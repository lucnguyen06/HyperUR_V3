<?php
/**
 * Database Configuration Template
 * HyperUR V3 - PHP Email System
 * 
 * ⚠️ RENAME THIS FILE TO config.php AND UPDATE VALUES
 * ⚠️ DO NOT COMMIT config.php TO GIT (add to .gitignore)
 */

// Database credentials - CẬP NHẬT THÔNG TIN CỦA BẠN
define('DB_HOST', 'localhost');           // Database host (thường là localhost)
define('DB_USER', 'ycoozxap');       // MySQL username
define('DB_PASS', 'Tl29126@@@');       // MySQL password
define('DB_NAME', 'ycoozxap_hyperur_db');          // Database name

// Website configuration
define('WEBSITE_URL', 'https://hyperur.io.vn');
define('SUPPORT_EMAIL', 'support@hyperur.io.vn');
define('TELEGRAM_CHANNEL', 'https://t.me/hypermodupdate');
define('TELEGRAM_CHAT', 'https://t.me/HuperUltraRateChat');

// Email configuration
define('EMAIL_FROM', 'hyperur2026@gmail.com');  // Email gửi đi
define('EMAIL_FROM_NAME', 'HyperUR');           // Tên hiển thị

// Security
define('API_SECRET', 'Tl29126@@@'); // Thay bằng mã bảo mật của bạn

// Timezone
date_default_timezone_set('Asia/Ho_Chi_Minh');

// Error reporting
error_reporting(E_ALL);
ini_set('display_errors', 0);  // Set to 0 for production
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error.log');
