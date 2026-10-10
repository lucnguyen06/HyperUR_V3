# 🧪 Test SePay QR - Hướng Dẫn & Khắc Phục

**Problem:** QR code SePay không hiện lên khi nhập thông tin trên `serial.php`  
**Solution:** File test + hướng dẫn khắc phục  
**Status:** Testing guide ready  

---

## 🎯 **Vấn Đề & Giải Pháp**

### **Vấn Đề Phát Hiện**
```
❌ serial.html có form thanh toán
❌ Nhưng KHÔNG gọi SePayHandler.initPayment()
❌ QR code không được tạo
❌ payment-detail-box vẫn trống
```

### **Root Cause**
```
File: serial.html
Line: 520 - <div id="payment-detail-box">
Status: HTML sẵn sàng nhưng JavaScript không trigger
Missing: Event listener để gọi SePayHandler
```

---

## 🚀 **Test QR Code Ngay**

### **Bước 1: Mở Test Page**
```
URL: https://yoursite.com/test-sepay-qr.html
hoặc: file:///path/to/test-sepay-qr.html (local)
```

### **Bước 2: Điền Thông Tin**
```
💰 Số tiền: Chọn một mức
📱 Serial: TEST123456 (default)
🔧 Thiết bị: Xiaomi 12 (default)
```

### **Bước 3: Nhấn Nút**
```
Click: "✨ Tạo QR Code Thanh Toán"
```

### **Bước 4: Kiểm Tra Kết Quả**
```
✅ Thành công:
   - QR code hiện lên
   - Thông tin bank hiển thị
   - Nội dung chuyển khoản đúng

❌ Lỗi:
   - Xem browser console (F12)
   - Tìm thông báo lỗi
   - Check SePayHandler đã load chưa
```

---

## 🔍 **Debug QR Issue**

### **Bước 1: Mở DevTools (F12)**

**Chrome/Firefox:**
```
1. Nhấn F12
2. Chọn tab "Console"
3. Xem các thông báo
```

### **Bước 2: Kiểm Tra Logs**
```
Browser console sẽ hiển thị:
✓ Test page loaded
✓ Checking SePay Config: {...}
✓ Checking SePayHandler: function
✓ Initiating SePay payment: ...
✓ SePayHandler found
✓ QR URL generated: https://...
✅ QR code tạo thành công!
```

### **Bước 3: Nếu Có Lỗi**

**Lỗi 1: "SePayHandler chưa được load"**
```
Nguyên nhân: json/sepay-handler.js không load
Giải pháp:
  1. Check file tồn tại: /json/sepay-handler.js
  2. Check đường dẫn trong HTML
  3. Reload browser (Ctrl+Shift+R)
```

**Lỗi 2: "SEPAY_CONFIG trống"**
```
Nguyên nhân: json/sepay-config.js không load
Giải pháp:
  1. Check file tồn tại: /json/sepay-config.js
  2. Check API URL, bank info
  3. Reload browser (Ctrl+Shift+R)
```

**Lỗi 3: "QR URL trống"**
```
Nguyên nhân: API SePay không trả QR
Giải pháp:
  1. Check API key có hợp lệ không
  2. Check network request (Network tab)
  3. Check CORS headers
  4. Fallback to VietQR
```

---

## 🔧 **Khắc Phục serial.html**

### **Thêm Event Listener vào serial.html**

**Tìm:**
```html
<!-- Line 520 -->
<div class="payment-detail-box" id="payment-detail-box">
    <!-- SePay QR & Info will be displayed here -->
    <!-- (Controlled by SePayHandler) -->
</div>
```

**Thêm vào file `serial.html` trước `</body>` (cuối file):**

```html
<script>
// Trigger SePay QR when payment method selected
document.addEventListener('DOMContentLoaded', function() {
    
    // Handle payment method selection
    const paymentMethods = document.querySelectorAll('.payment-method-card');
    
    paymentMethods.forEach(method => {
        method.addEventListener('click', function() {
            const methodType = this.getAttribute('data-method');
            const serial = document.getElementById('serial-input')?.value?.toUpperCase() || 'DEMO';
            const amount = parseInt(document.getElementById('amount')?.value || '50000');
            
            console.log(`💳 Payment method selected: ${methodType}`);
            console.log(`📱 Serial: ${serial}, Amount: ${amount}đ`);
            
            if (methodType === 'sepay' && window.SePayHandler) {
                console.log('🚀 Initializing SePay...');
                SePayHandler.initPayment(serial, amount);
            }
        });
    });
    
    // Also trigger on serial/amount change
    const serialInput = document.getElementById('serial-input');
    if (serialInput) {
        serialInput.addEventListener('change', function() {
            const serial = this.value.toUpperCase();
            const amount = parseInt(document.getElementById('amount')?.value || '50000');
            
            if (document.querySelector('.payment-method-card.active')?.getAttribute('data-method') === 'sepay') {
                console.log('📱 Serial changed, updating QR...');
                if (window.SePayHandler) {
                    SePayHandler.initPayment(serial, amount);
                }
            }
        });
    }
});
</script>
```

---

## 📊 **File Test yang Tạo**

### **File: `test-sepay-qr.html`**
```
Mục đích: Test QR code tạo thành công
Đặc điểm:
  ✅ Form đơn giản (Số tiền, Serial, Device)
  ✅ Tạo QR khi nhấn nút
  ✅ Hiển thị thông tin bank
  ✅ Debug console messages
  ✅ Status messages (success/error)

Đường dẫn: /test-sepay-qr.html
```

