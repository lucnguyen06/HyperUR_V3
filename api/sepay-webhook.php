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
require_once 'email-service.php';  // New email service module

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
    // SePay format: X-SePay-Signature: sha256=<hex>
    // SePay format: X-SePay-Timestamp: <unix_seconds>
    // Signature = HMAC-SHA256({timestamp}.{raw_body}, SECRET_KEY)
    // Reference: https://docs.sepay.vn/webhooks
    
    $rawBody = file_get_contents('php://input');
    $providedSignature = $_SERVER['HTTP_X_SEPAY_SIGNATURE'] ?? null;
    $timestamp = $_SERVER['HTTP_X_SEPAY_TIMESTAMP'] ?? null;
    
    // If SePay sends signature, verify it (REQUIRED for security)
    if ($providedSignature && $timestamp) {
        $webhookSecret = SEPAY_WEBHOOK_SECRET;
        
        // Prevent replay attacks: Check if timestamp is recent (within 5 minutes)
        $currentTime = time();
        $webhookTime = (int)$timestamp;
        $timeDiff = abs($currentTime - $webhookTime);
        $maxTimeDiff = 5 * 60; // 5 minutes in seconds
        
        if ($timeDiff > $maxTimeDiff) {
            http_response_code(401);
            error_log("SePay: Webhook timestamp too old (diff: {$timeDiff}s, max: {$maxTimeDiff}s)");
            throw new Exception('Webhook timestamp too old - possible replay attack');
        }
        
        // Build the signed string: {timestamp}.{raw_body}
        $signedString = $timestamp . '.' . $rawBody;
        
        // Calculate expected signature: sha256=<hex>
        $hmacHash = hash_hmac('sha256', $signedString, $webhookSecret);
        $expectedSignature = 'sha256=' . $hmacHash;
        
        // Compare signatures (using hash_equals to prevent timing attacks)
        if (!hash_equals($expectedSignature, $providedSignature)) {
            http_response_code(401);
            error_log("SePay: Invalid signature");
            error_log("  Expected: {$expectedSignature}");
            error_log("  Received: {$providedSignature}");
            error_log("  Signed string: {$signedString}");
            throw new Exception('Invalid webhook signature - data may be tampered');
        }
        error_log("SePay: Webhook signature verified ✓");
    } else {
        // SePay REQUIRES signature verification for security
        // Missing signature = reject webhook
        if (!$providedSignature) {
            http_response_code(401);
            error_log("SePay: Missing X-SePay-Signature header");
            throw new Exception('Missing webhook signature header');
        }
        if (!$timestamp) {
            http_response_code(401);
            error_log("SePay: Missing X-SePay-Timestamp header");
            throw new Exception('Missing webhook timestamp header');
        }
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
    
    // Send confirmation email using new email service
    $emailData = [
        'serial' => $serial,
        'email' => $senderEmail,
        'plan' => $plan,
        'payment_method' => 'SePay Bank Transfer',
        'transaction_id' => $transactionId,
        'amount' => $amount,
        'paid_at' => $activatedAt,
        'activated_at' => $activatedAt,
        'expired_at' => $expiredAt
    ];
    
    $emailSent = EmailService::paymentConfirmation($emailData);
    
    if (!$emailSent) {
        error_log("⚠️ Failed to send confirmation email to {$senderEmail} for serial {$serial}");
    } else {
        error_log("✓ Confirmation email sent to {$senderEmail}");
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
