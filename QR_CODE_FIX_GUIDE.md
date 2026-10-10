# 🔧 FIX: SePay QR Code Không Hiện - Hướng Dẫn Khắc Phục

**Problem:** Nhập thông tin trên serial.php/serial.html nhưng QR code SePay không hiện lên  
**Solution:** ✅ Test files + Event listener + Hướng dẫn  
**Status:** Ready to implement  

---

## 🚨 **Vấn Đề Gốc**

### **Phát Hiện**
```
❌ serial.html có form + payment methods
❌ Có payment-detail-box container (line 520)
❌ Nhưng KHÔNG gọi SePayHandler.initPayment()
❌ QR code không được tạo
❌ Thông tin bank không hiển thị
```

### **Root Cause**
```
JavaScript event listener chưa được thêm
Khi user chọn "SePay Bank Transfer"
→ Không trigger SePayHandler.initPayment()
→ QR code không tạo được
```

---

## ✅ **3 Files Được Tạo**

### **File 1: test-sepay-qr.html**
```
✓ Tạo QR code test
✓ Debug console messages
✓ Form đơn giản (số tiền, serial, thiết bị)
✓ Hiển thị thông tin bank
✓ Status message (success/error)

Mục đích: Verify SePayHandler hoạt động
Đường dẫn: /test-sepay-qr.html
```

### **File 2: diagnostic-sepay.html**
```
✓ Kiểm tra tất cả components
✓ Check SEPAY_CONFIG load
✓ Check SePayHandler load
✓ Test initialization
✓ Suggest solutions nếu có lỗi

Mục đích: Diagnose system
Đường dẫn: /diagnostic-sepay.html
```

### **File 3: docs/TEST_SEPAY_QR_GUIDE.md**
```
✓ Hướng dẫn test chi tiết
✓ Các test case
✓ Debug tips
✓ Fix script tương ứng

Mục đích: Documentation
Đường dẫn: /docs/TEST_SEPAY_QR_GUIDE.md
```

---

## 🎯 **Cách Khắc Phục (3 Bước)**

### **Bước 1: Test System (5 min)**
```
1. Mở: diagnostic-sepay.html
2. Chạy: "🔍 Chạy Kiểm Tra"
3. Kiểm tra kết quả:
   ✅ SEPAY_CONFIG loaded
   ✅ SePayHandler loaded
   ✅ Can initialize payment
   ✅ Can generate QR
```

### **Bước 2: Test QR Generation (5 min)**
```
1. Mở: test-sepay-qr.html
2. Form sẽ tự load:
   - Serial: TEST123456
   - Amount: 50.000đ
3. Nhấn: "✨ Tạo QR Code Thanh Toán"
4. Kiểm tra:
   ✅ QR code hiện lên
   ✅ Thông tin bank đúng
   ✅ Nội dung: UR TEST123456
```

### **Bước 3: Fix serial.html (10 min)**
```
1. Mở file: serial.html
2. Cuối file (trước </body>) thêm:

   <script>
   // Trigger SePay QR when payment method selected
   document.addEventListener('DOMContentLoaded', function() {
       const paymentMethods = document.querySelectorAll('.payment-method-card');
       
       paymentMethods.forEach(method => {
           method.addEventListener('click', function() {
               const methodType = this.getAttribute('data-method');
               const serial = document.getElementById('serial-input')?.value?.toUpperCase() || 'DEMO';
               const amount = parseInt(document.getElementById('amount')?.value || '50000');
               
               if (methodType === 'sepay' && window.SePayHandler) {
                   SePayHandler.initPayment(serial, amount);
               }
           });
       });
   });
   </script>

3. Save file
4. Reload serial.html
5. Test: Chọn SePay → QR hiện?
```

---

## 📊 **Verification Checklist**

