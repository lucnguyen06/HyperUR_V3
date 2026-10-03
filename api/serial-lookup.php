<?php
/**
 * Serial Lookup API
 * HyperUR V3 - PHP System
 * Endpoint: GET /api/serial-lookup.php?serial=ABC123456
 */

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

require_once 'config.php';

try {
    // Get serial from query parameter
    $serial = isset($_GET['serial']) ? strtoupper(trim($_GET['serial'])) : '';
    
    if (empty($serial)) {
        throw new Exception('Vui lòng cung cấp số Serial');
    }
    
    // Connect to database
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    
    if ($conn->connect_error) {
        throw new Exception('Kết nối database thất bại');
    }
    
    $conn->set_charset('utf8mb4');
    
    // Query serial
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
        $conn->close();
        
        echo json_encode([
            'success' => false,
            'message' => 'Không tìm thấy Serial này trong hệ thống'
        ]);
        exit;
    }
    
    $row = $result->fetch_assoc();
    
    // Format dates
    $formatDate = function($datetime) {
        if (!$datetime) return '';
        $dt = new DateTime($datetime);
        return $dt->format('d/m/Y H:i');
    };
    
    // Prepare response data
    $responseData = [
        'serial' => $row['serial'],
        'codename' => $row['codename'],
        'plan' => $row['plan'],
        'paymentMethod' => $row['payment_method'],
        'senderName' => $row['sender_name'],
        'senderEmail' => $row['sender_email'],
        'transactionCode' => $row['transaction_code'],
        'status' => $row['status'],
        'registeredDate' => $formatDate($row['created_at']),
        'activatedDate' => $formatDate($row['activated_at']),
        'expiredDate' => $formatDate($row['expired_at']),
        'updatedDate' => $formatDate($row['updated_at'])
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
        'message' => 'Tìm thấy Serial',
        'data' => $responseData
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Lỗi: ' . $e->getMessage()
    ]);
    error_log('Serial lookup error: ' . $e->getMessage());
}
