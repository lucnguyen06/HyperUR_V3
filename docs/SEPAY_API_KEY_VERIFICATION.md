# 🔐 SePay API Key - Server Verification Guide

**Status:** Implementation Complete ✅  
**Updated:** October 10, 2026  
**Component:** sepay-webhook.php  

---

## 🎯 **Understanding SePay API Key**

### **What SePay Sends**

When SePay sends a webhook to your server, it includes:

```http
POST /api/sepay-webhook.php HTTP/1.1
Host: hyperur.io.vn
Authorization: Apikey YOUR_API_KEY_HERE
Content-Type: application/json

{
  "id": "TXN1234567890",
  "amount": 50000,
  "description": "UR ABC123456",
  "sender_name": "NGUYEN VAN A",
  "status": "completed",
  ...
}
```

### **Purpose**

The `Authorization: Apikey` header serves to:
- ✅ **Authenticate** the request from SePay
- ✅ **Verify** it's really SePay calling your webhook
- ✅ **Prevent** fake/fraudulent webhook calls
- ✅ **Security** - Only SePay knows the API Key

---

## 🔧 **How It's Implemented**

### **File: api/sepay-webhook.php (Lines 30-55)**

```php
// ============================================================
// VERIFY SEPAY API KEY - Authenticate SePay requests
// ============================================================
// SePay sends: Authorization: Apikey YOUR_API_KEY
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

// Extract API Key from header format: "Apikey xxx"
if (strpos($authHeader, 'Apikey ') !== 0) {
    http_response_code(401);
    throw new Exception('Missing or invalid Authorization header');
}

$providedApiKey = substr($authHeader, 7); // Remove "Apikey " prefix
$expectedApiKey = SEPAY_API_KEY;         // From config.php

// Verify API Key matches
if ($providedApiKey !== $expectedApiKey) {
    http_response_code(401);
    error_log("SePay: Invalid API Key - Received: {$providedApiKey}");
    throw new Exception('Invalid API Key');
}

error_log("SePay: API Key verified ✓");
```

### **Flow**

```
SePay sends webhook
  ↓
Server receives request
  ↓
Extract Authorization header
  ↓
Compare with SEPAY_API_KEY from config.php
  ↓
If match → Continue processing payment ✅
If mismatch → Return 401 Unauthorized ❌
```

---

## 📝 **Configuration**

### **Step 1: Get API Key from SePay Dashboard**

1. Go: **https://dashboard.sepay.vn**
2. Settings → API Keys / Developers
3. Find: **API Key** or **Access Token**
4. Copy the full value (usually `sep_live_xxx` or `sep_test_xxx`)

### **Step 2: Update api/config.php (Line 43)**

```php
// Before:
define('SEPAY_API_KEY', 'your-sepay-api-key-here');

// After (with your actual key):
define('SEPAY_API_KEY', 'sep_live_xxxxxxxxxxxxxxxxxxxx');
```

⚠️ **Important:**
- Do NOT commit config.php to git (it's in .gitignore)
- Keep the API Key secret
- Use different keys for test vs production

---

## 🧪 **Testing API Key Verification**

### **Test 1: Valid Request (Should Succeed)**

```bash
curl -X POST https://hyperur.io.vn/api/sepay-webhook.php \
  -H "Content-Type: application/json" \
  -H "Authorization: Apikey sep_live_xxxxxxxxxxxxxxxxxxxx" \
  -d '{
    "id": "TEST123",
    "amount": 50000,
    "description": "UR ABC123456",
    "sender_name": "TEST USER",
    "status": "completed"
  }'
```

Expected Response:
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "serial": "ABC123456",
  "status": "Active"
}
```

Error Log:
```
SePay: API Key verified ✓
SePay Webhook received: [...]
```

### **Test 2: Missing Authorization (Should Fail with 401)**

```bash
curl -X POST https://hyperur.io.vn/api/sepay-webhook.php \
  -H "Content-Type: application/json" \
  -d '{"id":"TEST",...}'
