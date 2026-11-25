<?php
/**
 * HyperUR - Telegram Bot & Quick Serial Activation API
 * Endpoint: GET/POST /check_serial2.php?serial=XXXXX[&device=YYY&email=ZZZ&time=unlimited]
 *
 * Bảo mật:
 *   - Chạy qua CLI (Telegram Bot cùng server): cho phép trực tiếp.
 *   - Gọi qua HTTP: BẮT BUỘC xác thực token (fail-closed) qua `CHECK_SERIAL_TOKEN`
 *     (fallback `ADD_SERIAL_TOKEN` hoặc `API_SECRET`, từ chối placeholder `CHANGE_ME_*`).
 *     Truyền token qua header `X-API-Token`, `Authorization: Bearer <token>` hoặc tham số `token`.
 *   - Tuỳ chọn whitelist IP theo `REMOTE_ADDR` qua `CHECK_SERIAL_IP_ALLOW` / `ADD_SERIAL_IP_ALLOW`.
 */

$isCli = (php_sapi_name() === 'cli');

if ($isCli) {
    $_SERVER['REQUEST_METHOD'] = 'GET';
    parse_str($argv[1] ?? '', $_GET);
} else {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store, max-age=0');
}

require_once __DIR__ . '/api/config.php';

// Helpers
function bot_api_res($success, $message, $data = null, $code = 200) {
    if (php_sapi_name() !== 'cli') {
        http_response_code($code);
    }
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data'    => $data
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function bot_ip_in_cidr($ip, $cidr) {
    if (strpos($cidr, '/') === false) {
        return $ip === $cidr;
    }
    list($subnet, $bitsRaw) = explode('/', $cidr, 2);
    $bitsRaw = trim($bitsRaw);
    if ($bitsRaw === '') {
        $bits = 32;
    } elseif (!ctype_digit($bitsRaw)) {
        return false;
    } else {
        $bits = (int)$bitsRaw;
    }
    $ipLong     = ip2long($ip);
    $subnetLong = ip2long($subnet);
    if ($ipLong === false || $subnetLong === false || $bits < 0 || $bits > 32) {
        return false;
    }
    if ($bits === 0) {
        return true;
    }
    $mask = -1 << (32 - $bits);
    return ($ipLong & $mask) === ($subnetLong & $mask);
}

function bot_resolved_token() {
    // Cô lập secret theo thứ tự ưu tiên: dùng hằng hợp lệ ĐẦU TIÊN được khai báo
    foreach (['CHECK_SERIAL_TOKEN', 'ADD_SERIAL_TOKEN', 'API_SECRET'] as $constName) {
        if (defined($constName)) {
            $val = trim((string)constant($constName));
            if ($val !== '' && stripos($val, 'CHANGE_ME_') !== 0) {
                return $val;
            }
        }
    }
    return '';
}

function bot_parse_time_value($rawOriginal) {
    $rawOriginal = trim((string)$rawOriginal);
    $timeRaw = strtolower($rawOriginal);
    if ($timeRaw === 'unlimited' || $timeRaw === 'lifetime') {
        return ['valid' => true, 'store' => 'unlimited', 'expired_at' => null];
    }
    if ($timeRaw === 'trial' || $timeRaw === '36' || $timeRaw === '36days') {
        return [
            'valid'      => true,
            'store'      => date('Y-m-d', strtotime('+36 days')),
            'expired_at' => date('Y-m-d H:i:s', strtotime('+36 days')),
        ];
    }
    if (preg_match('/^(\d{2})(\d{2})(\d{4})$/', $rawOriginal, $m)) {
        if (checkdate((int)$m[2], (int)$m[1], (int)$m[3])) {
            $iso = "{$m[3]}-{$m[2]}-{$m[1]}";
            return ['valid' => true, 'store' => $iso, 'expired_at' => $iso . ' 23:59:59'];
        }
    }
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $rawOriginal, $m)) {
        if (checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
            return ['valid' => true, 'store' => $rawOriginal, 'expired_at' => $rawOriginal . ' 23:59:59'];
        }
    }
    return ['valid' => false, 'store' => null, 'expired_at' => null];
}

// 1. Nhận dữ liệu
$params = $_GET;
if (!empty($_POST)) {
    $params = array_merge($params, $_POST);
}
$rawInput = $isCli ? '' : file_get_contents('php://input');
if ($rawInput !== '' && $rawInput !== false) {
    $jsonBody = json_decode($rawInput, true);
    if (is_array($jsonBody)) {
        $params = array_merge($params, $jsonBody);
    }
}

