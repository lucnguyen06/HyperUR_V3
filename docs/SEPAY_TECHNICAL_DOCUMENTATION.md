# 🎯 SePay Integration - Comprehensive Summary

## 📋 Tổng Quan Thay Đổi

Dự án **HyperUR V3** đã được nâng cấp để tích hợp **SePay Bank Transfer** làm phương thức thanh toán chính, thay thế hệ thống Momo thủ công cũ.

---

## 🆕 Files Được Thêm Vào

### 1️⃣ **Backend API Files** (`/api/`)

#### `sepay-webhook.php` (182 lines)
- **Mục đích**: Tiếp nhận webhook callback từ SePay khi có giao dịch
- **Endpoint**: `POST /api/sepay-webhook.php`
- **Workflow**:
  1. Nhận payload từ SePay (amount, description, sender_name, etc.)
  2. Parse serial từ description format `UR [SERIAL]`
  3. Verify serial tồn tại trong database
  4. Verify amount khớp với expected payment (50,000đ)
  5. Update registration status → `Active`
  6. Set activated_at & expired_at (365 days)
  7. Log activity với IP address
  8. Gửi email xác nhận
  9. Return JSON response

**Key Features**:
- ✅ Prepared statements (SQL injection safe)
- ✅ Transaction validation
- ✅ Auto-activation
- ✅ Email notification
- ✅ Activity logging with IP
- ✅ Error handling & logging

#### `check-payment-status.php` (90 lines)
- **Mục đích**: Endpoint cho client polling check status thanh toán
- **Endpoint**: `GET /api/check-payment-status.php?serial=ABC123456`
- **Response**: `{ status: 'pending' | 'completed' | 'failed' }`
- **Usage**: Client poll mỗi 3 giây để check xem payment đã được xác nhận hay chưa

---

### 2️⃣ **Configuration Files** (`/json/`)

#### `sepay-config.js` (57 lines)
```javascript
window.SEPAY_CONFIG = {
  API_URL: 'https://api.sepay.vn/v1',
  WEBHOOK_URL: 'https://hyperur.io.vn/api/sepay-webhook.php',
  BANK_INFO: {
    bankCode: 'MB',
    accountNo: '0359998888',
    accountName: 'NGUYEN TAN LUC',
    amount: 50000
  },
  WEBHOOK_SECRET: 'your-sepay-webhook-secret-key',
  PAYMENT_PLANS: { single, bulk_5, bulk_15 },
  STATUS_CHECK_INTERVAL: 3000,
  MAX_STATUS_CHECKS: 30
}
```

**Tác Dụng**: Lưu trữ tất cả cấu hình SePay (API keys, bank info, constants)

#### `sepay-handler.js` (350 lines)
```javascript
window.SePayHandler = {
  initPayment(serial, amount),      // Khởi tạo payment
  generateQRCode(amount),            // Tạo QR code
  updatePaymentForm(serial, amount), // Update form UI
  pollPaymentStatus(serial),         // Check status periodically
  copyTransferContent(serial),       // Copy UR [SERIAL]
  openQRFullscreen(),                // Display QR fullscreen
  showPaymentSuccess(serial),        // Show success message
  showPaymentError(msg),             // Show error message
  showToast(msg, duration)           // Show toast notification
}
```

**Tác Dụng**: Client-side handler quản lý toàn bộ luồng payment UI & logic

---

### 3️⃣ **Documentation Files**

#### `SEPAY_INTEGRATION_GUIDE.md` (350+ lines)
Hướng dẫn chi tiết từng bước:
- SePay Account setup
- Webhook configuration
- Security checklist
- Testing procedures
- Deployment steps
- Troubleshooting

#### `SEPAY_UPDATE_README.md` (250+ lines)
Tóm tắt nhanh các thay đổi:
- New files summary
- Key changes table
- Quick start guide
- Deployment checklist
- Migration guide

#### `SERIAL_PAYMENT_METHODS_SNIPPET.html` (400+ lines)
HTML code snippet để replace payment methods section trong `serial.html`:
- Updated UI với SePay prominent
- Copy buttons for quick action
- JavaScript handlers
- CSS animations

---

## 🔄 Luồng Thanh Toán Chi Tiết

### 📍 User Journey

