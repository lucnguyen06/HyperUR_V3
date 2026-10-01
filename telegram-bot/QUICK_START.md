# 🚀 Quick Start Guide - HyperUR Telegram Bot

Hướng dẫn nhanh để chạy bot trong 5 phút!

## ⚡ Cách Nhanh Nhất

### Bước 1: Cài đặt dependencies

```bash
cd C:\Users\Administrator\Documents\GitHub\HyperUR_V3\telegram-bot
npm install
```

### Bước 2: Chạy setup wizard

```bash
npm run setup
```

Setup wizard sẽ hỏi bạn:
1. **Bot Token** - Lấy từ [@BotFather](https://t.me/BotFather)
2. **Admin ID** - Lấy từ [@userinfobot](https://t.me/userinfobot)
3. **Website URL** - URL của HyperUR (hoặc để mặc định)

### Bước 3: Chạy bot

```bash
npm start
```

**Xong!** Bot đã chạy! 🎉

---

## 📖 Hướng dẫn chi tiết từng bước

### 1. Lấy Bot Token

1. Mở Telegram và tìm [@BotFather](https://t.me/BotFather)
2. Gửi lệnh `/newbot`
3. Đặt tên bot: `HyperUR Bill Bot`
4. Đặt username: `hyperur_bill_bot` (hoặc tên khác có sẵn)
5. Copy token (dạng: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Lấy Admin ID

1. Mở [@userinfobot](https://t.me/userinfobot)
2. Gửi bất kỳ tin nhắn nào
3. Bot trả về ID của bạn (dạng: `123456789`)
4. Copy ID này

### 3. Tạo file .env

**Cách 1: Dùng setup wizard (khuyến nghị)**

```bash
npm run setup
```

**Cách 2: Tạo thủ công**

```bash
cp .env.example .env
```

Mở file `.env` và điền thông tin:

```env
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
ADMIN_IDS=123456789
HYPERUR_WEBSITE_URL=https://your-site.com
```

### 4. Chạy bot

**Development mode (auto-reload):**

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

---

## 🧪 Kiểm tra bot hoạt động

### 1. Gửi `/start` cho bot

Mở Telegram, tìm bot của bạn và gửi `/start`

Bot phản hồi:
```
🚀 Chào mừng bạn đến với HyperUR Bot!
...
```

✅ Bot đang chạy!

### 2. Test gửi bill (User)

1. Gửi 1 ảnh bất kỳ cho bot
2. Bot hỏi device code
3. Nhập `houji` (hoặc code bất kỳ)
4. Xác nhận gửi

✅ User flow hoạt động!

### 3. Test admin panel

Từ tài khoản admin:

```
/admin
```

Bot hiển thị admin panel với thống kê.

✅ Admin flow hoạt động!

---

## ❓ Troubleshooting

### Bot không phản hồi

**Nguyên nhân:** Token sai hoặc bot chưa được start

**Giải pháp:**
1. Kiểm tra `BOT_TOKEN` trong `.env`
2. Đảm bảo đã `/start` bot trước
3. Kiểm tra console có lỗi không

### Không nhận được thông báo admin

**Nguyên nhân:** `ADMIN_IDS` sai hoặc admin chưa `/start` bot

**Giải pháp:**
1. Kiểm tra `ADMIN_IDS` trong `.env`
2. Admin phải `/start` bot trước
3. Gửi tin nhắn cho [@userinfobot](https://t.me/userinfobot) để confirm ID

### Lỗi "Cannot find module"

**Nguyên nhân:** Chưa cài dependencies

**Giải pháp:**
```bash
npm install
```

### Lỗi "ENOENT: no such file or directory"

**Nguyên nhân:** Thư mục chưa được tạo

**Giải pháp:**
```bash
mkdir bills database
```

---

## 📱 Test Scenario Hoàn Chỉnh

### Scenario 1: User gửi bill

1. **User** gửi ảnh bill
2. **Bot** hỏi device code
3. **User** nhập `houji`
4. **Bot** xác nhận đã nhận
5. **Admin** nhận thông báo có đơn mới
6. **Admin** bấm "✅ Duyệt"
7. **Admin** gửi link ROM (hoặc "ok")
8. **User** nhận thông báo đơn đã được duyệt + link ROM

### Scenario 2: User tra cứu đơn

1. **User** gửi `/mybills`
2. **Bot** hiển thị danh sách đơn
3. **User** bấm vào đơn cụ thể
4. **Bot** hiển thị chi tiết đơn + bill ảnh

### Scenario 3: Admin quản lý

1. **Admin** gửi `/admin`
2. **Bot** hiển thị panel với stats
3. **Admin** gửi `/pending`
4. **Bot** hiển thị tất cả đơn chờ duyệt
5. **Admin** duyệt/từ chối từng đơn

---

## 🎯 Next Steps

Sau khi bot chạy thành công:

1. **Tùy chỉnh messages** - Sửa text trong handlers
2. **Thêm device validation** - Tích hợp với website
3. **Setup cron jobs** - Auto sync với website
4. **Deploy lên server** - VPS, Heroku, Railway, etc.

---

## 📚 Tài liệu đầy đủ

- [README.md](./README.md) - Hướng dẫn chi tiết
- [ADVANCED.md](./ADVANCED.md) - Tính năng nâng cao
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Đóng góp code

---

## 💬 Cần hỗ trợ?

- 📢 Channel: [@hypermodupdate](https://t.me/hypermodupdate)
- 💬 Chat Group: [@HuperUltraRateChat](https://t.me/HuperUltraRateChat)
- 👤 Direct: [@lcnguy06](https://t.me/lcnguy06) | [@Usagi79](https://t.me/Usagi79)

---

Chúc bạn triển khai bot thành công! 🚀
