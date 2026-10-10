# 🔧 Fix: PHP Không Chạy Được - Hướng Dẫn Chi Tiết

**Problem:** File PHP không chạy được, QR code không hiển thị  
**Cause:** Không sử dụng PHP server (XAMPP/WAMP)  
**Solution:** Setup local server + test đúng cách  

---

## ⚠️ **Vấn Đề Gốc**

### **Hiện Tượng**
```
❌ Mở serial.html → form hiển thị
❌ Nhấn nút → không có phản hồi
❌ QR code không hiện
❌ File PHP không chạy
```

### **Root Cause**
```
Vì: Mở file HTML trực tiếp từ filesystem (file://...)
    → Browser không chạy PHP code
    → Chỉ chạy JavaScript & HTML
    → PHP phía server không được xử lý
```

### **Giải Pháp**
```
✅ Phải chạy trên PHP server (XAMPP/WAMP/LAMP)
✅ Access via: http://localhost/... (không file://...)
✅ Khi đó PHP code mới được xử lý
```

---

## 🛠️ **Setup Local PHP Server (3 Cách)**

### **Cách 1: XAMPP (Dễ nhất) ⭐**

**Bước 1: Download & Install XAMPP**
```
1. Download: https://www.apachefriends.org/
2. Chọn: PHP 8.0 trở lên
3. Install vào: C:\xampp
```

**Bước 2: Thiết Lập Project**
```
1. Copy toàn bộ folder HyperUR_V3 vào:
   C:\xampp\htdocs\hyperur

2. Folder structure:
   C:\xampp\htdocs\
   └─ hyperur/
      ├─ serial.php ✅
      ├─ serial.html
      ├─ test-sepay-qr.php ✅ (NEW)
      ├─ index.html
      ├─ api/
      ├─ json/
      └─ ... (other files)
```

**Bước 3: Start XAMPP**
```
1. Mở: C:\xampp\xampp-control-exe.exe
2. Click: "Start" cho Apache
3. Click: "Start" cho MySQL (nếu cần database)
4. Chờ màu sắc chuyển thành xanh
```

**Bước 4: Test Project**
```
1. Mở browser
2. Truy cập: http://localhost/hyperur/
3. Nên thấy: index.html hoặc serial.html
```

### **Cách 2: WAMP (Windows)**

**Tương tự XAMPP nhưng:**
```
1. Download: https://www.wampserver.com/
2. Install vào: C:\wamp64
3. Folder project: C:\wamp64\www\hyperur
4. Access: http://localhost/hyperur/
5. Quản lý qua: System tray icon
```

### **Cách 3: PHP Built-in Server (Quick)**

**Chỉ cần PHP được install:**
```
1. Mở PowerShell
2. Điều hướng tới project:
   cd C:\path\to\HyperUR_V3

3. Start server:
   php -S localhost:8000

4. Truy cập:
   http://localhost:8000

5. Dừng server:
   Ctrl+C
```

---

## ✅ **Test QR Code (3 Bước)**

### **Bước 1: Verify Server Running**
```
Mở browser
Truy cập: http://localhost/hyperur/

Nếu thấy:
✅ Trang HyperUR hiển thị
✅ CSS/styling ok
✅ Server đang chạy

Nếu lỗi:
❌ Apache/PHP chưa chạy
❌ Check XAMPP control panel
```

### **Bước 2: Test QR Generator (PHP)**
```
URL: http://localhost/hyperur/test-sepay-qr.php

Form sẽ hiển thị:
- Dropdown amount
- Serial input
- Device input

Nhấn: "✨ Tạo QR Code Thanh Toán"

Expected:
✅ QR code hiện lên
✅ Thông tin bank hiển thị
✅ Debug info có URL
```

### **Bước 3: Test Serial Registration**
```
URL: http://localhost/hyperur/serial.html

Điền form:
1. Email
2. Device codename
3. Serial number
4. Tên người gửi
5. Chọn "SePay Bank Transfer"

Expected:
✅ QR code hiện lên (khi chọn SePay)
✅ Bank info hiển thị
✅ Nút "Gửi đăng ký" hoạt động
```

---

## 🐛 **Troubleshooting**

### **Error: PHP không tìm thấy**
```
Giải pháp 1: Cài XAMPP/WAMP
Giải pháp 2: Add PHP to PATH (advanced)
Giải pháp 3: Dùng online hosting (upload project)
```

### **Error: localhost không kết nối**
```
1. Check XAMPP/WAMP Apache running (màu xanh)
2. Check port 80 không bị chiếm (netstat -ano)
3. Try: http://127.0.0.1 (thay localhost)
4. Try: http://localhost:8000 (PHP built-in)
```

### **Error: Database connection failed**
```
1. Cần database chạy (MySQL)
2. Verify credentials trong config.php
3. Hoặc tạm thời comment DB code để test HTML/JS
```

### **Error: QR còn không hiện**
```
1. Check browser console (F12):
   - Any JavaScript errors?
   - Check Network tab
   
2. Check SePay API:
   - Có API key không?
   - API key đúng không?
   
3. Try VietQR fallback:
   - QR generator có 2 source
   - Nếu SePay fail → VietQR
```

---

