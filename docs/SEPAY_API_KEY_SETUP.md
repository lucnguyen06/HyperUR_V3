# 🔑 SePay API Key - Final Configuration

**Status:** Ready to add API Key  
**Current:** Placeholder value  
**Next:** One simple update needed  

---

## 📍 **Exact Location to Update**

### **File:** `api/config.php`
### **Line:** 43

**Current (WRONG - Placeholder):**
```php
define('SEPAY_API_KEY', 'your-sepay-api-key-here');
```

**After Update (with your key):**
```php
define('SEPAY_API_KEY', 'sep_live_xxxxxxxxxxxxxxxxxxxx');
```

---

## 🔍 **How to Find Your API Key**

### **Step 1: Open SePay Dashboard**
```
https://dashboard.sepay.vn
```

### **Step 2: Navigate to API Section**

Look for one of these:
- Settings → API Keys
- Settings → API / Credentials
- Developers → API Keys
- Integration → API Credentials

### **Step 3: Find Your API Key**

You'll see something like:
```
API Key (Live):    sep_live_xxxxxxxxxxxxxxxxxxxxxxxx
API Key (Test):    sep_test_xxxxxxxxxxxxxxxxxxxxxxxx
or
Access Token:      access_token_xxxxxxxxxxxx
```

### **Step 4: Copy the Full Value**

- Select the entire key string
- Copy it (Ctrl+C)
- Do NOT include quotes or "sep_live_" prefix twice

---

## 💻 **How to Update config.php**

### **Method 1: Using Cursor IDE (Recommended)**

1. Open: `api/config.php`
2. Go to line 43
3. Find: `define('SEPAY_API_KEY', 'your-sepay-api-key-here');`
4. Replace: `your-sepay-api-key-here` with your API Key
5. Save (Ctrl+S)

### **Method 2: Using SSH/FTP**

1. Connect to server via SSH or FTP
2. Navigate to: `/api/config.php`
3. Edit line 43
4. Replace placeholder with your API Key
5. Save file

### **Method 3: Using Command Line**

```bash
# If you have SSH access
ssh user@hyperur.io.vn
cd /path/to/HyperUR_V3/api
nano config.php

# Find line 43, replace placeholder
# Save: Ctrl+X → Y → Enter
```

---

## ✅ **Verification After Update**

### **Check 1: File Was Saved**
```bash
grep "SEPAY_API_KEY" /path/to/api/config.php

# Should show:
# define('SEPAY_API_KEY', 'sep_live_xxxxxxxxxxxx');
```

### **Check 2: Not Committed to Git**
```bash
git diff api/config.php

# Should show no changes (because config.php is in .gitignore)
# This is GOOD - we don't want to commit secrets!
```

### **Check 3: Test Webhook**

Send test webhook from SePay Dashboard
Check server logs:
```bash
tail -f /path/to/api/error.log

# Should see:
# SePay: API Key verified ✓
```

---

## 📋 **Before & After**

### **BEFORE Update:**
```php
// Line 43
define('SEPAY_API_KEY', 'your-sepay-api-key-here');

// Result when SePay calls webhook:
// ❌ Error: Invalid API Key
// Log: "SePay: Invalid API Key - Received: sep_live_actualkey"
```

### **AFTER Update (Example with Real Key):**
```php
// Line 43
define('SEPAY_API_KEY', 'sep_live_EjhK92nqW8x3pLmN5qRsT');

// Result when SePay calls webhook:
// ✅ Success: API Key verified
// Log: "SePay: API Key verified ✓"
// Payment processes normally
```

---

## 🎯 **Complete Workflow**

```
1. Get API Key from SePay Dashboard
   └─ Copy: sep_live_xxxxxxxxxxxx
   
2. Update api/config.php line 43
   └─ Replace: 'your-sepay-api-key-here'
   └─ With:    'sep_live_xxxxxxxxxxxx'
   
3. Save file
   └─ Ctrl+S (Cursor)
   └─ Or save via FTP/SSH
   
4. Upload to server
   └─ Already live if editing directly on server
   └─ Or upload via FTP/Git
   
5. Test webhook
   └─ SePay Dashboard → Your Webhook → Test
   └─ Check: api/error.log
   └─ Verify: "SePay: API Key verified ✓"
   
6. Monitor first real payment
   └─ Check logs during payment
   └─ Verify database update
   └─ Check email sent
   
7. Go LIVE! 🚀
```

---

## 🚨 **Important Security Notes**

### **DO ✅**
✅ Keep API Key secret  
✅ Only store in config.php (not hardcoded)  
✅ Use different keys for test vs production  
✅ Use HTTPS only (already configured)  
✅ Rotate API keys periodically  

### **DON'T ❌**
❌ Commit config.php to git  
❌ Share API Key in email/chat  
❌ Hardcode API Key in code  
❌ Use same key for dev/staging/production  
❌ Expose API Key in URLs  

---

## 🔐 **API Key Security in Production**

### **Current Setup (Good)**
```
config.php (server only, not in git)
  └─ SEPAY_API_KEY (secret, never exposed)
  └─ Used only by PHP backend
  └─ Never sent to frontend
  └─ Only used in Authorization header verification
```

### **Request Flow (Secure)**
```
SePay server → HTTPS → Your server:443
  ├─ Header: Authorization: Apikey sep_live_xxx
  ├─ Server receives
  ├─ Extract API Key from header
  ├─ Compare with config.php value
  ├─ If match → process payment
  └─ If mismatch → reject with 401
```

---

## 📞 **If Something Goes Wrong**

### **Issue: "Invalid API Key" in Logs**

**Solution:**
1. Double-check you copied the entire key
2. Verify no extra spaces or characters
3. Make sure it's the LIVE key, not TEST key
4. Check it matches exactly with SePay Dashboard

### **Issue: "Missing Authorization header"**

**Solution:**
1. Make sure webhook is configured in SePay Dashboard
2. Test webhook should send Authorization header
3. Check SePay documentation for webhook format
4. Contact SePay support if header not being sent

### **Issue: 401 Unauthorized Response**

**Solution:**
1. Verify API Key in config.php is correct
2. Check server can read config.php
3. Look for typos in the key
4. Restart PHP-FPM if using (some servers need restart after config change)

---

## ✨ **Final Checklist**

- [ ] Get SePay API Key from dashboard
- [ ] Copy the full key (including "sep_live_" prefix)
- [ ] Open api/config.php line 43
- [ ] Replace placeholder with actual key
- [ ] Save file
- [ ] Upload to server (if not already there)
- [ ] NOT committed to git ✓
- [ ] Ready for webhook testing!

---

## 🎊 **You're Almost There!**

Just these final steps:

1. **Get the key** (5 minutes)
2. **Update config.php** (30 seconds)
3. **Save** (10 seconds)
4. **Test webhook** (1 minute)
5. **DEPLOY!** 🚀

---

**Then you'll be LIVE with SePay payments! 🎉**

Send me your API Key and I can update it for you, or do it yourself following this guide!