```
1. User vào serial.html
   ↓
2. Điền form:
   - Email
   - Codename (thiết bị)
   - Serial
   - Chọn Plan (Free / Paid)
   ↓
3. Nếu Paid Plan → Chọn Payment Method
   ↓
4. SEPAY Selected:
   - SePayHandler.initPayment() được gọi
   - QR code được generate
   - Bank account info hiển thị
   - "UR ABC123456" instruction
   ↓
5. User quét QR hoặc:
   - Copy số tài khoản
   - Copy nội dung: UR ABC123456
   - Transfer 50,000đ từ MBBank app
   ↓
6. Transfer hoàn tất
   ↓
7. SePay xác nhận → Gửi webhook POST tới:
   /api/sepay-webhook.php
   ↓
8. Server xử lý:
   - Parse serial
   - Verify payment
   - Update DB: status = 'Active'
   - Log activity
   - Gửi email
   ↓
9. Client polling:
   /api/check-payment-status.php?serial=ABC123456
   ↓
10. Nhận: { status: 'completed' }
    ↓
11. Show success message ✅
```

---

## 🔌 API Specifications

### Webhook từ SePay

**Request (từ SePay):**
```bash
POST /api/sepay-webhook.php
Content-Type: application/json

{
  "id": "TXN123456789",
  "transaction_id": "SePay-TXN-789",
  "amount": 50000,
  "currency": "VND",
  "description": "UR ABC123456",
  "sender_name": "NGUYEN VAN A",
  "bank_account": "0359998888",
  "bank_name": "MBBank",
  "status": "completed",
  "timestamp": "2026-10-10T15:30:45+07:00"
}
```

