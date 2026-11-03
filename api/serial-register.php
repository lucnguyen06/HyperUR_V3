<?php
/**
 * Serial Registration API
 * HyperUR V3 - PHP Email System
 * Endpoint: POST /api/serial-register.php
 */

// Headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('X-Content-Type-Options: nosniff');

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Chỉ hỗ trợ phương thức POST'
    ]);
    exit;
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/email-template.php';

/**
 * Danh sách gói được tự động kích hoạt (miễn phí) - SO KHỚP CHÍNH XÁC.
 * ⚠️ KHÔNG dùng strpos/str_contains trên $plan do client tự gửi lên:
 *    kẻ xấu chỉ cần đổi plan thành "xxx 36" là được kích hoạt miễn phí.
 */
const FREE_PLAN_WHITELIST = [
    'Active Free',
    'Active Free (36 ngày)',
    'Active Free (36 ngày trải nghiệm)',
];

try {
    // Get POST data
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!is_array($data)) {
        throw new Exception('Dữ liệu gửi lên không hợp lệ (JSON expected)');
    }

    // Validate required fields
    if (empty($data['serial']) || empty($data['codename']) || empty($data['senderEmail'])) {
        throw new Exception('Thiếu thông tin bắt buộc: Serial, Codename, Email');
    }

    // Sanitize inputs
    $serial = strtoupper(trim($data['serial']));
    $codename = strtolower(trim($data['codename']));
    $plan = trim($data['plan'] ?? '');
    $paymentMethod = trim($data['paymentMethod'] ?? '');
    $senderName = trim($data['senderName'] ?? '');
    $senderEmail = strtolower(trim($data['senderEmail']));
    $transactionCode = trim($data['transactionCode'] ?? '');

    // Validate serial format (4-32 ký tự A-Z0-9) - chặn ký tự lạ lọt vào DB/log
    if (!preg_match('/^[A-Z0-9]{4,32}$/', $serial)) {
        throw new Exception('Serial không hợp lệ (4-32 ký tự chữ và số)');
    }

    // Validate codename (a-z0-9._-)
    if (!preg_match('/^[a-z0-9._-]{1,100}$/', $codename)) {
        throw new Exception('Mã thiết bị (codename) không hợp lệ');
    }

    // Validate email format
    if (!filter_var($senderEmail, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Địa chỉ email không hợp lệ');
    }

    // Giới hạn độ dài các trường tự do (tránh payload lớn / tràn cột)
    $plan = mb_substr($plan, 0, 100);
    $paymentMethod = mb_substr($paymentMethod, 0, 50);
    $senderName = mb_substr($senderName, 0, 100);
    $transactionCode = mb_substr($transactionCode, 0, 100);

    // Connect to database
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    
    if ($conn->connect_error) {
        throw new Exception('Kết nối database thất bại: ' . $conn->connect_error);
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
    
    // Check if Free plan (auto-activate) - SO KHỚP CHÍNH XÁC theo whitelist
    $isFree = in_array($plan, FREE_PLAN_WHITELIST, true);
    $status = $isFree ? 'Active' : 'Pending';
    $activatedAt = $isFree ? date('Y-m-d H:i:s') : null;
    $expiredAt = $isFree ? date('Y-m-d H:i:s', strtotime('+36 days')) : null;
    
    // Check if serial already exists
    $checkStmt = $conn->prepare("SELECT id FROM registrations WHERE serial = ?");
    $checkStmt->bind_param("s", $serial);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    
    if ($result->num_rows > 0) {
        // Update existing record
        $updateStmt = $conn->prepare("
            UPDATE registrations 
            SET codename = ?, 
                plan = ?, 
                payment_method = ?, 
                sender_name = ?, 
                sender_email = ?, 
                transaction_code = ?,
                updated_at = NOW()
            WHERE serial = ?
        ");
        $updateStmt->bind_param(
            "sssssss",
            $codename,
            $plan,
            $paymentMethod,
            $senderName,
            $senderEmail,
            $transactionCode,
            $serial
        );
        $updateStmt->execute();
        $updateStmt->close();
        
    } else {
        // Insert new record
        $insertStmt = $conn->prepare("
            INSERT INTO registrations 
            (serial, codename, plan, payment_method, sender_name, sender_email, transaction_code, status, activated_at, expired_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $insertStmt->bind_param(
            "ssssssssss",
            $serial,
            $codename,
            $plan,
            $paymentMethod,
            $senderName,
            $senderEmail,
            $transactionCode,
            $status,
            $activatedAt,
            $expiredAt
        );
        $insertStmt->execute();
        $insertStmt->close();
    }
    
    $checkStmt->close();
    
    // Log activity
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
    $logStmt = $conn->prepare("
        INSERT INTO activity_logs (serial, action, description, ip_address, user_agent) 
        VALUES (?, 'register', ?, ?, ?)
    ");
    $logDesc = "Đăng ký serial {$serial} cho {$codename}";
    $logStmt->bind_param("ssss", $serial, $logDesc, $ip, $userAgent);
    $logStmt->execute();
    $logStmt->close();
    
    $conn->close();
    
    // Send confirmation email
    $emailHtml = generateEmailTemplate($data);
    $subject = "✅ Xác Nhận Đăng Ký Serial {$serial} - HyperUR";
    
    // Properly encode email headers to prevent issues with special characters
    $fromName = '=?UTF-8?B?' . base64_encode(EMAIL_FROM_NAME) . '?=';
    
    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "From: {$fromName} <" . EMAIL_FROM . ">\r\n";
    $headers .= "Reply-To: " . SUPPORT_EMAIL . "\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
    
    $emailSent = mail($senderEmail, $subject, $emailHtml, $headers);
    
    if (!$emailSent) {
        error_log("Failed to send email to {$senderEmail} for serial {$serial}");
    }
    
    // Return success response
    echo json_encode([
        'success' => true,
        'message' => 'Đăng ký thành công và email xác nhận đã được gửi',
        'data' => [
            'serial' => $serial,
            'email' => $senderEmail,
            'status' => $status,
            'emailSent' => $emailSent
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Lỗi: ' . $e->getMessage()
    ]);
    error_log('Serial registration error: ' . $e->getMessage());
}
