<?php
/**
 * Serial Lookup API
 * HyperUR V3 - PHP System
 * Endpoint: GET /api/serial-lookup.php?serial=ABC123456
 */

// Support CLI invocation (Cho phép Telegram Bot chạy trực tiếp không qua HTTP/Loopback)
if (php_sapi_name() === 'cli') {
    $_SERVER['REQUEST_METHOD'] = 'GET';
    parse_str($argv[1] ?? '', $_GET);
}

// Headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only accept GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Chỉ hỗ trợ phương thức GET'
    ]);
    exit;
}

require_once __DIR__ . '/config.php';

try {
    // Get query parameters (hỗ trợ cả serial và email)
    $serial = isset($_GET['serial']) ? strtoupper(trim($_GET['serial'])) : '';
    $email  = isset($_GET['email']) ? strtolower(trim($_GET['email'])) : '';
    
    if (empty($serial) && empty($email)) {
        throw new Exception('Vui lòng cung cấp số Serial hoặc Email');
    }
    
    // Connect to database
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    
    if ($conn->connect_error) {
        throw new Exception('Kết nối database thất bại');
    }
    
    $conn->set_charset('utf8mb4');

    // Tự động bảo đảm bảng tồn tại
    @$conn->query("
        CREATE TABLE IF NOT EXISTS `registrations` (
            `id`               INT AUTO_INCREMENT PRIMARY KEY,
            `serial`           VARCHAR(50)  NOT NULL UNIQUE,
            `codename`         VARCHAR(100) NOT NULL,
            `plan`             VARCHAR(100) DEFAULT NULL,
            `payment_method`   VARCHAR(50)  DEFAULT NULL,
            `sender_name`      VARCHAR(100) DEFAULT NULL,
            `sender_email`     VARCHAR(100) NOT NULL,
            `transaction_code` VARCHAR(100) DEFAULT NULL,
            `status`           ENUM('Pending', 'Active', 'Expired', 'Suspended') DEFAULT 'Pending',
            `activated_at`     DATETIME     DEFAULT NULL,
            `expired_at`       DATETIME     DEFAULT NULL,
            `created_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            `updated_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `idx_serial` (`serial`),
            INDEX `idx_email`  (`sender_email`),
            INDEX `idx_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    @$conn->query("
        CREATE TABLE IF NOT EXISTS `activity_logs` (
            `id`         INT AUTO_INCREMENT PRIMARY KEY,
            `serial`     VARCHAR(50) NOT NULL,
            `action`     VARCHAR(50) NOT NULL,
            `description` TEXT,
            `ip_address` VARCHAR(45) DEFAULT NULL,
            `user_agent` TEXT DEFAULT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_serial`  (`serial`),
            INDEX `idx_action`  (`action`),
            INDEX `idx_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // =========================================================
    // 1. Tra cứu số lượng và danh sách thiết bị theo Email từ MySQL
    // =========================================================
    if (!empty($email)) {
        $devices = [];
        $existingSerials = [];

        // Lấy từ bảng serial gốc (nguồn chuẩn quyết định bản quyền)
        $stmtSerial = $conn->prepare("SELECT STT, Device, Serial, Gmail, Time FROM serial WHERE LOWER(TRIM(Gmail)) = ? ORDER BY STT DESC");
        if ($stmtSerial) {
            $stmtSerial->bind_param("s", $email);
            $stmtSerial->execute();
            $rSerial = $stmtSerial->get_result();
            while ($r = $rSerial->fetch_assoc()) {
                $sn = trim($r['Serial'] ?? '');
                if ($sn === '' || in_array(strtolower($sn), $existingSerials, true)) continue;
                $existingSerials[] = strtolower($sn);

                $isUnl = (strtolower(trim($r['Time'] ?? '')) === 'unlimited');
                $devices[] = [
                    'serial'     => $sn,
                    'codename'   => $r['Device'] ?: 'Mobile',
                    'plan'       => $isUnl ? 'Trọn Đời (Lifetime)' : ('Hạn dùng: ' . $r['Time']),
                    'status'     => 'Active',
                    'statusCode' => 'active',
                    'statusText' => 'Đã Kích Hoạt',
                    'time'       => $isUnl ? 'Vĩnh viễn' : $r['Time']
                ];
            }
            $stmtSerial->close();
        }

        // Lấy từ bảng registrations
        $stmtReg = $conn->prepare("SELECT serial, codename, plan, status, created_at, expired_at FROM registrations WHERE LOWER(TRIM(sender_email)) = ? ORDER BY id DESC");
        if ($stmtReg) {
            $stmtReg->bind_param("s", $email);
            $stmtReg->execute();
            $rReg = $stmtReg->get_result();
            while ($r = $rReg->fetch_assoc()) {
                $sn = trim($r['serial'] ?? '');
                if ($sn === '' || in_array(strtolower($sn), $existingSerials, true)) continue;

                $st = $r['status'] ?: 'Pending';
                // Nếu bản ghi ghi là Active nhưng không có trong bảng serial -> đã bị admin xóa
                if (strtolower($st) === 'active') {
                    // Dọn dẹp bản ghi mồ côi
                    @$conn->query("DELETE FROM registrations WHERE LOWER(TRIM(serial)) = '" . $conn->real_escape_string(strtolower($sn)) . "'");
                    continue;
                }

                $existingSerials[] = strtolower($sn);
                $devices[] = [
                    'serial'     => $sn,
                    'codename'   => $r['codename'],
                    'plan'       => $r['plan'] ?: 'Chờ duyệt',
                    'status'     => $st,
                    'statusCode' => 'pending',
                    'statusText' => 'Chờ Kích Hoạt',
                    'time'       => 'Chờ duyệt'
                ];
            }
            $stmtReg->close();
        }

        // Đếm chính xác số thiết bị đã kích hoạt
        $activeCount = 0;
        foreach ($devices as $d) {
            if ($d['statusCode'] === 'active') {
                $activeCount++;
            }
        }
        $conn->close();

        echo json_encode([
            'success' => true,
            'found'   => ($activeCount > 0 || count($devices) > 0),
            'type'    => 'email',
            'email'   => $email,
            'count'   => $activeCount,
            'devices' => $devices
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // =========================================================
    // 2. Tra cứu chi tiết bản quyền theo Serial
    // =========================================================
    // Tra cứu trong bảng `serial` trước (nguồn chuẩn quyết định bản quyền)
    $stmtSerial = $conn->prepare("SELECT STT, Device, Serial, Gmail, Time FROM serial WHERE LOWER(TRIM(Serial)) = LOWER(?) LIMIT 1");
    $sRow = null;
    if ($stmtSerial) {
        $stmtSerial->bind_param("s", $serial);
        $stmtSerial->execute();
        $resSerial = $stmtSerial->get_result();
        if ($resSerial && $resSerial->num_rows > 0) {
            $sRow = $resSerial->fetch_assoc();
        }
        $stmtSerial->close();
    }

    // Tra cứu thông tin từ bảng `registrations` (nếu có)
    $stmtReg = $conn->prepare("SELECT serial, codename, plan, payment_method, sender_name, sender_email, transaction_code, status, created_at, activated_at, expired_at, updated_at FROM registrations WHERE LOWER(TRIM(serial)) = LOWER(?) LIMIT 1");
    $regRow = null;
    if ($stmtReg) {
        $stmtReg->bind_param("s", $serial);
        $stmtReg->execute();
        $resReg = $stmtReg->get_result();
        if ($resReg && $resReg->num_rows > 0) {
            $regRow = $resReg->fetch_assoc();
        }
        $stmtReg->close();
    }

    $formatDate = function($datetime) {
        if (!$datetime) return '';
        $dt = new DateTime($datetime);
        return $dt->format('d/m/Y H:i');
    };

    // Trường hợp 1: Có trong bảng serial -> Bản quyền hợp lệ
    if ($sRow) {
        $isUnlimited = (strtolower(trim($sRow['Time'] ?? '')) === 'unlimited');
        $deviceDisplay = $sRow['Device'] ?: ($regRow['codename'] ?? 'Mobile');
        $timeVal = trim($sRow['Time'] ?? '');
        $isExpired = false;
        if (!$isUnlimited) {
            $ts = false;
            if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $timeVal, $m)) {
                $ts = strtotime($timeVal);
            } elseif (preg_match('/^(\d{2})(\d{2})(\d{4})$/', $timeVal, $m)) {
                $ts = strtotime("{$m[3]}-{$m[2]}-{$m[1]}");
            } else {
                $ts = strtotime($timeVal);
            }
            if ($ts !== false && $ts < strtotime(date('Y-m-d'))) {
                $isExpired = true;
            }
        }
        $statusCode = $isExpired ? 'expired' : 'active';
        $statusText = $isExpired ? 'Đã Hết Hạn' : 'Đã Kích Hoạt';

        $responseData = [
            'serial'          => $sRow['Serial'],
            'codename'        => $regRow['codename'] ?? $deviceDisplay,
            'deviceName'      => $deviceDisplay,
            'plan'            => $regRow['plan'] ?? ($isUnlimited ? 'Trọn Đời (Lifetime)' : ('Hạn dùng: ' . $sRow['Time'])),
            'statusCode'      => $statusCode,
            'statusText'      => $statusText,
            'paymentMethod'   => $regRow['payment_method'] ?? 'Hệ Thống Bản Quyền HyperUR',
            'senderName'      => $regRow['sender_name'] ?? 'Thành Viên HyperUR',
            'senderEmail'     => $sRow['Gmail'] ?: ($regRow['sender_email'] ?? ''),
            'transactionCode' => $regRow['transaction_code'] ?? ('STT-' . $sRow['STT']),
            'status'          => $isExpired ? 'Expired' : 'Active',
            'registeredDate'  => $regRow ? $formatDate($regRow['created_at']) : 'Hệ Thống',
            'activatedDate'   => $regRow ? $formatDate($regRow['activated_at']) : ($isUnlimited ? 'Vĩnh Viễn' : 'Hệ Thống'),
            'expiredDate'     => $isUnlimited ? 'Vĩnh viễn' : $sRow['Time'],
            'updatedDate'     => $regRow ? $formatDate($regRow['updated_at']) : '',
            'features'        => [
                'Mở khóa toàn quyền bản ROM HyperUR',
                'Bypass Play Integrity mặc định (mọi app ngân hàng, VNeID)',
                'Hỗ trợ kỹ thuật và OTA trực tiếp từ Admin'
            ]
        ];

        $ip = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
        $userAgent = substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 0, 500);
        @$conn->query("INSERT INTO activity_logs (serial, action, description, ip_address, user_agent) VALUES ('" . $conn->real_escape_string($serial) . "', 'lookup', 'Tra cứu serial gốc thành công', '" . $conn->real_escape_string($ip) . "', '" . $conn->real_escape_string($userAgent) . "')");
        $conn->close();

        echo json_encode([
            'success' => true,
            'found'   => true,
            'message' => 'Tìm thấy Serial',
            'data'    => $responseData
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Trường hợp 2: Không có trong bảng serial
    // Kiểm tra xem có trong registrations không
    if ($regRow) {
        $st = $regRow['status'] ?: 'Pending';
        if (strtolower($st) === 'active') {
            // Đã từng active nhưng hiện không có trong bảng serial -> serial ĐÃ BỊ XÓA BỞI ADMIN
            // Dọn dẹp bản ghi mồ côi trong registrations
            @$conn->query("DELETE FROM registrations WHERE LOWER(TRIM(serial)) = '" . $conn->real_escape_string(strtolower($serial)) . "'");
            $conn->close();

            echo json_encode([
                'success' => true,
                'found'   => false,
                'message' => 'Không tìm thấy Serial này trong hệ thống'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Đơn hàng đang chờ duyệt
        $responseData = [
            'serial'          => $regRow['serial'],
            'codename'        => $regRow['codename'],
            'deviceName'      => 'Thiết bị ' . $regRow['codename'],
            'plan'            => $regRow['plan'],
            'statusCode'      => 'pending',
            'statusText'      => 'Chờ Kích Hoạt',
            'paymentMethod'   => $regRow['payment_method'],
            'senderName'      => $regRow['sender_name'],
            'senderEmail'     => $regRow['sender_email'],
            'transactionCode' => $regRow['transaction_code'],
            'status'          => $st,
            'registeredDate'  => $formatDate($regRow['created_at']),
            'activatedDate'   => '',
            'expiredDate'     => '',
            'updatedDate'     => $formatDate($regRow['updated_at']),
            'features'        => [
                'Mở khóa toàn quyền bản ROM HyperUR',
                'Bypass Play Integrity mặc định (mọi app ngân hàng, VNeID)',
                'Hỗ trợ kỹ thuật và OTA trực tiếp từ Admin'
            ]
        ];

        $conn->close();
        echo json_encode([
            'success' => true,
            'found'   => true,
            'message' => 'Serial đang chờ đối soát & kích hoạt',
            'data'    => $responseData
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Không tìm thấy ở cả 2 bảng
    $conn->close();
    echo json_encode([
        'success' => true,
        'found'   => false,
        'message' => 'Không tìm thấy Serial này trong hệ thống'
    ], JSON_UNESCAPED_UNICODE);
    exit;
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Lỗi: ' . $e->getMessage()
    ]);
    error_log('Serial lookup error: ' . $e->getMessage());
}
