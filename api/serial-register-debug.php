<?php
/**
 * Enhanced Serial Registration with Better Error Handling
 * HyperUR V3 - PHP Email System with Debug Info
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

// Enable error logging for debugging
$debugMode = false; // Set to true để debug, false cho production
$debugInfo = [];

try {
    // Get POST data
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if ($debugMode) {
        $debugInfo['received_data'] = $data;
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
    
    if ($debugMode) {
        $debugInfo['database_connected'] = true;
    }
    
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
        
        if ($debugMode) {
            $debugInfo['database_action'] = 'updated';
        }
        
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
        
        if ($debugMode) {
            $debugInfo['database_action'] = 'inserted';
        }
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
    
    // Try different header configurations
    $headers = array();
    $headers[] = "MIME-Version: 1.0";
    $headers[] = "Content-Type: text/html; charset=UTF-8";
    $headers[] = "From: " . EMAIL_FROM_NAME . " <" . EMAIL_FROM . ">";
    $headers[] = "Reply-To: " . SUPPORT_EMAIL;
    $headers[] = "X-Mailer: PHP/" . phpversion();
    
    // Attempt to send email
    $emailSent = false;
    $emailError = '';
    
    // Check if mail() function exists
    if (!function_exists('mail')) {
        $emailError = 'PHP mail() function is not available on this server';
    } else {
        // Try to send
        $emailSent = @mail($senderEmail, $subject, $emailHtml, implode("\r\n", $headers));
        
        if (!$emailSent) {
            $emailError = error_get_last()['message'] ?? 'Unknown mail error';
        }
    }
    
    if ($debugMode) {
        $debugInfo['email_sent'] = $emailSent;
        $debugInfo['email_error'] = $emailError;
        $debugInfo['mail_function_exists'] = function_exists('mail');
        $debugInfo['sendmail_path'] = ini_get('sendmail_path');
    }
    
    // Log email result
    if (!$emailSent) {
        error_log("Failed to send email to {$senderEmail} for serial {$serial}. Error: {$emailError}");
    }
    
    // Return response
    $response = [
        'success' => true,
        'message' => $emailSent 
            ? 'Đăng ký thành công và email xác nhận đã được gửi' 
            : 'Đăng ký thành công nhưng không thể gửi email. Vui lòng liên hệ admin.',
        'data' => [
            'serial' => $serial,
            'email' => $senderEmail,
            'status' => $status,
            'emailSent' => $emailSent
        ]
    ];
    
    // Add debug info if enabled
    if ($debugMode) {
        $response['debug'] = $debugInfo;
        $response['emailError'] = $emailError;
    }
    
    echo json_encode($response);
    
} catch (Exception $e) {
    http_response_code(500);
    $response = [
        'success' => false,
        'message' => 'Lỗi: ' . $e->getMessage()
    ];
    
    if ($debugMode) {
        $response['debug'] = $debugInfo;
    }
    
    echo json_encode($response);
    error_log('Serial registration error: ' . $e->getMessage());
}
