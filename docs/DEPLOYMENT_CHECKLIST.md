# ✅ DEPLOYMENT CHECKLIST - SePay Integration

**Status:** Ready to Deploy  
**Target:** Production  
**Timeline:** ~15 minutes  

---

## 🎯 **PRE-DEPLOYMENT (Now)**

### **Step 1: Get API Key** ⏱️ 5 minutes
- [ ] Go to: https://dashboard.sepay.vn
- [ ] Login to account
- [ ] Navigate: Settings → API Keys (or similar)
- [ ] Copy API Key (format: `sep_live_xxx` or `sep_test_xxx`)
- [ ] Save in safe place (password manager, note, etc.)
- [ ] Do NOT share or commit to git

### **Step 2: Update config.php** ⏱️ 30 seconds
- [ ] Open: `api/config.php`
- [ ] Find: Line 43
- [ ] Replace: `'your-sepay-api-key-here'`
- [ ] With: Your actual API Key
- [ ] Save file
- [ ] Verify: Key looks correct
- [ ] Verify: Not committed to git

### **Step 3: Verify Files** ⏱️ 2 minutes
- [ ] Check: `api/sepay-webhook.php` exists
- [ ] Check: `api/check-payment-status.php` exists
- [ ] Check: `json/sepay-config.js` exists
- [ ] Check: `json/sepay-handler.js` exists
- [ ] Check: `serial.html` updated
- [ ] Check: All files readable
- [ ] Check: No syntax errors

---

## 🚀 **DEPLOYMENT (Production Server)**

### **Step 4: Upload Files** ⏱️ 5 minutes
- [ ] Connect to server (FTP/SSH/Git)
- [ ] Upload: `api/sepay-webhook.php`
- [ ] Upload: `api/check-payment-status.php`
- [ ] Upload: `api/config.php` (with API Key)
- [ ] Upload: `json/sepay-config.js`
- [ ] Upload: `json/sepay-handler.js`
- [ ] Upload: `serial.html`
- [ ] Verify: All files uploaded
- [ ] Verify: Permissions set (644 for PHP files)
- [ ] Verify: No FTP errors

### **Step 5: Verify Server** ⏱️ 2 minutes
- [ ] Check: `api/config.php` readable
- [ ] Check: Database credentials correct
- [ ] Check: Database connection works
- [ ] Check: Error log writable
- [ ] Check: Email settings work
- [ ] Check: HTTPS enabled
- [ ] Test: Can access `serial.html` in browser

---

## ⚙️ **CONFIGURATION (SePay Dashboard)**

### **Step 6: Configure Webhook** ⏱️ 2 minutes
- [ ] Go to: https://dashboard.sepay.vn
- [ ] Navigate: Webhooks (or Integrations)
- [ ] Click: Add New Webhook (or Create)
- [ ] URL field: `https://hyperur.io.vn/api/sepay-webhook.php`
- [ ] Event: Select `transaction.completed`
- [ ] Method: Select `POST`
- [ ] Headers: Leave empty or default
- [ ] Signature: Enable HMAC-SHA256 (if available)
- [ ] Save webhook
- [ ] Verify: Webhook created
- [ ] Note: You'll see webhook ID (save it)

### **Step 7: Test Webhook** ⏱️ 2 minutes
- [ ] In dashboard: Find your webhook
- [ ] Click: Test Webhook (or Send Test)
- [ ] Send test payload
- [ ] Check: Server receives it
- [ ] Check: `api/error.log` shows:
  - `SePay: API Key verified ✓`
  - `SePay Webhook received`
- [ ] If error: Check API Key matches
- [ ] If success: Continue!

---

## 🧪 **TESTING (Pre-Production)**

### **Step 8: Visual Test** ⏱️ 2 minutes
- [ ] Open: `https://hyperur.io.vn/serial.html`
- [ ] Click: "SePay Bank Transfer" section
- [ ] Verify: QR code displays
- [ ] Verify: Bank: MBBank shows
- [ ] Verify: Account: 0562903904 shows
- [ ] Verify: Amount: 50,000đ shows
- [ ] Verify: Holder: NGUYEN TAN LUC shows
- [ ] Verify: Instructions clear
- [ ] Verify: No console errors (press F12)

### **Step 9: Webhook Test** ⏱️ 2 minutes
```bash
# Test with curl (if you have SSH access)
curl -X POST https://hyperur.io.vn/api/sepay-webhook.php \
  -H "Content-Type: application/json" \
  -H "Authorization: Apikey YOUR_API_KEY" \
  -d '{
    "id": "TEST123",
    "amount": 50000,
    "description": "UR TEST123456",
    "sender_name": "TEST USER",
    "status": "completed"
  }'

# Expected response:
# {"success":false,"message":"Serial not found"}
# (This is OK - means webhook works, serial just doesn't exist)
```

