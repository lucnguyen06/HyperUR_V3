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

require_once 'config.php';
require_once 'email-template.php';

try {
    // Get POST data
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
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
    
    // Validate email format
    if (!filter_var($senderEmail, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Địa chỉ email không hợp lệ');
    }
    
    // Connect to database
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    
    if ($conn->connect_error) {
        throw new Exception('Kết nối database thất bại: ' . $conn->connect_error);
    }
    
    $conn->set_charset('utf8mb4');
    
    // Check if Free plan (auto-activate)
    $isFree = (strpos($plan, 'Active Free') !== false || strpos($plan, '36') !== false);
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
