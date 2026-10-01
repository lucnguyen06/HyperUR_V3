# HyperUR Telegram Bot

Bot Telegram để quản lý đăng ký ROM HyperOS - Nhận và xử lý bill thanh toán tự động.

## 🚀 Tính Năng

### Người dùng
- ✅ Gửi bill thanh toán (ảnh)
- 📱 Đăng ký thiết bị theo codename
- 🔍 Tra cứu trạng thái đơn
- 🔗 Nhận link ROM sau khi được duyệt
- 📊 Xem lịch sử đơn đăng ký

### Admin
- 🔔 Nhận thông báo đơn mới realtime
- ✅ Duyệt/Từ chối đơn nhanh chóng
- 📋 Quản lý danh sách đơn chờ
- 📊 Xem thống kê hệ thống
- 💬 Gửi link ROM cho user

## 📦 Cài Đặt

### 1. Clone và cài đặt dependencies

```bash
cd C:\Users\Administrator\Documents\GitHub\HyperUR_V3\telegram-bot
npm install
```

### 2. Tạo file `.env`

```bash
cp .env.example .env
```

Chỉnh sửa file `.env`:

```env
BOT_TOKEN=your_telegram_bot_token_here
ADMIN_IDS=123456789,987654321
HYPERUR_API_URL=http://localhost:3000/api
HYPERUR_WEBSITE_URL=https://your-site.com
BILLS_FOLDER=./bills
DATABASE_FILE=./database/bot-data.json
```

### 3. Lấy Bot Token

1. Mở Telegram, tìm [@BotFather](https://t.me/BotFather)
2. Gửi `/newbot`
3. Đặt tên bot: `HyperUR Bot`
4. Đặt username: `hyperur_bill_bot` (hoặc tên khác)
5. Copy token và paste vào `.env`

### 4. Lấy Admin ID

1. Mở [@userinfobot](https://t.me/userinfobot)
2. Gửi bất kỳ tin nhắn nào
3. Bot sẽ trả về ID của bạn
4. Copy ID và paste vào `ADMIN_IDS` trong `.env`

## 🏃 Chạy Bot

### Development mode (auto-reload)

```bash
npm run dev
```

### Production mode

```bash
npm start
```

## 📖 Hướng Dẫn Sử Dụng

### Dành cho User

1. **Gửi bill:**
   - Mở bot và gửi `/start`
   - Bấm nút "📤 Gửi Bill"
   - Gửi ảnh bill thanh toán
   - Nhập codename thiết bị (vd: `houji`, `garnet`)
   - Xác nhận thông tin

2. **Tra cứu đơn:**
   - Gửi `/mybills`
   - Hoặc bấm nút "🔍 Tra Cứu Đơn"

3. **Xem chi tiết đơn:**
   - Từ danh sách đơn, chọn đơn cần xem
   - Xem trạng thái, link ROM (nếu đã duyệt)

### Dành cho Admin

1. **Xem panel admin:**
   ```
   /admin
   ```

2. **Xem đơn chờ duyệt:**
   ```
   /pending
   ```

3. **Duyệt đơn:**
   - Bot sẽ gửi thông báo khi có đơn mới
   - Bấm nút "✅ Duyệt"
   - Gửi link ROM (hoặc "ok" nếu không có link)

4. **Từ chối đơn:**
   - Bấm nút "❌ Từ chối"
   - Nhập lý do từ chối (hoặc "ok")

5. **Xem thống kê:**
   ```
   /stats
   ```

## 🗂️ Cấu Trúc Project

```
telegram-bot/
├── bot.js                      # File chính - Khởi động bot
├── database.js                 # Quản lý database JSON
├── package.json
├── .env.example
├── .env
├── handlers/
│   ├── billHandler.js         # Xử lý bill upload
│   ├── adminHandler.js        # Xử lý chức năng admin
│   └── userHandler.js         # Xử lý chức năng user
├── bills/                     # Thư mục lưu ảnh bill
└── database/
    └── bot-data.json          # Database JSON
```

## 📊 Database Schema

```json
{
  "bills": [
    {
      "id": "unique-id",
      "userId": 123456789,
      "username": "user123",
      "firstName": "Nguyen Van A",
      "photoPath": "./bills/bill_123_timestamp.jpg",
      "photoFileId": "telegram-file-id",
      "deviceCode": "houji",
      "status": "pending|approved|rejected",
      "createdAt": "2026-10-01T08:00:00.000Z",
      "updatedAt": "2026-10-01T09:00:00.000Z",
      "approvedBy": 987654321,
      "approvedAt": "2026-10-01T09:00:00.000Z",
      "romLink": "https://drive.google.com/...",
      "notes": "Lý do từ chối (nếu có)"
    }
  ],
  "users": {
    "123456789": {
      "id": 123456789,
      "username": "user123",
      "firstName": "Nguyen Van A",
      "createdAt": "2026-10-01T08:00:00.000Z",
      "billCount": 5,
      "lastActive": "2026-10-01T10:00:00.000Z"
    }
  },
  "settings": {}
}
```

## 🔧 Tích Hợp với Website HyperUR

Bot có thể tích hợp với website HyperUR_V3 thông qua:

1. **API Endpoint** - Đồng bộ serial đã đăng ký
2. **Google Drive API** - Lấy link ROM tự động
3. **Webhook** - Cập nhật trạng thái realtime

### Tạo API endpoint trên website (tùy chọn)

```javascript
// api/bills.js
app.post('/api/bills/verify', (req, res) => {
  const { userId, deviceCode } = req.body;
  // Kiểm tra trong database bot
  // Trả về trạng thái đơn
});
```

## 🔐 Bảo Mật

- ✅ Chỉ admin được phê duyệt đơn
- ✅ User chỉ xem được đơn của mình
- ✅ Bill được lưu local, không upload lên cloud
- ✅ Token bot được lưu trong `.env` (không commit)

## 🛠️ Troubleshooting

### Bot không phản hồi
- Kiểm tra `BOT_TOKEN` trong `.env`
- Kiểm tra kết nối internet
- Xem log lỗi trong console

### Không nhận được thông báo admin
- Kiểm tra `ADMIN_IDS` trong `.env`
- Đảm bảo admin đã `/start` bot trước

### Lỗi lưu ảnh
- Kiểm tra quyền ghi thư mục `./bills`
- Kiểm tra dung lượng ổ cứng

## 📝 TODO / Tính năng tương lai

- [ ] Webhook mode cho production
- [ ] Tích hợp Google Drive API tự động
- [ ] Export thống kê Excel
- [ ] Multi-language support
- [ ] Rate limiting
- [ ] Payment gateway integration

## 👥 Đội Ngũ

- [@lcnguy06](https://t.me/lcnguy06) - Project Lead
- [@Usagi79](https://t.me/Usagi79) - Developer

## 📞 Liên Hệ & Hỗ Trợ

- 📢 Channel: [@hypermodupdate](https://t.me/hypermodupdate)
- 💬 Chat Group: [@HuperUltraRateChat](https://t.me/HuperUltraRateChat)
- 🌐 Website: [HyperUR](https://your-site.com)

## 📄 License

MIT License - © 2026 HyperUR Team
