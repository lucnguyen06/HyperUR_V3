# 🔧 SePay Webhook Configuration Guide

**Status:** Ready to configure  
**Estimated Time:** 10 minutes  

---

## 📍 Step-by-Step Setup

### **Step 1: Get SePay API Credentials**

1. Go to: **https://dashboard.sepay.vn**
2. Login with your SePay account
3. Navigate to: **Settings → API Keys** (or similar)
4. You'll find:
   - ✅ **API Key** - Starts with something like `sep_...`
   - ✅ **Webhook Secret** - Long random string

**Copy both values!**

---

### **Step 2: Update api/config.php**

Open: `api/config.php` (you just created)

Find these lines and update:

```php
// Line ~47-48
define('SEPAY_API_KEY', 'your-sepay-api-key-here');
define('SEPAY_WEBHOOK_SECRET', 'your-sepay-webhook-secret-here');
```

Replace with your actual values:

```php
define('SEPAY_API_KEY', 'sep_xxxxxxxxxxxxxxxxxxxxx');
define('SEPAY_WEBHOOK_SECRET', 'sk_yyyyyyyyyyyyyyyyyyyyyyyyyyy');
```

✅ **Save the file!**

---

### **Step 3: Configure Webhook in SePay Dashboard**

1. Go to: **https://dashboard.sepay.vn**
2. Navigate to: **Webhooks → Add Webhook** (or Create New)
3. Fill in the form:

**Field 1: Webhook URL**
```
https://hyperur.io.vn/api/sepay-webhook.php
```

**Field 2: Events**
Select: 
- ✅ `transaction.completed` (MUST SELECT)
- Or similar event name for payment completion

**Field 3: Method**
Select:
- ✅ **POST** (already selected usually)

**Field 4: Headers** (if available)
Leave empty or default

**Field 5: Signature Verification**
- ✅ **Enable** (if available)
- Set to: **HMAC-SHA256**

4. Click: **Save** or **Create Webhook**

5. **Important:** After saving, SePay will show you the **Webhook Secret**
   - Copy this and update `config.php` line 48

---

## 🧪 Testing Webhook

### **Option 1: Test from SePay Dashboard**

1. In SePay Dashboard → Your webhook → **Test Webhook**
2. SePay will send a test payload
3. Check server logs: `api/error.log`
4. Should see: "SePay Webhook received"

### **Option 2: Test with curl (Local)**

If you have SSH access:

```bash
curl -X POST https://hyperur.io.vn/api/sepay-webhook.php \
  -H "Content-Type: application/json" \
  -d '{
    "id": "TEST123",
    "amount": 50000,
    "description": "UR ABC123456",
    "sender_name": "TEST USER",
    "status": "completed"
  }'
```

Expected response:
```json
{
  "success": false,
  "message": "Serial not found"
}
```

(Error is expected because serial doesn't exist - this is correct behavior)

---

## 📝 Webhook Payload Format

**What SePay sends to your webhook:**

```json
{
  "id": "TXN1234567890",
  "transaction_id": "SePay-TXN-789",
  "amount": 50000,
  "currency": "VND",
  "description": "UR ABC123456",
  "sender_name": "NGUYEN VAN A",
  "sender_account": "0123456789",
  "bank_account": "0359998888",
  "bank_name": "MBBank",
  "bank_account_name": "NGUYEN TAN LUC",
  "status": "completed",
  "timestamp": "2026-10-10T15:30:45+07:00",
  "note": "Optional message"
}
```

**Your server will:**
1. Parse serial from description: `UR ABC123456` → `ABC123456`
2. Verify amount = 50000
3. Update database: `status = 'Active'`
4. Send confirmation email
5. Return: `{ "success": true }`

---

## 🔐 Security Checklist

✅ **Webhook URL is HTTPS** (not HTTP)  
✅ **API_KEY stored in config.php** (not in code)  
✅ **WEBHOOK_SECRET stored securely** (not hardcoded)  
✅ **config.php in .gitignore** (not committed)  
✅ **Signature verification enabled** (if available)  

---

## ⚠️ Common Issues

### Issue 1: "Webhook not receiving"

**Solution:**
- Check webhook URL is correct
- Make sure URL is publicly accessible (not localhost)
- Check firewall allows POST requests
- Look at `api/error.log` for errors

### Issue 2: "Serial not found"

**Expected behavior!**
- Only happens if serial doesn't exist in database
- Normal during testing

### Issue 3: "Payment not activating"

**Solutions:**
- Check database has proper `registrations` table
- Verify amount matches expected 50,000đ
- Check transaction_code not already used
- Look at error logs

---

## 📊 Verification Checklist

After setup, verify:

- [ ] SePay API key obtained ✅
- [ ] Webhook secret obtained ✅
- [ ] config.php updated ✅
- [ ] Webhook URL configured in SePay ✅
- [ ] Test webhook sent & logged ✅
- [ ] No HTTPS errors ✅
- [ ] Database ready ✅

---

## 🚀 Next Steps

1. ✅ Complete this guide (you are here)
2. Update `config.php` with credentials
3. Configure webhook in SePay dashboard
4. Test with webhook
5. Register a test device
6. Complete payment & verify activation
7. Check logs for any errors
8. Go live!

---

## 📞 Support

**If webhook not working:**

1. Check `api/error.log`:
   ```bash
   tail -f api/error.log
   ```

2. Common logs:
   - "SePay Webhook received:" = Good
   - "Serial not found" = Expected (if serial not registered)
   - Database errors = Check DB credentials

3. Contact: @lcnguy06 on Telegram with error logs

---

## 📚 SePay Official Docs

- Main: https://developer.sepay.vn
- Webhooks: https://developer.sepay.vn/vi/sepay-webhooks
- Sandbox: https://developer.sepay.vn/vi/test-mode-sandbox

---

**✅ Ready? Start with Step 1 above!**
