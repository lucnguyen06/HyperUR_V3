<?php
/**
 * Check Payment Status
 * HyperUR V3 - Endpoint to check if payment has been received
 * 
 * Called by client-side polling after initiating SePay transfer
 * Endpoint: GET /api/check-payment-status.php?serial=ABC123456
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

require_once 'config.php';

try {
    $serial = isset($_GET['serial']) ? strtoupper(trim($_GET['serial'])) : null;
    
    if (empty($serial)) {
        throw new Exception('Serial is required');
    }
    
    // Connect to database
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    
    if ($conn->connect_error) {
        throw new Exception('Database connection failed');
    }
    
    $conn->set_charset('utf8mb4');
    
    // Check registration status
    $stmt = $conn->prepare("
        SELECT status, activated_at, expired_at, transaction_code 
        FROM registrations 
        WHERE serial = ?
    ");
    $stmt->bind_param("s", $serial);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode([
            'success' => false,
            'message' => 'Serial not found',
            'data' => ['status' => 'not_found']
        ]);
        $stmt->close();
        $conn->close();
        exit;
    }
    
    $registration = $result->fetch_assoc();
    $stmt->close();
    $conn->close();
    
    // Map database status to payment status
    $paymentStatus = 'pending';
    if ($registration['status'] === 'Active') {
        $paymentStatus = 'completed';
    } elseif ($registration['status'] === 'Cancelled' || $registration['status'] === 'Expired') {
        $paymentStatus = 'failed';
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Status retrieved',
        'data' => [
            'serial' => $serial,
            'status' => $paymentStatus,
            'registration_status' => $registration['status'],
            'activated_at' => $registration['activated_at'],
            'expired_at' => $registration['expired_at'],
            'transaction_code' => $registration['transaction_code']
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
