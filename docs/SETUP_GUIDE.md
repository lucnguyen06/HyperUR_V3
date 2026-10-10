# ✅ SETUP GUIDE: PHP Email System

**Date:** 3 October 2026  
**System:** HyperUR V3 PHP Email System

---

## 📋 Checklist Setup

### ✅ Phase 1: Database Setup

- [ ] 1.1. Đăng nhập cPanel
- [ ] 1.2. Vào **phpMyAdmin**
- [ ] 1.3. Tạo database mới: `hyperur_db`
- [ ] 1.4. Tạo user database (hoặc dùng user có sẵn)
- [ ] 1.5. Gán quyền user cho database
- [ ] 1.6. Import file `database/schema.sql`:
  - Click database `hyperur_db`
  - Tab **Import**
  - Choose file → `schema.sql`
  - Click **Go**
- [ ] 1.7. Verify: Check 2 tables đã được tạo:
  - `registrations` (0 rows)
  - `activity_logs` (0 rows)

---

### ✅ Phase 2: Cấu Hình Files

- [ ] 2.1. Mở `api/config.php`
- [ ] 2.2. Cập nhật thông tin database:
  ```php
  define('DB_HOST', 'localhost');           // ✏️ Sửa nếu khác
  define('DB_USER', 'your_username');       // ✏️ Thay username của bạn
  define('DB_PASS', 'your_password');       // ✏️ Thay password của bạn
  define('DB_NAME', 'hyperur_db');          // ✅ Giữ nguyên
  ```
- [ ] 2.3. Cập nhật email & security:
  ```php
  define('EMAIL_FROM', 'noreply@hyperur.io.vn');  // ✏️ Thay domain của bạn
  define('API_SECRET', 'your_secret_key_here');   // ✏️ Tạo mã bảo mật
  ```
- [ ] 2.4. Lưu file

---

### ✅ Phase 3: Upload Files

- [ ] 3.1. Kết nối FTP/SFTP hoặc dùng File Manager cPanel
- [ ] 3.2. Upload các files:
  ```
  public_html/api/
  ├── config.php ✏️
  ├── email-template.php ✅
  ├── serial-register.php ✅
  ├── serial-lookup.php ✅
  └── update-link.js (giữ nguyên)
  ```
- [ ] 3.3. Set permissions (nếu cần):
  ```bash
  chmod 644 *.php
  ```

---

### ✅ Phase 4: Test Database Connection

- [ ] 4.1. Tạo file test: `api/test-db.php`:
  ```php
  <?php
  require_once 'config.php';
  $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
  if ($conn->connect_error) {
      die("❌ Failed: " . $conn->connect_error);
  }
  echo "✅ Database connected successfully!";
  $conn->close();
  ?>
  ```
- [ ] 4.2. Truy cập: `https://hyperur.io.vn/api/test-db.php`
- [ ] 4.3. Kết quả mong đợi: `✅ Database connected successfully!`
- [ ] 4.4. ✅ Xóa file test: `rm test-db.php`

---

### ✅ Phase 5: Test API Endpoints

#### 5.1. Test API Đăng Ký (POST)

- [ ] 5.1.1. Dùng **Postman** hoặc **curl**:
  ```bash
  curl -X POST https://hyperur.io.vn/api/serial-register.php \
    -H "Content-Type: application/json" \
    -d '{
      "serial": "TEST123456",
      "codename": "marble",
      "plan": "Active Free (36 ngày)",
      "paymentMethod": "Active Free (0đ)",
      "senderName": "Test User",
      "senderEmail": "YOUR_EMAIL@gmail.com",
      "transactionCode": "FREE_36"
    }'
  ```
- [ ] 5.1.2. Kết quả mong đợi:
  ```json
  {
    "success": true,
    "message": "Đăng ký thành công và email xác nhận đã được gửi",
    "data": {
      "serial": "TEST123456",
      "email": "YOUR_EMAIL@gmail.com",
      "status": "Active",
      "emailSent": true
    }
  }
  ```

#### 5.2. Test API Tra Cứu (GET)

- [ ] 5.2.1. Truy cập URL:
  ```
  https://hyperur.io.vn/api/serial-lookup.php?serial=TEST123456
  ```
- [ ] 5.2.2. Kết quả mong đợi: Hiển thị thông tin Serial vừa đăng ký

---

### ✅ Phase 6: Kiểm Tra Email

- [ ] 6.1. Mở inbox email (dùng trong test ở 5.1.1)
- [ ] 6.2. Tìm email subject: `✅ Xác Nhận Đăng Ký Serial TEST123456 - HyperUR`
- [ ] 6.3. Nếu không thấy → Check **Spam** folder
- [ ] 6.4. Verify email template:
  - ✅ Logo HyperUR
  - ✅ Success icon
  - ✅ Thông tin Serial đầy đủ
  - ✅ Button "Kiểm Tra Trạng Thái"
  - ✅ Footer links

#### ⚠️ Nếu Email Không Nhận Được:

**Option A: Check PHP mail() function**
```php
// Tạo file: api/test-email.php
<?php
$to = "your-email@gmail.com";
$subject = "Test Email";
$message = "This is a test email from PHP";
$headers = "From: noreply@hyperur.io.vn";

if (mail($to, $subject, $message, $headers)) {
    echo "✅ Email sent successfully";
} else {
    echo "❌ Email failed to send";
}
?>
```
Truy cập: `https://hyperur.io.vn/api/test-email.php`

