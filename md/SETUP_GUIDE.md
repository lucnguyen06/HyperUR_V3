# ✅ SETUP GUIDE — PHP Backend & Admin Panel

**Cập nhật:** 2026-11-03
**Hệ thống:** HyperUR V3 — PHP Email System + Admin Panel

Checklist triển khai từ đầu đến cuối. Đánh dấu `[x]` khi xong từng bước.

---

## Checklist

### ✅ Phase 1 — Database

- [ ] 1.1. Đăng nhập cPanel → **phpMyAdmin**
- [ ] 1.2. Tạo database mới
- [ ] 1.3. Tạo user database (hoặc dùng user có sẵn)
- [ ] 1.4. Gán quyền user cho database
- [ ] 1.5. Import `sql/schema.sql`:
  - Click database → tab **Import** → Choose file → **Go**
- [ ] 1.6. Verify đủ 5 bảng:

  | Bảng | Mục đích |
  |------|----------|
  | `registrations` | Đăng ký serial từ website |
  | `activity_logs` | Log register / lookup của user |
  | `admin_users` | Tài khoản đăng nhập admin |
  | `admin_logs` | Audit log thao tác admin |
  | `serial` | Serial bản quyền ROM (bảng chính) |

---

### ✅ Phase 2 — Cấu hình

- [ ] 2.1. Copy template:
  ```bash
  cp api/config.example.php api/config.php
  ```
- [ ] 2.2. Cập nhật thông tin database:
  ```php
  define('DB_HOST', 'localhost');
  define('DB_USER', 'your_username');
  define('DB_PASS', 'your_password');
  define('DB_NAME', 'your_db_name');
  ```
- [ ] 2.3. Cập nhật email & security:
  ```php
  define('EMAIL_FROM', 'noreply@hyperur.io.vn');
  define('API_SECRET', 'chuoi-random-dai');
  ```
- [ ] 2.4. (Khuyến nghị) Bảo vệ `add_serial.php`:
  ```php
  define('ADD_SERIAL_TOKEN', 'chuoi-bi-mat-khac');
  // define('ADD_SERIAL_IP_ALLOW', '127.0.0.1,113.161.0.0/16');
  ```
- [ ] 2.5. Lưu file — **xác nhận `api/config.php` KHÔNG bị commit** (`git status` không thấy file này)

---

### ✅ Phase 3 — Upload files

- [ ] 3.1. Kết nối FTP/SFTP hoặc File Manager cPanel
- [ ] 3.2. Upload đúng cấu trúc:

  ```text
  public_html/
  ├── admin/
  │   ├── admin.html
  │   ├── admin.css
  │   ├── admin.js
  │   ├── admin-users.html
  │   ├── admin-users.css
  │   └── admin-users.js
  ├── api/
  │   ├── _bootstrap.php
  │   ├── .htaccess
  │   ├── config.php          ✏️ tự tạo
  │   ├── config.example.php
  │   ├── email-template.php
  │   ├── serial-register.php
  │   ├── serial-lookup.php
  │   ├── admin-auth.php
  │   ├── admin-serials.php
  │   ├── admin-logs.php
  │   ├── admin-users.php
  │   └── update-link.js
  ├── add_serial.php
  ├── index.html
  ├── serial.html
  └── ... (assets: styles.css, json/, devices/, images/)
  ```
- [ ] 3.3. Set permissions:
  ```bash
  chmod 644 *.php api/*.php
  chmod 755 admin api
  ```

---

### ✅ Phase 4 — Tạo Super Admin

- [ ] 4.1. Sinh bcrypt hash cho mật khẩu:
  ```bash
  php -r "echo password_hash('MatKhauCuaBan', PASSWORD_DEFAULT), PHP_EOL;"
  ```
- [ ] 4.2. Insert vào database (thay hash vừa sinh):
  ```sql
  INSERT INTO admin_users (username, password, full_name, role, active)
  VALUES ('superadmin', '<HASH_VỪA_SINH>', 'Super Admin', 'superadmin', 1);
  ```
- [ ] 4.3. Kiểm tra:
  ```sql
  SELECT id, username, role, active FROM admin_users;
  ```

---

### ✅ Phase 5 — Test API

#### 5.1. Test DB connection

Tạo tạm `api/test-db.php`:

```php
<?php
require_once __DIR__ . '/config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die("❌ Failed: " . $conn->connect_error);
}
echo "✅ Database connected successfully!";
$conn->close();
```

- [ ] 5.1.1. Truy cập `https://hyperur.io.vn/api/test-db.php`
- [ ] 5.1.2. Kết quả: `✅ Database connected successfully!`
- [ ] 5.1.3. **Xoá file test** (`rm api/test-db.php`)

