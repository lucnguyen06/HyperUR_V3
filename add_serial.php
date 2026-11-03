<?php
/**
 * HyperUR - Quick Add Serial (auto via URL)
 *
 * GET   /add_serial?serial=XXXXX[&device=YYY&gmail=ZZZ&time=unlimited][&format=json][&token=SECRET]
 *         ───────────────────────────────────────────────────────────
 *         Tham số `time` LUÔN ở cuối URL (đuôi) để dễ copy & debug.
 *         Thứ tự cố định: serial → device → gmail → time.
 * POST  tương tự, an toàn hơn (serial trong body).
 *
 * Khi chạy https://hyperur.io.vn/add_serial?serial=<mã> sẽ:
 *   1. Validate format serial (4-32 ký tự A-Z, 0-9).
 *   2. Kiểm tra trùng (case-insensitive). Nếu đã tồn tại → trả về thông báo "đã có".
 *   3. Tự cấp STT mới (MAX(STT) + 1, tự tìm khoảng trống nếu trùng).
 *   4. INSERT vào bảng `serial` với:
 *        - Device = tham số `device` hoặc mặc định 'auto'
 *        - Serial = tham số `serial`
 *        - Gmail  = tham số `gmail`  hoặc mặc định 'auto@hyperur.io.vn'
 *        - Time   = tham số `time`   hoặc mặc định 'unlimited'
 *   5. Ghi log vào bảng `admin_logs` với:
 *        - admin_id = 0
 *        - username = '0'
 *        - action   = 'add_serial_auto'
 *        - description = "Auto add serial via URL: <serial>"
 *        - new_data = JSON {stt, device, serial, email, time, source_ip}
 *
 * Response:
 *   - Mặc định: trang HTML xác nhận (đẹp, dễ đọc khi mở trực tiếp trên trình duyệt)
 *   - ?format=json (hoặc Accept: application/json): trả về JSON {success, message, data}
 *
 * ⚠️ BẢO MẬT:
 *   - Endpoint này KHÔNG yêu cầu đăng nhập (public).
 *   - Nếu muốn giới hạn truy cập, đặt hằng số `ADD_SERIAL_TOKEN` trong api/config.php
 *     rồi truyền `?token=<giá trị đó>` khi gọi. Nếu token sai → HTTP 403.
 *   - Có thể đặt thêm `ADD_SERIAL_IP_ALLOW` (danh sách IP CIDR được phân tách bằng dấu phẩy)
 *     để whitelist IP, ví dụ: define('ADD_SERIAL_IP_ALLOW', '113.161.0.0/16,127.0.0.1');
 */

require_once __DIR__ . '/api/config.php';

