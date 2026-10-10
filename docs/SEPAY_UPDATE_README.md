# 🎉 HyperUR V3 - SePay Integration Update

**Date:** October 10, 2026  
**Version:** 3.1 (SePay Release)  
**Status:** Ready for Integration

---

## 📦 New Files Added

### 🔧 Backend APIs
```
api/sepay-webhook.php              # Receive SePay payment callbacks
api/check-payment-status.php        # Check real-time payment status
```

### ⚙️ Configuration
```
json/sepay-config.js               # SePay settings & constants
```

### 💻 Frontend Handler
```
json/sepay-handler.js              # Client-side SePay payment handler
```

### 📖 Documentation
```
SEPAY_INTEGRATION_GUIDE.md          # Complete setup guide
SERIAL_PAYMENT_METHODS_SNIPPET.html # HTML code snippet for integration
```

---

## 🎯 Key Changes Summary

### ✅ What's New

| Feature | Before | After |
|---------|--------|-------|
| **Primary Payment** | MoMo Quỹ (manual verify) | SePay Bank Transfer (auto-verify) |
| **Verification Time** | 5-30 minutes (manual) | Instant (webhook) |
| **Bank Account** | MoMo Account | MBBank 0359998888 |
| **Webhook Support** | None | ✅ SePay webhook integration |
| **Status Polling** | Manual refresh | ✅ Real-time polling |
| **Auto-Activation** | Manual only | ✅ Automatic via webhook |

### 🔄 Payment Flow Comparison

**OLD Flow (Momo):**
```
User Transfer → Momo Account → Wait for Admin → Manual DB Update → Send Email
[5-30 min delay, requires manual intervention]
```

**NEW Flow (SePay):**
```
User Transfer → SePay Webhook → Auto DB Update → Send Email → Auto-Activation
[Instant, fully automated]
```

---

## 🚀 Quick Start Integration

### 1️⃣ Add Script Imports to `serial.html`

```html
<!-- Before </head> -->
<script src="json/sepay-config.js"></script>
<script src="json/sepay-handler.js"></script>
```

### 2️⃣ Replace Payment Methods Section

Copy code from: `SERIAL_PAYMENT_METHODS_SNIPPET.html`  
Paste into: `serial.html` at payment methods section (~line 460)

### 3️⃣ Update `api/config.php`

```php
// Add SePay credentials
define('SEPAY_API_KEY', 'your-key-here');
define('SEPAY_WEBHOOK_SECRET', 'your-secret-here');
define('SEPAY_BANK_ACCOUNT', '0359998888');
define('SEPAY_BANK_CODE', 'MB');
define('SEPAY_ACCOUNT_NAME', 'NGUYEN TAN LUC');
```

### 4️⃣ Configure SePay Dashboard

1. Go to: https://dashboard.sepay.vn
2. Navigate to: Webhooks → Create Webhook
3. Set URL: `https://hyperur.io.vn/api/sepay-webhook.php`
4. Events: `transaction.completed`
5. Copy Webhook Secret to `config.php`

### 5️⃣ Test with Sandbox

Follow SePay Test Mode Guide at: https://developer.sepay.vn/vi/test-mode-sandbox

---

## 📊 Database Schema (No Changes!)

**Existing tables work as-is:**

```sql
-- registrations table (unchanged)
-- activity_logs table (unchanged)

-- New columns populated by SePay:
-- transaction_code ← SePay transaction ID
-- sender_name ← SePay sender name (auto-filled)
-- status ← Auto-updated to 'Active' on payment receipt
```

---

## 🔐 Security Features

✅ **Webhook Signature Verification** (HMAC-SHA256)  
✅ **Amount Validation** (Check against expected payment)  
✅ **Serial Validation** (Verify serial exists)  
✅ **IP Logging** (Track all webhook calls)  
✅ **Rate Limiting** (Prevent abuse)  
✅ **HTTPS Only** (Enforce on production)  

---

## 📧 Email Template Update

Update `api/email-template.php` to receive additional fields:

```php
function generateEmailTemplate($data) {
  // Now includes:
  // - $data['amount']              // SePay transaction amount
  // - $data['transactionCode']     // SePay transaction ID
  // - $data['paymentMethod']       // 'SePay Bank Transfer'
}
```

---

## 🧪 Testing Endpoints

### Test Payment Status

```bash
curl "https://hyperur.io.vn/api/check-payment-status.php?serial=ABC123456"

# Response:
{
  "success": true,
  "data": {
    "status": "pending",  # pending | completed | failed
    "registration_status": "Pending",
    "transaction_code": "SePay-TXN-123456"
  }
}
```

### Test Webhook (Sandbox)

```bash
curl -X POST "https://hyperur.io.vn/api/sepay-webhook.php" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "TEST123",
    "amount": 50000,
    "description": "UR ABC123456",
    "sender_name": "TEST USER",
    "status": "completed"
  }'

# Response:
{
  "success": true,
  "message": "Payment processed successfully",
  "serial": "ABC123456",
  "status": "Active"
}
```

---

## 📋 Deployment Checklist

- [ ] Add 3 new PHP files to `/api/`
- [ ] Add 2 new JS files to `/json/`
- [ ] Update `serial.html` with new payment methods UI
- [ ] Update `api/config.php` with SePay credentials
- [ ] Update `api/email-template.php` (optional)
- [ ] Configure SePay webhook in dashboard
- [ ] Test with sandbox environment
- [ ] Monitor logs: `tail -f api/error.log`
- [ ] Go live!

---

## 🎓 Learning Resources

**SePay Documentation:**
- Main Docs: https://developer.sepay.vn
- Webhooks Guide: https://developer.sepay.vn/vi/sepay-webhooks
- Test Mode: https://developer.sepay.vn/vi/test-mode-sandbox

**Integration Guide:**
- Full Setup: `SEPAY_INTEGRATION_GUIDE.md` (this repo)

---

## 🔄 Backward Compatibility

✅ **MoMo, Binance, PayPal still work!**

Users can still choose legacy payment methods. The new SePay is just the primary/recommended option now.

---

## 📞 Support

- 🐛 Issues: Check `api/error.log`
- 💬 Questions: https://t.me/HuperUltraRateChat
- 👤 Admin: @lcnguy06

---

## 🎉 What's Next?

After SePay integration is live:

1. **Monitor webhook reliability** (check error logs)
2. **Gather user feedback** on new payment flow
3. **Optimize email template** based on feedback
4. **Consider multi-bank support** (VietCom, ACB, etc. via SePay)
5. **Add transaction history** page for users

---

## 📝 Migration Guide (From Old Momo System)

### For Existing Registered Users

No action needed! All existing serial registrations remain valid.

### For New Registrations

- Use new SePay payment method
- Auto-verification instead of manual
- Same pricing: 50k per device, 40k for 15+ devices

### Database Migration

No data migration needed. Existing tables work as-is.

---

**Questions? Check the full guide: `SEPAY_INTEGRATION_GUIDE.md`**

🚀 **Let's go live!**
