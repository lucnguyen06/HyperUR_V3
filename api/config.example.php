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
define('DB_USER', 'your_username');       // MySQL username
define('DB_PASS', 'your_password');       // MySQL password
define('DB_NAME', 'hyperur_db');          // Database name

// Website configuration
define('WEBSITE_URL', 'https://hyperur.io.vn');
define('SUPPORT_EMAIL', 'support@hyperur.io.vn');
define('TELEGRAM_CHANNEL', 'https://t.me/hypermodupdate');
define('TELEGRAM_CHAT', 'https://t.me/HuperUltraRateChat');

// Email configuration
define('EMAIL_FROM', 'noreply@hyperur.io.vn');  // Email gửi đi
define('EMAIL_FROM_NAME', 'HyperUR');           // Tên hiển thị

// Security
define('API_SECRET', 'change_this_to_random_secret_key'); // Thay bằng mã bảo mật của bạn

// Timezone
date_default_timezone_set('Asia/Ho_Chi_Minh');

// Error reporting
error_reporting(E_ALL);
ini_set('display_errors', 0);  // Set to 0 for production
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error.log');