// =====================================================
//  Helpers
// =====================================================
function json_response_add($success, $message, $data = null, $code = 200) {
    http_response_code($code);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data'    => $data
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function html_response_add($title, $ok, $detail, $extra = []) {
    $accent = $ok ? '#10b981' : '#f43f5e';
    $icon   = $ok
        ? '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11.5 14.5 16.5 9"/></svg>'
        : '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

    $rowsHtml = '';
    foreach ($extra as $k => $v) {
        $rowsHtml .= '<tr><td>' . htmlspecialchars($k, ENT_QUOTES, 'UTF-8') . '</td><td><code>' . htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8') . '</code></td></tr>';
    }

    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
    echo '<meta name="robots" content="noindex, nofollow">';
    echo '<title>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . ' · HyperUR</title>';
    echo '<link rel="icon" href="https://t.me/i/userpic/320/hypermodupdate.jpg">';
    echo '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">';
    echo '<style>
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            background: radial-gradient(circle at 50% 0%, #0d1e1a 0%, #080a11 60%, #05060a 100%);
            color: #e2e8f0;
            font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem 1rem;
        }
        .card {
            max-width: 560px;
            width: 100%;
            background: rgba(16, 28, 24, 0.65);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 22px;
            padding: 2.5rem 2rem;
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            box-shadow: 0 24px 60px rgba(0,0,0,0.5);
            text-align: center;
        }
        .icon { display: flex; justify-content: center; margin-bottom: 1rem; }
        h1 {
            font-size: 1.5rem;
            margin: 0 0 0.5rem;
            font-weight: 700;
            letter-spacing: -0.01em;
            color: ' . $accent . ';
        }
        p.lead { color: #cbd5e1; margin: 0 0 1.5rem; font-size: 0.95rem; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
            font-size: 0.9rem;
        }
        table td {
            padding: 0.55rem 0.7rem;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            text-align: left;
        }
        table td:first-child {
            color: #94a3b8;
            font-weight: 600;
            width: 38%;
        }
        table td:last-child { word-break: break-all; }
        code, .mono {
            font-family: "JetBrains Mono", monospace;
            color: #6ee7b7;
            background: rgba(16, 185, 129, 0.08);
            padding: 0.1rem 0.4rem;
            border-radius: 4px;
        }
        .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; margin-top: 1.5rem; }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.55rem 1rem;
            border-radius: 10px;
            font-size: 0.85rem;
            font-weight: 600;
            text-decoration: none;
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(20, 42, 36, 0.7);
            color: #e2e8f0;
            transition: all 0.18s;
        }
        .btn:hover { background: rgba(30, 60, 50, 0.85); border-color: rgba(16, 185, 129, 0.45); }
        .btn.primary {
            background: linear-gradient(135deg, #10b981, #06b6d4);
            color: #04231c;
            border-color: transparent;
        }
        .btn.primary:hover { filter: brightness(1.05); }
        .footer {
            margin-top: 1.5rem;
            font-size: 0.78rem;
            color: #64748b;
        }
    </style></head><body><div class="card">';
    echo '<div class="icon">' . $icon . '</div>';
    echo '<h1>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h1>';
    echo '<p class="lead">' . htmlspecialchars($detail, ENT_QUOTES, 'UTF-8') . '</p>';
    if ($rowsHtml) echo '<table>' . $rowsHtml . '</table>';
    echo '<div class="actions">';
    echo '<a class="btn primary" href="admin/admin.html">Mở trang Admin</a>';
    echo '<a class="btn" href="index.html">Trang chủ</a>';
    echo '</div>';
    echo '<div class="footer">HyperUR · Quick Add Serial Endpoint</div>';
    echo '</div></body></html>';
    exit;
}

function is_valid_serial_format($s) {
    return is_string($s) && preg_match('/^[A-Za-z0-9]{4,32}$/', $s);
}

function client_ip() {
    // Ưu tiên X-Forwarded-For nếu có (sau reverse proxy), fallback REMOTE_ADDR
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($parts[0]);
    }
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

function ip_in_cidr($ip, $cidr) {
    if (strpos($cidr, '/') === false) {
        return $ip === $cidr;
    }
    list($subnet, $bits) = explode('/', $cidr, 2);
    if ($bits === '') $bits = 32;
    $bits = (int)$bits;
    $ip_long     = ip2long($ip);
    $subnet_long = ip2long($subnet);
    if ($ip_long === false || $subnet_long === false) return false;
    if ($bits === 0) return true;
    $mask = -1 << (32 - $bits);
    return ($ip_long & $mask) === ($subnet_long & $mask);
}

function is_ip_allowed($ip) {
    if (!defined('ADD_SERIAL_IP_ALLOW')) return true; // không giới hạn
    $list = trim(ADD_SERIAL_IP_ALLOW);
    if ($list === '') return true;
    foreach (explode(',', $list) as $cidr) {
        $cidr = trim($cidr);
        if ($cidr === '') continue;
        if (ip_in_cidr($ip, $cidr)) return true;
    }
    return false;
}

