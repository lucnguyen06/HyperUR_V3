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

        // Lấy từ bảng serial gốc
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
                $existingSerials[] = strtolower($sn);

                $st = $r['status'] ?: 'Pending';
                $isActive = (strtolower($st) === 'active');
                $devices[] = [
                    'serial'     => $sn,
                    'codename'   => $r['codename'],
                    'plan'       => $r['plan'] ?: 'Active Free',
                    'status'     => $st,
                    'statusCode' => strtolower($st),
                    'statusText' => $isActive ? 'Đã Kích Hoạt' : 'Chờ Kích Hoạt',
                    'time'       => $r['expired_at'] ? date('d/m/Y', strtotime($r['expired_at'])) : 'Vĩnh viễn'
                ];
            }
            $stmtReg->close();
        }

        $totalCount = count($devices);
        $conn->close();

        echo json_encode([
            'success' => true,
            'found'   => ($totalCount > 0),
            'type'    => 'email',
            'email'   => $email,
            'count'   => $totalCount,
            'devices' => $devices
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // =========================================================
    // 2. Tra cứu chi tiết bản quyền theo Serial
    // =========================================================
    $stmt = $conn->prepare("
        SELECT 
            serial,
            codename,
            plan,
            payment_method,
            sender_name,
            sender_email,
            transaction_code,
            status,
            created_at,
            activated_at,
            expired_at,
            updated_at
        FROM registrations 
        WHERE serial = ?
    ");
    
    $stmt->bind_param("s", $serial);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $stmt->close();

        // Fallback: tra cứu trong bảng serial gốc của hệ thống (hơn 500 serial có sẵn)
        $stmt2 = $conn->prepare("SELECT STT, Device, Serial, Gmail, Time FROM serial WHERE LOWER(Serial) = LOWER(?) LIMIT 1");
        if ($stmt2) {
            $stmt2->bind_param("s", $serial);
            $stmt2->execute();
            $res2 = $stmt2->get_result();
            if ($res2 && $res2->num_rows > 0) {
                $sRow = $res2->fetch_assoc();
                $stmt2->close();
                
                $isUnlimited = (strtolower(trim($sRow['Time'] ?? '')) === 'unlimited');
                $deviceDisplay = $sRow['Device'] ?: 'Mobile';
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
                    'serial' => $sRow['Serial'],
                    'codename' => $deviceDisplay,
                    'deviceName' => $deviceDisplay,
                    'plan' => $isUnlimited ? 'Trọn Đời (Lifetime)' : ('Hạn dùng: ' . $sRow['Time']),
                    'statusCode' => $statusCode,
                    'statusText' => $statusText,
                    'paymentMethod' => 'Hệ Thống Bản Quyền HyperUR',
                    'senderName' => 'Thành Viên HyperUR',
                    'senderEmail' => $sRow['Gmail'],
                    'transactionCode' => 'STT-' . $sRow['STT'],
                    'status' => $isExpired ? 'Expired' : 'Active',
                    'registeredDate' => 'Hệ Thống',
                    'activatedDate' => 'Vĩnh Viễn',
                    'expiredDate' => $isUnlimited ? 'Vĩnh viễn' : $sRow['Time'],
                    'updatedDate' => '',
                    'features' => [
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
            $stmt2->close();
        }
        
        $conn->close();
        echo json_encode([
            'success' => true,
            'found'   => false,
            'message' => 'Không tìm thấy Serial này trong hệ thống'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    $row = $result->fetch_assoc();
    
    // Format dates
    $formatDate = function($datetime) {
        if (!$datetime) return '';
        $dt = new DateTime($datetime);
        return $dt->format('d/m/Y H:i');
    };
    
    $st = $row['status'] ?: 'Pending';
    $isExp = (strtolower($st) === 'expired') || (!empty($row['expired_at']) && strtotime($row['expired_at']) < time());
    if ($isExp && strtolower($st) === 'active') {
        $st = 'Expired';
    }
    $isActive = (strtolower($st) === 'active');
    
    // Prepare response data
    $responseData = [
        'serial' => $row['serial'],
        'codename' => $row['codename'],
        'deviceName' => 'Thiết bị ' . $row['codename'],
        'plan' => $row['plan'],
        'statusCode' => $isExp ? 'expired' : strtolower($st),
        'statusText' => $isExp ? 'Đã Hết Hạn' : ($isActive ? 'Đã Kích Hoạt' : 'Chờ Kích Hoạt'),
        'paymentMethod' => $row['payment_method'],
        'senderName' => $row['sender_name'],
        'senderEmail' => $row['sender_email'],
        'transactionCode' => $row['transaction_code'],
        'status' => $st,
        'registeredDate' => $formatDate($row['created_at']),
        'activatedDate' => $formatDate($row['activated_at']),
        'expiredDate' => $formatDate($row['expired_at']),
        'updatedDate' => $formatDate($row['updated_at']),
        'features' => [
            'Mở khóa toàn quyền bản ROM HyperUR',
            'Bypass Play Integrity mặc định (mọi app ngân hàng, VNeID)',
            'Hỗ trợ kỹ thuật và OTA trực tiếp từ Admin'
        ]
    ];
    
    // Log activity
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
    $logStmt = $conn->prepare("
        INSERT INTO activity_logs (serial, action, description, ip_address, user_agent) 
        VALUES (?, 'lookup', ?, ?, ?)
    ");
    $logDesc = "Tra cứu serial {$serial}";
    $logStmt->bind_param("ssss", $serial, $logDesc, $ip, $userAgent);
    $logStmt->execute();
    $logStmt->close();
    
    $stmt->close();
    $conn->close();
    
    // Return success response
    echo json_encode([
        'success' => true,
        'found'   => true,
        'message' => 'Tìm thấy Serial',
        'data'    => $responseData
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Lỗi: ' . $e->getMessage()
    ]);
    error_log('Serial lookup error: ' . $e->getMessage());
}
