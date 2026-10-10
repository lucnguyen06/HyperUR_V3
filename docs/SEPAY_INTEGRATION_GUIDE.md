# Serial Registration - SePay Integration Guide

## 📋 Thay Đổi Chính So Với Phiên Bản Cũ

### ✅ Được Thêm Vào
1. **SePay Webhook Support**
   - Endpoint: `/api/sepay-webhook.php` - nhận callback từ SePay
   - Endpoint: `/api/check-payment-status.php` - kiểm tra status thanh toán

2. **SePay Configuration Files**
   - `json/sepay-config.js` - cấu hình SePay (API URL, bank account, etc.)
   - `json/sepay-handler.js` - handler JavaScript xử lý luồng thanh toán

3. **Phương Thức Thanh Toán Mới**
   - **SePay Bank Transfer** - chuyển khoản qua ngân hàng thông qua SePay (PRIMARY)
   - Vẫn giữ: MoMo, Binance Pay, PayPal (LEGACY - optional)

4. **Luồng Thanh Toán Tự Động**
   - User đăng ký → Chọn gói thanh toán → SePay QR/Form → Transfer tiền
   - SePay webhook gửi callback → Auto-activate Serial
   - Email xác nhận gửi tới user

### ❌ Bỏ Đi / Thay Đổi
- Momo Quỹ chỉ dùng làm fallback (optional)
- Không còn cần manual verification từ admin

---

## 🔧 Setup Hướng Dẫn

### 1️⃣ **SePay Account & Webhook Configuration**

Truy cập: https://developer.sepay.vn/vi/sepay-webhooks

**Bước 1: Đăng ký tài khoản SePay**
- Vào https://sepay.vn
- Đăng nhập/Đăng ký
- Xác thực tài khoản ngân hàng (MBBank, VietCom, etc.)

**Bước 2: Lấy API Key & Webhook Secret**
- Vào Dashboard → Settings → API Keys
- Copy: `API_KEY`, `WEBHOOK_SECRET`
- Cập nhật vào `api/config.php` hoặc `json/sepay-config.js`

**Bước 3: Cấu Hình Webhook URL**
- Vào Dashboard → Webhooks → Create Webhook
- URL: `https://hyperur.io.vn/api/sepay-webhook.php`
- Events: `transaction.completed`
- Method: POST
- Save

---

### 2️⃣ **Update config.php**

```php
// Thêm vào /api/config.php

// SePay Integration
define('SEPAY_API_KEY', 'your-sepay-api-key');     // ✏️ Replace
define('SEPAY_WEBHOOK_SECRET', 'your-webhook-secret'); // ✏️ Replace
define('SEPAY_BANK_ACCOUNT', '0359998888');         // Bank account number
define('SEPAY_BANK_CODE', 'MB');                    // MBBank
define('SEPAY_ACCOUNT_NAME', 'NGUYEN TAN LUC');     // Account holder name
```

---

### 3️⃣ **Update serial.html**

**Thêm scripts vào `<head>` section:**

```html
<!-- SePay Configuration -->
<script src="json/sepay-config.js"></script>
<!-- SePay Handler -->
<script src="json/sepay-handler.js"></script>
```

**Thay Đổi Payment Methods Section:**

Thay phần payment methods từ "Momo chính thức" sang "SePay Bank Transfer":

```html
<!-- Payment Method: SePay (Primary) -->
<div class="payment-method-card active" data-method="sepay" role="radio" aria-checked="true" tabindex="0">
  <div class="payment-method-icon" style="background: rgba(10, 180, 100, 0.12); border: 1px solid rgba(10, 180, 100, 0.3);">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#0ab464">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  </div>
  <div class="payment-method-name" style="color: #10b981;">SePay Bank Transfer (Chính Thức)</div>
  <div class="payment-method-desc">Chuyển khoản ngân hàng MBBank - Auto Verify</div>
</div>

<!-- Payment Method: MoMo (Legacy/Optional) -->
<!-- Keep existing MoMo card as fallback -->

<!-- Payment Method: Binance (Optional) -->
<!-- Keep as before -->

<!-- Payment Method: PayPal (Optional) -->
<!-- Keep as before -->
```

---

### 4️⃣ **Update Form Submit Handler**

Thêm vào form submit listener (trong serial.html `<script>` tag):

