# PHP Email System - HyperUR V3

Hệ thống PHP gửi email tự động thay thế Google Apps Script.

---

## 🎯 Tính Năng

- ✅ Nhận đăng ký Serial từ website
- 💾 Lưu vào MySQL database
- 📧 Gửi email xác nhận tự động (template đẹp)
- 🔍 API tra cứu Serial
- 🆓 Tự động kích hoạt gói Free (36 ngày)
- 📊 Log hoạt động đầy đủ

---

## 📦 Files Cấu Trúc

```
api/
├── config.php              # Cấu hình database & email
├── email-template.php      # Email HTML template
├── serial-register.php     # API đăng ký serial (POST)
├── serial-lookup.php       # API tra cứu serial (GET)
└── update-link.js          # Webhook ROM files (giữ nguyên)

database/
└── schema.sql              # MySQL schema
```

---

## 🚀 Hướng Dẫn Setup

### Bước 1: Tạo Database MySQL

1. Đăng nhập **cPanel** → **phpMyAdmin**
2. Tạo database mới: `hyperur_db`
3. Import file `database/schema.sql`:
   - Click database `hyperur_db`
   - Tab **Import**
   - Choose file `schema.sql`
   - Click **Go**

### Bước 2: Cấu Hình Database

Mở file `api/config.php` và cập nhật:

```php
define('DB_HOST', 'localhost');        // Thường là localhost
define('DB_USER', 'your_username');    // Username MySQL
define('DB_PASS', 'your_password');    // Password MySQL
define('DB_NAME', 'hyperur_db');       // Tên database

define('EMAIL_FROM', 'noreply@hyperur.io.vn');  // Email gửi
define('API_SECRET', 'your_secret_key');        // Mã bảo mật
```

### Bước 3: Upload Files lên Hosting

Upload các file sau lên hosting:

```
public_html/
├── api/
│   ├── config.php
│   ├── email-template.php
│   ├── serial-register.php
│   ├── serial-lookup.php
│   └── update-link.js
├── serial.html
├── index.html
└── ... (files khác)
```

### Bước 4: Test API

#### Test Đăng Ký Serial (POST):

```bash
curl -X POST https://hyperur.io.vn/api/serial-register.php \
  -H "Content-Type: application/json" \
  -d '{
    "serial": "TEST123456",
    "codename": "marble",
    "plan": "Active Free (36 ngày)",
    "paymentMethod": "Active Free",
    "senderName": "Test User",
    "senderEmail": "your-email@gmail.com",
    "transactionCode": "FREE_36"
  }'
```

#### Test Tra Cứu Serial (GET):

```bash
curl https://hyperur.io.vn/api/serial-lookup.php?serial=TEST123456
```

### Bước 5: Kiểm Tra Email

1. Kiểm tra inbox email đã nhận được email xác nhận chưa
2. Nếu không thấy, check **Spam** folder
3. Nếu vẫn không có, kiểm tra log: `api/error.log`

---

## 📊 Database Structure

### Table: `registrations`

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Auto increment ID |
| serial | VARCHAR(50) | Số Serial (UNIQUE) |
| codename | VARCHAR(50) | Mã thiết bị |
| plan | VARCHAR(100) | Gói đăng ký |
| payment_method | VARCHAR(100) | Phương thức thanh toán |
| sender_name | VARCHAR(100) | Tên người gửi |
| sender_email | VARCHAR(255) | Email người gửi |
| transaction_code | VARCHAR(100) | Mã giao dịch |
| status | ENUM | Active/Pending/Expired/Cancelled |
| created_at | TIMESTAMP | Thời gian đăng ký |
| activated_at | TIMESTAMP | Thời gian kích hoạt |
| expired_at | TIMESTAMP | Thời gian hết hạn |

### Table: `activity_logs`

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Auto increment ID |
| serial | VARCHAR(50) | Số Serial |
| action | VARCHAR(50) | Hành động (register/lookup) |
| description | TEXT | Mô tả chi tiết |
| ip_address | VARCHAR(45) | IP address |
| user_agent | VARCHAR(255) | User agent |
| created_at | TIMESTAMP | Thời gian |

---

## 🔌 API Documentation

### POST `/api/serial-register.php`