- [ ] Webhook received without 401 error = ✅ API Key correct
- [ ] Serial not found error = ✅ Expected (test serial doesn't exist)
- [ ] 401 Unauthorized = ❌ API Key incorrect

### **Step 10: Real Payment Test** ⏱️ ~5 minutes
- [ ] Register new test serial (e.g., "TESTPAY123")
- [ ] Go to serial.html
- [ ] Click: "SePay Bank Transfer"
- [ ] See: QR code + bank details
- [ ] Make: Real payment (50,000đ)
  - Scan QR or use bank app
  - Description: `UR TESTPAY123`
  - Recipient: NGUYEN TAN LUC
- [ ] Wait: Webhook to process (usually <30 seconds)
- [ ] Check: 
  - [ ] Database: status = 'Active' ✓
  - [ ] Email: Received confirmation ✓
  - [ ] error.log: "API Key verified" ✓
- [ ] Verify: All working!

---

## ✅ **PRODUCTION VERIFICATION**

### **Step 11: Final Checks** ⏱️ 2 minutes
- [ ] QR displays correctly
- [ ] Bank info accurate
- [ ] Webhook receives requests
- [ ] API Key verified in logs
- [ ] Database updates work
- [ ] Emails send successfully
- [ ] Error logs accessible
- [ ] HTTPS only (no HTTP)
- [ ] No console errors
- [ ] No database errors

### **Step 12: Monitoring Setup** ⏱️ 2 minutes
- [ ] Set up: Log monitoring
  - [ ] Watch: `api/error.log` daily
  - [ ] Look for: Errors, failures, issues
- [ ] Set up: Database monitoring
  - [ ] Check: Payment records created
  - [ ] Check: Status updates working
- [ ] Set up: Email monitoring
  - [ ] Verify: Confirmation emails sending
  - [ ] Check: No bounces/errors
- [ ] Set up: Alert system (optional)
  - [ ] Alert on: API Key errors
  - [ ] Alert on: Database errors
  - [ ] Alert on: Email failures

---

## 🎊 **LAUNCH (Go Live!)**

### **Step 13: Enable SePay** ⏱️ 1 second
- [ ] Announce: "SePay payments now available!"
- [ ] Tell users: "Pay with bank transfer"
- [ ] Monitor: First 24 hours
- [ ] Watch for: Any issues
- [ ] Be ready: Support if problems
- [ ] Celebrate: 🎉 You're LIVE!

---

## 🚨 **TROUBLESHOOTING QUICK FIXES**

### **Problem: 401 Unauthorized**
```
Solution:
1. Check API Key in config.php matches dashboard
2. Make sure no extra spaces
3. Use LIVE key, not TEST key
4. Verify Authorization header format
```

### **Problem: Serial Not Found**
```
Solution (expected for test):
1. Register actual serial first
2. Make payment with correct serial in description
3. Serial must be: UR SERIAL_HERE (uppercase)
```

### **Problem: QR Not Loading**
```
Solution:
1. SePay API might be down → Uses VietQR fallback
2. Check internet connection
3. Try fullscreen QR (click QR image)
4. Check browser console for errors
```

### **Problem: Email Not Sending**
```
Solution:
1. Check SMTP credentials in config.php
2. Verify email not in spam/junk
3. Check error log for details
4. May need to whitelist sender email
```

### **Problem: Database Not Updating**
```
Solution:
1. Check database credentials in config.php
2. Verify database connection works
3. Check database user has UPDATE permission
4. Look at error log for SQL errors
```

---

## 📋 **SIGN-OFF CHECKLIST**

- [ ] API Key obtained from SePay
- [ ] config.php updated with API Key
- [ ] All files uploaded to server
- [ ] Webhook configured in SePay Dashboard
- [ ] Test webhook successful
- [ ] QR displays correctly
- [ ] Bank details accurate
- [ ] Real payment processed successfully
- [ ] Database updated correctly
- [ ] Confirmation email received
- [ ] Error logs show "API Key verified"
- [ ] No errors in browser console
- [ ] No errors in server logs
- [ ] Production monitoring set up
- [ ] Support team briefed
- [ ] Documentation updated

---

## 🎯 **SUCCESS CRITERIA**

✅ **Visual:** QR displays, bank details show  
✅ **Functional:** Payment processes, status updates  
✅ **Security:** API Key verified, no 401 errors  
✅ **Backend:** Database updates, email sends  
✅ **Monitoring:** Logs accessible, errors tracked  

---

## 📞 **SUPPORT CONTACTS**

| Issue | Contact |
|-------|---------|
| SePay API Key | SePay Dashboard / Support |
| Server Issues | Your hosting provider |
| Database Issues | Database admin / hosting |
| Email Issues | Email provider / hosting |
| Code Issues | Development team |

---

## 🎊 **DEPLOYMENT COMPLETE!**

Once all checkboxes are ✅:

```
🎉 You're LIVE with SePay payments!
🎉 Users can pay by bank transfer!
🎉 Payments auto-activate devices!
🎉 Confirmation emails auto-send!

Ready for production traffic! 🚀
```

---

**Print this checklist, check off items as you go, and reference it during deployment!**

**Total Time:** ~30 minutes (includes testing)  
**Difficulty:** Easy (mostly copy-paste)  
**Risk:** Low (all pre-tested)  

**You've got this! 💪**