**Response (từ server):**
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "serial": "ABC123456",
  "status": "Active",
  "activated_at": "2026-10-10 15:30:45"
}
```

### Status Check Endpoint

**Request:**
```bash
GET /api/check-payment-status.php?serial=ABC123456
```

**Response (Pending):**
```json
{
  "success": true,
  "data": {
    "serial": "ABC123456",
    "status": "pending",
    "registration_status": "Pending",
    "activated_at": null,
    "expired_at": null,
    "transaction_code": null
  }
}
```

**Response (Completed):**
```json
{
  "success": true,
  "data": {
    "serial": "ABC123456",
    "status": "completed",
    "registration_status": "Active",
    "activated_at": "2026-10-10 15:30:45",
    "expired_at": "2027-10-10 15:30:45",
    "transaction_code": "SePay-TXN-789"
  }
}
```

---

## 💾 Database Updates

### Bảng: `registrations`

**Columns affected (auto-populated by SePay):**

| Column | Value Source | When |
|--------|--------------|------|
| `status` | 'Active' | On webhook receipt |
| `activated_at` | NOW() | On webhook receipt |
| `expired_at` | NOW() + 365 days | On webhook receipt |
| `transaction_code` | SePay transaction ID | On webhook receipt |
| `sender_name` | SePay sender_name | On webhook receipt |
| `updated_at` | NOW() | On webhook receipt |

### Bảng: `activity_logs`

**New log entry:**
- `action`: 'webhook_payment'
- `description`: "SePay payment received - Amount: 50000đ, TxnID: SePay-TXN-789"
- `ip_address`: SePay server IP
- `user_agent`: 'SePay'
- `created_at`: NOW()

---

## 🛡️ Security Implementation

### 1️⃣ **Webhook Signature Verification** (Future)
```php
// Verify HMAC-SHA256 signature from SePay
$signature = hash_hmac('sha256', $payload, SEPAY_WEBHOOK_SECRET);
if ($signature !== $_SERVER['HTTP_X_SEPAY_SIGNATURE']) {
  throw new Exception('Invalid signature');
}
```

### 2️⃣ **Amount Validation**
```php
$expectedAmount = 50000;
if ($amount < $expectedAmount) {
  throw new Exception('Amount mismatch');
}
```

### 3️⃣ **Serial Validation**
```php
$checkStmt = $conn->prepare("SELECT id FROM registrations WHERE serial = ?");
if ($result->num_rows === 0) {
  throw new Exception('Serial not found');
}
```

### 4️⃣ **IP Logging**
```php
$ip = $_SERVER['REMOTE_ADDR'];
error_log("SePay webhook from IP: {$ip}");
```

### 5️⃣ **Prepared Statements**
All SQL queries use prepared statements to prevent SQL injection

---

## 📧 Email Template Integration

Update `generateEmailTemplate()` để nhận thêm:

```php
function generateEmailTemplate($data) {
  // Existing fields:
  // - $data['serial']
  // - $data['codename']
  // - $data['plan']
  // - $data['senderName']
  // - $data['senderEmail']
  
  // NEW fields từ SePay:
  $amount = $data['amount'];              // 50000
  $transactionCode = $data['transactionCode']; // SePay-TXN-789
  $paymentMethod = $data['paymentMethod']; // 'SePay Bank Transfer'
  
  // Email content tự động update để hiển thị:
  // - Payment amount
  // - Transaction ID
  // - Bank transfer confirmation
}
```

---

## 🎨 UI Changes in serial.html

### Payment Methods Section

**Before (Old):**
- Momo (Primary) - Manual verify
- Binance (Optional)
- PayPal (Optional)

**After (New):**
- ✅ **SePay Bank Transfer** (Primary) - Auto verify
- Momo (Legacy/Optional)
- Binance (Optional)
- PayPal (Optional)

### Visual Updates

1. **SePay card hiển thị prominent** (top, green accent)
2. **QR code auto-generated** from SePay API
3. **Copy buttons** cho quick action
4. **Status polling indicator** (⏳ animation)
5. **Real-time feedback** on payment status

---

## 🧪 Testing Checklist

### Unit Tests
- [ ] `sepay-webhook.php` - Webhook parsing & processing
- [ ] `check-payment-status.php` - Status query
- [ ] `sepay-handler.js` - Payment initialization

### Integration Tests
- [ ] SePay sandbox webhook delivery
- [ ] Email sending on payment receipt
- [ ] Database update on webhook
- [ ] Status polling on client-side

### End-to-End Tests
- [ ] User registers → Selects SePay → Scans QR → Gets auto-activated
- [ ] Email confirmation sent
- [ ] Serial shows as 'Active' in lookup
- [ ] Error handling when amount mismatches
- [ ] Error handling when serial not found

---

## 🚀 Deployment Steps

1. **Upload new files**
   ```bash
   scp api/sepay-webhook.php user@host:/var/www/api/
   scp api/check-payment-status.php user@host:/var/www/api/
   scp json/sepay-config.js user@host:/var/www/json/
   scp json/sepay-handler.js user@host:/var/www/json/
   ```

2. **Update config.php**
   - Add SePay API credentials
   - Update bank account info

3. **Update serial.html**
   - Add SePay script imports
   - Replace payment methods section
   - Update form handlers

4. **Configure SePay Dashboard**
   - Create webhook endpoint
   - Set webhook URL
   - Copy webhook secret

5. **Test with sandbox**
   - Use SePay test environment
   - Verify webhook delivery
   - Check database updates

6. **Go live**
   - Switch to production
   - Monitor logs
   - Gather user feedback

---

## 📊 Compatibility Matrix

| Component | Status | Notes |
|-----------|--------|-------|
| Existing MoMo registrations | ✅ Still work | No data migration needed |
| Existing serial lookups | ✅ Still work | No schema changes |
| Payment history | ✅ Preserved | Transaction code logged |
| Email system | ✅ Updated | Now includes SePay info |
| Activity logs | ✅ Enhanced | New webhook_payment action |

---

## 🎓 Key Learning Points

1. **Webhook Integration**: Understanding how SePay sends real-time notifications
2. **Auto-Verification**: Eliminating manual intervention via webhook triggers
3. **Security**: Validating payments, preventing fraud
4. **UX Improvement**: Real-time status polling vs manual refresh
5. **Error Handling**: Graceful degradation if webhook fails

---

## 🔮 Future Enhancements

1. **Multi-bank support** (VietCom, ACB, etc. via SePay)
2. **Transaction history page** for users
3. **Refund handling** via webhook
4. **Dispute resolution** system
5. **Recurring payments** for discounts
6. **QR dynamic generation** based on amount
7. **SMS notifications** on payment received

---

## 📞 Support & Documentation

- **Full Setup Guide**: `SEPAY_INTEGRATION_GUIDE.md`
- **Quick Update Summary**: `SEPAY_UPDATE_README.md`
- **Code Snippet**: `SERIAL_PAYMENT_METHODS_SNIPPET.html`
- **SePay Official Docs**: https://developer.sepay.vn
- **Team Telegram**: @lcnguy06

---

**Status**: 🟢 Ready for Integration  
**Last Updated**: October 10, 2026  
**Maintained By**: @lcnguy06, @Usagi79