## 📊 **Comparison: 3 Test Tools**

| Tool | Type | Startup | QR | Database | Best For |
|------|------|---------|-----|----------|----------|
| **test-sepay-qr.html** | HTML | Instant | ❌ No | ❌ No | UI preview |
| **test-sepay-qr.php** | PHP | Need server | ✅ Yes | ❌ No | QR testing |
| **serial.php** | PHP | Need server | ✅ Yes | ✅ Yes | Full test |

---

## 🚀 **Quick Start (5 Minutes)**

### **Scenario 1: Already Have XAMPP**
```
1. Copy project to: C:\xampp\htdocs\hyperur
2. Start Apache in XAMPP
3. Open: http://localhost/hyperur/test-sepay-qr.php
4. Done! Test QR code
```

### **Scenario 2: No PHP Setup**
```
1. Download XAMPP: https://www.apachefriends.org/
2. Install to: C:\xampp
3. Copy project: C:\xampp\htdocs\hyperur
4. Start Apache
5. Open: http://localhost/hyperur/test-sepay-qr.php
6. Test QR code
```

### **Scenario 3: Want Quick Test**
```
1. Install PHP (if not exist)
2. Open PowerShell in project folder
3. Run: php -S localhost:8000
4. Open: http://localhost:8000/test-sepay-qr.php
5. Test QR code
```

---

## 🔍 **Verify Setup Correct**

### **Checklist:**
- [ ] XAMPP/WAMP installed & running
- [ ] Apache server is green (running)
- [ ] Project in htdocs folder
- [ ] Can access: http://localhost/hyperur/
- [ ] Can access: http://localhost/hyperur/test-sepay-qr.php
- [ ] Form loads without errors
- [ ] Submit form shows QR code
- [ ] QR code has bank info
- [ ] Browser console no errors (F12)

---

## 📝 **Files Structure on Server**

```
C:\xampp\htdocs\
├─ hyperur/ ← Project root
│  ├─ index.html ← Home
│  ├─ serial.html ← Registration form
│  ├─ serial.php ← Server processor
│  ├─ test-sepay-qr.html ← Static demo (HTML only)
│  ├─ test-sepay-qr.php ← PHP QR generator ✅
│  ├─ diagnostic-sepay.html ← Diagnostic tool
│  ├─ api/
│  │  ├─ config.php ← Database config
│  │  ├─ sepay-webhook.php ← Webhook handler
│  │  ├─ email-service.php ← Email module
│  │  └─ check-payment-status.php
│  ├─ json/
│  │  ├─ sepay-config.js
│  │  └─ sepay-handler.js
│  ├─ docs/
│  └─ ... (other files)
```

---

## ✅ **Expected Result**

### **Sau Setup Đúng:**
```
✅ Mở http://localhost/hyperur/ → Trang chủ hiển thị
✅ Mở http://localhost/hyperur/serial.html → Form hiển thị
✅ Mở http://localhost/hyperur/test-sepay-qr.php → QR generator hiển thị
✅ Nhấn "Tạo QR" → QR code hiện (hoặc fallback QR)
✅ Thông tin bank đầy đủ
✅ Browser console sạch (không có error)
✅ Database có thể connect (nếu setup)
```

### **Sau Đó:**
```
✅ Test real payment
✅ Check logs
✅ Verify email
✅ Deploy lên hosting
```

---

## 🌐 **Deploy lên Hosting (Sau Testing Local)**

**Khi local test thành công:**

1. **Buy Hosting**
   ```
   Cần: PHP 7.4+ hosting
   Database: MySQL 5.7+
   SSL: HTTPS
   ```

2. **Upload Files**
   ```
   Upload tất cả files via FTP
   Đảm bảo folder structure đúng
   ```

3. **Update Config**
   ```
   api/config.php:
   - DB_HOST: hosting DB server
   - DB_USER: hosting DB user
   - DB_PASS: hosting DB password
   - WEBSITE_URL: https://hyperur.io.vn
   ```

4. **Test Online**
   ```
   Access: https://hyperur.io.vn/serial.html
   Verify: QR code works
   Check: Email sends
   ```

---

## 📞 **Quick Help**

**Q: XAMPP start nhưng Apache vẫn red?**
```
A: Port 80 bị chiếm
   - Stop IIS (Services)
   - Hoặc change port trong Apache config
```

**Q: QR code vẫn không hiện?**
```
A: 1. Check browser console (F12)
   2. Check Network tab (requests ok?)
   3. Check server logs
   4. Try clear cache (Ctrl+Shift+R)
```

**Q: localhost:8000 không kết nối?**
```
A: PHP built-in server:
   1. Cần PHP installed
   2. Run từ project folder
   3. Mở đúng port (8000)
   4. PowerShell keep running
```

---

## ✨ **Summary**

```
Problem:     PHP không chạy
Cause:       Không sử dụng PHP server
Solution:    1. Install XAMPP/WAMP
             2. Copy project
             3. Start server
             4. Access via http://localhost/

Time:        15 minutes
Result:      ✅ QR code works
             ✅ Ready for testing
             ✅ Ready for deployment
```

---

**🚀 Setup xong → Test QR → Go LIVE! 🚀**