```javascript
// When user selects SePay
paymentCards.forEach(card => {
  card.addEventListener('click', function() {
    const method = this.dataset.method;
    
    if (method === 'sepay') {
      // Initialize SePay
      const serial = document.getElementById('serial-input').value;
      const amount = currentPlan === 'free' ? 0 : 50000;
      
      if (amount > 0) {
        SePayHandler.initPayment(serial, amount);
        // Show SePay QR & instructions
        showSepayPaymentUI();
        // Start polling for payment confirmation
        SePayHandler.pollPaymentStatus(serial);
      }
    }
  });
});
```

---

### 5️⃣ **Payment Flow Diagram**

```
User Visit serial.html
         ↓
   Select Plan (Free or Paid)
         ↓
   For PAID Plan → Select Payment Method
         ↓
   ┌─────────────────────────────────────┐
   │  Choose: SePay / MoMo / Binance      │
   └─────────────────────────────────────┘
         ↓ (if SePay selected)
   ┌─────────────────────────────────────┐
   │ SePayHandler.initPayment()           │
   │ - Generate QR Code                   │
   │ - Show bank account details          │
   │ - Display transfer instruction       │
   └─────────────────────────────────────┘
         ↓
   User scan QR → Transfer via MBBank App
         ↓
   SePay receives transaction
         ↓
   SePay sends webhook POST to:
   https://hyperur.io.vn/api/sepay-webhook.php
         ↓
   ┌────────────────────────────────────────┐
   │ /api/sepay-webhook.php                 │
   │ - Parse serial from description        │
   │ - Verify amount                        │
   │ - Update registration.status = 'Active'│
   │ - Send confirmation email              │
   └────────────────────────────────────────┘
         ↓
   Meanwhile, client polls:
   /api/check-payment-status.php?serial=ABC123456
         ↓
   ┌────────────────────────────────────────┐
   │ Receive: { status: 'completed' }       │
   │ Show success message                   │
   │ Send email confirmation                │
   └────────────────────────────────────────┘
```

---

## 🎯 SePay Webhook Payload Example

**Request từ SePay:**

```json
POST /api/sepay-webhook.php
{
  "id": "TXN123456789",
  "transaction_id": "SePay-TXN-123456789",
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

**Response từ server:**

```json
{
  "success": true,
  "message": "Payment processed successfully",
  "serial": "ABC123456",
  "status": "Active",
  "activated_at": "2026-10-10 15:30:45"
}
```

---

## 📧 Email Template Update

Update `api/email-template.php` để nhận thêm field:
- `amount` - số tiền thanh toán
- `transaction_code` - mã giao dịch SePay

---

## 🔐 Security Checklist

- ✅ Webhook signature verification (HMAC-SHA256)
- ✅ Validate amount vs expected payment
- ✅ Check serial exists before updating
- ✅ Log all webhook activity with IP
- ✅ Rate limiting trên `/api/sepay-webhook.php`
- ✅ HTTPS only (production)

---

## 🧪 Testing

### Test Mode (Sandbox)

Ref: https://developer.sepay.vn/vi/test-mode-sandbox

```bash
# Test webhook locally using ngrok
ngrok http 3000

# Get public URL: https://xxxx-xx-xxx-xx-xx.ngrok.io
# Update webhook URL to: https://xxxx-xx-xxx-xx-xx.ngrok.io/api/sepay-webhook.php

# Test payload
curl -X POST https://xxxx.ngrok.io/api/sepay-webhook.php \
  -H "Content-Type: application/json" \
  -d '{
    "id": "TEST123",
    "amount": 50000,
    "description": "UR ABC123456",
    "sender_name": "TEST USER",
    "status": "completed"
  }'
```

---

## 📊 Database Changes

**No schema changes needed!**

Existing `registrations` & `activity_logs` tables work as-is.

Fields nhận từ SePay sẽ được map:
- `transaction_code` ← SePay `id` / `transaction_id`
- `sender_name` ← SePay `sender_name`
- `status` ← Update từ webhook

---

## 🚀 Deployment Checklist

- [ ] Add SePay API credentials to `config.php`
- [ ] Upload `sepay-webhook.php` & `check-payment-status.php` to `/api/`
- [ ] Upload `sepay-config.js` & `sepay-handler.js` to `/json/`
- [ ] Update `serial.html` with new scripts & payment UI
- [ ] Update email template to include SePay transaction info
- [ ] Configure webhook URL in SePay Dashboard
- [ ] Test with sandbox environment
- [ ] Monitor logs: `tail -f api/error.log`
- [ ] Go live!

---

## 📞 Support Links

- SePay Docs: https://developer.sepay.vn/vi/sepay-webhooks
- SePay Dashboard: https://dashboard.sepay.vn
- Admin Contact: @lcnguy06 on Telegram