**Request:**
```json
{
  "serial": "ABC123456",
  "codename": "marble",
  "plan": "Có Ủng hộ (Vĩnh viễn)",
  "paymentMethod": "Momo",
  "senderName": "Nguyễn Văn A",
  "senderEmail": "example@gmail.com",
  "transactionCode": "UR ABC123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đăng ký thành công và email xác nhận đã được gửi",
  "data": {
    "serial": "ABC123456",
    "email": "example@gmail.com",
    "status": "Pending",
    "emailSent": true
  }
}
```

### GET `/api/serial-lookup.php?serial=ABC123456`

**Response:**
```json
{
  "success": true,
  "message": "Tìm thấy Serial",
  "data": {
    "serial": "ABC123456",
    "codename": "marble",
    "plan": "Có Ủng hộ (Vĩnh viễn)",
    "paymentMethod": "Momo",
    "senderName": "Nguyễn Văn A",
    "senderEmail": "example@gmail.com",
    "transactionCode": "UR ABC123456",
    "status": "Active",
    "registeredDate": "03/10/2026 13:30",
    "activatedDate": "03/10/2026 14:00",
    "expiredDate": "03/10/2027 14:00",
    "updatedDate": "03/10/2026 14:00"
  }
}
```

---

## 📧 Email Template

Email tự động có:
- ✅ Dark theme glassmorphism design
- 📱 Responsive (mobile-friendly)
- 🎨 Logo HyperUR với accent color
- 📋 Chi tiết đầy đủ về Serial, Codename, Gói
- 🔗 Button CTA kiểm tra trạng thái
- ⚠️ Lưu ý quan trọng (khác nhau giữa Free/Paid)
- 📲 Links Telegram channel & support

---

## 🔧 Troubleshooting

### Email không được gửi

**Nguyên nhân:** PHP `mail()` không hoạt động trên hosting

**Giải pháp 1 - Dùng SMTP (Recommended):**

Install PHPMailer:
```bash
composer require phpmailer/phpmailer
```

Cập nhật `serial-register.php`:
```php
use PHPMailer\PHPMailer\PHPMailer;

$mail = new PHPMailer(true);
$mail->isSMTP();
$mail->Host = 'smtp.gmail.com';
$mail->SMTPAuth = true;
$mail->Username = 'your-email@gmail.com';
$mail->Password = 'your-app-password';
$mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
$mail->Port = 587;
$mail->setFrom('noreply@hyperur.io.vn', 'HyperUR');
$mail->addAddress($senderEmail);
$mail->isHTML(true);
$mail->Subject = $subject;
$mail->Body = $emailHtml;
$mail->send();
```

**Giải pháp 2 - Kiểm tra log:**
```bash
tail -f api/error.log
```

### Database connection failed

1. Kiểm tra thông tin database trong `config.php`
2. Đảm bảo user có quyền truy cập database
3. Test kết nối:
```php
<?php
$conn = new mysqli('localhost', 'user', 'pass', 'hyperur_db');
if ($conn->connect_error) {
    die("Failed: " . $conn->connect_error);
}
echo "Connected successfully";
?>
```

### CORS errors

Thêm vào `.htaccess`:
```apache
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
    Header set Access-Control-Allow-Headers "Content-Type"
</IfModule>
```

---

## 🆚 So Sánh với Google Apps Script

| Feature | Google Apps Script | PHP System |
|---------|-------------------|-----------|
| Setup | Phức tạp | Đơn giản (upload files) |
| Database | Google Sheets | MySQL (mạnh hơn) |
| Email quota | 100-1500/ngày | Unlimited (tùy hosting) |
| Speed | Chậm (serverless) | Nhanh (dedicated) |
| Control | Limited | Full control |
| Cost | Free (trong quota) | Hosting fee |
| Maintenance | Google quản lý | Tự quản lý |

---

## 🔐 Security Notes

1. **Đổi API_SECRET** trong `config.php`
2. **Không commit** `config.php` lên git public
3. **Disable error display** trên production:
   ```php
   ini_set('display_errors', 0);
   ```
4. **Validate inputs** - Đã có trong code
5. **Use prepared statements** - Đã có trong code
6. **HTTPS only** - Bắt buộc cho production

---

## 📞 Support

- 📢 Channel: https://t.me/hypermodupdate
- 💬 Chat: https://t.me/HuperUltraRateChat
- 👤 Admin: @lcnguy06 | @Usagi79

---

## 🆕 Version

**v3.0** (2026-10-03)
- ✅ PHP email system thay thế Google Apps Script
- ✅ MySQL database thay Google Sheets
- ✅ Auto-activation cho gói Free
- ✅ Activity logging
- ✅ Email template đẹp
