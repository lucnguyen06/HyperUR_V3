# HyperUR - HyperOS Custom ROM Portal (V3.0)

Cổng thông tin và kho tải ROM Custom Stock-based hàng đầu cho hệ sinh thái thiết bị Xiaomi, Redmi tại Việt Nam.

## 🚀 Tính Năng & Kiến Trúc

- **Pure Semantic HTML5**: Tối ưu tốc độ tải trang, chuẩn SEO, nhẹ và không phụ thuộc framework cồng kềnh.
- **Hỗ trợ 121 thiết bị**: Danh mục máy nội địa & quốc tế đầy đủ (Xiaomi, Redmi).
- **Thiết kế Titanium & Obsidian Glassmorphism**: Tone màu cao cấp, tương phản chuẩn công thái học, hỗ trợ chuyển đổi Light/Dark mode.
- **100% Vector SVG**: Biểu tượng sắc nét, loại bỏ hoàn toàn emoji không đồng bộ.
- **Dynamic Device Module (`devices.js`)**: Module JavaScript duy nhất đảm nhận tải động 121 máy, tìm kiếm tức thì theo tên/mã máy, lọc theo hãng và mở hộp thoại tải ROM chuẩn `<dialog>`.
- **Tương thích toàn diện**: Bypass Play Integrity mặc định, hoạt động 100% ứng dụng ngân hàng và eKYC sinh trắc học.

---

## 📁 Cấu Trúc Dự Án Tối Giản (Clean Architecture)

```text
UR_V3/
├── index.html                  # Trang Chủ (Giới thiệu, Banner Hero, 3 Thẻ điều hướng)
├── download.html               # Kho Tải ROM (121 thiết bị, Tìm kiếm, Lọc hãng, Popup tải)
├── features.html               # Tính Năng (Công nghệ Kernel, Camera Leica, Play Integrity)
├── guide.html                  # Hướng Dẫn Flash (Quy trình 4 bước, Fastboot/Recovery, Lưu ý)
├── styles.css                  # Toàn bộ Design System (Titanium Glassmorphism)
├── devices.js                  # Module JavaScript duy nhất (Tải & Lọc thiết bị, Modal)
├── README.md                   # Tài liệu dự án
├── devices/                    # 121 file JSON dữ liệu thiết bị
│   ├── manifest.json           # Danh mục tổng hợp mã máy
│   └── ... (các mã thiết bị)
└── images/                     # Ảnh render thiết bị theo chuẩn mã máy
```

---

## 🛠️ Chạy Thử Cục Bộ

1. Sử dụng bất kỳ web server tĩnh nào (ví dụ: Python, Live Server, Nginx):
   ```bash
   python -m http.server 8080
   ```
2. Mở trình duyệt tại: `http://localhost:8080/`

---

## 👥 Đội Ngũ Phát Triển & Cộng Đồng

### Đội ngũ phát triển
- **Project Lead & Developer**: [@lcnguy06](https://t.me/lcnguy06)
- **Project Lead & Developer**: [@Usagi79](https://t.me/Usagi79)

### Hyper Ultra Rate
- 📢 **Channel**: [Channel Hyper Ultra Rate](https://t.me/hypermodupdate)
- 💬 **Chat Group**: [Chat Hyper Ultra Rate](https://t.me/HuperUltraRateChat)

---

## 📄 Bản Quyền & Giấy Phép

© 2026 HYPERUR TEAM. Dự án mã nguồn mở phục vụ cộng đồng người dùng Xiaomi.
