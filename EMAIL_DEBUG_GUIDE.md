## 🔍 EMAIL DEBUG GUIDE - Tại Sao Không Nhận Được Email?

**Ngày:** 3 October 2026  
**Vấn đề:** Email không được gửi sau khi deploy

---

## ⚡ QUICK FIX - Làm Ngay

### Bước 1: Test Email Function

1. **Upload file test** lên server:
   - Upload `api/test-email.php` lên hosting
   
2. **Sửa email trong file:**
   ```php
   $testEmail = "your-real-email@gmail.com"; // Thay email thật của bạn
   ```

3. **Truy cập URL:**
   ```
   https://hyperur.io.vn/api/test-email.php
   ```

4. **Xem kết quả:**
   - ✅ Nếu thấy "Email sent successfully" → Check inbox/spam
   - ❌ Nếu thấy "Email failed to send" → PHP mail() không hoạt động

---

## 🐛 Debug với Serial Register

### Bước 2: Enable Debug Mode

1. **Sử dụng file debug:**
   - Upload `api/serial-register-debug.php` lên server

2. **Cập nhật URL trong `json/config.js`:**
   ```javascript
   SERIAL_REGISTER_API_URL: "https://hyperur.io.vn/api/serial-register-debug.php",
   ```

3. **Enable debug trong file:**
   ```php
   $debugMode = true; // Dòng 30 trong serial-register-debug.php
   ```

4. **Test đăng ký serial và xem response:**
   ```json
   {
     "success": true,
     "message": "...",
     "data": {...},
     "debug": {
       "database_connected": true,
       "database_action": "inserted",
       "email_sent": false,
       "email_error": "mail(): Failed to connect to mailserver",
       "mail_function_exists": true,
       "sendmail_path": "/usr/sbin/sendmail -t -i"
     }
   }
   ```

---

## 🔧 SOLUTIONS - Các Giải Pháp

### Solution 1: Check PHP mail() Configuration

**Vào cPanel:**
1. **Email Accounts** → Đảm bảo có email account tồn tại
2. **Email Routing** → Set to "Local Mail Exchanger"
3. **SPF Records** → Thêm SPF record cho domain

**Check PHP settings:**
```php
<?php
phpinfo();
?>
```
Tìm: `sendmail_path` phải có giá trị (không empty)

---

### Solution 2: Use SMTP với PHPMailer (RECOMMENDED)

Nếu PHP `mail()` không hoạt động, dùng SMTP:

#### A. Install PHPMailer

**Option 1 - Composer (recommended):**
```bash
cd /path/to/your/website
composer require phpmailer/phpmailer
```

**Option 2 - Manual download:**
1. Download: https://github.com/PHPMailer/PHPMailer/archive/master.zip
2. Extract và upload folder `PHPMailer` vào `api/`

#### B. Tạo File SMTP Config

Tạo file `api/smtp-mailer.php`:

```php
<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'vendor/autoload.php'; // Hoặc require 'PHPMailer/src/PHPMailer.php';

function sendEmailSMTP($to, $subject, $htmlBody) {
    $mail = new PHPMailer(true);
    
    try {
        //Server settings
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';  // Gmail SMTP
        $mail->SMTPAuth   = true;
        $mail->Username   = 'your-email@gmail.com';     // ✏️ Email của bạn
        $mail->Password   = 'your-app-password';        // ✏️ App password (not regular password)
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;
        $mail->CharSet    = 'UTF-8';
        
        //Recipients
        $mail->setFrom('noreply@hyperur.io.vn', 'HyperUR');
        $mail->addAddress($to);
        $mail->addReplyTo(SUPPORT_EMAIL, 'HyperUR Support');
        
        //Content
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $htmlBody;
        
        $mail->send();
        return true;
        
    } catch (Exception $e) {
        error_log("PHPMailer Error: {$mail->ErrorInfo}");
        return false;
    }
}
?>
```

#### C. Cập Nhật serial-register.php

Thay đoạn code gửi email (dòng 143-154) bằng:

