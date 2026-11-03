<?php
/**
 * HyperUR - Telegram Bot & Quick Serial Activation API
 * Endpoint: GET/POST /check_serial2.php?serial=XXXXX[&device=YYY&email=ZZZ&time=unlimited]
 *
 * Tương thích 100% với HyperUR Telegram Bot:
 *   - Gọi trực tiếp: https://hyperur.io.vn/check_serial2.php?serial=MÃ_SERIAL
 *   - Nhận diện cả 'trial' / '36days' -> tự tính hạn 36 ngày
 *   - Trả về JSON hoặc text SUCCESS để bot Telegram nhận diện ngay lập tức
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (php_sapi_name() === 'cli') {
    $_SERVER['REQUEST_METHOD'] = 'GET';
    parse_str($argv[1] ?? '', $_GET);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/api/config.php';

// Helpers
function bot_api_res($success, $message, $data = null, $code = 200) {
    http_response_code($code);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data'    => $data
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// 1. Nhận dữ liệu
$params = $_GET;
if (empty($params['serial']) && !empty($_POST['serial'])) {
    $params = $_POST;
}
if (empty($params['serial'])) {
    $jsonBody = json_decode(file_get_contents('php://input'), true);
    if (is_array($jsonBody)) {
        $params = array_merge($params, $jsonBody);
    }
}

$serial = strtoupper(trim($params['serial'] ?? ''));
$device = trim($params['device'] ?? ($params['codename'] ?? 'Mobile'));
$email  = strtolower(trim($params['email'] ?? ($params['gmail'] ?? 'hyperur2026@gmail.com')));
$timeRaw = strtolower(trim($params['time'] ?? 'unlimited'));

// 2. Validate serial
if (empty($serial)) {
    bot_api_res(false, 'Thiếu tham số serial', null, 400);
}

// Làm sạch serial (chỉ giữ chữ và số)
$cleanSerial = preg_replace('/[^A-Z0-9]/', '', $serial);
if (strlen($cleanSerial) < 4 || strlen($cleanSerial) > 32) {
    bot_api_res(false, 'Serial không hợp lệ (4-32 ký tự)', ['received' => $serial], 400);
}
$serial = $cleanSerial;

// Tính toán thời gian
$timeStore = 'unlimited';
if ($timeRaw === 'trial' || $timeRaw === '36' || $timeRaw === '36days' || strpos($timeRaw, 'thử') !== false) {
    $timeStore = date('Y-m-d', strtotime('+36 days'));
} elseif ($timeRaw !== 'unlimited' && $timeRaw !== 'lifetime') {
    $timeStore = $params['time'];
}

// 3. Kết nối Database
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    bot_api_res(false, 'Kết nối database thất bại: ' . $conn->connect_error, null, 500);
}
$conn->set_charset('utf8mb4');

// 4. Kiểm tra xem serial đã có trong bảng `serial` chưa
$chk = $conn->prepare("SELECT STT, Device, Serial, Gmail, Time FROM serial WHERE LOWER(Serial) = LOWER(?) LIMIT 1");
$chk->bind_param('s', $serial);
$chk->execute();
$existing = $chk->get_result()->fetch_assoc();
$chk->close();

if ($existing) {
    $curTime = strtolower(trim($existing['Time'] ?? ''));
    if ($curTime !== 'pending') {
        $conn->close();
        // Đã có trong DB -> Trả về success=true để Bot Telegram xác nhận kích hoạt thành công
        bot_api_res(true, 'Serial đã được kích hoạt trước đó', [
            'stt'    => (int)$existing['STT'],
            'serial' => $existing['Serial'],
            'device' => $existing['Device'],
            'email'  => $existing['Gmail'],
            'time'   => $existing['Time'],
            'status' => 'Active'
        ]);
    } else {
        // Đang là pending -> Cập nhật kích hoạt thành công
        $upd = $conn->prepare("UPDATE serial SET Device = ?, Gmail = ?, Time = ? WHERE STT = ?");
        $upd->bind_param('sssi', $device, $email, $timeStore, $existing['STT']);
        $upd->execute();
        $upd->close();

        @$conn->query("UPDATE registrations SET status = 'Active', activated_at = NOW() WHERE LOWER(TRIM(serial)) = LOWER('{$serial}')");
        $conn->close();

        bot_api_res(true, 'Kích hoạt Serial thành công', [
            'stt'    => (int)$existing['STT'],
            'serial' => $existing['Serial'],
            'device' => $device,
            'email'  => $email,
            'time'   => $timeStore,
            'status' => 'Active'
        ]);
    }
}

// 5. Cấp STT mới (MAX(STT) + 1)
$maxRow = $conn->query("SELECT IFNULL(MAX(STT), 0) AS m FROM serial")->fetch_assoc();
$newStt = (int)$maxRow['m'] + 1;
while (true) {
    $test = $conn->prepare("SELECT STT FROM serial WHERE STT = ?");
    $test->bind_param('i', $newStt);
    $test->execute();
    $r = $test->get_result();
    $test->close();
    if ($r->num_rows === 0) break;
    $newStt++;
    if ($newStt > 10000000) break;
}

// 6. INSERT vào bảng `serial`
$ins = $conn->prepare("INSERT INTO serial (STT, Device, Serial, Gmail, Time) VALUES (?, ?, ?, ?, ?)");
$ins->bind_param('issss', $newStt, $device, $serial, $email, $timeStore);
if (!$ins->execute()) {
    $err = $ins->error;
    $ins->close();
    $conn->close();
    bot_api_res(false, 'Lỗi lưu bảng serial: ' . $err, null, 500);
}
$ins->close();

// 7. Đồng bộ sang bảng `registrations` nếu bảng tồn tại
$regStatus = 'Active';
$planName = ($timeStore === 'unlimited') ? 'Vĩnh Viễn (Telegram Bot)' : 'Active Free (36 ngày)';
$expDate = ($timeStore === 'unlimited') ? null : date('Y-m-d H:i:s', strtotime('+36 days'));

@$conn->query("
    INSERT INTO registrations (serial, codename, plan, payment_method, sender_name, sender_email, transaction_code, status, activated_at, expired_at)
    VALUES ('{$serial}', '{$conn->real_escape_string($device)}', '{$planName}', 'Telegram Bot', 'Bot User', '{$conn->real_escape_string($email)}', 'BOT-STT-{$newStt}', '{$regStatus}', NOW(), " . ($expDate ? "'{$expDate}'" : "NULL") . ")
    ON DUPLICATE KEY UPDATE status = 'Active', updated_at = NOW()
");

// 8. Ghi audit log vào `admin_logs`
$ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
$ua = substr($_SERVER['HTTP_USER_AGENT'] ?? 'Telegram-Bot', 0, 500);
$logDesc = "Telegram Bot kích hoạt serial {$serial} ({$device})";
$newData = json_encode([
    'stt'    => $newStt,
    'serial' => $serial,
    'device' => $device,
    'email'  => $email,
    'time'   => $timeStore
], JSON_UNESCAPED_UNICODE);

try {
    $conn->query("
        INSERT INTO admin_logs (admin_id, username, action, table_name, record_id, description, new_data, ip_address, user_agent)
        VALUES (NULL, 'telegram_bot', 'bot_activate', 'serial', '{$newStt}', '{$conn->real_escape_string($logDesc)}', '{$conn->real_escape_string($newData)}', '{$conn->real_escape_string($ip)}', '{$conn->real_escape_string($ua)}')
    ");
} catch (\Throwable $e) {
    // Không chặn luồng kích hoạt nếu ghi log admin thất bại
}

$conn->close();

// 9. Phản hồi thành công
bot_api_res(true, 'Kích hoạt serial thành công', [
    'stt'    => $newStt,
    'serial' => $serial,
    'device' => $device,
    'email'  => $email,
    'time'   => $timeStore,
    'status' => 'Active'
]);