```

Expected Response:
```json
{
  "success": false,
  "message": "Missing or invalid Authorization header"
}
```

HTTP Status: **401 Unauthorized**

Error Log:
```
SePay Webhook error: Missing or invalid Authorization header
```

### **Test 3: Invalid API Key (Should Fail with 401)**

```bash
curl -X POST https://hyperur.io.vn/api/sepay-webhook.php \
  -H "Authorization: Apikey sep_live_WRONG_KEY_12345" \
  -d '{...}'
```

Expected Response:
```json
{
  "success": false,
  "message": "Invalid API Key"
}
```

HTTP Status: **401 Unauthorized**

Error Log:
```
SePay: Invalid API Key - Received: sep_live_WRONG_KEY_12345
```

---

## 🔒 **Security Features**

✅ **API Key in config.php** (not hardcoded in webhook handler)  
✅ **Header validation** (checks "Apikey" prefix)  
✅ **Exact match comparison** (no fuzzy matching)  
✅ **401 responses** (standard HTTP authentication failure)  
✅ **Error logging** (logs failed attempts)  
✅ **Early rejection** (fails before processing data)  

---

## 🚨 **What Happens If API Key is Wrong**

### **Scenario: SePay has Key A, You have Key B**

```
SePay sends: Authorization: Apikey KEY_A
Your server expects: SEPAY_API_KEY = 'KEY_B'

Result:
  ├─ KEY_A !== KEY_B
  ├─ Return 401
  ├─ Log: "Invalid API Key"
  └─ Payment NOT processed ❌
```

### **Solution:**

1. Go to SePay Dashboard
2. Copy your API Key exactly
3. Update config.php line 43
4. Redeploy
5. Test again

---

## 📊 **Complete Webhook Verification Flow**

```
┌─────────────────────────────────────────────────┐
│ 1. SePay sends POST request                      │
│    Headers: Authorization: Apikey API_KEY        │
│    Body: JSON transaction data                   │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 2. sepay-webhook.php receives request           │
│    Checks: REQUEST_METHOD === POST ✓            │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 3. Extract Authorization header                 │
│    Format: "Apikey sep_live_xxx"                │
│    Extract: sep_live_xxx                        │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 4. Compare with SEPAY_API_KEY from config.php  │
│    sep_live_xxx === config.SEPAY_API_KEY?       │
└─────────────────────────────────────────────────┘
                      ↓
        ┌─────────────┴─────────────┐
        │                           │
      YES                          NO
        │                           │
        ↓                           ↓
    ✅ VERIFIED              ❌ REJECTED
        │                           │
        ↓                           ↓
   Continue:                  Return 401
   ├─ Parse data             error_log
   ├─ Verify serial          message: "Invalid API Key"
   ├─ Check amount
   ├─ Update DB
   ├─ Send email
   └─ Return 200 OK
```

---

## 🎯 **When to Use This**

### **Uses API Key (Authorization Header)**
✅ SePay webhook calls  
✅ Server-to-server communication  
✅ Webhook authentication  

### **Does NOT Use API Key**
❌ QR code generation (uses SePay API directly)  
❌ Frontend JavaScript (no API Key needed)  
❌ User transactions (handled by SePay)  

---

## 📚 **Related Documentation**

| Component | File | Purpose |
|-----------|------|---------|
| **Webhook Handler** | api/sepay-webhook.php | Receives webhooks + verifies API Key |
| **Configuration** | api/config.php | Stores SEPAY_API_KEY |
| **Setup Guide** | SEPAY_WEBHOOK_SETUP_GUIDE.md | How to configure webhook in SePay |
| **Tech Docs** | SEPAY_TECHNICAL_DOCUMENTATION.md | Complete technical reference |

---

## 💡 **Key Points**

1. **API Key** = Secret authentication credential
2. **Header format** = `Authorization: Apikey YOUR_KEY`
3. **Verification** = Compare header with config.php value
4. **Failure** = Return 401 + log attempt
5. **Security** = Prevents fake webhooks

---

## 🚀 **Next Steps**

1. ✅ Get API Key from SePay Dashboard
2. ✅ Update: Line 43 in `api/config.php`
3. ✅ Verify webhook calls work
4. ✅ Check error logs for verification messages
5. ✅ Deploy to production

---

**API Key verification is now active and secure!** 🔐