// Build canonical URL with parameters in fixed order: serial → device → gmail → time.
// `time` is intentionally LAST (đuôi URL) để dễ nhìn & dễ copy khi debug.
function build_canonical_url($serial, $device, $gmail, $time, $extra = []) {
    $params = [];
    if ($serial !== '') $params['serial'] = $serial;
    if ($device !== '' && $device !== 'Mobile')               $params['device'] = $device;
    if ($gmail  !== '' && strtolower($gmail) !== 'hyperur2026@gmail.com') $params['gmail']  = $gmail;
    // time luôn ở đuôi URL (kể cả khi = default 'unlimited') để pattern cố định
    $params['time'] = ($time !== '' ? $time : 'unlimited');
    foreach ($extra as $k => $v) {
        if ($v === null || $v === '') continue;
        $params[$k] = $v;
    }
    return WEBSITE_URL . '/add_serial?' . http_build_query($params);
}

// =====================================================
//  1. Bảo mật: token + IP whitelist
// =====================================================
$format = strtolower($_GET['format'] ?? $_POST['format'] ?? 'html');
$isJson = ($format === 'json') || (isset($_SERVER['HTTP_ACCEPT']) && stripos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false);

$ip = client_ip();

// IP whitelist (optional)
if (!is_ip_allowed($ip)) {
    if ($isJson) {
        json_response_add(false, 'IP ' . $ip . ' không được phép truy cập endpoint này', null, 403);
    }
    html_response_add('403 · Truy cập bị từ chối', false, 'IP của bạn không nằm trong danh sách cho phép.', ['IP' => $ip]);
}

// Token check (optional)
if (defined('ADD_SERIAL_TOKEN') && ADD_SERIAL_TOKEN !== '') {
    $expected = ADD_SERIAL_TOKEN;
    $provided = $_GET['token'] ?? $_POST['token'] ?? '';
    if (!is_string($provided) || !hash_equals($expected, $provided)) {
        if ($isJson) {
            json_response_add(false, 'Token không hợp lệ hoặc thiếu', null, 403);
        }
        html_response_add('403 · Token không hợp lệ', false, 'Cần truyền tham số ?token=<giá trị bí mật> để sử dụng endpoint này.', ['IP' => $ip]);
    }
}

// =====================================================
//  2. Lấy tham số (ưu tiên GET)
// =====================================================
$source_params = $_GET;
if (empty($source_params['serial']) && !empty($_POST['serial'])) {
    $source_params = $_POST;
}

$serial = trim($source_params['serial'] ?? '');
$device = trim($source_params['device'] ?? 'Mobile');
$gmail  = strtolower(trim($source_params['gmail'] ?? 'hyperur2026@gmail.com'));
$time   = trim($source_params['time']   ?? 'unlimited');

// =====================================================
//  3. Validate
// =====================================================
if ($serial === '') {
    if ($isJson) {
        json_response_add(false, 'Thiếu tham số `serial`', null, 400);
    }
    html_response_add('Thiếu tham số', false, 'Cần truyền `?serial=<mã serial>` trên URL. Tham số `time` luôn đứng cuối (đuôi) URL.', [
        'Ví dụ (tối thiểu)' => WEBSITE_URL . '/add_serial?serial=abc12345&time=unlimited',
        'Ví dụ (đầy đủ)'   => WEBSITE_URL . '/add_serial?serial=abc12345&device=hypermod&gmail=user@gmail.com&time=2026-12-31'
    ]);
}

if (!is_valid_serial_format($serial)) {
    if ($isJson) {
        json_response_add(false, 'Serial không hợp lệ (4-32 ký tự, chỉ gồm A-Z và 0-9)', null, 400);
    }
    html_response_add('Serial không hợp lệ', false, 'Serial phải gồm 4-32 ký tự chữ và số (không ký tự đặc biệt).', [
        'Serial nhận' => $serial,
        'Độ dài'      => strlen($serial) . ' ký tự',
        'Mẫu hợp lệ'  => 'abc12345, 1a2b3c4d, DEADBEEF'
    ]);
}

