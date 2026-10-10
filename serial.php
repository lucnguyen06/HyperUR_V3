<?php
/**
 * HyperUR V3 - Serial Registration & Lookup
 * Server-side handler with PHP template rendering
 * 
 * Features:
 * - Registration form processing
 * - Serial lookup verification
 * - Database synchronization
 * - Email notifications
 */

// Start session for CSRF protection
session_start();

// Load configuration
require_once 'api/config.php';
require_once 'api/email-service.php';  // Use new email service

// ============================================================
// CONFIGURATION & CONSTANTS
// ============================================================
define('REGISTRATION_VALID_DAYS', 365);
define('SERIAL_FORMAT', '/^[A-Z0-9]{6,20}$/');

// ============================================================
// ERROR & SUCCESS HANDLING
// ============================================================
$error_message = null;
$success_message = null;
$lookup_result = null;

// ============================================================
// HANDLE FORM SUBMISSIONS (AJAX/POST)
// ============================================================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    
    // Get request type
    $action = $_POST['action'] ?? $_GET['action'] ?? null;
    
    try {
        // Database connection
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        if ($conn->connect_error) {
            throw new Exception('Kết nối cơ sở dữ liệu thất bại');
        }
        $conn->set_charset('utf8mb4');
        
        // ============================================================
        // ACTION: REGISTER NEW SERIAL
        // ============================================================
        if ($action === 'register') {
            // Sanitize input
            $serial = strtoupper(trim($_POST['serial'] ?? ''));
            $email = trim($_POST['email'] ?? '');
            $device_model = trim($_POST['device_model'] ?? '');
            $plan = $_POST['plan'] ?? 'single';
            
            // Validate inputs
            if (empty($serial) || !preg_match(SERIAL_FORMAT, $serial)) {
                throw new Exception('Serial không hợp lệ (6-20 ký tự chữ/số)');
            }
            
            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                throw new Exception('Email không hợp lệ');
            }
            
            if (empty($device_model)) {
                throw new Exception('Model thiết bị là bắt buộc');
            }
            
            // Check if serial already exists
            $checkStmt = $conn->prepare("SELECT id, status FROM registrations WHERE serial = ?");
            $checkStmt->bind_param("s", $serial);
            $checkStmt->execute();
            $existing = $checkStmt->get_result()->fetch_assoc();
            $checkStmt->close();
            
            if ($existing) {
                // Serial exists - provide lookup/upgrade info
                $status = $existing['status'];
                if ($status === 'Active') {
                    throw new Exception("Serial này đã được kích hoạt. <a href='?tab=lookup'>Tra cứu trạng thái</a>");
                } else {
                    throw new Exception("Serial này đã được đăng ký. <a href='?tab=lookup'>Kiểm tra trạng thái</a>");
                }
            }
            
            // Create new registration record
            $created_at = date('Y-m-d H:i:s');
            $insertStmt = $conn->prepare("
                INSERT INTO registrations (serial, sender_email, device_model, plan, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'Pending', ?, ?)
            ");
            $insertStmt->bind_param("ssssss", $serial, $email, $device_model, $plan, $created_at, $created_at);
            
            if (!$insertStmt->execute()) {
                throw new Exception('Đăng ký thất bại: ' . $conn->error);
            }
            
            $registration_id = $insertStmt->insert_id;
            $insertStmt->close();
            
            // Log activity
            $log_desc = "Serial registered - Device: {$device_model}, Plan: {$plan}";
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $logStmt = $conn->prepare("
                INSERT INTO activity_logs (serial, action, description, ip_address, user_agent)
                VALUES (?, 'registration', ?, ?, ?)
            ");
            $logStmt->bind_param("ssss", $serial, $log_desc, $ip, $_SERVER['HTTP_USER_AGENT'] ?? '');
            $logStmt->execute();
            $logStmt->close();
            
            $conn->close();
            
            // Send confirmation email
            $emailData = [
                'serial' => $serial,
                'device_model' => $device_model,
                'plan' => $plan,
                'created_at' => $created_at,
                'status' => 'Pending'
            ];
            
            $emailHtml = generateEmailTemplate($emailData);
            $subject = "✅ Đăng Ký Thành Công - Serial {$serial} - HyperUR";
            $headers = "MIME-Version: 1.0\r\n";
            $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
            $headers .= "From: " . EMAIL_FROM_NAME . " <" . EMAIL_FROM . ">\r\n";
            $headers .= "Reply-To: " . SUPPORT_EMAIL . "\r\n";
            
            mail($email, $subject, $emailHtml, $headers);
            
            echo json_encode([
                'success' => true,
                'message' => 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận.',
                'serial' => $serial,
                'status' => 'Pending',
                'next_step' => 'Chọn phương thức thanh toán để kích hoạt'
            ]);
            exit;
        }
        
        // ============================================================
        // ACTION: LOOKUP SERIAL STATUS
        // ============================================================
        if ($action === 'lookup') {
            $serial = strtoupper(trim($_POST['serial'] ?? ''));
            
            if (empty($serial) || !preg_match(SERIAL_FORMAT, $serial)) {
                throw new Exception('Serial không hợp lệ');
            }
            
            // Query database
            $lookupStmt = $conn->prepare("
                SELECT serial, status, device_model, plan, activated_at, expired_at, created_at
                FROM registrations
                WHERE serial = ?
            ");
            $lookupStmt->bind_param("s", $serial);
            $lookupStmt->execute();
            $result = $lookupStmt->get_result();
            $lookupStmt->close();
            
            if ($result->num_rows === 0) {
                throw new Exception('Serial không tìm thấy. Bạn chưa đăng ký hoặc nhập sai serial.');
            }
            
            $registration = $result->fetch_assoc();
            $conn->close();
            
            // Determine status color & icon
            $status_map = [
                'Pending' => ['label' => '⏳ Đang Chờ Thanh Toán', 'color' => 'warning'],
                'Active' => ['label' => '✅ Đã Kích Hoạt', 'color' => 'success'],
                'Expired' => ['label' => '⏰ Hết Hạn', 'color' => 'expired'],
                'Cancelled' => ['label' => '❌ Đã Hủy', 'color' => 'danger']
            ];
            
            $status_info = $status_map[$registration['status']] ?? ['label' => $registration['status'], 'color' => 'info'];
            
            echo json_encode([
                'success' => true,
                'data' => [
                    'serial' => $registration['serial'],
                    'status' => $registration['status'],
                    'status_label' => $status_info['label'],
                    'status_color' => $status_info['color'],
                    'device_model' => $registration['device_model'],
                    'plan' => $registration['plan'],
                    'created_at' => date('d/m/Y H:i', strtotime($registration['created_at'])),
                    'activated_at' => $registration['activated_at'] ? date('d/m/Y H:i', strtotime($registration['activated_at'])) : 'Chưa kích hoạt',
                    'expired_at' => $registration['expired_at'] ? date('d/m/Y', strtotime($registration['expired_at'])) : 'N/A'
                ]
            ]);
            exit;
        }
        
        throw new Exception('Hành động không hợp lệ');
        
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
        exit;
    }
}

// ============================================================
// GENERATE CSRF TOKEN
// ============================================================
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
$csrf_token = $_SESSION['csrf_token'];

?>
<!DOCTYPE html>
<html lang="vi" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="HyperUR - Cổng Đăng Ký & Tra Cứu Serial bản quyền ROM HyperUR V3 chính thức.">
    <title>Đăng Ký & Tra Cứu Serial - HyperUR V3</title>
    <link rel="icon" href="https://t.me/i/userpic/320/hypermodupdate.jpg">
    
    <!-- Preconnect & Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
    
    <!-- Stylesheets -->
    <link rel="stylesheet" href="styles.css">
    
    <!-- SePay Configuration -->
    <script src="json/sepay-config.js"></script>
    <script src="json/sepay-handler.js"></script>
</head>
<body>
    <!-- Include original navbar and content from serial.html -->
    <!-- This will be merged from serial.html structure -->
    <!-- For now, just load the form via AJAX/include -->
    
    <div id="app-container">
        <!-- PHP will render the registration form with server-side data -->
        <div class="main-content">
            <!-- Registration form HTML from original serial.html -->
            <!-- Form will process through this PHP file -->
            
            <form id="serial-register-form" method="POST" action="serial.php" novalidate>
                <!-- CSRF Protection -->
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>">
                <input type="hidden" name="action" value="register">
                
                <!-- Form fields -->
                <!-- (Keep original HTML structure from serial.html) -->
            </form>
            
            <form id="serial-lookup-form" method="POST" action="serial.php" novalidate>
                <!-- CSRF Protection -->
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>">
                <input type="hidden" name="action" value="lookup">
                
                <!-- Lookup form -->
            </form>
        </div>
    </div>
    
    <!-- JavaScript -->
    <script>
        // CSRF Token for AJAX
        const CSRF_TOKEN = '<?php echo $csrf_token; ?>';
        
        // Handle form submissions via AJAX
        document.addEventListener('DOMContentLoaded', function() {
            // Registration form
            const registerForm = document.getElementById('serial-register-form');
            if (registerForm) {
                registerForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    
                    const formData = new FormData(this);
                    formData.append('action', 'register');
                    formData.append('csrf_token', CSRF_TOKEN);
                    
                    try {
                        const response = await fetch('serial.php', {
                            method: 'POST',
                            body: formData
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            alert('✅ ' + result.message);
                            registerForm.reset();
                            // Switch to lookup tab
                            document.getElementById('tab-lookup-btn')?.click();
                        } else {
                            alert('❌ ' + result.message);
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        alert('❌ Lỗi khi xử lý: ' + error.message);
                    }
                });
            }
            
            // Lookup form
            const lookupForm = document.getElementById('serial-lookup-form');
            if (lookupForm) {
                lookupForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    
                    const formData = new FormData(this);
                    formData.append('action', 'lookup');
                    formData.append('csrf_token', CSRF_TOKEN);
                    
                    try {
                        const response = await fetch('serial.php', {
                            method: 'POST',
                            body: formData
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            // Display lookup result
                            displayLookupResult(result.data);
                        } else {
                            alert('❌ ' + result.message);
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        alert('❌ Lỗi khi tra cứu: ' + error.message);
                    }
                });
            }
        });
        
        function displayLookupResult(data) {
            // Display result in modal/section
            const resultHtml = `
                <div class="lookup-result-card">
                    <h3>${data.status_label}</h3>
                    <dl>
                        <dt>Serial:</dt>
                        <dd>${data.serial}</dd>
                        <dt>Thiết bị:</dt>
                        <dd>${data.device_model}</dd>
                        <dt>Gói:</dt>
                        <dd>${data.plan}</dd>
                        <dt>Đăng ký:</dt>
                        <dd>${data.created_at}</dd>
                        <dt>Kích hoạt:</dt>
                        <dd>${data.activated_at}</dd>
                        <dt>Hết hạn:</dt>
                        <dd>${data.expired_at}</dd>
                    </dl>
                </div>
            `;
            
            // Update result container
            const resultContainer = document.getElementById('lookup-result');
            if (resultContainer) {
                resultContainer.innerHTML = resultHtml;
            }
        }
    </script>
</body>
</html>