// 2. Xác thực HTTP (fail-closed)
if (!$isCli) {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method !== 'GET' && $method !== 'POST') {
        bot_api_res(false, 'Chỉ hỗ trợ phương thức GET hoặc POST', null, 405);
    }

    // 2a. IP whitelist tuỳ chọn (chỉ tin REMOTE_ADDR)
    $ipAllowRaw = '';
    if (defined('CHECK_SERIAL_IP_ALLOW') && trim((string)CHECK_SERIAL_IP_ALLOW) !== '') {
        $ipAllowRaw = trim((string)CHECK_SERIAL_IP_ALLOW);
    } elseif (defined('ADD_SERIAL_IP_ALLOW') && trim((string)ADD_SERIAL_IP_ALLOW) !== '') {
        $ipAllowRaw = trim((string)ADD_SERIAL_IP_ALLOW);
    }
    if ($ipAllowRaw !== '') {
        $remoteIp = $_SERVER['REMOTE_ADDR'] ?? '';
        $ipOk = false;
        foreach (explode(',', $ipAllowRaw) as $cidr) {
            $cidr = trim($cidr);
            if ($cidr !== '' && bot_ip_in_cidr($remoteIp, $cidr)) {
                $ipOk = true;
                break;
            }
        }
        if (!$ipOk) {
            error_log('[check_serial2] IP bị chặn: ' . $remoteIp);
            bot_api_res(false, 'IP không được phép truy cập endpoint này', null, 403);
        }
    }

    // 2b. Token xác thực bắt buộc (ưu tiên CHECK_SERIAL_TOKEN -> ADD_SERIAL_TOKEN -> API_SECRET)
    $expectedToken = bot_resolved_token();
    if ($expectedToken === '') {
        error_log('[check_serial2] Chưa cấu hình CHECK_SERIAL_TOKEN / ADD_SERIAL_TOKEN / API_SECRET hợp lệ');
        bot_api_res(false, 'Endpoint chưa được cấu hình khoá xác thực', null, 500);
    }

    $allReqHeaders = function_exists('getallheaders') ? array_change_key_case(getallheaders(), CASE_LOWER) : [];
    $xApiToken     = $_SERVER['HTTP_X_API_TOKEN'] ?? ($allReqHeaders['x-api-token'] ?? '');
    $authHeader    = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? ($allReqHeaders['authorization'] ?? ''));

    $providedToken = '';
    if (trim((string)$xApiToken) !== '') {
        $providedToken = trim((string)$xApiToken);
    } elseif (preg_match('/^Bearer\s+(.+)$/i', trim((string)$authHeader), $m)) {
        $providedToken = trim($m[1]);
    } elseif (isset($params['token']) && is_string($params['token'])) {
        $providedToken = trim($params['token']);
    }

    if ($providedToken === '' || !hash_equals($expectedToken, $providedToken)) {
        bot_api_res(false, 'Token không hợp lệ hoặc thiếu', null, 403);
    }
}

$serial  = trim((string)($params['serial'] ?? ''));
$device  = trim((string)($params['device'] ?? ($params['codename'] ?? 'Mobile')));
$email   = strtolower(trim((string)($params['email'] ?? ($params['gmail'] ?? 'hyperur2026@gmail.com'))));
$timeArg = array_key_exists('time', $params) ? trim((string)$params['time']) : 'unlimited';

// 3. Validate đầu vào
if ($serial === '') {
    bot_api_res(false, 'Thiếu tham số serial', null, 400);
}

$cleanSerial = preg_replace('/[^A-Za-z0-9]/', '', $serial);
if (strlen($cleanSerial) < 4 || strlen($cleanSerial) > 32) {
    bot_api_res(false, 'Serial không hợp lệ (4-32 ký tự)', ['received' => $serial], 400);
}
$serial = $cleanSerial;

if ($device === '') {
    $device = 'Mobile';
}
$device = function_exists('mb_substr') ? mb_substr($device, 0, 50, 'UTF-8') : substr($device, 0, 50);

if ($email === '') {
    $email = 'hyperur2026@gmail.com';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    bot_api_res(false, 'Email không hợp lệ', null, 400);
}
$email = substr($email, 0, 100);

$parsedTime = bot_parse_time_value($timeArg);
if (!$parsedTime['valid']) {
    bot_api_res(false, 'Time không hợp lệ (chấp nhận: unlimited, trial/36days, ddmmyyyy, YYYY-MM-DD)', null, 400);
}
$timeStore = $parsedTime['store'];
$expDate   = $parsedTime['expired_at'];

// 4. Kết nối Database
$conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    error_log('[check_serial2] DB connect failed: ' . $conn->connect_error);
    bot_api_res(false, 'Kết nối database thất bại', null, 500);
}
$conn->set_charset('utf8mb4');