```php
// Send confirmation email using SMTP
require_once 'smtp-mailer.php';

$emailHtml = generateEmailTemplate($data);
$subject = "✅ Xác Nhận Đăng Ký Serial {$serial} - HyperUR";

$emailSent = sendEmailSMTP($senderEmail, $subject, $emailHtml);
```

#### D. Tạo Gmail App Password

1. Vào: https://myaccount.google.com/security
2. Bật **2-Step Verification**
3. Vào **App passwords**
4. Chọn **Mail** và **Other** (custom name: "HyperUR")
5. Click **Generate**
6. Copy 16-ký tự password và paste vào `smtp-mailer.php`

---

### Solution 3: Dùng SMTP của Hosting

Nếu hosting có SMTP riêng (thường cPanel có):

```php
$mail->Host       = 'mail.hyperur.io.vn';  // Hoặc localhost
$mail->Username   = 'noreply@hyperur.io.vn';
$mail->Password   = 'password-cua-email';
$mail->Port       = 587; // Hoặc 465 cho SSL
```

---

### Solution 4: Check Email Logs

**cPanel → Email Delivery Reports:**
1. Vào **Track Delivery**
2. Nhập email đích
3. Xem logs để biết email bị reject/bounce vì lý do gì

**SSH vào server:**
```bash
tail -f /var/log/exim_mainlog
# Hoặc
tail -f /var/log/mail.log
```

---

## 📋 Checklist Debug

- [ ] 1. Upload `test-email.php` và test
- [ ] 2. Check kết quả: Email sent? hoặc Failed?
- [ ] 3. Nếu Failed → Check PHP mail() configuration
- [ ] 4. Nếu mail() disabled → Install PHPMailer
- [ ] 5. Setup SMTP credentials (Gmail App Password)
- [ ] 6. Update `serial-register.php` với SMTP
- [ ] 7. Test lại đăng ký serial
- [ ] 8. Check inbox AND spam folder
- [ ] 9. Check email logs trong cPanel
- [ ] 10. Verify SPF/DKIM records

---

## 🎯 Common Issues

### Issue 1: Email vào Spam
**Giải pháp:**
- Add SPF record: `v=spf1 a mx ~all`
- Add DKIM authentication trong cPanel
- Dùng email có domain name giống website (noreply@hyperur.io.vn)

### Issue 2: "mail() function not available"
**Giải pháp:**
- Hosting disable mail() → Dùng PHPMailer với SMTP

### Issue 3: "Failed to connect to mailserver"
**Giải pháp:**
- Check firewall: Port 25, 587, 465 có bị block không
- Thử SMTP của hosting thay vì Gmail

### Issue 4: Email gửi chậm (delay)
**Giải pháp:**
- PHP mail() thường chậm → Chuyển sang SMTP sẽ nhanh hơn
- Check mail queue: `mailq` command

---

## ⚡ FASTEST SOLUTION (Khuyên Dùng)

**Dùng Gmail SMTP với PHPMailer:**

1. ✅ **Nhanh** - Gửi trong vài giây
2. ✅ **Reliable** - Gmail infrastructure
3. ✅ **Easy** - Chỉ cần App Password
4. ✅ **No spam** - Gmail có reputation tốt

**Setup trong 5 phút:**
```bash
1. composer require phpmailer/phpmailer
2. Tạo Gmail App Password
3. Update smtp-mailer.php với credentials
4. Update serial-register.php dùng sendEmailSMTP()
5. Done!
```

---

## 📞 Need Help?

Nếu vẫn không hoạt động sau khi thử các solution trên:

1. **Check response từ API** (enable debug mode)
2. **Check error.log** trong folder api/
3. **Liên hệ hosting support** hỏi về email configuration
4. **Telegram**: @lcnguy06 hoặc @Usagi79

---

## 🔄 After Fixed

Sau khi email hoạt động:

1. ✅ Disable debug mode: `$debugMode = false;`
2. ✅ Đổi lại URL: `SERIAL_REGISTER_API_URL` về `serial-register.php`
3. ✅ Xóa file test: `rm api/test-email.php`
4. ✅ Test lại toàn bộ flow: Đăng ký → Nhận email → Tra cứu
5. ✅ Commit changes lên Git

---

**Good luck! 🚀**