#### 5.2. Test API Đăng Ký (POST)

- [ ] 5.2.1. Gọi bằng Postman hoặc curl:

  ```bash
  curl -X POST https://hyperur.io.vn/api/serial-register.php \
    -H "Content-Type: application/json" \
    -d '{
      "serial": "TEST123456",
      "codename": "marble",
      "plan": "Active Free",
      "paymentMethod": "Active Free (0đ)",
      "senderName": "Test User",
      "senderEmail": "YOUR_EMAIL@gmail.com",
      "transactionCode": "FREE_36"
    }'
  ```
- [ ] 5.2.2. Kết quả mong đợi:

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

> **Lưu ý**: `plan` phải khớp **chính xác** một trong các giá trị whitelist mới được auto-activate:
> `Active Free`, `Active Free (36 ngày)`, `Active Free (36 ngày trải nghiệm)`.
> Giá trị khác (kể cả có chứa chữ "36") sẽ ở trạng thái `Pending`.

#### 5.3. Test API Tra Cứu (GET)

- [ ] 5.3.1. Truy cập:
  ```
  https://hyperur.io.vn/api/serial-lookup.php?serial=TEST123456
  ```
- [ ] 5.3.2. Kết quả: thông tin Serial vừa đăng ký

#### 5.4. Test endpoint thêm serial nhanh

- [ ] 5.4.1. Nếu đặt `ADD_SERIAL_TOKEN`:
  ```
  https://hyperur.io.vn/add_serial.php?serial=TESTAUTO01&device=marble&gmail=test@gmail.com&time=unlimited&token=<TOKEN>
  ```
- [ ] 5.4.2. Kiểm tra bảng `serial` có row mới với `STT` tự tăng
- [ ] 5.4.3. Kiểm tra bảng `admin_logs` có `action = 'add_serial_auto'`, `admin_id = 0`

---

### ✅ Phase 6 — Kiểm tra Email

- [ ] 6.1. Mở inbox email dùng test ở 5.2.1
- [ ] 6.2. Tìm subject: `✅ Xác Nhận Đăng Ký Serial TEST123456 - HyperUR`
- [ ] 6.3. Nếu không thấy → check **Spam**
- [ ] 6.4. Verify template:
  - ✅ Logo HyperUR
  - ✅ Success icon
  - ✅ Thông tin Serial đầy đủ
  - ✅ Button "Kiểm Tra Trạng Thái"
  - ✅ Footer links

#### ⚠️ Nếu email không nhận được

**Option A — Test hàm `mail()`:**

Tạo tạm `api/test-email.php`:

```php
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
```

Truy cập `https://hyperur.io.vn/api/test-email.php` rồi **xoá file**.

**Option B — Cài PHPMailer (SMTP):**

```bash
composer require phpmailer/phpmailer
```

Tạo `api/smtp-config.php`:

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
```

Cập nhật `serial-register.php`:

```php
require_once 'smtp-config.php';
$emailSent = sendEmailSMTP($senderEmail, $subject, $emailHtml);
```

---

### ✅ Phase 7 — Kiểm tra Database sau test

- [ ] 7.1. Bảng `registrations`: có 1 row `TEST123456`, status `Active`, `activated_at` có giá trị, `expired_at` = +36 ngày
- [ ] 7.2. Bảng `activity_logs`: có log `action = 'register'`, `ip_address` có giá trị

---

### ✅ Phase 8 — Test trang Admin

- [ ] 8.1. Mở `https://hyperur.io.vn/admin/admin.html`
- [ ] 8.2. Đăng nhập bằng Super Admin vừa tạo (Phase 4)
- [ ] 8.3. Kiểm tra dashboard hiển thị đúng số liệu
- [ ] 8.4. Thêm 1 serial thủ công → thấy xuất hiện trong bảng
- [ ] 8.5. Sửa serial → lưu thành công
- [ ] 8.6. Gia hạn serial (+30 ngày) → cột `Time` cập nhật
- [ ] 8.7. Xuất CSV → file tải về mở được bằng Excel (UTF-8 đúng tiếng Việt)
- [ ] 8.8. Xem tab Nhật ký → thấy đủ các thao tác vừa làm
- [ ] 8.9. Đổi mật khẩu → đăng xuất → đăng nhập lại bằng mật khẩu mới
- [ ] 8.10. Mở `https://hyperur.io.vn/admin/admin-users.html`
  - Nếu đăng nhập bằng `superadmin` → truy cập được
  - Nếu đăng nhập bằng `admin` → không thấy nút "Quản Lý Admin", và gọi API trả 403
