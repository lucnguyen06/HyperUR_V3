<?php
/**
 * ============================================================
 *  HyperUR V3 - SePay Payment Webhook (tự động kích hoạt)
 * ============================================================
 *  URL cấu hình trên SePay Dashboard:
 *      https://hyperur.io.vn/api/payment-webhook.php
 *
 *  Sự kiện chọn: "Có tiền vào"  (transferType = 'in')
 *  Bảo mật chọn: HMAC-SHA256 (khuyến nghị) hoặc API Key
 *
 *  Luồng xử lý:
 *    1. Xác thực HMAC-SHA256 (X-SePay-Signature + X-SePay-Timestamp)
 *       hoặc API Key (Authorization: Apikey xxx)
 *    2. Chống trùng giao dịch theo `id` -> UNIQUE(sepay_id)
 *    3. Bóc tách SERIAL từ nội dung chuyển khoản
 *       (cú pháp website sinh ra: "UR <codename> <serial> <email>")
 *    4. Khớp bảng `registrations` -> status = 'Active'
 *    5. Ghi vào bảng `serial` để trang tra cứu nhận diện bản quyền
 *    6. Ghi audit log + thông báo Telegram (nếu có cấu hình)
 *
 *  Hằng số khai báo trong api/config.php (xem config.example.php):
 *    SEPAY_WEBHOOK_SECRET  - Secret Key khi chọn HMAC-SHA256
 *    SEPAY_API_KEY         - API Key khi chọn phương thức Apikey
 *    SEPAY_MIN_AMOUNT      - Số tiền tối thiểu để coi là thanh toán hợp lệ
 *    SEPAY_DEFAULT_EMAIL   - Email mặc định khi không đọc được từ nội dung CK
 *    SEPAY_IP_ALLOW        - (tuỳ chọn) Danh sách IP được phép, cách nhau dấu phẩy
 *    TELEGRAM_BOT_TOKEN    - (tuỳ chọn) token bot để thông báo
 *    TELEGRAM_ADMIN_CHAT_ID- (tuỳ chọn) chat_id nhận thông báo
 *
 *  Quy ước phản hồi với SePay:
 *    - 200/201 + {"success": true}  => SePay coi là thành công, không retry
 *    - Mã lỗi / body khác           => SePay retry (tối đa 7 lần / 5 giờ)
 *    Vì vậy lỗi nghiệp vụ (không khớp serial, thiếu tiền) vẫn trả
 *    success = true để tránh retry vô ích; chỉ trả lỗi khi hệ thống
 *    thực sự gặp sự cố (DB chết, chưa cấu hình khoá...).
 * ============================================================
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, max-age=0');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/_sepay-lib.php';

// ============================================================
// 1. Helper: phản hồi JSON & dừng
// ============================================================
function sepay_respond($httpCode, $success, $message, $extra = [])
{
    http_response_code($httpCode);
    echo json_encode(array_merge([
        'success' => (bool)$success,
        'message' => $message,
    ], $extra), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ============================================================
// 2. Kiểm tra method & môi trường
// ============================================================
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// GET chỉ dùng để health-check, không lộ thông tin nhạy cảm
if ($method === 'GET') {
    sepay_respond(200, true, 'SePay webhook endpoint is alive', [
        'hmacConfigured' => sepay_cfg('SEPAY_WEBHOOK_SECRET', '') !== '',
        'apiKeyConfigured' => sepay_cfg('SEPAY_API_KEY', '') !== '',
    ]);
}

if ($method !== 'POST') {
    sepay_respond(405, false, 'Chỉ hỗ trợ phương thức POST');
}

// (Tuỳ chọn) whitelist IP của SePay
$ipAllow = trim((string)sepay_cfg('SEPAY_IP_ALLOW', ''));
if ($ipAllow !== '') {
    $remoteIp = $_SERVER['REMOTE_ADDR'] ?? '';
    $allowed = array_filter(array_map('trim', explode(',', $ipAllow)));
    if (!in_array($remoteIp, $allowed, true)) {
        error_log('[sepay-webhook] IP bị chặn: ' . $remoteIp);
        sepay_respond(403, false, 'IP không được phép');
    }
}

// ============================================================
// 4. Đọc RAW BODY (bắt buộc: HMAC ký trên bytes gốc)
// ============================================================
$rawBody = file_get_contents('php://input');
if ($rawBody === false || $rawBody === '') {
    sepay_respond(400, false, 'Body rỗng');
}

// ============================================================
// 5. Xác thực
// ============================================================
$secret  = (string)sepay_cfg('SEPAY_WEBHOOK_SECRET', '');
$apiKey  = (string)sepay_cfg('SEPAY_API_KEY', '');

if ($secret !== '') {
    // ---- Chế độ HMAC-SHA256 (khuyến nghị) ----
    $signature = $_SERVER['HTTP_X_SEPAY_SIGNATURE'] ?? '';
    $timestamp = (int)($_SERVER['HTTP_X_SEPAY_TIMESTAMP'] ?? 0);

    // Chống replay: lệch quá 5 phút thì từ chối
    if ($timestamp <= 0 || abs(time() - $timestamp) > 300) {
        error_log('[sepay-webhook] Timestamp lệch/thiếu: ' . $timestamp);
        sepay_respond(401, false, 'Request đã hết hạn');
    }

    $expected = 'sha256=' . hash_hmac('sha256', $timestamp . '.' . $rawBody, $secret);
    if (!hash_equals($expected, (string)$signature)) {
        error_log('[sepay-webhook] Sai chữ ký HMAC. Nhận: ' . substr((string)$signature, 0, 20) . '...');
        sepay_respond(401, false, 'Chữ ký không hợp lệ');
    }
} elseif ($apiKey !== '') {
    // ---- Chế độ API Key (dự phòng) ----
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    $provided = '';
    if (preg_match('/^Apikey\s+(.+)$/i', trim((string)$authHeader), $m)) {
        $provided = trim($m[1]);
    }
    if ($provided === '' || !hash_equals($apiKey, $provided)) {
        error_log('[sepay-webhook] Sai API Key');
        sepay_respond(401, false, 'API Key không hợp lệ');
    }
} else {
    // Chưa cấu hình xác thực -> từ chối toàn bộ (không nhận webhook không xác thực)
    error_log('[sepay-webhook] Chưa cấu hình SEPAY_WEBHOOK_SECRET hoặc SEPAY_API_KEY');
    sepay_respond(500, false, 'Webhook chưa được cấu hình khoá xác thực');
}

// ============================================================
// 6. Parse payload
// ============================================================
$payload = json_decode($rawBody, true);
if (!is_array($payload)) {
    sepay_respond(400, false, 'Payload không phải JSON hợp lệ');
}

$sepayId        = (int)($payload['id'] ?? 0);
$transferType   = strtolower(trim((string)($payload['transferType'] ?? '')));
$transferAmount = (int)round((float)($payload['transferAmount'] ?? 0));
$content        = trim((string)($payload['content'] ?? ''));
$descriptionRaw = trim((string)($payload['description'] ?? ''));
$gateway        = trim((string)($payload['gateway'] ?? ''));
$accountNumber  = trim((string)($payload['accountNumber'] ?? ''));
$referenceCode  = trim((string)($payload['referenceCode'] ?? ''));
$transactionDate = trim((string)($payload['transactionDate'] ?? ''));

if ($sepayId <= 0) {
    sepay_respond(400, false, 'Thiếu trường id giao dịch');
}

// Chỉ xử lý tiền vào
if ($transferType !== '' && $transferType !== 'in') {
    sepay_respond(200, true, 'Bỏ qua giao dịch tiền ra', ['sepayId' => $sepayId]);
}

// Nội dung đối soát: ưu tiên `content`, nếu rỗng dùng `description`
$matchText = $content !== '' ? $content : $descriptionRaw;

// ============================================================
// 7. Kết nối database
// ============================================================
mysqli_report(MYSQLI_REPORT_OFF);
$conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    error_log('[sepay-webhook] DB connect failed: ' . $conn->connect_error);
    sepay_respond(500, false, 'Không kết nối được database');
}
$conn->set_charset('utf8mb4');
@$conn->query("SET time_zone = '+07:00'");

/**
 * Tạo bảng `payment_transactions` nếu chưa có.
 * Bảng này là "sổ nhận tiền": vừa chống trùng giao dịch, vừa để admin
 * soi lại khi có khiếu nại "đã chuyển mà chưa kích hoạt".
 */
