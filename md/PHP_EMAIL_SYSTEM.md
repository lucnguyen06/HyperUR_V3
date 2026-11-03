# PHP Email System - HyperUR V3

Hệ thống PHP gửi email tự động + tra cứu serial bằng MySQL, thay thế Google Apps Script.

---

## 🎯 Tính năng

- ✅ Nhận đăng ký Serial từ website
- 💾 Lưu vào MySQL database
- 📧 Gửi email xác nhận tự động (template HTML)
- 🔍 API tra cứu Serial
- 🆓 Tự động kích hoạt gói Free (36 ngày)
- 📊 Log hoạt động đầy đủ

---

## 📦 Cấu trúc file

```text
api/
├── _bootstrap.php          # Header JSON, CORS an toàn, session (dùng cho endpoint admin)
├── .htaccess               # Chặn truy cập config/log qua HTTP
├── config.php              # ⚠️ Tạo từ config.example.php, KHÔNG commit
├── config.example.php      # Template cấu hình
├── email-template.php      # Email HTML template
├── serial-register.php     # API đăng ký serial (POST)
├── serial-lookup.php       # API tra cứu serial (GET)
└── update-link.js          # Webhook ROM files (Vercel Serverless)

sql/
└── schema.sql              # MySQL schema đầy đủ
```

---

## 🚀 Hướng dẫn setup

### Bước 1: Tạo Database MySQL

1. Đăng nhập **cPanel** → **phpMyAdmin**
2. Tạo database mới
3. Import `sql/schema.sql`:
   - Click database → tab **Import**
   - Choose file → `schema.sql` → **Go**

### Bước 2: Cấu hình

```bash
cp api/config.example.php api/config.php
```

Mở `api/config.php`:

```php
define('DB_HOST', 'localhost');
define('DB_USER', 'your_username');
define('DB_PASS', 'your_password');
define('DB_NAME', 'hyperur_db');

define('EMAIL_FROM', 'noreply@hyperur.io.vn');
define('API_SECRET', 'your_secret_key');
```

### Bước 3: Upload files lên hosting

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
│   ├── config.php            ← file thật, KHÔNG commit
│   ├── email-template.php
│   ├── serial-register.php
│   ├── serial-lookup.php
│   ├── admin-auth.php
│   ├── admin-serials.php
│   ├── admin-logs.php
│   ├── admin-users.php
│   └── update-link.js
├── add_serial.php
├── serial.html
├── index.html
└── ... (files khác)
```

### Bước 4: Test API

**Đăng ký Serial (POST):**

```bash
curl -X POST https://hyperur.io.vn/api/serial-register.php \
  -H "Content-Type: application/json" \
  -d '{
    "serial": "TEST123456",
    "codename": "marble",
    "plan": "Active Free",
    "paymentMethod": "Active Free",
    "senderName": "Test User",
    "senderEmail": "your-email@gmail.com",
    "transactionCode": "FREE_36"
  }'
```

**Tra cứu Serial (GET):**

```bash
curl "https://hyperur.io.vn/api/serial-lookup.php?serial=TEST123456"
```

### Bước 5: Kiểm tra email

1. Kiểm tra inbox email đã nhận được email xác nhận
2. Nếu không thấy, check **Spam**
3. Nếu vẫn không có, kiểm tra log: `api/error.log`

---

## 📊 Database structure

### Table: `registrations`

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Auto increment ID |
| serial | VARCHAR(50) | Số Serial (UNIQUE) |
| codename | VARCHAR(100) | Mã thiết bị |
| plan | VARCHAR(100) | Gói đăng ký |
| payment_method | VARCHAR(50) | Phương thức thanh toán |
| sender_name | VARCHAR(100) | Tên người gửi |
| sender_email | VARCHAR(100) | Email người gửi |
| transaction_code | VARCHAR(100) | Mã giao dịch |
| status | ENUM | Pending/Active/Expired/Suspended |
| created_at | TIMESTAMP | Thời gian đăng ký |
| activated_at | DATETIME | Thời gian kích hoạt |
| expired_at | DATETIME | Thời gian hết hạn |

### Table: `activity_logs`

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Auto increment ID |
| serial | VARCHAR(50) | Số Serial |
| action | VARCHAR(50) | Hành động (register/lookup) |
| description | TEXT | Mô tả chi tiết |
| ip_address | VARCHAR(45) | IP address |
| user_agent | TEXT | User agent |
| created_at | TIMESTAMP | Thời gian |

Xem đầy đủ schema (bao gồm `serial`, `admin_users`, `admin_logs`) tại [`sql/schema.sql`](../sql/schema.sql).

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

**Validate rules:**

- `serial`: bắt buộc, `[A-Z0-9]{4,32}` (sau khi uppercase)
- `codename`: bắt buộc, `[a-z0-9._-]{1,100}`
- `senderEmail`: bắt buộc, đúng định dạng email
- `plan`: so khớp chính xác với whitelist để auto-activate gói Free

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

## 📧 Email template

Email tự động có:

- ✅ Dark theme glassmorphism design
- 📱 Responsive (mobile-friendly)
- 🎨 Logo HyperUR với accent color
- 📋 Chi tiết đầy đủ về Serial, Codename, Gói
- 🔗 Button CTA kiểm tra trạng thái
- ⚠️ Lưu ý quan trọng (khác nhau giữa Free/Paid)
- 📲 Links Telegram channel & support

Toàn bộ giá trị user nhập đều được `htmlspecialchars()` trước khi chèn vào HTML.

---

## 🔧 Troubleshooting

### Email không được gửi

**Nguyên nhân:** PHP `mail()` không hoạt động trên hosting

**Giải pháp 1 — Dùng SMTP (Recommended):**

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

**Giải pháp 2 — Kiểm tra log:**

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
```

### CORS errors

Các endpoint admin **không** trả `Access-Control-Allow-Origin: *` nữa (vì dùng cookie session).
Nếu admin panel chạy ở domain khác, khai báo trong `api/config.php`:

```php
define('ADMIN_ALLOWED_ORIGINS', 'https://admin.hyperur.io.vn');
```

---

## 🔐 Security notes

1. **Đổi `API_SECRET`** trong `config.php`
2. **Không commit** `config.php` lên git (đã có trong `.gitignore`)
3. **Disable error display** trên production — đã set `display_errors = 0` trong template
4. **Validate inputs** — đã có trong code
5. **Prepared statements** — đã có trong code
6. **HTTPS only** — bắt buộc cho production
7. **Bảo vệ `add_serial.php`** — đặt `ADD_SERIAL_TOKEN` / `ADD_SERIAL_IP_ALLOW` trong `config.php`

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
