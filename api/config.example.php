<?php
/**
 * HyperUR - Database & Email Configuration (TEMPLATE)
 *
 * ⚠️ HƯỚNG DẪN:
 *   1. Copy file này thành `api/config.php`
 *   2. Điền thông tin database / email thật của bạn
 *   3. KHÔNG commit `api/config.php` lên git (đã có trong .gitignore)
 *
 * File này dùng hằng số (kiểu mới) để tương thích với tất cả endpoint:
 *   - api/admin-auth.php
 *   - api/admin-serials.php
 *   - api/admin-logs.php
 *   - api/admin-users.php
 *   - api/serial-register.php
 *   - api/serial-lookup.php
 *   - api/email-template.php
 *   - add_serial.php
 */

// ===== Database =====
define('DB_HOST', 'localhost');
define('DB_USER', 'CHANGE_ME_DB_USER');
define('DB_PASS', 'CHANGE_ME_DB_PASSWORD');
define('DB_NAME', 'CHANGE_ME_DB_NAME');

// ===== Website =====
define('WEBSITE_URL',      'https://hyperur.io.vn');
define('SUPPORT_EMAIL',    'hyperur2026@gmail.com');
define('TELEGRAM_CHANNEL', 'https://t.me/hypermodupdate');
define('TELEGRAM_CHAT',    'https://t.me/HuperUltraRateChat');

// ===== Email =====
define('EMAIL_FROM',      'hyperur2026@gmail.com');
define('EMAIL_FROM_NAME', 'HyperUR');

// ===== SMTP (Khuyến nghị dùng để gửi email vào Inbox 100%, không bị chặn DMARC) =====
// Tạo App Password tại: Google Account -> Security -> 2-Step Verification -> App passwords
define('SMTP_ENABLED', true);
define('SMTP_HOST',    'smtp.gmail.com');
define('SMTP_PORT',    587);
define('SMTP_SECURE',  'tls');
define('SMTP_USER',    'hyperur2026@gmail.com');
define('SMTP_PASS',    'CHANGE_ME_GMAIL_APP_PASSWORD'); // Điền Mật khẩu ứng dụng 16 ký tự của Gmail

// ===== Security =====
// Mã bí mật dùng chung (đổi thành chuỗi random dài, ví dụ: openssl rand -hex 32)
define('API_SECRET', 'CHANGE_ME_RANDOM_SECRET');

// (Tuỳ chọn) Bảo vệ endpoint add_serial.php:
//   - Đặt ADD_SERIAL_TOKEN để bắt buộc truyền ?token=...
//   - Đặt ADD_SERIAL_IP_ALLOW để whitelist IP (CIDR, phân tách bằng dấu phẩy)
// define('ADD_SERIAL_TOKEN', 'CHANGE_ME_ADD_SERIAL_TOKEN');
// define('ADD_SERIAL_IP_ALLOW', '127.0.0.1,113.161.0.0/16');

// (Tuỳ chọn) CORS cho admin panel khi chạy ở domain khác (phân tách bằng dấu phẩy).
// Mặc định: chỉ same-origin. KHÔNG dùng '*' ở đây.
// define('ADMIN_ALLOWED_ORIGINS', 'https://admin.hyperur.io.vn');

// (Tuỳ chọn) Thời gian sống của phiên đăng nhập admin (giây). Mặc định 8 giờ.
// define('SESSION_TTL', 8 * 3600);

// ===== SePay - Webhook tự động kích hoạt (api/payment-webhook.php) =====
// Bắt buộc phải khai báo ÍT NHẤT MỘT trong hai hằng dưới đây,
// nếu không endpoint sẽ từ chối mọi request (fail-closed).
//
// 1) HMAC-SHA256 (KHUYẾN NGHỊ): Dashboard SePay -> Webhooks -> Bảo mật
//    -> HMAC-SHA256 -> copy Secret Key (chỉ hiện đầy đủ 1 lần).
//    Nếu dùng NHIỀU tài khoản SePay khác nhau (mỗi STK 1 tài khoản SePay riêng),
//    hãy phân cách các Secret Key bằng dấu phẩy:
//    'whsec_TK1, whsec_TK2'
// define('SEPAY_WEBHOOK_SECRET', 'CHANGE_ME_SEPAY_HMAC_SECRET');
//
// 2) API Key (dự phòng): header "Authorization: Apikey <key>"
// define('SEPAY_API_KEY', 'CHANGE_ME_SEPAY_API_KEY');

// Số tiền tối thiểu để coi là đã thanh toán hợp lệ.
// Mặc định 40.000đ = mức giá THẤP NHẤT của website
// (serial.js: 1-30 thiết bị = 50.000đ, từ 31 thiết bị = 40.000đ).
// Đổi bảng giá thì phải cập nhật cả đây.
// define('SEPAY_MIN_AMOUNT', 40000);

// Email dùng khi không đọc được email từ nội dung chuyển khoản.
// define('SEPAY_DEFAULT_EMAIL', 'hyperur2026@gmail.com');

// (Tuỳ chọn) Chỉ nhận webhook từ các IP này (danh sách IP của SePay).
// define('SEPAY_IP_ALLOW', '172.236.138.20,172.233.83.68,171.244.35.2');

// ===== Telegram - thông báo cho admin khi có tiền vào =====
// define('TELEGRAM_BOT_TOKEN', 'CHANGE_ME_BOT_TOKEN');
// define('TELEGRAM_ADMIN_CHAT_ID', 'CHANGE_ME_CHAT_ID');

// ===== Timezone =====
date_default_timezone_set('Asia/Ho_Chi_Minh');

// ===== Error reporting =====
error_reporting(E_ALL);
ini_set('display_errors', 0);   // Production: 0
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error.log');

// ===== Bảo đảm timezone cho MySQL khi có kết nối =====
// (Một số file API có thể gọi new mysqli() ngay sau khi include config.php này)
if (isset($GLOBALS['conn']) && $GLOBALS['conn'] instanceof mysqli) {
    @$GLOBALS['conn']->query("SET time_zone = '+07:00'");
}
