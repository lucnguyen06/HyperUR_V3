<?php
/**
 * Admin Authentication API
 * HyperUR V3 - Admin Serial Management
 *
 * Actions:
 *   POST action=login     { username, password }
 *   POST action=logout
 *   GET  action=check
 *   GET  action=me
 *
 * Uses table `admin_users` (id, username, password, full_name, role, active, last_login)
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
    // Tương thích với cả 2 kiểu config.php:
    //  - Kiểu cũ: tạo sẵn $conn toàn cục + biến $servername/$username/$password/$dbname
    //  - Kiểu mới: định nghĩa hằng số DB_HOST, DB_USER, DB_PASS, DB_NAME
    if (isset($GLOBALS['conn']) && $GLOBALS['conn'] instanceof mysqli) {
        $conn = $GLOBALS['conn'];
        // Bảo đảm charset utf8mb4
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

function write_admin_log($conn, $admin_id, $username, $action, $description, $table_name = null, $record_id = null, $old_data = null, $new_data = null) {
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
            $admin_id,
            $username,
            $action,
            $table_name,
            $record_id,
            $description,
            $oldJson,
            $newJson,
            $ip,
            $ua
        );
        $stmt->execute();
        $stmt->close();
    } catch (Exception $e) {
        // best-effort logging
        error_log('write_admin_log error: ' . $e->getMessage());
    }
}

$action = $_GET['action'] ?? ($_POST['action'] ?? '');

try {
    if ($action === 'login') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(false, 'Chỉ hỗ trợ POST', null, 405);
        }

        $payload = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $username = trim($payload['username'] ?? '');
        $password = (string)($payload['password'] ?? '');

        if ($username === '' || $password === '') {
            json_response(false, 'Vui lòng nhập tài khoản và mật khẩu', null, 400);
        }

        $conn = get_db_connection();
        $stmt = $conn->prepare("SELECT id, username, password, full_name, role, active FROM admin_users WHERE username = ? LIMIT 1");
        $stmt->bind_param('s', $username);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            $stmt->close();
            $conn->close();
            json_response(false, 'Tài khoản không tồn tại', null, 401);
        }

        $row = $result->fetch_assoc();
        $stmt->close();

        if ((int)$row['active'] !== 1) {
            $conn->close();
            json_response(false, 'Tài khoản đã bị vô hiệu hóa', null, 403);
        }

        if (!password_verify($password, $row['password'])) {
            $conn->close();
            json_response(false, 'Mật khẩu không đúng', null, 401);
        }

        // Successful login - update last_login
        $upd = $conn->prepare("UPDATE admin_users SET last_login = NOW() WHERE id = ?");
        $upd->bind_param('i', $row['id']);
        $upd->execute();
        $upd->close();

        write_admin_log($conn, (int)$row['id'], $row['username'], 'login', 'Đăng nhập hệ thống quản trị', 'admin_users', (string)$row['id']);

        $_SESSION['admin_id']       = (int)$row['id'];
        $_SESSION['admin_username'] = $row['username'];
        $_SESSION['admin_role']     = $row['role'];
        $_SESSION['admin_fullname'] = $row['full_name'];
        $_SESSION['admin_login_at'] = time();

        $conn->close();

        json_response(true, 'Đăng nhập thành công', [
            'id'        => (int)$row['id'],
            'username'  => $row['username'],
            'full_name' => $row['full_name'],
            'role'      => $row['role']
        ]);
    }

    if ($action === 'logout') {
        $conn = get_db_connection();
        if (isset($_SESSION['admin_id'], $_SESSION['admin_username'])) {
            write_admin_log($conn, (int)$_SESSION['admin_id'], $_SESSION['admin_username'], 'logout', 'Đăng xuất hệ thống quản trị', 'admin_users', (string)$_SESSION['admin_id']);
        }
        $conn->close();

        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();

        json_response(true, 'Đăng xuất thành công');
    }

    if ($action === 'check') {
        if (isset($_SESSION['admin_id'], $_SESSION['admin_username'])) {
            json_response(true, 'Đang đăng nhập', [
                'id'        => (int)$_SESSION['admin_id'],
                'username'  => $_SESSION['admin_username'],
                'full_name' => $_SESSION['admin_fullname'] ?? null,
                'role'      => $_SESSION['admin_role'] ?? 'admin'
            ]);
        }
        json_response(false, 'Chưa đăng nhập', null, 401);
    }

    if ($action === 'change_password') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(false, 'Chỉ hỗ trợ POST', null, 405);
        }
        if (!isset($_SESSION['admin_id'])) {
            json_response(false, 'Bạn cần đăng nhập', null, 401);
        }
        $payload = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $old = (string)($payload['old_password'] ?? '');
        $new = (string)($payload['new_password'] ?? '');

        if (strlen($new) < 6) {
            json_response(false, 'Mật khẩu mới phải có ít nhất 6 ký tự', null, 400);
        }

        $conn = get_db_connection();
        $stmt = $conn->prepare("SELECT password FROM admin_users WHERE id = ? LIMIT 1");
        $stmt->bind_param('i', $_SESSION['admin_id']);
        $stmt->execute();
        $r = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$r || !password_verify($old, $r['password'])) {
            $conn->close();
            json_response(false, 'Mật khẩu cũ không đúng', null, 401);
        }

        $hash = password_hash($new, PASSWORD_DEFAULT);
        $upd = $conn->prepare("UPDATE admin_users SET password = ? WHERE id = ?");
        $upd->bind_param('si', $hash, $_SESSION['admin_id']);
        $upd->execute();
        $upd->close();

        write_admin_log($conn, (int)$_SESSION['admin_id'], $_SESSION['admin_username'], 'change_password', 'Đổi mật khẩu', 'admin_users', (string)$_SESSION['admin_id']);

        $conn->close();
        json_response(true, 'Đổi mật khẩu thành công');
    }

    json_response(false, 'Action không hợp lệ: ' . $action, null, 400);
} catch (Throwable $e) {
    json_response(false, 'Lỗi: ' . $e->getMessage(), null, 500);
}