function sepay_ensure_tx_table($conn)
{
    @$conn->query("
        CREATE TABLE IF NOT EXISTS `payment_transactions` (
            `id`               INT AUTO_INCREMENT PRIMARY KEY,
            `sepay_id`         BIGINT       NOT NULL,
            `gateway`          VARCHAR(50)  DEFAULT NULL,
            `account_number`   VARCHAR(50)  DEFAULT NULL,
            `transfer_type`    VARCHAR(10)  DEFAULT NULL,
            `transfer_amount`  BIGINT       NOT NULL DEFAULT 0,
            `content`          VARCHAR(500) DEFAULT NULL,
            `description`      VARCHAR(500) DEFAULT NULL,
            `reference_code`   VARCHAR(100) DEFAULT NULL,
            `transaction_date` DATETIME     DEFAULT NULL,
            `matched_serial`   VARCHAR(50)  DEFAULT NULL,
            `matched_email`    VARCHAR(100) DEFAULT NULL,
            `status`           ENUM('matched','unmatched','ignored','error') DEFAULT 'unmatched',
            `note`             VARCHAR(255) DEFAULT NULL,
            `raw_payload`      LONGTEXT     DEFAULT NULL,
            `created_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_sepay_id` (`sepay_id`),
            INDEX `idx_serial`  (`matched_serial`),
            INDEX `idx_status`  (`status`),
            INDEX `idx_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}
sepay_ensure_tx_table($conn);

// ============================================================
// 8. Chống trùng giao dịch (SePay có thể gọi lại nhiều lần)
// ============================================================
$rawForDb       = sepay_cut($rawBody, 60000);
$contentForDb   = sepay_cut($content, 500);
$descForDb      = sepay_cut($descriptionRaw, 500);
$txDateForDb    = null;
if ($transactionDate !== '') {
    $ts = strtotime($transactionDate);
    if ($ts !== false) {
        $txDateForDb = date('Y-m-d H:i:s', $ts);
    }
}

$insTx = $conn->prepare("
    INSERT IGNORE INTO payment_transactions
        (sepay_id, gateway, account_number, transfer_type, transfer_amount,
         content, description, reference_code, transaction_date, status, raw_payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unmatched', ?)
");
if (!$insTx) {
    error_log('[sepay-webhook] prepare insert tx failed: ' . $conn->error);
    sepay_respond(500, false, 'Lỗi chuẩn bị ghi giao dịch');
}

$insTx->bind_param(
    'isssisssss',
    $sepayId,
    $gateway,
    $accountNumber,
    $transferType,
    $transferAmount,
    $contentForDb,
    $descForDb,
    $referenceCode,
    $txDateForDb,
    $rawForDb
);

if (!$insTx->execute()) {
    error_log('[sepay-webhook] insert tx failed: ' . $insTx->error);
    $insTx->close();
    sepay_respond(500, false, 'Lỗi ghi giao dịch');
}

$isDuplicate = ($insTx->affected_rows === 0);
$insTx->close();

if ($isDuplicate) {
    // Giao dịch đã từng được ghi nhận. NHƯNG không được trả success ngay:
    // nếu lần xử lý trước bị lỗi giữa chừng (DB timeout, fatal, deploy...)
    // thì status vẫn là 'unmatched' và serial CHƯA được kích hoạt.
    // Trả success ngay lúc này = tiền đã nhận nhưng vĩnh viễn không kích hoạt.
    $prev = $conn->prepare("SELECT status FROM payment_transactions WHERE sepay_id = ? LIMIT 1");
    $prevStatus = '';
    if ($prev) {
        $prev->bind_param('i', $sepayId);
        $prev->execute();
        $prevRow = $prev->get_result()->fetch_assoc();
        $prevStatus = (string)($prevRow['status'] ?? '');
        $prev->close();
    }

    if ($prevStatus === 'matched') {
        // Đã xử lý xong thực sự -> báo trùng để SePay thôi retry
        $conn->close();
        sepay_respond(200, true, 'Giao dịch đã được xử lý trước đó', [
            'sepayId'   => $sepayId,
            'duplicate' => true,
        ]);
    }

    // Lần trước chưa hoàn tất -> chạy lại phần kích hoạt (idempotent:
    // đã kiểm tra tồn tại ở cả registrations và serial trước khi ghi)
    error_log('[sepay-webhook] Retry cho giao dịch chưa hoàn tất: ' . $sepayId . ' (status cũ: ' . $prevStatus . ')');
}

/** Cập nhật trạng thái giao dịch đã ghi */
function sepay_finalize_tx($conn, $sepayId, $status, $serial, $email, $note)
{
    $upd = $conn->prepare("
        UPDATE payment_transactions
           SET status = ?, matched_serial = ?, matched_email = ?, note = ?
         WHERE sepay_id = ?
         LIMIT 1
    ");
    if ($upd) {
        $upd->bind_param('ssssi', $status, $serial, $email, $note, $sepayId);
        $upd->execute();
        $upd->close();
    }
}

// ============================================================
// 9. Bóc tách SERIAL từ nội dung chuyển khoản
//    Cú pháp website sinh ra:  "UR <codename> <serial> <email>"
//    Việc chấm điểm / xếp hạng nằm trong api/_sepay-lib.php
//    (sepay_serial_candidates) để test được độc lập.
// ============================================================
$candidateSerials = sepay_serial_candidates($matchText, 10);

// ============================================================
// 10. Đối chiếu với bảng `registrations` / `serial`
// ============================================================
$matchedSerial = null;
$matchedEmail  = null;
$regRow        = null;

foreach ($candidateSerials as $candidate) {
    // 10a. Tìm trong registrations (đơn đăng ký từ website)
    $stmt = $conn->prepare("
        SELECT id, serial, codename, plan, sender_email, status
          FROM registrations
         WHERE UPPER(TRIM(serial)) = ?
         LIMIT 1
    ");
    if ($stmt) {
        $stmt->bind_param('s', $candidate);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if ($row) {
            $matchedSerial = strtoupper(trim($row['serial']));
            $matchedEmail  = strtolower(trim($row['sender_email']));
            $regRow        = $row;
            break;
        }
    }

    // 10b. Không có trong registrations -> kiểm tra serial đã có sẵn trong `serial`
    $stmt = $conn->prepare("
        SELECT STT, Serial, Gmail FROM serial WHERE UPPER(TRIM(Serial)) = ? LIMIT 1
    ");
    if ($stmt) {
        $stmt->bind_param('s', $candidate);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if ($row) {
            $matchedSerial = strtoupper(trim($row['Serial']));
            $matchedEmail  = strtolower(trim($row['Gmail']));
            break;
        }
    }
}

// Số tiền tối thiểu để coi là thanh toán hợp lệ.
// ⚠️ Mặc định 40.000đ = MỨC GIÁ THẤP NHẤT của website
//    (serial.js: 1-30 thiết bị = 50.000đ, từ 31 thiết bị = 40.000đ).
//    Đặt cao hơn giá thật -> khách trả đủ vẫn bị chặn.
//    Đặt thấp hơn -> khách trả thiếu vẫn được kích hoạt (thất thoát).
//    Nếu sau này đổi bảng giá, PHẢI cập nhật cả hằng số này.
$minAmount = (int)sepay_cfg('SEPAY_MIN_AMOUNT', 40000);
$amountOk  = ($transferAmount >= $minAmount);

// Trường hợp không tìm thấy serial trong hệ thống
if ($matchedSerial === null) {
    sepay_finalize_tx($conn, $sepayId, 'unmatched', null, null, 'Không khớp serial trong nội dung CK');

    $note = "⚠️ Tiền vào KHÔNG khớp serial\n"
          . "Số tiền: " . number_format($transferAmount) . "đ\n"
          . "Nội dung: " . ($matchText !== '' ? $matchText : '(trống)')
          . "\nMã GD: " . $sepayId;
    sepay_notify_telegram($note);

    $conn->close();
    sepay_respond(200, true, 'Đã ghi nhận nhưng không khớp serial nào', [
        'sepayId' => $sepayId,
        'matched' => false,
    ]);
}

// ============================================================
// 11. Kích hoạt
// ============================================================
$regUpdated     = false;
$serialInserted = false;
$serialExisted  = false;

if (!$amountOk) {
    // Tiền chưa đủ -> chỉ ghi nhận, KHÔNG kích hoạt, báo admin xử lý tay
    sepay_finalize_tx(
        $conn,
        $sepayId,
        'unmatched',
        $matchedSerial,
        $matchedEmail,
        sepay_cut('Số tiền ' . number_format($transferAmount) . 'đ < tối thiểu ' . number_format($minAmount) . 'đ', 250)
    );

    $conn->close();
    sepay_notify_telegram(
        "⚠️ TIỀN VÀO CHƯA ĐỦ - SePay\n"
        . "Serial: {$matchedSerial}\n"
        . "Email: {$matchedEmail}\n"
        . "Số tiền: " . number_format($transferAmount) . "đ (tối thiểu " . number_format($minAmount) . "đ)\n"
        . "Nội dung: " . ($matchText !== '' ? $matchText : '(trống)')
        . "\nGD #{$sepayId} • {$gateway}\n"
        . "Chưa kích hoạt, cần admin kiểm tra tay."
    );

    sepay_respond(200, true, 'Đã ghi nhận, số tiền chưa đủ để kích hoạt', [
        'sepayId' => $sepayId,
        'matched' => false,
        'amount'  => $transferAmount,
    ]);
}

// 11a. Cập nhật bảng registrations -> Active
//      (chỉ khi serial này có đơn đăng ký trên website)
if ($regRow) {
    $updReg = $conn->prepare("
        UPDATE registrations
           SET status           = ?,
               activated_at     = NOW(),
               expired_at       = NULL,
               payment_method   = 'SePay (Chuyển khoản tự động)',
               transaction_code = ?,
               updated_at       = NOW()
         WHERE id = ?
         LIMIT 1
    ");
    if ($updReg) {
        $transCode    = 'SEPAY-' . $sepayId;
        $regId        = (int)$regRow['id'];
        $statusActive = 'Active';
        $updReg->bind_param('ssi', $statusActive, $transCode, $regId);
        if ($updReg->execute()) {
            $regUpdated = true;
        } else {
            error_log('[sepay-webhook] update registrations failed: ' . $updReg->error);
        }
        $updReg->close();
    }
}

// 11b. Ghi vào bảng `serial` (bảng quyết định bản quyền khi tra cứu)
//
// ⚠️ Phải kiểm tra bảng `serial` một cách ĐỘC LẬP, không dựa vào
//    $alreadyActive ở bước 10. Lý do:
//    - Bước 10 dừng ngay khi tìm thấy serial trong `registrations`,
//      nên nếu serial đã được kích hoạt trước đó (có ở CẢ 2 bảng) thì
//      $alreadyActive vẫn = false -> sẽ INSERT trùng bản ghi.
//    - Bảng `serial` KHÔNG có UNIQUE(Serial) nên DB không tự chặn.
//    => Trường hợp user chuyển khoản lần 2 là hoàn toàn có thật.
$chkExist = $conn->prepare("SELECT STT FROM serial WHERE UPPER(TRIM(Serial)) = ? LIMIT 1");
$serialExisted = false;
if ($chkExist) {
    $chkExist->bind_param('s', $matchedSerial);
    $chkExist->execute();
    $serialExisted = $chkExist->get_result()->num_rows > 0;
    $chkExist->close();
}

if (!$serialExisted) {
    // Lấy STT mới = MAX(STT) + 1, tự nhảy qua số đã dùng
    $maxRow = $conn->query("SELECT IFNULL(MAX(STT), 0) AS m FROM serial")->fetch_assoc();
    $newStt = (int)$maxRow['m'] + 1;

    $codename = $regRow ? trim($regRow['codename']) : 'Mobile';
    if ($codename === '') {
        $codename = 'Mobile';
    }
    $codename = sepay_cut($codename, 50);

    $gmail = $matchedEmail !== '' ? $matchedEmail : (string)sepay_cfg('SEPAY_DEFAULT_EMAIL', 'hyperur2026@gmail.com');
    $gmail = sepay_cut($gmail, 100);

    // Time = unlimited (thanh toán 1 lần -> vĩnh viễn, đúng chính sách website)
    $timeStore = 'unlimited';

    $guard = 0;
    while (true) {
        $chk = $conn->prepare("SELECT STT FROM serial WHERE STT = ? LIMIT 1");
        if (!$chk) {
            break;
        }
        $chk->bind_param('i', $newStt);
        $chk->execute();
        $exists = $chk->get_result()->num_rows > 0;
        $chk->close();
        if (!$exists) {
            break;
        }
        $newStt++;
        if (++$guard > 1000) {
            break;
        }
    }

    $insSerial = $conn->prepare("
        INSERT INTO serial (STT, Device, Serial, Gmail, Time)
        VALUES (?, ?, ?, ?, ?)
    ");
    if ($insSerial) {
        $insSerial->bind_param('issss', $newStt, $codename, $matchedSerial, $gmail, $timeStore);
        if ($insSerial->execute()) {
            $serialInserted = true;
        } else {
            error_log('[sepay-webhook] insert serial failed: ' . $insSerial->error);
        }
        $insSerial->close();
    }
}

// 11c. Ghi audit log (admin_logs) để soi lại về sau
$logDesc = "SePay tự động kích hoạt serial {$matchedSerial} - " . number_format($transferAmount) . "đ (GD #{$sepayId})";
$newData = json_encode([
    'sepay_id'      => $sepayId,
    'serial'        => $matchedSerial,
    'email'         => $matchedEmail,
    'amount'        => $transferAmount,
    'gateway'       => $gateway,
    'content'       => $matchText,
    'reg_updated'   => $regUpdated,
    'serial_added'  => $serialInserted,
], JSON_UNESCAPED_UNICODE);

try {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'sepay';
    $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? 'SePay-Webhook', 0, 500);
    $logStmt = $conn->prepare("
        INSERT INTO admin_logs
            (admin_id, username, action, table_name, record_id, description, new_data, ip_address, user_agent)
        VALUES (0, 'sepay_webhook', 'payment_activate', 'serial', ?, ?, ?, ?, ?)
    ");
    if ($logStmt) {
        $recordId = (string)$matchedSerial;
        $logStmt->bind_param('sssss', $recordId, $logDesc, $newData, $ip, $ua);
        $logStmt->execute();
        $logStmt->close();
    }
} catch (\Throwable $e) {
    error_log('[sepay-webhook] write admin_logs failed: ' . $e->getMessage());
}

// 11d. Chốt trạng thái giao dịch
$finalNote = 'Kích hoạt OK'
    . ($serialInserted ? ' (thêm mới bảng serial)' : ($serialExisted ? ' (serial đã có sẵn)' : ''));
sepay_finalize_tx($conn, $sepayId, 'matched', $matchedSerial, $matchedEmail, sepay_cut($finalNote, 250));

// 11e. Tự động tăng lượt giao dịch xoay QR VietQR (mỗi 5 giao dịch đổi tài khoản)
try {
    @$conn->query("
        INSERT INTO `system_settings` (`setting_key`, `setting_value`)
        VALUES ('qr_rotation_count', '1')
        ON DUPLICATE KEY UPDATE `setting_value` = CAST(`setting_value` AS UNSIGNED) + 1
    ");
} catch (\Throwable $e) {}

$conn->close();

// ============================================================
// 12. Thông báo Telegram cho admin
// ============================================================
$tgMsg = "✅ TIỀN VÀO - SePay\n"
       . "Serial: {$matchedSerial}\n"
       . "Email: {$matchedEmail}\n"
       . "Số tiền: " . number_format($transferAmount) . "đ\n"
       . "Nội dung: " . ($matchText !== '' ? $matchText : '(trống)')
       . "\nGD #{$sepayId} • {$gateway}"
       . "\nĐã TỰ ĐỘNG KÍCH HOẠT" . ($serialInserted ? ' (thêm mới)' : ' (đã có sẵn)');
sepay_notify_telegram($tgMsg);

// ============================================================
// 13. Phản hồi cho SePay
//     Tới đây luôn là nhánh tiền đã đủ (nhánh thiếu tiền đã return sớm).
// ============================================================
sepay_respond(200, true, 'Đã kích hoạt serial', [
    'sepayId'        => $sepayId,
    'matched'        => true,
    'serial'         => $matchedSerial,
    'email'          => $matchedEmail,
    'amount'         => $transferAmount,
    'serialInserted' => $serialInserted,
    'regUpdated'     => $regUpdated,
]);
