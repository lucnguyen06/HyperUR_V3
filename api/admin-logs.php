<?php
/**
 * Admin Logs API
 * HyperUR V3 - Xem admin_logs
 *
 * GET action=list  -> danh sách log (phân trang, lọc theo action/username)
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
        json_response(false, 'Bạn cần đăng nhập', null, 401);
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

$action = $_GET['action'] ?? ($_POST['action'] ?? '');

try {
    $conn = get_db_connection();

    if ($action === 'list') {
        require_admin();

        $page    = max(1, (int)($_GET['page'] ?? 1));
        $perPage = min(100, max(5, (int)($_GET['per_page'] ?? 30)));
        $offset  = ($page - 1) * $perPage;

        $search   = trim($_GET['search'] ?? '');
        $username = trim($_GET['username'] ?? '');
        $act      = trim($_GET['log_action'] ?? '');
        $table    = trim($_GET['table'] ?? '');
        $from     = $_GET['from'] ?? '';
        $to       = $_GET['to'] ?? '';

        $where = [];
        $types = '';
        $params = [];

        if ($search !== '') {
            $where[] = '(description LIKE ? OR record_id LIKE ?)';
            $like = '%' . $search . '%';
            $types .= 'ss';
            array_push($params, $like, $like);
        }
        if ($username !== '') {
            $where[] = 'username = ?';
            $types .= 's';
            $params[] = $username;
        }
        if ($act !== '') {
            $where[] = 'action = ?';
            $types .= 's';
            $params[] = $act;
        }
        if ($table !== '') {
            $where[] = 'table_name = ?';
            $types .= 's';
            $params[] = $table;
        }
        if ($from !== '') {
            $where[] = 'created_at >= ?';
            $types .= 's';
            $params[] = $from . ' 00:00:00';
        }
        if ($to !== '') {
            $where[] = 'created_at <= ?';
            $types .= 's';
            $params[] = $to . ' 23:59:59';
        }

        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $countSql = "SELECT COUNT(*) AS total FROM admin_logs $whereSql";
        $stmt = $conn->prepare($countSql);
        if ($types) $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $total = (int)$stmt->get_result()->fetch_assoc()['total'];
        $stmt->close();

        $sql = "SELECT id, admin_id, username, action, table_name, record_id, description, old_data, new_data, ip_address, created_at
                FROM admin_logs $whereSql ORDER BY id DESC LIMIT ? OFFSET ?";
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
            $row['admin_id'] = (int)$row['admin_id'];
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

    // Distinct values for filters
    if ($action === 'facets') {
        require_admin();
        $out = ['usernames' => [], 'actions' => [], 'tables' => []];
        $rs = $conn->query("SELECT DISTINCT username FROM admin_logs WHERE username IS NOT NULL ORDER BY username");
        while ($row = $rs->fetch_assoc()) $out['usernames'][] = $row['username'];
        $rs = $conn->query("SELECT DISTINCT action FROM admin_logs ORDER BY action");
        while ($row = $rs->fetch_assoc()) $out['actions'][] = $row['action'];
        $rs = $conn->query("SELECT DISTINCT table_name FROM admin_logs WHERE table_name IS NOT NULL ORDER BY table_name");
        while ($row = $rs->fetch_assoc()) $out['tables'][] = $row['table_name'];
        $conn->close();
        json_response(true, 'OK', $out);
    }

    $conn->close();
    json_response(false, 'Action không hợp lệ: ' . $action, null, 400);
} catch (Throwable $e) {
    json_response(false, 'Lỗi: ' . $e->getMessage(), null, 500);
}