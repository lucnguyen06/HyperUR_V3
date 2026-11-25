<?php
/**
 * HyperUR V3 - QR Account Rotation API
 *
 * Tự động xoay vòng tài khoản VietQR sau mỗi 5 lần giao dịch hợp lệ (tăng từ SePay webhook)
 * Đồng bộ toàn hệ thống qua Database (MySQL)
 *
 * Endpoints:
 *   GET  /api/qr-active.php                    -> (Public) Lấy thông tin tài khoản đang kích hoạt
 *   POST /api/qr-active.php?action=record_scan -> (Admin only) Ghi nhận 1 lượt (+1)
 *   POST /api/qr-active.php?action=switch_next -> (Admin only) Chuyển ngay sang tài khoản tiếp theo
 */

require_once __DIR__ . '/config.php';

// Danh sách tài khoản MBBank xoay vòng
const QR_ACCOUNTS = [
    [
        'id'   => 0,
        'name' => 'NGUYEN TAN LUC',
        'acc'  => 'VQRQAMNWP9901',
        'bank' => 'MBBank',
        'url'  => 'https://vietqr.app/img?bank=MBBank&acc=VQRQAMNWP9901&template=&showinfo=true&holder=NGUYEN%20TAN%20LUC'
    ],
    [
        'id'   => 1,
        'name' => 'NGUYEN VAN TUC',
        'acc'  => 'VQRQANJTA5424',
        'bank' => 'MBBank',
        'url'  => 'https://vietqr.app/img?bank=MBBank&acc=VQRQANJTA5424&template=&showinfo=true&holder=NGUYEN%20VAN%20TUC'
    ]
];

const QR_ROTATE_THRESHOLD = 5;

function qr_response($success, $data = [], $message = '', $httpCode = 200) {
    http_response_code($httpCode);
    echo json_encode(array_merge([
        'success' => (bool)$success,
        'message' => $message,
    ], $data), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$action = $_GET['action'] ?? ($_POST['action'] ?? 'get');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Bảo vệ mọi thao tác ghi thay đổi trạng thái xoay QR: chỉ khởi động phiên Admin qua _bootstrap.php khi cần ghi
$mutatingActions = ['record_scan', 'record_submit', 'switch_next'];
if (in_array($action, $mutatingActions, true)) {
    require_once __DIR__ . '/_bootstrap.php';   // JSON headers + safe CORS + admin session
    if ($method !== 'POST') {
        qr_response(false, [], 'Chỉ hỗ trợ phương thức POST cho thao tác này', 405);
    }
    if (!isset($_SESSION['admin_id'], $_SESSION['admin_username'])) {
        qr_response(false, [], 'Bạn cần đăng nhập quản trị để thực hiện thao tác này', 401);
    }
} else {
    // Public read-only GET: không tạo session cookie ẩn danh, giữ CORS công khai chỉ đọc
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store, max-age=0');

    if ($method === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    if ($method !== 'GET') {
        qr_response(false, [], 'Chỉ hỗ trợ phương thức GET cho thao tác đọc', 405);
    }
}

try {
    $conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        error_log('[qr-active] DB connect failed: ' . $conn->connect_error);
        // Fallback an toàn nếu DB lỗi: dùng tài khoản 0
        qr_response(true, [
            'index'     => 0,
            'count'     => 0,
            'threshold' => QR_ROTATE_THRESHOLD,
            'total'     => 0,
            'account'   => QR_ACCOUNTS[0],
            'warning'   => 'Fallback to default account'
        ]);
    }
    $conn->set_charset('utf8mb4');

    // Khởi tạo bảng system_settings nếu chưa có
    @$conn->query("
        CREATE TABLE IF NOT EXISTS `system_settings` (
            `setting_key`   VARCHAR(50) PRIMARY KEY,
            `setting_value` TEXT NOT NULL,
            `updated_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // 1. Thao tác ghi nhận lượt mới (+1) — chỉ Admin
    if ($action === 'record_scan' || $action === 'record_submit') {
        @$conn->query("
            INSERT INTO `system_settings` (`setting_key`, `setting_value`)
            VALUES ('qr_rotation_count', '1')
            ON DUPLICATE KEY UPDATE `setting_value` = CAST(`setting_value` AS UNSIGNED) + 1
        ");
    }

    // 2. Thao tác chuyển ngay sang tài khoản tiếp theo — chỉ Admin
    if ($action === 'switch_next') {
        $curVal = 0;
        $r = $conn->query("SELECT `setting_value` FROM `system_settings` WHERE `setting_key` = 'qr_rotation_count' LIMIT 1");
        if ($r && $row = $r->fetch_assoc()) {
            $curVal = (int)$row['setting_value'];
        }
        $nextMultiple = (string)(((int)floor($curVal / QR_ROTATE_THRESHOLD) + 1) * QR_ROTATE_THRESHOLD);
        $stmt = $conn->prepare("
            INSERT INTO `system_settings` (`setting_key`, `setting_value`)
            VALUES ('qr_rotation_count', ?)
            ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`)
        ");
        if ($stmt) {
            $stmt->bind_param('s', $nextMultiple);
            $stmt->execute();
            $stmt->close();
        }
    }

    // 3. Đọc tổng số lượt hiện tại
    $totalCount = 0;
    $res = $conn->query("SELECT `setting_value` FROM `system_settings` WHERE `setting_key` = 'qr_rotation_count' LIMIT 1");
    if ($res && $row = $res->fetch_assoc()) {
        $totalCount = (int)$row['setting_value'];
    } else {
        // Nếu chưa có trong settings, khởi tạo theo số giao dịch SePay matched trong DB
        $txRes = $conn->query("SELECT COUNT(*) AS c FROM `payment_transactions` WHERE `status` = 'matched'");
        if ($txRes && $txRow = $txRes->fetch_assoc()) {
            $totalCount = (int)$txRow['c'];
        }
        $initStmt = $conn->prepare("
            INSERT IGNORE INTO `system_settings` (`setting_key`, `setting_value`)
            VALUES ('qr_rotation_count', ?)
        ");
        if ($initStmt) {
            $totalStr = (string)$totalCount;
            $initStmt->bind_param('s', $totalStr);
            $initStmt->execute();
            $initStmt->close();
        }
    }

    $conn->close();

    $accountsCount = count(QR_ACCOUNTS);
    $activeIdx     = (int)floor($totalCount / QR_ROTATE_THRESHOLD) % $accountsCount;
    $cycleCount    = $totalCount % QR_ROTATE_THRESHOLD;
    $activeAccount = QR_ACCOUNTS[$activeIdx];

    qr_response(true, [
        'index'     => $activeIdx,
        'count'     => $cycleCount,
        'threshold' => QR_ROTATE_THRESHOLD,
        'total'     => $totalCount,
        'account'   => $activeAccount,
        'accounts'  => QR_ACCOUNTS
    ], "Đang sử dụng tài khoản: {$activeAccount['name']} ({$cycleCount}/" . QR_ROTATE_THRESHOLD . ")");

} catch (Throwable $e) {
    error_log('[qr-active] Unexpected error: ' . $e->getMessage());
    qr_response(true, [
        'index'     => 0,
        'count'     => 0,
        'threshold' => QR_ROTATE_THRESHOLD,
        'total'     => 0,
        'account'   => QR_ACCOUNTS[0],
        'warning'   => 'Fallback to default account'
    ]);
}