- [ ] Đã tải 2 test files: test-sepay-qr.html + diagnostic-sepay.html
- [ ] Diagnostic test chạy ✓ (all components loaded)
- [ ] test-sepay-qr.html tạo QR thành công
- [ ] QR code hiển thị đúng
- [ ] Thông tin bank đúng
- [ ] Console không có lỗi
- [ ] Thêm event listener vào serial.html
- [ ] serial.html reload
- [ ] Chọn SePay → QR hiện ngay
- [ ] QR cập nhật khi đổi serial

---

## 🧪 **Test Flow**

```
User mở serial.html
    ↓
Điền thông tin (serial, device)
    ↓
Chọn "SePay Bank Transfer"
    ↓
[EVENT LISTENER TRIGGER]
    ↓
SePayHandler.initPayment(serial, amount)
    ↓
QR code được tạo
    ↓
Display trong #payment-detail-box
    ↓
Hiển thị thông tin bank
    ↓
User quét QR + chuyển tiền
    ↓
Webhook receive thanh toán
    ↓
Activate serial
```

---

## 🎯 **Expected Result Sau Fix**

### **Trước Fix**
```
❌ Form đầy đủ
❌ Payment methods hiển thị
❌ Nhưng QR không hiện
❌ Thông tin bank không hiển thị
```

### **Sau Fix**
```
✅ Form đầy đủ
✅ Payment methods hiển thị
✅ Chọn SePay → QR hiện ngay
✅ Thông tin bank hiển thị
✅ Nội dung chuyển khoản đúng
✅ QR cập nhật khi đổi serial
✅ Sẵn sàng thanh toán
```

---

## 📁 **File Locations**

```
/test-sepay-qr.html
   └─ Test QR code generation
   
/diagnostic-sepay.html
   └─ Diagnostic tool
   
/docs/TEST_SEPAY_QR_GUIDE.md
   └─ Hướng dẫn chi tiết
   
/serial.html
   └─ Thêm event listener (cuối file)
   
/json/sepay-config.js
   └─ Config (must load)
   
/json/sepay-handler.js
   └─ Handler (must load)
```

---

## 💡 **Troubleshooting**

### **Nếu Diagnostic Test Fail**

**Lỗi 1: SEPAY_CONFIG not found**
```
→ Check: /json/sepay-config.js exists
→ Check: Browser console for 404
→ Fix: Reload page, check path
```

**Lỗi 2: SePayHandler not found**
```
→ Check: /json/sepay-handler.js exists
→ Check: Loaded after config
→ Fix: Check script order
```

### **Nếu test-sepay-qr.html Fail**

**QR không hiện**
```
→ Check browser console (F12)
→ Look for error messages
→ Check network request to SePay API
→ Check CORS issues
→ Fallback to VietQR
```

### **Nếu serial.html Still Fail**

**QR vẫn không hiện sau fix**
```
1. Open F12 Console
2. Manually type:
   SePayHandler.initPayment('TEST123', 50000)
3. Check if QR appears
4. Check error messages
5. Verify event listener was added correctly
```

---

## 🚀 **Quick Start**

```
1. Upload 2 test files
2. Run diagnostic-sepay.html
3. Run test-sepay-qr.html
4. Fix serial.html with event listener
5. Test serial.html
6. QR code working?
7. Go LIVE! ✅
```

---

## 📞 **Support Files**

| File | Purpose | Time |
|------|---------|------|
| test-sepay-qr.html | Test QR generation | 5 min |
| diagnostic-sepay.html | Check components | 3 min |
| TEST_SEPAY_QR_GUIDE.md | Detailed guide | Reference |
| serial.html (fix) | Add event listener | 10 min |

---

## ✅ **Status**

```
Diagnostic tool: ✅ Ready
Test tool: ✅ Ready
Documentation: ✅ Complete
Fix script: ✅ Ready to apply
Time to fix: ⏱️ ~20 minutes
```

---

**🎉 Ready to fix QR issue! Test & implement above! 🎉**