- [ ] 8.11. Tạo 1 admin thường → đăng nhập thử → xác nhận không vào được `admin-users.html`
- [ ] 8.12. Khoá admin vừa tạo → đăng nhập bị từ chối (`Tài khoản đã bị vô hiệu hóa`)

---

### ✅ Phase 9 — Test trên website

- [ ] 9.1. Mở `https://hyperur.io.vn/serial.html`
- [ ] 9.2. Tab **"Đăng Ký Serial"** → điền form → submit
- [ ] 9.3. Kết quả: modal "Email xác nhận đã được gửi đến..." + toast success
- [ ] 9.4. Check inbox → nhận email
- [ ] 9.5. Tab **"Tra Cứu Serial"** → nhập serial vừa đăng ký → thấy đầy đủ thông tin

> ⚠️ **Quan trọng**: website hiện đang gọi **Google Apps Script**, không phải PHP.
> Muốn chuyển sang backend PHP, sửa `json/config.js`:
>
> ```javascript
> SERIAL_REGISTER_API_URL: "https://hyperur.io.vn/api/serial-register.php",
> SERIAL_LOOKUP_API_URL:   "https://hyperur.io.vn/api/serial-lookup.php"
> ```
>
> Nếu giữ GAS thì backend PHP chỉ dùng cho admin panel (`/admin/admin.html`) — hai hệ dữ liệu sẽ **tách rời nhau**.

---

### ✅ Phase 10 — Clean up

- [ ] 10.1. Xoá serial test:
  ```sql
  DELETE FROM registrations WHERE serial IN ('TEST123456', 'TEST789012');
  DELETE FROM activity_logs WHERE serial IN ('TEST123456', 'TEST789012');
  DELETE FROM serial WHERE Serial IN ('TESTAUTO01');
  ```
- [ ] 10.2. Xoá file test (nếu có):
  - `api/test-db.php`
  - `api/test-email.php`
- [ ] 10.3. Xoá `api/error.log` cũ nếu có dữ liệu nhạy cảm

---

### ✅ Phase 11 — Security hardening

- [ ] 11.1. Xác nhận `api/.htaccess` đã upload (chặn `config.php`, `*.log`, `_bootstrap.php`, `email-template.php`)
- [ ] 11.2. Test: truy cập `https://hyperur.io.vn/api/config.php` → phải trả **403**
- [ ] 11.3. Xác nhận `display_errors = 0` trong `api/config.php`
- [ ] 11.4. Xác nhận `.gitignore` chặn `api/config.php`:
  ```bash
  git check-ignore -v api/config.php
  ```
- [ ] 11.5. Nếu admin panel chạy khác domain, khai báo:
  ```php
  define('ADMIN_ALLOWED_ORIGINS', 'https://admin.hyperur.io.vn');
  ```
- [ ] 11.6. Bật HTTPS bắt buộc cho toàn site
- [ ] 11.7. (Khuyến nghị) Bổ sung CSRF token cho các form admin

---

## 🎉 Hoàn thành

### 🔗 URLs quan trọng

| Mục | URL |
|-----|-----|
| Website | https://hyperur.io.vn |
| Serial page | https://hyperur.io.vn/serial.html |
| Admin — Serial | https://hyperur.io.vn/admin/admin.html |
| Admin — Tài khoản | https://hyperur.io.vn/admin/admin-users.html |
| API Register | https://hyperur.io.vn/api/serial-register.php |
| API Lookup | https://hyperur.io.vn/api/serial-lookup.php |
| Thêm serial nhanh | https://hyperur.io.vn/add_serial.php?serial=XXX&time=unlimited |

---

## 📊 Monitoring

### Check logs

```bash
tail -f api/error.log
```

### Check database

```sql
-- Tổng số đăng ký
SELECT COUNT(*) FROM registrations;

-- Đăng ký hôm nay
SELECT COUNT(*) FROM registrations WHERE DATE(created_at) = CURDATE();

-- Serial Active
SELECT COUNT(*) FROM registrations WHERE status = 'Active';

-- Tổng serial bản quyền
SELECT COUNT(*) FROM serial;

-- Serial sắp hết hạn trong 7 ngày
SELECT STT, Serial, Device, Gmail, Time FROM serial
WHERE Time <> 'unlimited'
  AND STR_TO_DATE(Time, '%Y-%m-%d') BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY);

-- Hoạt động admin gần đây
SELECT id, username, action, description, ip_address, created_at
FROM admin_logs ORDER BY id DESC LIMIT 20;
```

---

**Good luck! 🚀**
