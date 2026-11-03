<?php
/**
 * ============================================================
 *  E2E test client cho SePay webhook
 * ============================================================
 *  Gọi webhook qua HTTP THẬT với HMAC-SHA256 thật, rồi kiểm tra
 *  trạng thái DB để chắc chắn: xác thực, chống trùng, bóc serial,
 *  kích hoạt registrations + serial đều đúng.
 *
 *  Yêu cầu: server đã chạy (xem scripts/run-sepay-e2e.ps1)
 *  Chạy:    php scripts/sepay-e2e/client.php
 * ============================================================
 */

$BASE_URL = $argv[1] ?? 'http://127.0.0.1:8899/payment-webhook.php';
$SECRET   = 'test_secret_key_1234567890';

$dbHost = '127.0.0.1';
$dbUser = 'root';
$dbPass = '';
$dbName = 'hyperur_sepay_test';

$fail = 0;
$pass = 0;

function ok($cond, $label, $detail = '')
{
    global $fail, $pass;
    if ($cond) {
        $pass++;
        echo "PASS  {$label}\n";
    } else {
        $fail++;
        echo "FAIL  {$label}" . ($detail !== '' ? "  -> {$detail}" : '') . "\n";
    }
}

// ------------------------------------------------------------
// Gửi webhook với chữ ký HMAC hợp lệ
// ------------------------------------------------------------
function send_webhook($url, $secret, $payload, $opts = [])
{
    $body = is_string($payload) ? $payload : json_encode($payload);

    $timestamp = $opts['timestamp'] ?? time();
    $signature = $opts['signature'] ?? ('sha256=' . hash_hmac('sha256', $timestamp . '.' . $body, $secret));
    $omitSig   = $opts['omit_signature'] ?? false;

    $headers = ['Content-Type: application/json'];
    if (!$omitSig) {
        $headers[] = 'X-SePay-Signature: ' . $signature;
    }
    if (!($opts['omit_timestamp'] ?? false)) {
        $headers[] = 'X-SePay-Timestamp: ' . $timestamp;
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    return [
        'http' => $code,
        'raw'  => $res,
        'json' => json_decode((string)$res, true),
        'err'  => $err,
    ];
}

// ------------------------------------------------------------
// Kết nối DB test
// ------------------------------------------------------------
// Không throw exception để test tự báo lỗi rõ ràng hơn
mysqli_report(MYSQLI_REPORT_OFF);

$db = new mysqli($dbHost, $dbUser, $dbPass, $dbName);
if ($db->connect_error) {
    fwrite(STDERR, "Không kết nối được DB test: {$db->connect_error}\n");
    exit(1);
}
$db->set_charset('utf8mb4');

function q1($db, $sql)
{
    $rs = $db->query($sql);
    if (!$rs) {
        return null;
    }
    $row = $rs->fetch_assoc();
    return $row;
}

// ------------------------------------------------------------
// Dữ liệu test: 1 đơn Pending đã đăng ký trước
// ------------------------------------------------------------
$db->query("DELETE FROM payment_transactions");
$db->query("DELETE FROM registrations WHERE serial IN ('TSTSERIAL1','TSTSERIAL2','TSTSERIAL3')");
$db->query("DELETE FROM serial WHERE Serial IN ('TSTSERIAL1','TSTSERIAL2','TSTSERIAL3')");

$db->query("
    INSERT INTO registrations
        (serial, codename, plan, payment_method, sender_name, sender_email,
         transaction_code, status, activated_at, expired_at)
    VALUES
        ('TSTSERIAL1', 'alioth', 'Đăng kí có Ủng hộ (Vĩnh viễn)', 'Chuyển Khoản VietQR (24/7)',
         '', 'buyer1@test.com', '', 'Pending', NULL, NULL)
");
ok($db->affected_rows === 1, 'Chuẩn bị: tạo đơn Pending TSTSERIAL1');

echo "\n--- NHÓM 1: XÁC THỰC ---\n";

// 1.1 Không có chữ ký
$r = send_webhook($BASE_URL, $SECRET, ['id' => 1], ['omit_signature' => true]);
ok($r['http'] === 401, 'Thiếu chữ ký -> 401', 'http=' . $r['http']);

// 1.2 Chữ ký sai
$r = send_webhook($BASE_URL, $SECRET, ['id' => 2], ['signature' => 'sha256=deadbeef']);
ok($r['http'] === 401, 'Chữ ký sai -> 401', 'http=' . $r['http']);

// 1.3 Timestamp cũ (replay)
$r = send_webhook($BASE_URL, $SECRET, ['id' => 3], ['timestamp' => time() - 4000]);
ok($r['http'] === 401, 'Timestamp cũ -> 401 (chống replay)', 'http=' . $r['http']);

// 1.4 Không có timestamp
$r = send_webhook($BASE_URL, $SECRET, ['id' => 4], ['omit_timestamp' => true]);
ok($r['http'] === 401, 'Thiếu timestamp -> 401', 'http=' . $r['http']);

// 1.5 DB không được ghi bởi các request bị từ chối
$row = q1($db, "SELECT COUNT(*) AS c FROM payment_transactions");
ok((int)$row['c'] === 0, 'Request bị từ chối không ghi vào DB', 'count=' . $row['c']);

echo "\n--- NHÓM 2: GIAO DỊCH HỢP LỆ ---\n";

// 2.1 Tiền vào đúng, khớp serial trong registrations
$r = send_webhook($BASE_URL, $SECRET, [
    'id'               => 92704,
    'gateway'          => 'MBBank',
    'transactionDate'  => '2026-11-03 15:30:00',
    'accountNumber'    => '0379050602',
    'code'             => '',
    'content'          => 'UR alioth TSTSERIAL1 buyer1@test.com',
    'transferType'     => 'in',
    'description'      => 'NGUYEN VAN A chuyen tien',
    'transferAmount'   => 50000,
    'accumulated'      => 50000,
    'referenceCode'    => 'FT2600001',
]);
ok($r['http'] === 200, 'HTTP 200', 'http=' . $r['http']);
ok(($r['json']['success'] ?? false) === true, 'Body có success=true (SePay không retry)', json_encode($r['json']));
ok(($r['json']['matched'] ?? false) === true, 'matched=true', json_encode($r['json']));
ok(($r['json']['serial'] ?? '') === 'TSTSERIAL1', 'Trả về đúng serial', $r['json']['serial'] ?? '');
ok(($r['json']['regUpdated'] ?? false) === true, 'Đã cập nhật registrations');
ok(($r['json']['serialInserted'] ?? false) === true, 'Đã chèn vào bảng serial');

// 2.2 Kiểm tra DB: registrations -> Active
$reg = q1($db, "SELECT status, transaction_code, activated_at, expired_at FROM registrations WHERE serial='TSTSERIAL1'");
ok($reg['status'] === 'Active', 'registrations.status = Active', $reg['status']);
ok(strpos((string)$reg['transaction_code'], 'SEPAY-92704') === 0, 'transaction_code = SEPAY-92704', (string)$reg['transaction_code']);
ok($reg['activated_at'] !== null, 'activated_at đã set');
ok($reg['expired_at'] === null, 'expired_at = NULL (vĩnh viễn)', (string)$reg['expired_at']);

// 2.3 Kiểm tra DB: bảng serial có bản ghi
$ser = q1($db, "SELECT STT, Device, Serial, Gmail, Time FROM serial WHERE Serial='TSTSERIAL1'");
ok($ser !== null, 'Đã thêm vào bảng serial (bảng quyết định bản quyền)');
ok(($ser['Time'] ?? '') === 'unlimited', 'serial.Time = unlimited', (string)($ser['Time'] ?? ''));
ok(($ser['Device'] ?? '') === 'alioth', 'serial.Device lấy từ codename', (string)($ser['Device'] ?? ''));
ok(($ser['Gmail'] ?? '') === 'buyer1@test.com', 'serial.Gmail lấy từ email đơn', (string)($ser['Gmail'] ?? ''));

// 2.4 Bảng giao dịch
$tx = q1($db, "SELECT status, matched_serial, matched_email FROM payment_transactions WHERE sepay_id=92704");
ok(($tx['status'] ?? '') === 'matched', 'payment_transactions.status = matched', (string)($tx['status'] ?? ''));
ok(($tx['matched_serial'] ?? '') === 'TSTSERIAL1', 'Lưu matched_serial', (string)($tx['matched_serial'] ?? ''));

// 2.5 Audit log
$log = q1($db, "SELECT action, username FROM admin_logs WHERE record_id='TSTSERIAL1' AND action='payment_activate' ORDER BY id DESC LIMIT 1");
ok($log !== null, 'Đã ghi admin_logs (audit)');
ok(($log['username'] ?? '') === 'sepay_webhook', 'admin_logs.username = sepay_webhook', (string)($log['username'] ?? ''));

echo "\n--- NHÓM 3: CHỐNG TRÙNG (SePay retry) ---\n";

$before = q1($db, "SELECT COUNT(*) AS c FROM serial");
$r = send_webhook($BASE_URL, $SECRET, [
    'id'             => 92704,   // cùng id
    'gateway'        => 'MBBank',
    'content'        => 'UR alioth TSTSERIAL1 buyer1@test.com',
    'transferType'   => 'in',
    'transferAmount' => 50000,
]);
$after = q1($db, "SELECT COUNT(*) AS c FROM serial");

ok($r['http'] === 200, 'Retry cùng id -> HTTP 200', 'http=' . $r['http']);
ok(($r['json']['duplicate'] ?? false) === true, 'Báo duplicate=true', json_encode($r['json']));
ok((int)$before['c'] === (int)$after['c'], 'Không tạo thêm bản ghi serial', "{$before['c']} -> {$after['c']}");

echo "\n--- NHÓM 4: CÁC TRƯỜNG HỢP KHÔNG KÍCH HOẠT ---\n";

// 4.1 Tiền ra (transferType = out)
$r = send_webhook($BASE_URL, $SECRET, [
    'id'             => 50001,
    'content'        => 'UR alioth TSTSERIAL2 x@test.com',
    'transferType'   => 'out',
    'transferAmount' => 50000,
]);
ok($r['http'] === 200, 'Tiền ra -> 200 (bỏ qua)', 'http=' . $r['http']);

// 4.2 Tiền vào không đủ
$db->query("
    INSERT INTO registrations (serial, codename, plan, sender_email, status)
    VALUES ('TSTSERIAL2', 'alioth', 'Test', 'buyer2@test.com', 'Pending')
");
$r = send_webhook($BASE_URL, $SECRET, [
    'id'             => 50002,
    'content'        => 'UR alioth TSTSERIAL2 buyer2@test.com',
    'transferType'   => 'in',
    'transferAmount' => 5000,   // < 20000
]);
ok($r['http'] === 200, 'Tiền chưa đủ -> 200', 'http=' . $r['http']);
ok(($r['json']['matched'] ?? true) === false, 'Tiền chưa đủ -> matched=false', json_encode($r['json']));

$reg2 = q1($db, "SELECT status FROM registrations WHERE serial='TSTSERIAL2'");
ok($reg2['status'] === 'Pending', 'Tiền chưa đủ -> KHÔNG kích hoạt (vẫn Pending)', $reg2['status']);
$ser2 = q1($db, "SELECT COUNT(*) AS c FROM serial WHERE Serial='TSTSERIAL2'");
ok((int)$ser2['c'] === 0, 'Tiền chưa đủ -> không thêm vào bảng serial', 'count=' . $ser2['c']);

// 4.3 Nội dung không có serial
$r = send_webhook($BASE_URL, $SECRET, [
    'id'             => 50003,
    'content'        => 'chuyen tien mua rom',
    'transferType'   => 'in',
    'transferAmount' => 50000,
]);
ok($r['http'] === 200, 'Không khớp serial -> 200 (không retry)', 'http=' . $r['http']);
ok(($r['json']['matched'] ?? true) === false, 'Không khớp -> matched=false', json_encode($r['json']));

$tx3 = q1($db, "SELECT status FROM payment_transactions WHERE sepay_id=50003");
ok(($tx3['status'] ?? '') === 'unmatched', 'Ghi lại giao dịch không khớp để admin soi', (string)($tx3['status'] ?? ''));

echo "\n--- NHÓM 5: SERIAL ĐÃ CÓ SẴN ---\n";

$db->query("INSERT INTO serial (STT, Device, Serial, Gmail, Time) VALUES (999001, 'vangogh', 'TSTSERIAL3', 'old@test.com', 'unlimited')");
$r = send_webhook($BASE_URL, $SECRET, [
    'id'             => 50004,
    'content'        => 'UR vangogh TSTSERIAL3 old@test.com',
    'transferType'   => 'in',
    'transferAmount' => 50000,
]);
ok($r['http'] === 200, 'Serial đã tồn tại -> 200', 'http=' . $r['http']);
ok(($r['json']['serialInserted'] ?? true) === false, 'Không chèn trùng bản ghi serial', json_encode($r['json']));

$cnt = q1($db, "SELECT COUNT(*) AS c FROM serial WHERE Serial='TSTSERIAL3'");
ok((int)$cnt['c'] === 1, 'Chỉ có 1 bản ghi TSTSERIAL3', 'count=' . $cnt['c']);

echo "\n--- NHÓM 6: HEALTH CHECK & METHOD ---\n";

$ch = curl_init($BASE_URL);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$hj = json_decode((string)$res, true);
ok($code === 200, 'GET health-check -> 200', 'http=' . $code);
ok(($hj['success'] ?? false) === true, 'Health-check success=true');
ok(($hj['hmacConfigured'] ?? false) === true, 'Health-check báo đã cấu hình HMAC');

$ch = curl_init($BASE_URL);
curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => 'PUT', CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
ok($code === 405, 'Method khác POST/GET -> 405', 'http=' . $code);

// ------------------------------------------------------------
// Tổng kết
// ------------------------------------------------------------
$db->close();

echo "\n==============================================\n";
echo "PASS: {$pass}   FAIL: {$fail}\n";
echo "==============================================\n";
exit($fail === 0 ? 0 : 1);
