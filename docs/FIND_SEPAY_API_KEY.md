# 🔍 Finding SePay API Key

## ✅ Webhook Secret: DONE ✅
```
whsec_Ej86RjhLW3qLWD6JRNMc7QKsyyNkB0yC
```
Updated in: `api/config.php` line 47

---

## 🔍 Still Need: SePay API Key

### Where to Find It

**Method 1: From Webhook Page**
1. Go: https://dashboard.sepay.vn
2. In the same webhook section
3. Look for: **"API Key"** or **"Access Token"** field
4. Copy the entire value

**Method 2: Settings → API**
1. https://dashboard.sepay.vn → Settings
2. Look for: **API Keys**, **Credentials**, **Access Token**
3. Or similar tab

**Method 3: From Email**
- Check email for "API Setup" or "Credentials"
- SePay usually sends it after account creation

---

## 📝 Format

API Key usually looks like:
```
sep_live_xxxxxxxxxxxxxxxx
sep_test_xxxxxxxxxxxxxxxx
or
access_token_xxxxxxxxxxxxxxxx
```

---

## 🚀 Once You Have It

Send it and I'll update config.php immediately!

Then we'll:
1. ✅ Add webhook secret (DONE)
2. ✅ Add API key (WAITING)
3. ✅ Test webhook
4. ✅ Deploy

---

**Where should I add it in SePay Dashboard?**

Check these locations in order:
1. Current webhook page - scroll down
2. Settings tab
3. Developers tab
4. API section
5. Integration settings

**Take a screenshot if you find it!**