**Option B: Cài PHPMailer (SMTP)**
```bash
# Trong thư mục project
composer require phpmailer/phpmailer
```

Tạo file `api/smtp-config.php`:
```php
<?php
use PHPMailer\PHPMailer\PHPMailer;
require 'vendor/autoload.php';

function sendEmailSMTP($to, $subject, $htmlBody) {
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = 'smtp.gmail.com';
    $mail->SMTPAuth = true;
    $mail->Username = 'your-email@gmail.com';      // ✏️ Thay email
    $mail->Password = 'your-app-password';          // ✏️ App password
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = 587;
    $mail->setFrom('noreply@hyperur.io.vn', 'HyperUR');
    $mail->addAddress($to);
    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body = $htmlBody;
    return $mail->send();
}
?>
```

Cập nhật `serial-register.php` (dòng 125+):
```php
require_once 'smtp-config.php';
$emailSent = sendEmailSMTP($senderEmail, $subject, $emailHtml);
```

---

### ✅ Phase 7: Kiểm Tra Database

- [ ] 7.1. Vào **phpMyAdmin** → Database `hyperur_db`
- [ ] 7.2. Click table `registrations`
- [ ] 7.3. Verify có 1 row:
  - Serial: `TEST123456`
  - Codename: `marble`
  - Status: `Active`
  - Activated_at: Có timestamp
  - Expired_at: +36 ngày
- [ ] 7.4. Click table `activity_logs`
- [ ] 7.5. Verify có log:
  - Serial: `TEST123456`
  - Action: `register`
  - IP address: Có giá trị

---

### ✅ Phase 8: Test Trên Website

- [ ] 8.1. Mở `https://hyperur.io.vn/serial.html`
- [ ] 8.2. Chọn tab **"Đăng Ký Serial"**
- [ ] 8.3. Điền form:
  - Email: `your-email@gmail.com`
  - Serial: `TEST789012`
  - Codename: `marble`
  - Gói: Active Free
- [ ] 8.4. Click **"Xác Nhận & Gửi Serial"**
- [ ] 8.5. Kết quả mong đợi:
  - ✅ Modal thông báo: "Email xác nhận đã được gửi đến..."
  - ✅ Toast success
- [ ] 8.6. Check inbox → Nhận email mới
- [ ] 8.7. Chuyển tab **"Tra Cứu Serial"**
- [ ] 8.8. Nhập Serial: `TEST789012`
- [ ] 8.9. Click **"Tra Cứu"**
- [ ] 8.10. Kết quả hiển thị đầy đủ thông tin

---

### ✅ Phase 9: Clean Up

- [ ] 9.1. Xóa Serial test trong database:
  ```sql
  DELETE FROM registrations WHERE serial IN ('TEST123456', 'TEST789012');
  DELETE FROM activity_logs WHERE serial IN ('TEST123456', 'TEST789012');
  ```
- [ ] 9.2. Xóa file test (nếu có):
  - `api/test-db.php`
  - `api/test-email.php`

---

### ✅ Phase 10: Security Hardening

- [ ] 10.1. Tạo `.htaccess` trong `api/`:
  ```apache
  # Protect config file
  <Files "config.php">
      Order Allow,Deny
      Deny from all
  </Files>
  
  # Enable CORS
  <IfModule mod_headers.c>
      Header set Access-Control-Allow-Origin "*"
      Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
      Header set Access-Control-Allow-Headers "Content-Type"
  </IfModule>
  ```
- [ ] 10.2. Disable error display trong `config.php`:
  ```php
  ini_set('display_errors', 0);  // ✅ Set to 0 for production
  ```
- [ ] 10.3. Tạo `.gitignore`:
  ```
  api/config.php
  api/error.log
  vendor/
  ```

---

## 🎉 Hoàn Thành!

Sau khi hoàn thành tất cả checklist trên, hệ thống PHP Email của bạn đã sẵn sàng hoạt động!

### 🔗 URLs Quan Trọng:

- **Website**: https://hyperur.io.vn
- **Serial Page**: https://hyperur.io.vn/serial.html
- **API Register**: https://hyperur.io.vn/api/serial-register.php
- **API Lookup**: https://hyperur.io.vn/api/serial-lookup.php
- **ROM API**: https://script.google.com/macros/s/AKfycbzaD5HJUbNeKUQYfRUQDzpe7p9oHijySTbnFw9Cujt2HK1PXYS87ssEY_TLqeDe2xZOeA/exec ✅ (giữ nguyên)

---

## 📊 Monitoring

### Check logs:
```bash
tail -f api/error.log
```

### Check database:
```sql
-- Tổng số đăng ký
SELECT COUNT(*) FROM registrations;

-- Đăng ký hôm nay
SELECT COUNT(*) FROM registrations WHERE DATE(created_at) = CURDATE();

-- Serial Active
SELECT COUNT(*) FROM registrations WHERE status = 'Active';

-- Hoạt động gần đây
SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10;
```

---

**Good luck! 🚀**