// Validate email (nếu Gmail được truyền khác default)
if ($gmail !== '' && !filter_var($gmail, FILTER_VALIDATE_EMAIL)) {
    if ($isJson) {
        json_response_add(false, 'Email không hợp lệ', null, 400);
    }
    html_response_add('Email không hợp lệ', false, 'Vui lòng truyền tham số `gmail` đúng định dạng email, hoặc bỏ trống để dùng mặc định.', ['Gmail nhận' => $gmail]);
}

// Validate time (cho phép unlimited / ddmmyyyy / YYYY-MM-DD)
$time_kind = 'invalid';
if (strtolower($time) === 'unlimited' || strtolower($time) === 'lifetime') {
    $time_kind = 'unlimited';
    $time_store = 'unlimited';
} elseif (preg_match('/^(\d{2})(\d{2})(\d{4})$/', $time, $m)) {
    $candidate = "{$m[3]}-{$m[2]}-{$m[1]}";
    if (strtotime($candidate) !== false) {
        $time_kind = 'fixed';
        $time_store = $candidate;
    }
} elseif (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $time, $m)) {
    if (strtotime($time) !== false) {
        $time_kind = 'fixed';
        $time_store = $time;
    }
}
if ($time_kind === 'invalid') {
    if ($isJson) {
        json_response_add(false, 'Time không hợp lệ (chấp nhận: unlimited, ddmmyyyy, YYYY-MM-DD)', null, 400);
    }
    html_response_add('Time không hợp lệ', false, 'Tham số `time` chỉ chấp nhận: `unlimited`, `ddmmyyyy` hoặc `YYYY-MM-DD`.', [
        'Time nhận'  => $time,
        'Ví dụ OK'   => 'unlimited | 31102026 | 2026-10-31'
    ]);
}

// =====================================================
//  4. Kết nối DB
// =====================================================
try {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        if ($isJson) {
            json_response_add(false, 'Kết nối database thất bại: ' . $conn->connect_error, null, 500);
        }
        html_response_add('Lỗi kết nối', false, 'Không thể kết nối database. Vui lòng thử lại sau.');
    }
    $conn->set_charset('utf8mb4');
} catch (Throwable $e) {
    if ($isJson) {
        json_response_add(false, 'Lỗi DB: ' . $e->getMessage(), null, 500);
    }
    html_response_add('Lỗi kết nối', false, $e->getMessage());
}

// =====================================================
//  5. Kiểm tra trùng serial
// =====================================================
$chk = $conn->prepare("SELECT STT, Device, Serial, Gmail, Time FROM serial WHERE LOWER(Serial) = LOWER(?) LIMIT 1");
$chk->bind_param('s', $serial);
$chk->execute();
$existing = $chk->get_result()->fetch_assoc();
$chk->close();

if ($existing) {
    if (strtolower(trim($existing['Time'] ?? '')) === 'pending') {
        $upd = $conn->prepare("UPDATE serial SET Device = ?, Gmail = ?, Time = ? WHERE STT = ?");
        $upd->bind_param('sssi', $device, $gmail, $time_store, $existing['STT']);
        $upd->execute();
        $upd->close();
        @$conn->query("UPDATE registrations SET status = 'Active', activated_at = NOW() WHERE LOWER(TRIM(serial)) = LOWER('{$serial}')");
        $conn->close();
        if ($isJson) {
            json_response_add(true, 'Kích hoạt serial thành công', [
                'stt'    => (int)$existing['STT'],
                'serial' => $existing['Serial'],
                'device' => $device,
                'gmail'  => $gmail,
                'time'   => $time_store
            ]);
        }
        html_response_add('Kích hoạt thành công', true, 'Serial vừa được kích hoạt thành công từ trạng thái chờ thanh toán.', [
            'STT'    => '#' . $existing['STT'],
            'Serial' => $existing['Serial'],
            'Device' => $device,
            'Gmail'  => $gmail,
            'Time'   => $time_store
        ]);
    }

    $conn->close();
    if ($isJson) {
        json_response_add(false, 'Serial đã tồn tại trong hệ thống', [
            'stt'    => (int)$existing['STT'],
            'serial' => $existing['Serial'],
            'device' => $existing['Device'],
            'gmail'  => $existing['Gmail'],
            'time'   => $existing['Time']
        ], 409);
    }
    html_response_add('Serial đã tồn tại', false, 'Serial này đã được đăng ký trong hệ thống. Không thêm trùng.', [
        'STT'    => '#' . $existing['STT'],
        'Serial' => $existing['Serial'],
        'Device' => $existing['Device'],
        'Gmail'  => $existing['Gmail'],
        'Time'   => $existing['Time']
    ]);
}