// 5. Kiểm tra xem serial đã có trong bảng `serial` chưa
$chk = $conn->prepare("SELECT STT, Device, Serial, Gmail, Time FROM serial WHERE LOWER(Serial) = LOWER(?) LIMIT 1");
$chk->bind_param('s', $serial);
$chk->execute();
$existing = $chk->get_result()->fetch_assoc();
$chk->close();

if ($existing) {
    $curTime = strtolower(trim((string)($existing['Time'] ?? '')));
    if ($curTime !== 'pending') {
        $conn->close();
        bot_api_res(true, 'Serial đã được kích hoạt trước đó', [
            'stt'    => (int)$existing['STT'],
            'serial' => $existing['Serial'],
            'device' => $existing['Device'],
            'email'  => $existing['Gmail'],
            'time'   => $existing['Time'],
            'status' => 'Active'
        ]);
    } else {
        $upd = $conn->prepare("UPDATE serial SET Device = ?, Serial = ?, Gmail = ?, Time = ? WHERE STT = ?");
        $upd->bind_param('ssssi', $device, $serial, $email, $timeStore, $existing['STT']);
        $upd->execute();
        $upd->close();

        $updReg = $conn->prepare("UPDATE registrations SET status = 'Active', activated_at = NOW(), serial = ? WHERE LOWER(TRIM(serial)) = LOWER(?)");
        if ($updReg) {
            $updReg->bind_param('ss', $serial, $serial);
            $updReg->execute();
            $updReg->close();
        }
        $conn->close();

        bot_api_res(true, 'Kích hoạt Serial thành công', [
            'stt'    => (int)$existing['STT'],
            'serial' => $serial,
            'device' => $device,
            'email'  => $email,
            'time'   => $timeStore,
            'status' => 'Active'
        ]);
    }
}

// 6. Cấp STT mới (MAX(STT) + 1)
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

// 7. INSERT vào bảng `serial`
$ins = $conn->prepare("INSERT INTO serial (STT, Device, Serial, Gmail, Time) VALUES (?, ?, ?, ?, ?)");
$ins->bind_param('issss', $newStt, $device, $serial, $email, $timeStore);
if (!$ins->execute()) {
    $err = $ins->error;
    $ins->close();
    $conn->close();
    error_log('[check_serial2] insert serial failed: ' . $err);
    bot_api_res(false, 'Lỗi lưu bảng serial', null, 500);
}
$ins->close();

// 8. Đồng bộ sang bảng `registrations` nếu bảng tồn tại (Prepared Statement)
$regStatus = 'Active';
$planName  = ($timeStore === 'unlimited') ? 'Vĩnh Viễn (Telegram Bot)' : 'Active Free (36 ngày)';
$txCode    = 'BOT-STT-' . $newStt;

try {
    $insReg = $conn->prepare("
        INSERT INTO registrations
            (serial, codename, plan, payment_method, sender_name, sender_email, transaction_code, status, activated_at, expired_at)
        VALUES (?, ?, ?, 'Telegram Bot', 'Bot User', ?, ?, ?, NOW(), ?)
        ON DUPLICATE KEY UPDATE status = 'Active', updated_at = NOW()
    ");
    if ($insReg) {
        $insReg->bind_param('sssssss', $serial, $device, $planName, $email, $txCode, $regStatus, $expDate);
        $insReg->execute();
        $insReg->close();
    }
} catch (\Throwable $e) {
    error_log('[check_serial2] sync registrations failed: ' . $e->getMessage());
}

// 9. Ghi audit log vào `admin_logs` (Prepared Statement, admin_id = 0)
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
    $logStmt = $conn->prepare("
        INSERT INTO admin_logs
            (admin_id, username, action, table_name, record_id, description, new_data, ip_address, user_agent)
        VALUES (0, 'telegram_bot', 'bot_activate', 'serial', ?, ?, ?, ?, ?)
    ");
    if ($logStmt) {
        $recordId = (string)$newStt;
        $logStmt->bind_param('sssss', $recordId, $logDesc, $newData, $ip, $ua);
        $logStmt->execute();
        $logStmt->close();
    }
} catch (\Throwable $e) {
    error_log('[check_serial2] write admin_logs failed: ' . $e->getMessage());
}

$conn->close();

// 10. Phản hồi thành công
bot_api_res(true, 'Kích hoạt serial thành công', [
    'stt'    => $newStt,
    'serial' => $serial,
    'device' => $device,
    'email'  => $email,
    'time'   => $timeStore,
    'status' => 'Active'
]);
