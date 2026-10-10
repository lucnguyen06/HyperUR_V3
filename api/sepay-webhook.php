<?php
/**
 * SePay Webhook Handler
 * HyperUR V3 - Xử lý callback từ SePay khi nhận thanh toán
 * 
 * Endpoint: POST /api/sepay-webhook.php
 * Webhook từ SePay sẽ gửi dữ liệu thanh toán tới endpoint này
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

require_once 'config.php';
require_once 'email-template.php';

try {
    // ============================================================
    // VERIFY SEPAY API KEY - Authenticate SePay requests
    // ============================================================
    // SePay sends: Authorization: Apikey YOUR_API_KEY
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    
    // Extract API Key from header format: "Apikey xxx"
    if (strpos($authHeader, 'Apikey ') !== 0) {
        http_response_code(401);
        throw new Exception('Missing or invalid Authorization header');
    }
    
    $providedApiKey = substr($authHeader, 7); // Remove "Apikey " prefix
    $expectedApiKey = SEPAY_API_KEY;
    
    // Verify API Key matches
    if ($providedApiKey !== $expectedApiKey) {
        http_response_code(401);
        error_log("SePay: Invalid API Key - Received: {$providedApiKey}");
        throw new Exception('Invalid API Key');
    }
    
    error_log("SePay: API Key verified ✓");
    
    // ============================================================
    // VERIFY WEBHOOK SIGNATURE - HMAC-SHA256 (Prevent tampering)
    // ============================================================
    // SePay may send: X-SePay-Signature or X-Signature header
    // Signature = HMAC-SHA256(webhook_body, WEBHOOK_SECRET)
    
    $rawBody = file_get_contents('php://input');
    $providedSignature = $_SERVER['HTTP_X_SEPAY_SIGNATURE'] ?? 
                        $_SERVER['HTTP_X_SIGNATURE'] ?? 
                        $_SERVER['HTTP_SIGNATURE'] ?? null;
    
    // If SePay sends signature, verify it
    if ($providedSignature) {
        $webhookSecret = SEPAY_WEBHOOK_SECRET;
        $expectedSignature = hash_hmac('sha256', $rawBody, $webhookSecret);
        
        // Compare signatures (using hash_equals to prevent timing attacks)
        if (!hash_equals($expectedSignature, $providedSignature)) {
            http_response_code(401);
            error_log("SePay: Invalid signature - Received: {$providedSignature}");
            throw new Exception('Invalid webhook signature - data may be tampered');
        }
        error_log("SePay: Webhook signature verified ✓");
    } else {
        // No signature provided - log warning but continue
        // (SePay may not send signature on all webhooks)
        error_log("SePay: No signature provided (optional verification)");
    }
    
    // ============================================================
    // Get raw webhook data
    $input = $rawBody;
    $data = json_decode($input, true);
    
    // Log webhook
    error_log("SePay Webhook received: " . print_r($data, true));
    
    // Validate required SePay fields
    if (empty($data['description']) || empty($data['amount'])) {
        throw new Exception('Missing SePay data: description or amount');
    }
    
    // Parse description format: UR [SERIAL]
    // Example: "UR ABC123456" or "UR ABC123456 - Xiaomi Marble"
    $description = $data['description'];
    preg_match('/UR\s+([A-Z0-9]+)/i', $description, $matches);
    
    if (empty($matches[1])) {
        // Log but don't fail - just mark as unrelated transaction
        error_log("SePay: Invalid format - " . $description);
        echo json_encode(['success' => false, 'message' => 'Invalid transaction format']);
        exit;
    }
    
    $serial = strtoupper(trim($matches[1]));
    $amount = $data['amount']; // Example: 50000
    $transactionId = $data['id'] ?? $data['transaction_id'] ?? null;
    $bankAccount = $data['bank_account'] ?? null;
    $senderName = $data['sender_name'] ?? 'SePay Transfer';
    
    // Connect to database
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    
    if ($conn->connect_error) {
        throw new Exception('Database connection failed: ' . $conn->connect_error);
    }
    
    $conn->set_charset('utf8mb4');
    
    // Check if serial exists
    $checkStmt = $conn->prepare("SELECT id, sender_email, plan FROM registrations WHERE serial = ?");
    $checkStmt->bind_param("s", $serial);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    
    if ($result->num_rows === 0) {
        error_log("SePay: Serial not found - {$serial}");
        $conn->close();
        echo json_encode(['success' => false, 'message' => 'Serial not found']);
        exit;
    }
    
    $registration = $result->fetch_assoc();
    $senderEmail = $registration['sender_email'];
    $plan = $registration['plan'];
    
    $checkStmt->close();
    
    // Determine if amount matches expected payment (50000 VND)
    $expectedAmount = 50000;
    $isValidPayment = ($amount >= $expectedAmount);
    
    if (!$isValidPayment) {
        error_log("SePay: Amount mismatch - Expected {$expectedAmount}, Got {$amount} for {$serial}");
        $conn->close();
        echo json_encode(['success' => false, 'message' => 'Amount mismatch']);
        exit;
    }
    
    // Update registration status to Active
    $activatedAt = date('Y-m-d H:i:s');
    $expiredAt = date('Y-m-d H:i:s', strtotime('+365 days')); // 1 year validity for paid plans
    
    $updateStmt = $conn->prepare("
        UPDATE registrations 
        SET status = 'Active',
            activated_at = ?,
            expired_at = ?,
            transaction_code = ?,
            updated_at = NOW()
        WHERE serial = ?
    ");
    $updateStmt->bind_param("ssss", $activatedAt, $expiredAt, $transactionId, $serial);
    $updateStmt->execute();
    $updateStmt->close();
    
    // Log webhook activity
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'SePay';
    $logStmt = $conn->prepare("
        INSERT INTO activity_logs (serial, action, description, ip_address, user_agent) 
        VALUES (?, 'webhook_payment', ?, ?, ?)
    ");
    $logDesc = "SePay payment received - Amount: {$amount}đ, TxnID: {$transactionId}";
    $logStmt->bind_param("ssss", $serial, $logDesc, $ip, $_SERVER['HTTP_USER_AGENT'] ?? 'SePay');
    $logStmt->execute();
    $logStmt->close();
    
    $conn->close();
    
    // Send confirmation email to user
    $emailData = [
        'serial' => $serial,
        'codename' => 'N/A',
        'plan' => $plan,
        'paymentMethod' => 'SePay Bank Transfer',
        'senderName' => $senderName,
        'senderEmail' => $senderEmail,
        'transactionCode' => $transactionId,
        'amount' => $amount
    ];
    
    $emailHtml = generateEmailTemplate($emailData);
    $subject = "✅ Xác Nhận Thanh Toán - Serial {$serial} - HyperUR";
    
    $fromName = '=?UTF-8?B?' . base64_encode(EMAIL_FROM_NAME) . '?=';
    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "From: {$fromName} <" . EMAIL_FROM . ">\r\n";
    $headers .= "Reply-To: " . SUPPORT_EMAIL . "\r\n";
    
    $emailSent = mail($senderEmail, $subject, $emailHtml, $headers);
    
    if (!$emailSent) {
        error_log("Failed to send email to {$senderEmail} for serial {$serial}");
    }
    
    // Success response
    echo json_encode([
        'success' => true,
        'message' => 'Payment processed successfully',
        'serial' => $serial,
        'status' => 'Active',
        'activated_at' => $activatedAt
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
    error_log('SePay webhook error: ' . $e->getMessage());
}
