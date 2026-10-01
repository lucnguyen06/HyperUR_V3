# HyperUR - HyperOS Custom ROM Portal (V3.0)

Cổng thông tin và kho tải ROM Custom Stock-based hàng đầu cho hệ sinh thái thiết bị Xiaomi, Redmi tại Việt Nam.

## 🚀 Tính Năng & Kiến Trúc

- **Pure Semantic HTML5**: Tối ưu tốc độ tải trang, chuẩn SEO, nhẹ và không phụ thuộc framework cồng kềnh.
- **Hỗ trợ 121 thiết bị**: Danh mục máy nội địa & quốc tế đầy đủ (Xiaomi, Redmi).
- **Thiết kế Titanium & Obsidian Glassmorphism**: Tone màu cao cấp, tương phản chuẩn công thái học, hỗ trợ chuyển đổi Light/Dark mode.
- **100% Vector SVG**: Biểu tượng sắc nét, loại bỏ hoàn toàn emoji không đồng bộ.
- **Dynamic Device Module (`devices.js`)**: Module JavaScript duy nhất đảm nhận tải động 121 máy, tìm kiếm tức thì theo tên/mã máy, lọc theo hãng và mở hộp thoại tải ROM chuẩn `<dialog>`.
- **Tương thích toàn diện**: Bypass Play Integrity mặc định, hoạt động 100% ứng dụng ngân hàng và eKYC sinh trắc học.
- **🤖 Telegram Bot**: Hệ thống bot Telegram tự động nhận và xử lý đăng ký ROM qua bill thanh toán.

---

## 📁 Cấu Trúc Dự Án

```text
HyperUR_V3/
├── index.html                  # Trang Chủ
├── download.html               # Kho Tải ROM (121 thiết bị)
├── firmware.html               # Thông Tin FW
├── guide.html                  # Hướng Dẫn Flash
├── serial.html                 # Đăng Ký & Tra Cứu Serial
├── styles.css                  # Design System
├── devices.js                  # Module JavaScript
├── devices/                    # 121 file JSON dữ liệu thiết bị
├── images/                     # Ảnh render thiết bị
├── telegram-bot/               # 🤖 Telegram Bot System
│   ├── bot.js                  # Bot chính
│   ├── database.js             # Quản lý database
│   ├── handlers/               # Bill, Admin, User handlers
│   ├── config.js               # Configuration
│   ├── integration.js          # Tích hợp với website
│   └── README.md               # Hướng dẫn bot
└── README.md                   # Tài liệu dự án
```

---

## 🤖 Telegram Bot - Quản Lý Đăng Ký ROM

### Tính năng Bot

**Dành cho User:**
- 📤 Gửi bill thanh toán (ảnh)
- 📱 Đăng ký thiết bị theo codename
- 🔍 Tra cứu trạng thái đơn
- 🔗 Nhận link ROM sau khi được duyệt

**Dành cho Admin:**
- 🔔 Nhận thông báo đơn mới realtime
- ✅ Duyệt/Từ chối đơn nhanh chóng
- 📋 Quản lý danh sách đơn chờ
- 📊 Xem thống kê hệ thống

### Quick Start Bot

```bash
# Di chuyển vào thư mục bot
cd telegram-bot

# Cài đặt dependencies
npm install

# Chạy setup wizard
npm run setup

# Khởi động bot
npm start
```

**Xem hướng dẫn chi tiết:** [telegram-bot/README.md](./telegram-bot/README.md)

---

## 🛠️ Chạy Website Cục Bộ

1. Sử dụng web server tĩnh:
   ```bash
   python -m http.server 8080
   ```
2. Mở trình duyệt: `http://localhost:8080/`

---

## 🔗 Tích Hợp Website & Bot

Bot tự động đồng bộ với website:

- **Serial Registration**: Đồng bộ serial đã đăng ký vào `data/registered-serials.json`
- **Device Validation**: Kiểm tra device code từ `devices_catalog.json`
- **ROM Links**: Lấy link từ `active_roms.json`
- **Statistics**: Export stats vào `data/bot-stats.json`

### Kích hoạt tích hợp

Bot tự động tìm website tại thư mục cha. Cấu trúc:

```
HyperUR_V3/
├── index.html (website)
├── devices_catalog.json
├── active_roms.json
├── data/
│   ├── registered-serials.json (tự động tạo)
│   └── bot-stats.json (tự động tạo)
└── telegram-bot/
    └── bot.js
```

---

## 👥 Đội Ngũ Phát Triển & Cộng Đồng

### Đội ngũ phát triển
- **Project Lead & Developer**: [@lcnguy06](https://t.me/lcnguy06)
- **Project Lead & Developer**: [@Usagi79](https://t.me/Usagi79)

### Hyper Ultra Rate
- 📢 **Channel**: [Channel Hyper Ultra Rate](https://t.me/hypermodupdate)
- 💬 **Chat Group**: [Chat Hyper Ultra Rate](https://t.me/HuperUltraRateChat)

---

## 📦 Deployment

### Website (Static Hosting)

Deploy lên:
- **Vercel**: `vercel --prod`
- **Netlify**: `netlify deploy --prod`
- **GitHub Pages**: Push lên `gh-pages` branch
- **Cloudflare Pages**: Connect repo

### Telegram Bot (Server)

Deploy lên:
- **VPS**: PM2 process manager
- **Heroku**: Procfile provided
- **Railway**: One-click deploy
- **Docker**: Dockerfile included

**Xem chi tiết:** [telegram-bot/ADVANCED.md](./telegram-bot/ADVANCED.md)

---

## 📚 Tài Liệu

### Website
- [README.md](./README.md) - Tài liệu chính
- [devices.js](./devices.js) - Device module documentation

### Telegram Bot
- [telegram-bot/README.md](./telegram-bot/README.md) - Hướng dẫn đầy đủ
- [telegram-bot/QUICK_START.md](./telegram-bot/QUICK_START.md) - Hướng dẫn nhanh
- [telegram-bot/ADVANCED.md](./telegram-bot/ADVANCED.md) - Tính năng nâng cao
- [telegram-bot/CONTRIBUTING.md](./telegram-bot/CONTRIBUTING.md) - Đóng góp code
- [telegram-bot/SECURITY.md](./telegram-bot/SECURITY.md) - Security policy

---

## 🔐 Bảo Mật

- Bot token và sensitive data lưu trong `.env`
- Database bill được mã hóa (optional)
- Admin access được validate
- Rate limiting cho spam protection

---

## 🤝 Đóng Góp

Contributions are welcome! Xem [CONTRIBUTING.md](./telegram-bot/CONTRIBUTING.md)

---

## 📄 Bản Quyền & Giấy Phép

© 2026 HYPERUR TEAM. Dự án mã nguồn mở phục vụ cộng đồng người dùng Xiaomi.

License: [MIT](./telegram-bot/LICENSE)

---

## 🆕 What's New in V3.0

### Website
- ✨ Redesigned UI với Titanium Glassmorphism
- 🚀 100% tối ưu performance
- 📱 121 thiết bị được hỗ trợ
- 🔍 Tìm kiếm và lọc thiết bị nâng cao

### 🤖 Telegram Bot (NEW!)
- 📤 Tự động nhận và xử lý bill
- ✅ Admin panel quản lý đơn
- 🔗 Gửi ROM link tự động
- 📊 Thống kê và analytics
- 🔄 Tích hợp hoàn chỉnh với website

---

**Phiên bản:** V3.0  
**Cập nhật:** 2026-10-01  
**Maintainers:** [@lcnguy06](https://t.me/lcnguy06) | [@Usagi79](https://t.me/Usagi79)
