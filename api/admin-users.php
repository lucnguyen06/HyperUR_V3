<?php
/**
 * Admin Users Management API
 * HyperUR V3 - CHỈ DÀNH CHO SUPERADMIN
 *
 * Quản lý tài khoản admin_users (CRUD + đổi role + active/inactive + reset password).
 * Tất cả actions đều yêu cầu role = 'superadmin'.
 *
 * Schema `admin_users`:
 *   id            INT UNSIGNED PRIMARY KEY
 *   username      VARCHAR(50)     NOT NULL UNIQUE
 *   password      VARCHAR(255)    NOT NULL  -- bcrypt
 *   full_name     VARCHAR(100)    DEFAULT NULL
 *   role          ENUM('superadmin','admin') NOT NULL DEFAULT 'admin'
 *   active        TINYINT(1)      NOT NULL DEFAULT 1
 *   created_at    DATETIME        NOT NULL DEFAULT current_timestamp()
 *   last_login    DATETIME        DEFAULT NULL
 *
 * Actions:
 *   GET  ?action=list                    -> danh sách admin (search/filter, paged)
 *   GET  ?action=stats                   -> tổng số admin, superadmin, admin, active, inactive
 *   GET  ?action=get&id=NN               -> chi tiết 1 admin
 *   GET  ?action=activity&id=NN          -> 20 log gần nhất của admin đó
 *   POST ?action=add                     { username, password, full_name?, role? }
 *   POST ?action=update                  { id, full_name?, role?, active? } (không đổi password)
 *   POST ?action=delete                  { id }    -- không xoá self, không xoá superadmin cuối cùng
 *   POST ?action=reset_password          { id, new_password }   (superadmin reset pass cho bất kỳ ai)
 *   POST ?action=toggle_active           { id }    -- khoá/mở khoá tài khoản
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

function get_db_connection() {
    // Tương thích cả 2 kiểu config.php cũ và mới
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

function require_login() {
    if (!isset($_SESSION['admin_id'], $_SESSION['admin_username'])) {
        json_response(false, 'Bạn cần đăng nhập', null, 401);
    }
}

function require_superadmin() {
    require_login();
    if (($_SESSION['admin_role'] ?? '') !== 'superadmin') {
        json_response(false, 'Truy cập bị từ chối: chỉ Super Admin mới có quyền này', null, 403);
    }
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

function is_valid_username($u) {
    // Chỉ cho phép chữ thường, chữ số, dấu chấm, gạch dưới, gạch ngang. 3-50 ký tự.
    return is_string($u) && preg_match('/^[a-z0-9._-]{3,50}$/', $u);
}

function is_valid_password($pw) {
    return is_string($pw) && strlen($pw) >= 6 && strlen($pw) <= 128;
}

function is_valid_role($r) {
    return in_array($r, ['superadmin', 'admin'], true);
}

$action = $_GET['action'] ?? ($_POST['action'] ?? '');

try {
    $conn = get_db_connection();

    // ============================================================
    // LIST - paginated, searchable, filterable
    // ============================================================
    if ($action === 'list') {
        require_superadmin();

        $page    = max(1, (int)($_GET['page'] ?? 1));
        $perPage = min(100, max(5, (int)($_GET['per_page'] ?? 25)));
        $offset  = ($page - 1) * $perPage;

        $search = trim($_GET['search'] ?? '');
        $role   = trim($_GET['role'] ?? '');
        $active = trim($_GET['active'] ?? ''); // '', '1', '0'

        $where = [];
        $types = '';
        $params = [];

        if ($search !== '') {
            $where[] = '(username LIKE ? OR full_name LIKE ? OR CAST(id AS CHAR) LIKE ?)';
            $like = '%' . $search . '%';
            $types .= 'sss';
            array_push($params, $like, $like, $like);
        }
        if ($role !== '' && is_valid_role($role)) {
            $where[] = 'role = ?';
            $types .= 's';
            $params[] = $role;
        }
        if ($active === '1' || $active === '0') {
            $where[] = 'active = ?';
            $types .= 'i';
            $params[] = (int)$active;
        }

        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $countSql = "SELECT COUNT(*) AS total FROM admin_users $whereSql";
        $stmt = $conn->prepare($countSql);
        if ($types) $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $total = (int)$stmt->get_result()->fetch_assoc()['total'];
        $stmt->close();

        $sql = "SELECT id, username, full_name, role, active, created_at, last_login FROM admin_users $whereSql ORDER BY id ASC LIMIT ? OFFSET ?";
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
            $row['id'] = (int)$row['id'];
            $row['active'] = (int)$row['active'];
            $rows[] = $row;
        }
        $stmt->close();

        $conn->close();
        json_response(true, 'OK', [
            'rows'        => $rows,
            'total'       => $total,
            'page'        => $page,
            'per_page'    => $perPage,
            'total_pages' => max(1, (int)ceil($total / $perPage))
        ]);
    }

    // ============================================================
    // STATS
    // ============================================================
    if ($action === 'stats') {
        require_superadmin();
        $stats = [
            'total'        => 0,
            'superadmin'   => 0,
            'admin'        => 0,
            'active'       => 0,
            'inactive'     => 0,
            'online_today' => 0
        ];

        $rs = $conn->query("SELECT COUNT(*) AS c FROM admin_users");
        $stats['total'] = (int)($rs->fetch_assoc()['c'] ?? 0);

        $rs = $conn->query("SELECT role, active, COUNT(*) AS c FROM admin_users GROUP BY role, active");
        while ($row = $rs->fetch_assoc()) {
            $r = $row['role'];
            $a = (int)$row['active'];
            $c = (int)$row['c'];
            if ($r === 'superadmin') $stats['superadmin'] += $c;
            if ($r === 'admin')      $stats['admin']      += $c;
            if ($a === 1)            $stats['active']     += $c;
            else                     $stats['inactive']   += $c;
        }

        // online_today = last_login trong hôm nay (theo timezone server)
        $todayStart = date('Y-m-d') . ' 00:00:00';
        $todayEnd   = date('Y-m-d') . ' 23:59:59';
        $stmt = $conn->prepare("SELECT COUNT(*) AS c FROM admin_users WHERE last_login BETWEEN ? AND ?");
        $stmt->bind_param('ss', $todayStart, $todayEnd);
        $stmt->execute();
        $stats['online_today'] = (int)$stmt->get_result()->fetch_assoc()['c'];
        $stmt->close();

        $conn->close();
        json_response(true, 'OK', $stats);
    }

    // ============================================================
    // GET single
    // ============================================================
    if ($action === 'get') {
        require_superadmin();
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) json_response(false, 'ID không hợp lệ', null, 400);

        $stmt = $conn->prepare("SELECT id, username, full_name, role, active, created_at, last_login FROM admin_users WHERE id = ? LIMIT 1");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row) {
            $conn->close();
            json_response(false, 'Không tìm thấy tài khoản', null, 404);
        }
        $row['id'] = (int)$row['id'];
        $row['active'] = (int)$row['active'];

        $conn->close();
        json_response(true, 'OK', $row);
    }

    // ============================================================
    // ACTIVITY (recent logs)
    // ============================================================
    if ($action === 'activity') {
        require_superadmin();
        $id = (int)($_GET['id'] ?? 0);
        $limit = min(50, max(5, (int)($_GET['limit'] ?? 20)));
        if ($id <= 0) json_response(false, 'ID không hợp lệ', null, 400);

        $stmt = $conn->prepare("SELECT id, action, table_name, record_id, description, ip_address, created_at FROM admin_logs WHERE admin_id = ? ORDER BY id DESC LIMIT ?");
        $stmt->bind_param('ii', $id, $limit);
        $stmt->execute();
        $rs = $stmt->get_result();
        $rows = [];
        while ($row = $rs->fetch_assoc()) {
            $row['id'] = (int)$row['id'];
            $rows[] = $row;
        }
        $stmt->close();

        $conn->close();
        json_response(true, 'OK', ['rows' => $rows, 'total' => count($rows)]);
    }

    // ============================================================
    // ADD
    // ============================================================
    if ($action === 'add') {
        require_superadmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(false, 'Chỉ hỗ trợ POST', null, 405);

        $payload = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $username  = trim($payload['username'] ?? '');
        $password  = (string)($payload['password'] ?? '');
        $full_name = trim($payload['full_name'] ?? '');
        $role      = trim($payload['role'] ?? 'admin');

        if (!is_valid_username($username)) {
            json_response(false, 'Tên đăng nhập không hợp lệ (3-50 ký tự, chỉ gồm a-z, 0-9, ., _, -)', null, 400);
        }
        if (!is_valid_password($password)) {
            json_response(false, 'Mật khẩu phải có ít nhất 6 ký tự (tối đa 128)', null, 400);
        }
        if (!is_valid_role($role)) {
            json_response(false, 'Role không hợp lệ (chỉ chấp nhận superadmin hoặc admin)', null, 400);
        }

        // Kiểm tra trùng username
        $chk = $conn->prepare("SELECT id FROM admin_users WHERE LOWER(username) = LOWER(?) LIMIT 1");
        $chk->bind_param('s', $username);
        $chk->execute();
        if ($chk->get_result()->num_rows > 0) {
            $chk->close();
            $conn->close();
            json_response(false, 'Tên đăng nhập đã tồn tại trong hệ thống', null, 409);
        }
        $chk->close();

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $full_name_or_null = $full_name !== '' ? $full_name : null;

        $ins = $conn->prepare("INSERT INTO admin_users (username, password, full_name, role, active) VALUES (?, ?, ?, ?, 1)");
        $ins->bind_param('ssss', $username, $hash, $full_name_or_null, $role);
        if (!$ins->execute()) {
            $err = $ins->error;
            $ins->close();
            $conn->close();
            json_response(false, 'Lỗi thêm admin: ' . $err, null, 500);
        }
        $newId = $ins->insert_id;
        $ins->close();

        write_admin_log(
            $conn,
            (int)$_SESSION['admin_id'],
            $_SESSION['admin_username'],
            'admin_add',
            'Thêm admin mới: ' . $username . ' (role=' . $role . ')',
            'admin_users',
            (string)$newId,
            null,
            ['username' => $username, 'full_name' => $full_name_or_null, 'role' => $role, 'active' => 1]
        );

        $conn->close();
        json_response(true, 'Đã thêm tài khoản admin mới', ['id' => $newId, 'username' => $username]);
    }

    // ============================================================
    // UPDATE - đổi full_name, role, active (KHÔNG đổi password ở đây)
    // ============================================================
    if ($action === 'update') {
        require_superadmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(false, 'Chỉ hỗ trợ POST', null, 405);

        $payload = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id        = (int)($payload['id'] ?? 0);
        $full_name = array_key_exists('full_name', $payload) ? trim((string)$payload['full_name']) : null;
        $role_in   = array_key_exists('role', $payload) ? trim((string)$payload['role']) : null;
        $active_in = array_key_exists('active', $payload) ? (int)$payload['active'] : null;

        if ($id <= 0) json_response(false, 'ID không hợp lệ', null, 400);

        // Read existing
        $stmt = $conn->prepare("SELECT id, username, full_name, role, active FROM admin_users WHERE id = ? LIMIT 1");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $oldRow = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$oldRow) {
            $conn->close();
            json_response(false, 'Không tìm thấy tài khoản', null, 404);
        }

        // Validate new role
        $role = $oldRow['role'];
        if ($role_in !== null) {
            if (!is_valid_role($role_in)) {
                $conn->close();
                json_response(false, 'Role không hợp lệ', null, 400);
            }
            // Không cho tự hạ quyền nếu là superadmin cuối cùng
            if ($role_in === 'admin' && $oldRow['role'] === 'superadmin') {
                $cnt = (int)$conn->query("SELECT COUNT(*) AS c FROM admin_users WHERE role = 'superadmin' AND active = 1")->fetch_assoc()['c'];
                if ($cnt <= 1) {
                    $conn->close();
                    json_response(false, 'Không thể hạ quyền Super Admin cuối cùng đang hoạt động', null, 403);
                }
            }
            $role = $role_in;
        }

        // Active
        $active = (int)$oldRow['active'];
        if ($active_in !== null) {
            if ($active_in !== 0 && $active_in !== 1) {
                $conn->close();
                json_response(false, 'Active phải là 0 hoặc 1', null, 400);
            }
            // Không cho tự vô hiệu hoá nếu là superadmin cuối cùng
            if ($active_in === 0 && (int)$oldRow['active'] === 1) {
                if ($oldRow['role'] === 'superadmin') {
                    $cnt = (int)$conn->query("SELECT COUNT(*) AS c FROM admin_users WHERE role = 'superadmin' AND active = 1")->fetch_assoc()['c'];
                    if ($cnt <= 1) {
                        $conn->close();
                        json_response(false, 'Không thể khoá Super Admin cuối cùng đang hoạt động', null, 403);
                    }
                }
            }
            $active = $active_in;
        }

        // Full name
        $newFullName = $full_name !== null ? ($full_name !== '' ? $full_name : null) : $oldRow['full_name'];

        $upd = $conn->prepare("UPDATE admin_users SET full_name = ?, role = ?, active = ? WHERE id = ? LIMIT 1");
        $upd->bind_param('ssii', $newFullName, $role, $active, $id);
        if (!$upd->execute()) {
            $err = $upd->error;
            $upd->close();
            $conn->close();
            json_response(false, 'Lỗi cập nhật: ' . $err, null, 500);
        }
        $upd->close();

        $oldData = [
            'full_name' => $oldRow['full_name'],
            'role'      => $oldRow['role'],
            'active'    => (int)$oldRow['active']
        ];
        $newData = [
            'full_name' => $newFullName,
            'role'      => $role,
            'active'    => $active
        ];
        write_admin_log(
            $conn,
            (int)$_SESSION['admin_id'],
            $_SESSION['admin_username'],
            'admin_update',
            'Cập nhật admin: ' . $oldRow['username'],
            'admin_users',
            (string)$id,
            $oldData,
            $newData
        );

        $conn->close();
        json_response(true, 'Đã cập nhật tài khoản');
    }

    // ============================================================
    // DELETE
    // ============================================================
    if ($action === 'delete') {
        require_superadmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(false, 'Chỉ hỗ trợ POST', null, 405);

        $payload = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = (int)($payload['id'] ?? 0);
        if ($id <= 0) json_response(false, 'ID không hợp lệ', null, 400);

        // Không cho xoá chính mình
        if ($id === (int)$_SESSION['admin_id']) {
            $conn->close();
            json_response(false, 'Không thể xoá chính tài khoản đang đăng nhập', null, 403);
        }

        $stmt = $conn->prepare("SELECT id, username, role, active FROM admin_users WHERE id = ? LIMIT 1");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $oldRow = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$oldRow) {
            $conn->close();
            json_response(false, 'Không tìm thấy tài khoản', null, 404);
        }

        // Bảo toàn tối thiểu 1 superadmin đang hoạt động
        if ($oldRow['role'] === 'superadmin') {
            $cnt = (int)$conn->query("SELECT COUNT(*) AS c FROM admin_users WHERE role = 'superadmin' AND active = 1")->fetch_assoc()['c'];
            if ($cnt <= 1) {
                $conn->close();
                json_response(false, 'Không thể xoá Super Admin cuối cùng đang hoạt động', null, 403);
            }
        }

        $del = $conn->prepare("DELETE FROM admin_users WHERE id = ? LIMIT 1");
        $del->bind_param('i', $id);
        if (!$del->execute()) {
            $err = $del->error;
            $del->close();
            $conn->close();
            json_response(false, 'Lỗi xoá: ' . $err, null, 500);
        }
        $del->close();

        write_admin_log(
            $conn,
            (int)$_SESSION['admin_id'],
            $_SESSION['admin_username'],
            'admin_delete',
            'Xoá tài khoản admin: ' . $oldRow['username'],
            'admin_users',
            (string)$id,
            [
                'username' => $oldRow['username'],
                'role'     => $oldRow['role'],
                'active'   => (int)$oldRow['active']
            ],
            null
        );

        $conn->close();
        json_response(true, 'Đã xoá tài khoản admin');
    }

    // ============================================================
    // RESET_PASSWORD - superadmin reset mật khẩu cho user bất kỳ
    // ============================================================
    if ($action === 'reset_password') {
        require_superadmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(false, 'Chỉ hỗ trợ POST', null, 405);

        $payload = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id          = (int)($payload['id'] ?? 0);
        $new_password = (string)($payload['new_password'] ?? '');

        if ($id <= 0) json_response(false, 'ID không hợp lệ', null, 400);
        if (!is_valid_password($new_password)) {
            json_response(false, 'Mật khẩu mới phải có ít nhất 6 ký tự (tối đa 128)', null, 400);
        }

        $stmt = $conn->prepare("SELECT id, username FROM admin_users WHERE id = ? LIMIT 1");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row) {
            $conn->close();
            json_response(false, 'Không tìm thấy tài khoản', null, 404);
        }

        $hash = password_hash($new_password, PASSWORD_DEFAULT);
        $upd = $conn->prepare("UPDATE admin_users SET password = ? WHERE id = ? LIMIT 1");
        $upd->bind_param('si', $hash, $id);
        if (!$upd->execute()) {
            $err = $upd->error;
            $upd->close();
            $conn->close();
            json_response(false, 'Lỗi cập nhật mật khẩu: ' . $err, null, 500);
        }
        $upd->close();

        write_admin_log(
            $conn,
            (int)$_SESSION['admin_id'],
            $_SESSION['admin_username'],
            'admin_reset_password',
            'Reset mật khẩu cho admin: ' . $row['username'],
            'admin_users',
            (string)$id,
            null,
            null
        );

        $conn->close();
        json_response(true, 'Đã reset mật khẩu');
    }

    // ============================================================
    // TOGGLE_ACTIVE - khoá / mở khoá
    // ============================================================
    if ($action === 'toggle_active') {
        require_superadmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(false, 'Chỉ hỗ trợ POST', null, 405);

        $payload = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = (int)($payload['id'] ?? 0);
        if ($id <= 0) json_response(false, 'ID không hợp lệ', null, 400);

        $stmt = $conn->prepare("SELECT id, username, role, active FROM admin_users WHERE id = ? LIMIT 1");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row) {
            $conn->close();
            json_response(false, 'Không tìm thấy tài khoản', null, 404);
        }

        $newActive = ((int)$row['active'] === 1) ? 0 : 1;

        // Nếu đang khoá (active 1 -> 0), kiểm tra không khoá superadmin cuối cùng
        if ($newActive === 0 && $row['role'] === 'superadmin') {
            $cnt = (int)$conn->query("SELECT COUNT(*) AS c FROM admin_users WHERE role = 'superadmin' AND active = 1")->fetch_assoc()['c'];
            if ($cnt <= 1) {
                $conn->close();
                json_response(false, 'Không thể khoá Super Admin cuối cùng đang hoạt động', null, 403);
            }
        }

        $upd = $conn->prepare("UPDATE admin_users SET active = ? WHERE id = ? LIMIT 1");
        $upd->bind_param('ii', $newActive, $id);
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
            'admin_toggle_active',
            ($newActive === 1 ? 'Mở khoá' : 'Khoá') . ' tài khoản admin: ' . $row['username'],
            'admin_users',
            (string)$id,
            ['active' => (int)$row['active']],
            ['active' => $newActive]
        );

        $conn->close();
        json_response(true, $newActive === 1 ? 'Đã mở khoá tài khoản' : 'Đã khoá tài khoản', ['active' => $newActive]);
    }

    $conn->close();
    json_response(false, 'Action không hợp lệ: ' . $action, null, 400);
} catch (Throwable $e) {
    json_response(false, 'Lỗi: ' . $e->getMessage(), null, 500);
}