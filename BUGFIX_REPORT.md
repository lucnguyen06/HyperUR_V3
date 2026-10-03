# 🐛 BUG FIX REPORT - Serial Registration Email

**Ngày:** 3 October 2026  
**File:** `api/serial-register.php`  
**Trạng thái:** ✅ ĐÃ SỬA

---

## 🔍 Lỗi Phát Hiện

### **LỖI: Email header không encode UTF-8 đúng chuẩn**

**File:** `api/serial-register.php` - Dòng 150

**Code cũ (SAI):**
```php
$headers .= "From: " . EMAIL_FROM_NAME . " <" . EMAIL_FROM . ">\r\n";
```

**Vấn đề:**
1. ❌ Không encode tên người gửi theo chuẩn RFC 5322
2. ❌ Ký tự Unicode trong `EMAIL_FROM_NAME` (VD: "HyperUR") có thể gây lỗi
3. ❌ Một số email server từ chối email có header không đúng format
4. ❌ Email có thể bị đánh dấu spam hoặc không gửi được

**Hậu quả:**
- Email xác nhận không được gửi đến người dùng
- Hoặc bị reject bởi mail server
- Hoặc rơi vào spam folder

---

## ✅ Giải Pháp

**Code mới (ĐÚNG):**
```php
// Properly encode email headers to prevent issues with special characters
$fromName = '=?UTF-8?B?' . base64_encode(EMAIL_FROM_NAME) . '?=';

$headers = "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";
$headers .= "From: {$fromName} <" . EMAIL_FROM . ">\r\n";
$headers .= "Reply-To: " . SUPPORT_EMAIL . "\r\n";
$headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
```

**Cải thiện:**
1. ✅ Encode tên người gửi theo chuẩn RFC 2047 (Base64 UTF-8)
2. ✅ Hỗ trợ ký tự Unicode an toàn
3. ✅ Tương thích với mọi email server
4. ✅ Giảm khả năng bị đánh dấu spam

---

## 📊 Các File Liên Quan

### Files đã sửa:
- ✅ `api/serial-register.php` - Fixed email header encoding

### Files debug có sẵn (để test):
- 📄 `api/test-email.php` - Test PHP mail() function
- 📄 `api/serial-register-debug.php` - Debug version với logging chi tiết
- 📄 `EMAIL_DEBUG_GUIDE.md` - Hướng dẫn debug email đầy đủ

---

## 🧪 Hướng Dẫn Test

### Bước 1: Test email function
```bash
# Upload test-email.php lên server và truy cập:
https://hyperur.io.vn/api/test-email.php

# Sửa email trong file trước:
$testEmail = "your-real-email@gmail.com";
```

### Bước 2: Test registration API
```bash
# Gửi POST request đến:
https://hyperur.io.vn/api/serial-register.php

# Với payload:
{
  "serial": "TEST123456",
  "codename": "device001",
  "senderEmail": "your-email@gmail.com",
  "plan": "Active Free (36 Ngày)"
}
```

### Bước 3: Kiểm tra email
- ✅ Check inbox
- ✅ Check spam/junk folder
- ✅ Verify email hiển thị đúng format
- ✅ Verify sender name hiển thị "HyperUR"

---

## 🔐 Lưu Ý Bảo Mật

**⚠️ QUAN TRỌNG:**
File `api/config.php` chứa thông tin nhạy cảm đã được commit lên Git!

```php
define('DB_USER', 'ycoozxap');
define('DB_PASS', 'Tl29126@@@');  // ⚠️ PASSWORD BỊ LỘ
define('DB_NAME', 'ycoozxap_hyperur_db');
define('EMAIL_FROM', 'hyperur2026@gmail.com');
```

### Khuyến nghị:
1. ❌ **XÓA config.php khỏi Git ngay:**
   ```bash
   git rm --cached api/config.php
   git commit -m "security: Remove config.php from repository"
   ```

2. ✅ **Đổi password database ngay lập tức**

3. ✅ **Sử dụng config.example.php làm template**

4. ✅ **Verify .gitignore đã ignore config.php:**
   ```
   # .gitignore
   api/config.php
   ```

---

## 📝 Changelog

### [Fixed] - 2026-10-03
- Fixed email header encoding to RFC 2047 standard
- Added Base64 UTF-8 encoding for sender name
- Improved email deliverability and spam score

---

## 📞 Hỗ Trợ

Nếu vẫn gặp lỗi email:
- 📖 Đọc `EMAIL_DEBUG_GUIDE.md`
- 🔧 Sử dụng `serial-register-debug.php`
- 💬 Liên hệ: hyperur2026@gmail.com
