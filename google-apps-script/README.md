# Google Apps Script - HyperUR Email System

Hệ thống tự động gửi email xác nhận khi user đăng ký Serial.

## 📋 Chức năng

- ✅ Nhận đăng ký Serial từ website
- 💾 Lưu vào Google Sheets tự động
- 📧 Gửi email xác nhận với template đẹp
- 🔍 API tra cứu trạng thái Serial
- 🆓 Tự động kích hoạt gói Active Free (36 ngày)

---

## 🚀 Hướng Dẫn Setup

### Bước 1: Tạo Google Sheets

1. Truy cập https://sheets.google.com
2. Tạo spreadsheet mới: **HyperUR Registrations**
3. Lưu lại Spreadsheet ID (trong URL)

### Bước 2: Tạo Google Apps Script

1. Trong Google Sheets, chọn **Extensions** → **Apps Script**
2. Xóa code mẫu
3. Copy toàn bộ code từ file `Code.gs` và paste vào
4. Đổi tên project thành: **HyperUR Email System**
5. Lưu (Ctrl+S hoặc Command+S)

### Bước 3: Cấu hình

Sửa phần CONFIG trong code:

```javascript
const CONFIG = {
  SHEET_NAME: 'Registrations',
  WEBSITE_URL: 'https://hyperur.io.vn', // URL website của bạn
  SUPPORT_EMAIL: 'support@hyperur.io.vn',
  TELEGRAM_CHANNEL: 'https://t.me/hypermodupdate',
  TELEGRAM_CHAT: 'https://t.me/HuperUltraRateChat'
};
```

### Bước 4: Test Email

1. Trong Apps Script Editor, chọn function **testEmail**
2. Sửa email trong function:
   ```javascript
   senderEmail: 'your-email@gmail.com', // Thay bằng email của bạn
   ```
3. Click **Run** (▶️)
4. Cho phép quyền truy cập khi được hỏi:
   - Click **Review Permissions**
   - Chọn tài khoản Google
   - Click **Advanced** → **Go to HyperUR Email System (unsafe)**
   - Click **Allow**
5. Kiểm tra inbox email của bạn

### Bước 5: Deploy Web App

1. Click **Deploy** → **New deployment**
2. Click ⚙️ (settings icon) → Chọn **Web app**
3. Cấu hình:
   - **Description**: HyperUR Email System v1.0
   - **Execute as**: **Me** (your-email@gmail.com)
   - **Who has access**: **Anyone**
4. Click **Deploy**
5. Copy **Web app URL** (dạng `https://script.google.com/macros/s/.../exec`)

### Bước 6: Cập nhật Website

Mở file `json/config.js` và cập nhật URL:

```javascript
SERIAL_REGISTER_API_URL: "URL_VỪA_COPY",
SERIAL_LOOKUP_API_URL: "URL_VỪA_COPY"
```

---

## 📊 Cấu trúc Google Sheets

Script sẽ tự động tạo sheet **Registrations** với các cột:

| Timestamp | Serial | Codename | Plan | Payment Method | Sender Name | Sender Email | Transaction Code | Status | Activated Date | Expired Date |
|-----------|--------|----------|------|----------------|-------------|--------------|------------------|--------|----------------|--------------|
| 2026-10-03 | TEST123 | marble | Free | Free | Test User | test@mail.com | FREE_36 | Active | 2026-10-03 | 2026-11-08 |

### Status Values:
- **Pending**: Chờ thanh toán
- **Active**: Đã kích hoạt
- **Expired**: Đã hết hạn
- **Cancelled**: Đã hủy

---

## 🔌 API Endpoints

### POST - Đăng ký Serial

**URL**: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`

**Request Body**:
```json
{
  "serial": "ABC123456",
  "codename": "marble",
  "plan": "Có Ủng hộ (Vĩnh viễn)",
  "paymentMethod": "Momo",
  "senderName": "Nguyễn Văn A",
  "senderEmail": "example@gmail.com",
  "transactionCode": "UR ABC123456",
  "timestamp": "2026-10-03T13:30:00.000Z"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Đăng ký thành công và email đã được gửi"
}
```

### GET - Tra cứu Serial

**URL**: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?serial=ABC123456`

**Response**:
```json
{
  "success": true,
  "message": "Tìm thấy Serial",
  "data": {
    "serial": "ABC123456",
    "codename": "marble",
    "plan": "Có Ủng hộ (Vĩnh viễn)",
    "senderEmail": "example@gmail.com",
    "status": "Active",
    "activatedDate": "03/10/2026 13:30",
    "expiredDate": "03/10/2027 13:30",
    "registeredDate": "03/10/2026 13:25"
  }
}
```

---

## 📧 Email Template

Email được gửi tự động có:

- ✅ Thiết kế dark theme glassmorphism giống website
- 📱 Responsive, đẹp trên mọi thiết bị
- 🎨 Logo HyperUR, icon success
- 📋 Chi tiết đầy đủ: Serial, Codename, Gói, Mức ủng hộ
- 🔗 Button CTA để kiểm tra trạng thái
- ⚠️ Lưu ý quan trọng về thanh toán
- 📲 Link Telegram channel & support

---

## 🔧 Troubleshooting

### Lỗi "Authorization required"
- Chạy lại function `testEmail` và cho phép quyền

### Email không được gửi
- Kiểm tra Spam folder
- Kiểm tra Log: **View** → **Logs** trong Apps Script Editor
- Đảm bảo email trong `testEmail` đúng

### Website không nhận được response
- Kiểm tra URL trong `json/config.js`
- Kiểm tra Deploy settings: "Who has access" phải là "Anyone"
- Test bằng Postman với POST request

### Serial không lưu vào Sheets
- Kiểm tra tên sheet: phải là "Registrations"
- Kiểm tra quyền truy cập spreadsheet

---

## 📝 Notes

- **Email quota**: Google Apps Script cho phép gửi 100 email/ngày (free account) hoặc 1500 email/ngày (Google Workspace)
- **Execution time**: Mỗi function chạy tối đa 6 phút
- **Trigger**: Có thể setup trigger tự động kích hoạt Serial sau 30 phút nếu cần

---

## 🆕 Updates

### Version 1.0 (2026-10-03)
- ✅ Nhận đăng ký Serial từ website
- ✅ Tự động gửi email xác nhận
- ✅ Lưu vào Google Sheets
- ✅ API tra cứu Serial
- ✅ Tự động kích hoạt gói Free

---

## 📞 Support

- 📢 Channel: https://t.me/hypermodupdate
- 💬 Chat: https://t.me/HuperUltraRateChat
- 👤 Admin: @lcnguy06 | @Usagi79