// =====================================================
//  6. Cấp STT mới
// =====================================================
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
    if ($newStt > 10000000) {
        $conn->close();
        if ($isJson) {
            json_response_add(false, 'Không thể cấp STT mới', null, 500);
        }
        html_response_add('Lỗi cấp STT', false, 'Không thể cấp số thứ tự mới (đã đạt giới hạn).');
    }
}

// =====================================================
//  7. INSERT vào bảng serial
// =====================================================
$ins = $conn->prepare("INSERT INTO serial (STT, Device, Serial, Gmail, Time) VALUES (?, ?, ?, ?, ?)");
$ins->bind_param('issss', $newStt, $device, $serial, $gmail, $time_store);
if (!$ins->execute()) {
    $err = $ins->error;
    $ins->close();
    $conn->close();
    if ($isJson) {
        json_response_add(false, 'Lỗi INSERT: ' . $err, null, 500);
    }
    html_response_add('Lỗi thêm serial', false, $err);
}
$ins->close();

// =====================================================
//  8. Ghi admin_logs với admin_id = 0, username = '0'
// =====================================================
$ua       = substr($_SERVER['HTTP_USER_AGENT'] ?? 'unknown', 0, 500);
$log_desc = 'Auto add serial via URL: ' . $serial;
$log_action = 'add_serial_auto';
$new_data = [
    'STT'       => $newStt,
    'Device'    => $device,
    'serial'    => $serial,
    'email'     => $gmail,
    'time'      => $time_store,
    'source_ip' => $ip
];
$new_json    = json_encode($new_data, JSON_UNESCAPED_UNICODE);
$sys_user_id = null;
$sys_user    = 'system';
$table_name  = 'serial';
$record_id   = (string)$newStt;

try {
    $log = $conn->prepare("
        INSERT INTO admin_logs
            (admin_id, username, action, table_name, record_id, description, old_data, new_data, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    ");
    if ($log) {
        $log->bind_param(
            'issssssss',
            $sys_user_id,
            $sys_user,
            $log_action,
            $table_name,
            $record_id,
            $log_desc,
            $new_json,
            $ip,
            $ua
        );
        $log->execute();
        $log_id = $log->insert_id;
        $log->close();
    }
} catch (\Throwable $logEx) {
    // Không chặn luồng add_serial nếu bảng admin_logs bị lỗi ràng buộc
}

$conn->close();

// =====================================================
//  9. Response
// =====================================================
$canonicalUrl = build_canonical_url($serial, $device, $gmail, $time_store);

if ($isJson) {
    json_response_add(true, 'Đã thêm serial thành công', [
        'stt'    => $newStt,
        'serial' => $serial,
        'device' => $device,
        'gmail'  => $gmail,
        'time'   => $time_store,
        'ip'     => $ip,
        'log_id' => $log_id,
        'url'    => $canonicalUrl
    ]);
}

html_response_add('Đã thêm serial thành công', true, 'Serial đã được tự động thêm vào hệ thống. Có thể dùng ngay để tra cứu.', [
    'STT'      => '#' . $newStt,
    'Serial'   => $serial,
    'Device'   => $device,
    'Gmail'    => $gmail,
    'Time'     => $time_store,
    'IP'       => $ip,
    'Full URL' => $canonicalUrl
]);