---

## ✅ **Checklist Khắc Phục**

- [ ] Đã tải test-sepay-qr.html từ repo
- [ ] Đã upload file lên server
- [ ] Đã mở test page và test thành công
- [ ] Đã thêm event listener vào serial.html
- [ ] Đã reload serial.html
- [ ] QR code hiện lên khi chọn SePay
- [ ] QR code cập nhật khi đổi serial
- [ ] Thông tin bank hiển thị đúng

---

## 🧪 **Các Test Case**

### **Test 1: QR Tạo Thành Công**
```
Input:
  - Amount: 50.000đ
  - Serial: DEMO000001
  - Device: Xiaomi 12

Expected:
  ✅ QR code hiện lên
  ✅ Thông tin bank đúng
  ✅ Nội dung: UR DEMO000001
```

### **Test 2: Đổi Serial QR Update**
```
Input:
  - Change serial từ DEMO000001 → DEMO000002
  - Amount: 100.000đ

Expected:
  ✅ QR code cập nhật
  ✅ Nội dung thay đổi
  ✅ Amount thay đổi
```

### **Test 3: SePay vs Momo**
```
Input:
  - Chọn SePay → QR hiện
  - Chọn Momo → QR ẩn

Expected:
  ✅ SePay: QR hiện + Bank info
  ✅ Momo: Khác thông tin
```

---

## 📱 **QR Code Display HTML**

### **Cấu Trúc Hoàn Chỉnh**

```html
<!-- File: serial.html - thêm HTML này vào payment section -->

<div class="payment-detail-box" id="payment-detail-box">
    <div class="qr-section">
        <h4>📲 Quét Mã QR để Chuyển Khoản</h4>
        
        <!-- QR Image Container -->
        <div class="qr-image-container">
            <img id="sepay-qr-image" src="" alt="SePay QR Code" style="display: none;">
            <div id="qr-loading" style="display: none; text-align: center; padding: 20px;">
                ⏳ Đang tạo QR code...
            </div>
        </div>
        
        <!-- Bank Info -->
        <div class="bank-details">
            <div class="bank-detail-row">
                <span>🏦 Ngân Hàng:</span>
                <strong id="bank-name">MBBank</strong>
            </div>
            <div class="bank-detail-row">
                <span>💳 Tài Khoản:</span>
                <code id="bank-account">0562903904</code>
            </div>
            <div class="bank-detail-row">
                <span>👤 Chủ TK:</span>
                <strong id="bank-owner">NGUYEN TAN LUC</strong>
            </div>
            <div class="bank-detail-row">
                <span>💰 Số Tiền:</span>
                <code id="bank-amount">50.000đ</code>
            </div>
            <div class="bank-detail-row">
                <span>📝 Nội Dung:</span>
                <code id="bank-content">UR ABC123456</code>
            </div>
        </div>
        
        <!-- Important Note -->
        <div class="bank-note">
            ⚠️ Sao chép nội dung chuyển khoản chính xác: <strong>UR [SERIAL]</strong>
        </div>
    </div>
</div>
```

---

## 💡 **Cách hoạt động**

```
User nhập Serial
    ↓
User chọn "SePay Bank Transfer"
    ↓
Event listener trigger
    ↓
SePayHandler.initPayment(serial, amount)
    ↓
QR code được tạo
    ↓
QR display vào #payment-detail-box
    ↓
User scan & chuyển tiền
```

---

## 🎯 **Cách Chạy Test**

### **Cách 1: Trên Browser Local**
```
1. Mở file: test-sepay-qr.html
2. Form sẽ load
3. Default: Serial "TEST123456", Amount 50.000đ
4. Nhấn: "✨ Tạo QR Code Thanh Toán"
5. QR hiện lên (nếu SePay API hoạt động)
```

### **Cách 2: Trên Server**
```
1. Upload test-sepay-qr.html lên /
2. Truy cập: https://yoursite.com/test-sepay-qr.html
3. Test tạo QR
4. Check console (F12) xem logs
```

### **Cách 3: Kiểm Tra serial.html**
```
1. Vào serial.html (trang chính)
2. Điền đầy đủ thông tin
3. Chọn "SePay Bank Transfer"
4. Kiểm tra QR có hiện không
5. Kiểm tra thông tin bank đúng không
```

---

## ✨ **Sau Khi Fix**

**serial.html sẽ:**
```
✅ Hiển thị form đăng ký
✅ Khi chọn SePay → QR hiện ngay
✅ Khi đổi Serial → QR update
✅ Thông tin bank chính xác
✅ Ready để user chuyển tiền
```

---

## 📞 **Debug Tips**

### **Tip 1: Console Logging**
```javascript
// Add to browser console
console.log(window.SEPAY_CONFIG);  // Check config
console.log(window.SePayHandler);  // Check handler
```

### **Tip 2: Check Network**
```
1. F12 → Network tab
2. Filter: XHR
3. Tạo QR
4. Check request tới SePay API
5. Check response status
```

### **Tip 3: Check Elements**
```
1. F12 → Elements tab
2. Tìm: #payment-detail-box
3. Check innerHTML có QR chưa
4. Check img src có URL chưa
```

---

**🎊 Test page ready - Hãy test ngay! 🧪**
