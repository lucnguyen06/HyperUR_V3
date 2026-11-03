<?php
/**
 * Admin Serial Management API
 * HyperUR V3 - CRUD bảng `serial`
 *
 * Schema:
 *   serial(STT, Device, Serial, Gmail, Time)
 *
 * Actions:
 *   GET  action=list                  -> list with pagination/search/filter
 *   GET  action=get&stt={STT}         -> single row
 *   GET  action=stats                 -> dashboard stats
 *   GET  action=devices               -> distinct device codenames
 *   POST action=add                   { device, serial, gmail, time }
 *   POST action=update                { stt, device, serial, gmail, time }
 *   POST action=delete                { stt }
 *   POST action=bulk_delete           { stts: [] }
 *   POST action=renew                 { stt, days }   (extends Time by N days, sets unlimited if days == -1)
 *   POST action=bulk_unlimited        { stts: [] }     (set Time = 'unlimited')
 *   GET  action=export                -> CSV download
 *
 * All mutating actions write to admin_logs.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/_bootstrap.php';   // header JSON + CORS an toàn + session

function json_response($success, $message, $data = null, $code = 200) {
    http_response_code($code);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data'    => $data
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function require_admin() {
    if (!isset($_SESSION['admin_id'], $_SESSION['admin_username'])) {
        json_response(false, 'Bạn cần đăng nhập để thực hiện thao tác này', null, 401);
    }
}

function get_db_connection() {
    // Tương thích với cả 2 kiểu config.php:
    //  - Kiểu cũ: tạo sẵn $conn toàn cục + biến $servername/$username/$password/$dbname
    //  - Kiểu mới: định nghĩa hằng số DB_HOST, DB_USER, DB_PASS, DB_NAME
    if (isset($GLOBALS['conn']) && $GLOBALS['conn'] instanceof mysqli) {
        $conn = $GLOBALS['conn'];
        @$conn->set_charset('utf8mb4');
        return $conn;
    }

    if (defined('DB_HOST') && defined('DB_USER') && defined('DB_PASS') && defined('DB_NAME')) {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    } elseif (isset($GLOBALS['servername'], $GLOBALS['username'], $GLOBALS['password'], $GLOBALS['dbname'])) {
        $conn = new mysqli($GLOBALS['servername'], $GLOBALS['username'], $GLOBALS['password'], $GLOBALS['dbname']);
    } else {
        json_response(false, 'Không tìm thấy cấu hình database trong config.php', null, 500);
    }

    if ($conn->connect_error) {
        json_response(false, 'Kết nối database thất bại: ' . $conn->connect_error, null, 500);
    }
    $conn->set_charset('utf8mb4');
    return $conn;
}

function write_admin_log($conn, $admin_id, $username, $action, $description, $table_name, $record_id, $old_data = null, $new_data = null) {
    try {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? 'unknown', 0, 500);

        $oldJson = $old_data !== null ? json_encode($old_data, JSON_UNESCAPED_UNICODE) : null;
        $newJson = $new_data !== null ? json_encode($new_data, JSON_UNESCAPED_UNICODE) : null;

        $stmt = $conn->prepare("
            INSERT INTO admin_logs
                (admin_id, username, action, table_name, record_id, description, old_data, new_data, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param(
            'iissssssss',
            $admin_id, $username, $action, $table_name, $record_id, $description, $oldJson, $newJson, $ip, $ua
        );
        $stmt->execute();
        $stmt->close();
    } catch (Exception $e) {
        error_log('write_admin_log error: ' . $e->getMessage());
    }
}

function parseTimeField($value) {
    // Returns ['kind' => 'unlimited'|'fixed'|'invalid', 'date' => 'YYYY-MM-DD' or null]
    $v = trim((string)$value);
    if ($v === '') return ['kind' => 'invalid', 'date' => null];

    $lower = strtolower($v);
    if ($lower === 'unlimited' || $lower === 'lifetime' || $lower === 'vĩnh viễn' || $lower === 'vinh vien') {
        return ['kind' => 'unlimited', 'date' => null];
    }

    // Accept ddmmyyyy (legacy) -> convert
    if (preg_match('/^(\d{2})(\d{2})(\d{4})$/', $v, $m)) {
        $date = "{$m[3]}-{$m[2]}-{$m[1]}";
        if (strtotime($date) !== false) {
            return ['kind' => 'fixed', 'date' => $date];
        }
    }

    // Accept YYYY-MM-DD
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $v, $m)) {
        if (strtotime($v) !== false) {
            return ['kind' => 'fixed', 'date' => $v];
        }
    }

    // Try generic strtotime
    $ts = strtotime($v);
    if ($ts !== false) {
        return ['kind' => 'fixed', 'date' => date('Y-m-d', $ts)];
    }

    return ['kind' => 'invalid', 'date' => null];
}

function formatTimeField($value) {
    // Convert stored value to display string. If stored is YYYY-MM-DD, return ddmmyyyy to mirror legacy import.
    $text = trim((string)$value);
    if ($text === '') return '';
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $text, $m)) {
        return "{$m[3]}/{$m[2]}/{$m[1]}";
    }
    return $text;
}

function normalizeEmail($value) {
    return strtolower(trim((string)$value));
}

function isValidSerialFormat($s) {
    return is_string($s) && preg_match('/^[A-Za-z0-9]{4,32}$/', $s);
}

function isValidEmail($e) {
    return filter_var($e, FILTER_VALIDATE_EMAIL);
}

$action = $_GET['action'] ?? ($_POST['action'] ?? '');

try {
    $conn = get_db_connection();

    // ============================================================
    // LIST - paginated, searchable, filterable
    // ============================================================
    if ($action === 'list') {
        require_admin();

        $page    = max(1, (int)($_GET['page'] ?? 1));
        $perPage = min(200, max(5, (int)($_GET['per_page'] ?? 50)));
        $offset  = ($page - 1) * $perPage;

        $search  = trim($_GET['search'] ?? '');
        $device  = trim($_GET['device'] ?? '');
        $status  = trim($_GET['status'] ?? ''); // 'unlimited' | 'active' | 'expired' | ''
        $sortBy  = $_GET['sort_by'] ?? 'STT';
        $sortDir = strtoupper($_GET['sort_dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

        $allowedSort = ['STT', 'Device', 'Serial', 'Gmail', 'Time'];
        if (!in_array($sortBy, $allowedSort, true)) $sortBy = 'STT';

        $where = [];
        $types = '';
        $params = [];

        if ($search !== '') {
            $where[] = '(Device LIKE ? OR Serial LIKE ? OR Gmail LIKE ? OR CAST(STT AS CHAR) LIKE ?)';
            $like = '%' . $search . '%';
            $types .= 'ssss';
            array_push($params, $like, $like, $like, $like);
        }

        if ($device !== '') {
            $where[] = 'Device LIKE ?';
            $types .= 's';
            $params[] = '%' . $device . '%';
        }

        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        // Status filter - cannot be expressed purely in SQL because Time is varchar.
        // Fetch a slightly extended window (when status set) and re-filter & re-paginate in PHP.
        $needClientStatus = in_array($status, ['unlimited', 'active', 'expired'], true);

        if ($needClientStatus) {
            // Pull only STT + Time for client-side filtering (plus any other selected columns we need)
            // Simpler: pull all rows after WHERE and filter in PHP. Limit kept reasonable.
            $countSql = "SELECT COUNT(*) AS total FROM serial $whereSql";
            $stmt = $conn->prepare($countSql);
            if ($types) $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $totalRow = $stmt->get_result()->fetch_assoc();
            $totalAll = (int)$totalRow['total'];
            $stmt->close();

            // Fetch all matching rows (without pagination) for client filter
            $sql = "SELECT STT, Device, Serial, Gmail, Time FROM serial $whereSql ORDER BY $sortBy $sortDir";
            $stmt = $conn->prepare($sql);
            if ($types) $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $rs = $stmt->get_result();

            $filtered = [];
            while ($row = $rs->fetch_assoc()) {
                $kind = parseTimeField($row['Time'])['kind'];
                if ($status === 'unlimited' && $kind !== 'unlimited') continue;
                if ($status === 'active' && $kind !== 'fixed') continue;
                if ($status === 'expired' && $kind === 'unlimited') continue;

                $row['Time'] = formatTimeField($row['Time']);
                $row['TimeStatus'] = ($kind === 'unlimited') ? 'unlimited' : (($kind === 'fixed' && strtotime(parseTimeField($row['Time'])['date']) >= strtotime(date('Y-m-d'))) ? 'active' : 'expired');
                $filtered[] = $row;
            }
            $stmt->close();

            $total = count($filtered);
            $rows = array_slice($filtered, $offset, $perPage);
        } else {
            $countSql = "SELECT COUNT(*) AS total FROM serial $whereSql";
            $stmt = $conn->prepare($countSql);
            if ($types) $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $totalRow = $stmt->get_result()->fetch_assoc();
            $total = (int)$totalRow['total'];
            $stmt->close();

            $sql = "SELECT STT, Device, Serial, Gmail, Time FROM serial $whereSql ORDER BY $sortBy $sortDir LIMIT ? OFFSET ?";
            $stmt = $conn->prepare($sql);
            if ($types) {
                $stmt->bind_param($types . 'ii', ...array_merge($params, [$perPage, $offset]));
            } else {
                $stmt->bind_param('ii', $perPage, $offset);
            }
            $stmt->execute();
            $rs = $stmt->get_result();
            $rows = [];
            while ($row = $rs->fetch_assoc()) {
                $row['Time'] = formatTimeField($row['Time']);
                $kind = parseTimeField($row['Time'])['kind'];
                $row['TimeStatus'] = ($kind === 'unlimited') ? 'unlimited' : (($kind === 'fixed' && strtotime(parseTimeField($row['Time'])['date']) >= strtotime(date('Y-m-d'))) ? 'active' : 'expired');
                $rows[] = $row;
            }
            $stmt->close();
        }

        $conn->close();
        json_response(true, 'OK', [
            'rows'       => $rows,
            'total'      => $total,
            'page'       => $page,
            'per_page'   => $perPage,
            'total_pages'=> max(1, (int)ceil($total / $perPage))
        ]);
    }

    // ============================================================
    // GET single
    // ============================================================
    if ($action === 'get') {
        require_admin();
        $stt = (int)($_GET['stt'] ?? 0);
        if ($stt <= 0) json_response(false, 'STT không hợp lệ', null, 400);

        $stmt = $conn->prepare("SELECT STT, Device, Serial, Gmail, Time FROM serial WHERE STT = ? LIMIT 1");
        $stmt->bind_param('i', $stt);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row) {
            $conn->close();
            json_response(false, 'Không tìm thấy serial', null, 404);
        }
        $row['Time'] = formatTimeField($row['Time']);
        $conn->close();
        json_response(true, 'OK', $row);
    }

    // ============================================================
    // STATS - dashboard
    // ============================================================
    if ($action === 'stats') {
        require_admin();

        $stats = [
            'total'      => 0,
            'unlimited'  => 0,
            'active'     => 0,
            'expired'    => 0,
            'today'      => 0,
            'devices'    => 0,
            'top_devices'=> [],
            'recent'     => []
        ];

        $rs = $conn->query("SELECT COUNT(*) AS c FROM serial");
        $stats['total'] = (int)($rs->fetch_assoc()['c'] ?? 0);

        // Walk rows to compute TimeStatus distribution (Time is varchar, not date)
        $rs = $conn->query("SELECT Time, Device FROM serial");
        $today = strtotime(date('Y-m-d'));
        $deviceCounts = [];
        while ($row = $rs->fetch_assoc()) {
            $kind = parseTimeField($row['Time'])['kind'];
            if ($kind === 'unlimited') {
                $stats['unlimited']++;
            } elseif ($kind === 'fixed') {
                $ts = strtotime(parseTimeField($row['Time'])['date']);
                if ($ts !== false && $ts >= $today) $stats['active']++;
                else $stats['expired']++;
            } else {
                $stats['expired']++;
            }
            $dev = strtolower(trim($row['Device']));
            // Extract codename (last word before any " - " after device name)
            if ($dev !== '') {
                if (!isset($deviceCounts[$dev])) $deviceCounts[$dev] = 0;
                $deviceCounts[$dev]++;
            }
        }

        arsort($deviceCounts);
        $stats['devices'] = count($deviceCounts);
        $stats['top_devices'] = array_slice(array_map(function ($k, $v) {
            return ['device' => $k, 'count' => $v];
        }, array_keys($deviceCounts), array_values($deviceCounts)), 0, 10, true);

        // "today" = serials whose Time expires today or later, plus those added "today" - we don't have created_at
        // Provide recent = top 5 latest rows
        $rs = $conn->query("SELECT STT, Serial, Device, Gmail FROM serial ORDER BY STT DESC LIMIT 5");
        while ($row = $rs->fetch_assoc()) {
            $stats['recent'][] = $row;
        }

        $conn->close();
        json_response(true, 'OK', $stats);
    }

    // ============================================================
    // DEVICES - distinct codenames
    // ============================================================
    if ($action === 'devices') {
        require_admin();
        $rs = $conn->query("SELECT Device, COUNT(*) AS c FROM serial GROUP BY Device ORDER BY c DESC");
        $devices = [];
        while ($row = $rs->fetch_assoc()) {
            if (trim($row['Device']) === '') continue;
            $devices[] = ['device' => $row['Device'], 'count' => (int)$row['c']];
        }
        $conn->close();
        json_response(true, 'OK', $devices);
    }

    // ============================================================
    // ADD
    // ============================================================
    if ($action === 'add') {
        require_admin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(false, 'Chỉ hỗ trợ POST', null, 405);

        $payload = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $device = trim($payload['device'] ?? '');
        $serial = trim($payload['serial'] ?? '');
        $gmail  = normalizeEmail($payload['gmail'] ?? '');
        $time   = trim($payload['time'] ?? 'unlimited');

        if ($device === '') json_response(false, 'Vui lòng nhập tên thiết bị', null, 400);
        if (!isValidSerialFormat($serial)) json_response(false, 'Serial không hợp lệ (4-32 ký tự A-Z, 0-9)', null, 400);
        if (!isValidEmail($gmail)) json_response(false, 'Email không hợp lệ', null, 400);

        $parsed = parseTimeField($time);
        if ($parsed['kind'] === 'invalid') json_response(false, 'Trường Time không hợp lệ (YYYY-MM-DD, ddmmyyyy hoặc "unlimited")', null, 400);

        // Check duplicate serial
        $chk = $conn->prepare("SELECT STT FROM serial WHERE LOWER(Serial) = LOWER(?) LIMIT 1");
        $chk->bind_param('s', $serial);
        $chk->execute();
        if ($chk->get_result()->num_rows > 0) {
            $chk->close();
            $conn->close();
            json_response(false, 'Serial đã tồn tại trong hệ thống', null, 409);
        }
        $chk->close();

        // Determine next STT
        $maxRow = $conn->query("SELECT IFNULL(MAX(STT),0) AS m FROM serial")->fetch_assoc();
        $newStt = (int)$maxRow['m'] + 1;
        // We try to keep dense STT; if MAX+1 collides (gaps), retry
        while (true) {
            $test = $conn->prepare("SELECT STT FROM serial WHERE STT = ?");
            $test->bind_param('i', $newStt);
            $test->execute();
            $r = $test->get_result();
            $test->close();
            if ($r->num_rows === 0) break;
            $newStt++;
            if ($newStt > 10000000) { $conn->close(); json_response(false, 'Không thể cấp STT mới', null, 500); }
        }

        $storeTime = ($parsed['kind'] === 'unlimited') ? 'unlimited' : $parsed['date'];

        $ins = $conn->prepare("INSERT INTO serial (STT, Device, Serial, Gmail, Time) VALUES (?, ?, ?, ?, ?)");
        $ins->bind_param('issss', $newStt, $device, $serial, $gmail, $storeTime);
        if (!$ins->execute()) {
            $err = $ins->error;
            $ins->close();
            $conn->close();
            json_response(false, 'Lỗi thêm serial: ' . $err, null, 500);
        }
        $ins->close();

        $newData = [
            'STT'    => $newStt,
            'Device' => $device,
            'serial' => $serial,
            'email'  => $gmail,
            'time'   => $storeTime
        ];
        write_admin_log(
            $conn,
            (int)$_SESSION['admin_id'],
            $_SESSION['admin_username'],
            'add',
            'Thêm serial mới: ' . $serial,
            'serial',
            (string)$newStt,
            null,
            $newData
        );

        $conn->close();
        json_response(true, 'Thêm serial thành công', ['stt' => $newStt, 'time' => $storeTime]);
    }

    // ============================================================
    // UPDATE
    // ============================================================
    if ($action === 'update') {
        require_admin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(false, 'Chỉ hỗ trợ POST', null, 405);

        $payload = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $stt    = (int)($payload['stt'] ?? 0);
        $device = trim($payload['device'] ?? '');
        $serial = trim($payload['serial'] ?? '');
        $gmail  = normalizeEmail($payload['gmail'] ?? '');
        $time   = trim($payload['time'] ?? '');

        if ($stt <= 0) json_response(false, 'STT không hợp lệ', null, 400);
        if ($device === '') json_response(false, 'Vui lòng nhập tên thiết bị', null, 400);
        if (!isValidSerialFormat($serial)) json_response(false, 'Serial không hợp lệ', null, 400);
        if (!isValidEmail($gmail)) json_response(false, 'Email không hợp lệ', null, 400);

        $parsed = parseTimeField($time);
        if ($parsed['kind'] === 'invalid') json_response(false, 'Trường Time không hợp lệ', null, 400);

        // Check duplicate serial (different STT)
        $chk = $conn->prepare("SELECT STT FROM serial WHERE LOWER(Serial) = LOWER(?) AND STT <> ? LIMIT 1");
        $chk->bind_param('si', $serial, $stt);
        $chk->execute();
        if ($chk->get_result()->num_rows > 0) {
            $chk->close();
            $conn->close();
            json_response(false, 'Serial đã tồn tại ở bản ghi khác', null, 409);
        }
        $chk->close();

        // Read old data
        $stmt = $conn->prepare("SELECT STT, Device, Serial, Gmail, Time FROM serial WHERE STT = ?");
        $stmt->bind_param('i', $stt);
        $stmt->execute();
        $oldRow = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$oldRow) {
            $conn->close();
            json_response(false, 'Không tìm thấy serial', null, 404);
        }

        $storeTime = ($parsed['kind'] === 'unlimited') ? 'unlimited' : $parsed['date'];

        $upd = $conn->prepare("UPDATE serial SET Device = ?, Serial = ?, Gmail = ?, Time = ? WHERE STT = ? LIMIT 1");
        $upd->bind_param('ssssi', $device, $serial, $gmail, $storeTime, $stt);
        if (!$upd->execute()) {
            $err = $upd->error;
            $upd->close();
            $conn->close();
            json_response(false, 'Lỗi cập nhật: ' . $err, null, 500);
        }
        $upd->close();

        // Đồng bộ cập nhật sang bảng registrations nếu có
        $updReg = $conn->prepare("UPDATE registrations SET serial = ?, codename = ?, sender_email = ? WHERE LOWER(TRIM(serial)) = LOWER(?)");
        if ($updReg) {
            $updReg->bind_param('ssss', $serial, $device, $gmail, $oldRow['Serial']);
            $updReg->execute();
            $updReg->close();
        }

        $oldData = [
            'STT'    => (int)$oldRow['STT'],
            'Device' => $oldRow['Device'],
            'serial' => $oldRow['Serial'],
            'email'  => strtolower($oldRow['Gmail']),
            'time'   => $oldRow['Time']
        ];
        $newData = [
            'STT'    => $stt,
            'Device' => $device,
            'serial' => $serial,
            'email'  => $gmail,
            'time'   => $storeTime
        ];
        write_admin_log(
            $conn,
            (int)$_SESSION['admin_id'],
            $_SESSION['admin_username'],
            'update',
            'Cập nhật serial: ' . $serial,
            'serial',
            (string)$stt,
            $oldData,
            $newData
        );

        $conn->close();
        json_response(true, 'Cập nhật thành công');
    }

    // ============================================================
    // DELETE
    // ============================================================
    if ($action === 'delete') {
        require_admin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(false, 'Chỉ hỗ trợ POST', null, 405);

        $payload = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $stt = (int)($payload['stt'] ?? 0);
        if ($stt <= 0) json_response(false, 'STT không hợp lệ', null, 400);

        $stmt = $conn->prepare("SELECT STT, Device, Serial, Gmail, Time FROM serial WHERE STT = ?");
        $stmt->bind_param('i', $stt);
        $stmt->execute();
        $oldRow = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$oldRow) {
            $conn->close();
            json_response(false, 'Không tìm thấy serial', null, 404);
        }

        $del = $conn->prepare("DELETE FROM serial WHERE STT = ? LIMIT 1");
        $del->bind_param('i', $stt);
        if (!$del->execute()) {
            $err = $del->error;
            $del->close();
            $conn->close();
            json_response(false, 'Lỗi xóa: ' . $err, null, 500);
        }
        $del->close();

        // Đồng bộ xóa trong bảng registrations
        if (!empty($oldRow['Serial'])) {
            $delReg = $conn->prepare("DELETE FROM registrations WHERE LOWER(TRIM(serial)) = LOWER(?)");
            if ($delReg) {
                $delReg->bind_param('s', $oldRow['Serial']);
                $delReg->execute();
                $delReg->close();
            }
        }

        $oldData = [
            'STT'    => (int)$oldRow['STT'],
            'Device' => $oldRow['Device'],
            'serial' => $oldRow['Serial'],
            'email'  => strtolower($oldRow['Gmail']),
            'time'   => $oldRow['Time']
        ];
        write_admin_log(
            $conn,
            (int)$_SESSION['admin_id'],
            $_SESSION['admin_username'],
            'delete',
            'Xóa serial: ' . $oldRow['Serial'],
            'serial',
            (string)$stt,
            $oldData,
            null
        );

        $conn->close();
        json_response(true, 'Đã xóa serial');
    }

    // ============================================================
    // BULK DELETE
    // ============================================================
    if ($action === 'bulk_delete') {
        require_admin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(false, 'Chỉ hỗ trợ POST', null, 405);

        $payload = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $stts = $payload['stts'] ?? [];
        if (!is_array($stts) || count($stts) === 0) json_response(false, 'Danh sách STT trống', null, 400);

        $stts = array_values(array_unique(array_filter(array_map('intval', $stts), function ($v) { return $v > 0; })));
        if (count($stts) === 0) json_response(false, 'Danh sách STT không hợp lệ', null, 400);

        $placeholders = implode(',', array_fill(0, count($stts), '?'));
        $types = str_repeat('i', count($stts));

        $stmt = $conn->prepare("SELECT STT, Serial FROM serial WHERE STT IN ($placeholders)");
        $stmt->bind_param($types, ...$stts);
        $stmt->execute();
        $rs = $stmt->get_result();
        $deleted = [];
        $deletedSerials = [];
        while ($row = $rs->fetch_assoc()) {
            $deleted[] = (int)$row['STT'];
            $deletedSerials[] = $row['Serial'];
        }
        $stmt->close();

        if (count($deleted) === 0) {
            $conn->close();
            json_response(false, 'Không có serial nào hợp lệ để xóa', null, 404);
        }

        $placeholders2 = implode(',', array_fill(0, count($deleted), '?'));
        $types2 = str_repeat('i', count($deleted));
        $del = $conn->prepare("DELETE FROM serial WHERE STT IN ($placeholders2)");
        $del->bind_param($types2, ...$deleted);
        $del->execute();
        $del->close();

        // Đồng bộ xóa trong bảng registrations
        if (!empty($deletedSerials)) {
            $regPlaceholders = implode(',', array_fill(0, count($deletedSerials), '?'));
            $regTypes = str_repeat('s', count($deletedSerials));
            $delReg = $conn->prepare("DELETE FROM registrations WHERE serial IN ($regPlaceholders)");
            if ($delReg) {
                $delReg->bind_param($regTypes, ...$deletedSerials);
                $delReg->execute();
                $delReg->close();
            }
        }

        write_admin_log(
            $conn,
            (int)$_SESSION['admin_id'],
            $_SESSION['admin_username'],
            'bulk_delete',
            'Xóa hàng loạt ' . count($deleted) . ' serial: ' . implode(', ', $deletedSerials),
            'serial',
            null,
            ['stts' => $deleted, 'serials' => $deletedSerials],
            null
        );

        $conn->close();
        json_response(true, 'Đã xóa ' . count($deleted) . ' serial', ['deleted' => $deleted]);
    }

    // ============================================================
    // RENEW - extend by N days, or set unlimited if days=-1
    // ============================================================
    if ($action === 'renew') {
        require_admin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(false, 'Chỉ hỗ trợ POST', null, 405);

        $payload = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $stt  = (int)($payload['stt'] ?? 0);
        $days = (int)($payload['days'] ?? 0);

        if ($stt <= 0) json_response(false, 'STT không hợp lệ', null, 400);
        if ($days !== -1 && ($days < 1 || $days > 3650)) json_response(false, 'Số ngày không hợp lệ (1-3650 hoặc -1 để set unlimited)', null, 400);

        $stmt = $conn->prepare("SELECT STT, Serial, Time FROM serial WHERE STT = ?");
        $stmt->bind_param('i', $stt);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row) {
            $conn->close();
            json_response(false, 'Không tìm thấy serial', null, 404);
        }

        $oldTime = $row['Time'];
        if ($days === -1) {
            $newTime = 'unlimited';
            $description = 'Set unlimited serial: ' . $row['Serial'];
        } else {
            $parsed = parseTimeField($oldTime);
            if ($parsed['kind'] === 'fixed') {
                $base = strtotime($parsed['date']);
            } else {
                $base = time();
            }
            $newTs = strtotime('+' . $days . ' days', $base);
            $newTime = date('Y-m-d', $newTs);
            $description = 'Gia hạn serial: ' . $row['Serial'] . ' thêm ' . $days . ' ngày';
        }

        $upd = $conn->prepare("UPDATE serial SET Time = ? WHERE STT = ? LIMIT 1");
        $upd->bind_param('si', $newTime, $stt);
        if (!$upd->execute()) {
            $err = $upd->error;
            $upd->close();
            $conn->close();
            json_response(false, 'Lỗi cập nhật: ' . $err, null, 500);
        }
        $upd->close();

        write_admin_log(
            $conn,
            (int)$_SESSION['admin_id'],
            $_SESSION['admin_username'],
            'renew',
            $description,
            'serial',
            (string)$stt,
            ['time' => $oldTime],
            ['time' => $newTime]
        );

        $conn->close();
        json_response(true, 'Gia hạn thành công', ['stt' => $stt, 'time' => $newTime]);
    }

    // ============================================================
    // BULK UNLIMITED
    // ============================================================
    if ($action === 'bulk_unlimited') {
        require_admin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(false, 'Chỉ hỗ trợ POST', null, 405);

        $payload = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $stts = $payload['stts'] ?? [];
        if (!is_array($stts) || count($stts) === 0) json_response(false, 'Danh sách STT trống', null, 400);

        $stts = array_values(array_unique(array_filter(array_map('intval', $stts), function ($v) { return $v > 0; })));
        if (count($stts) === 0) json_response(false, 'Danh sách STT không hợp lệ', null, 400);

        $placeholders = implode(',', array_fill(0, count($stts), '?'));
        $types = str_repeat('i', count($stts));

        $stmt = $conn->prepare("SELECT STT, Serial FROM serial WHERE STT IN ($placeholders)");
        $stmt->bind_param($types, ...$stts);
        $stmt->execute();
        $rs = $stmt->get_result();
        $serialsFound = [];
        while ($row = $rs->fetch_assoc()) {
            $serialsFound[] = ['stt' => (int)$row['STT'], 'serial' => $row['Serial']];
        }
        $stmt->close();

        if (count($serialsFound) === 0) {
            $conn->close();
            json_response(false, 'Không tìm thấy serial nào hợp lệ', null, 404);
        }

        $placeholders2 = implode(',', array_fill(0, count($serialsFound), '?'));
        $types2 = str_repeat('i', count($serialsFound));
        $ids = array_column($serialsFound, 'stt');
        $upd = $conn->prepare("UPDATE serial SET Time = 'unlimited' WHERE STT IN ($placeholders2)");
        $upd->bind_param($types2, ...$ids);
        $upd->execute();
        $upd->close();

        write_admin_log(
            $conn,
            (int)$_SESSION['admin_id'],
            $_SESSION['admin_username'],
            'bulk_unlimited',
            'Set unlimited hàng loạt cho ' . count($serialsFound) . ' serial',
            'serial',
            null,
            null,
            ['stts' => $ids, 'time' => 'unlimited']
        );

        $conn->close();
        json_response(true, 'Đã set unlimited cho ' . count($serialsFound) . ' serial', ['updated' => count($serialsFound)]);
    }

    // ============================================================
    // EXPORT CSV
    // ============================================================
    if ($action === 'export') {
        require_admin();
        $search = trim($_GET['search'] ?? '');
        $device = trim($_GET['device'] ?? '');

        $where = [];
        $types = '';
        $params = [];
        if ($search !== '') {
            $where[] = '(Device LIKE ? OR Serial LIKE ? OR Gmail LIKE ? OR CAST(STT AS CHAR) LIKE ?)';
            $like = '%' . $search . '%';
            $types .= 'ssss';
            array_push($params, $like, $like, $like, $like);
        }
        if ($device !== '') {
            $where[] = 'Device LIKE ?';
            $types .= 's';
            $params[] = '%' . $device . '%';
        }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $sql = "SELECT STT, Device, Serial, Gmail, Time FROM serial $whereSql ORDER BY STT ASC";
        $stmt = $conn->prepare($sql);
        if ($types) $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $rs = $stmt->get_result();

        $conn->close();

        $filename = 'hyperur_serial_export_' . date('Ymd_His') . '.csv';
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $out = fopen('php://output', 'w');
        // BOM for Excel UTF-8
        fwrite($out, "\xEF\xBB\xBF");
        fputcsv($out, ['STT', 'Device', 'Serial', 'Gmail', 'Time'], ',', '"', "\\");
        while ($row = $rs->fetch_assoc()) {
            $row['Time'] = formatTimeField($row['Time']);
            fputcsv($out, [$row['STT'], $row['Device'], $row['Serial'], $row['Gmail'], $row['Time']], ',', '"', "\\");
        }
        fclose($out);
        exit;
    }

    $conn->close();
    json_response(false, 'Action không hợp lệ: ' . $action, null, 400);
} catch (Throwable $e) {
    json_response(false, 'Lỗi: ' . $e->getMessage(), null, 500);
}