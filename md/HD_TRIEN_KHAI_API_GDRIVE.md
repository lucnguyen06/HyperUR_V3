# 🚀 Hướng Dẫn Chi Tiết Triển Khai API Google Drive Cho HyperUR (hyperur.io.vn)

Tài liệu này cấu hình theo cấu trúc Google Drive **mới** (mỗi thư mục con cấp 1 là một codename):
- **Link Tổng (Root `HYPERUR`)**: [https://drive.google.com/drive/u/2/folders/1hxTHOs5ua7Q5uWs236hGW_6X7jxaifKq](https://drive.google.com/drive/u/2/folders/1hxTHOs5ua7Q5uWs236hGW_6X7jxaifKq) (`1hxTHOs5ua7Q5uWs236hGW_6X7jxaifKq`)
- **Tên miền website**: [https://hyperur.io.vn](https://hyperur.io.vn)
- **Apps Script Web App (mới nhất, 2026-10-14 01:40)**: `https://script.google.com/macros/s/AKfycbyKp3hC87kGB_hpmNXoyDVrQGfqcIvnHhdWgHG124EajwJCguhIkxIJbjuR4ONij5oG/exec`
- **Apps Script Deployment ID**: `AKfycbyKp3hC87kGB_hpmNXoyDVrQGfqcIvnHhdWgHG124EajwJCguhIkxIJbjuR4ONij5oG`
- **Cache**: 600 giây (10 phút) — đã debug xong, tăng từ 60s lên 600s để giảm tải Apps Script
- **Phiên bản code hiện tại**: `v4-folder-link` (hỗ trợ hiển thị folder rỗng + mở link Drive trực tiếp)

### Cấu trúc thư mục

```text
HYPERUR  (link tổng)
├── fuxi/            -> file ROM của fuxi (Xiaomi 13)
├── ishtar/          -> file ROM của ishtar (Xiaomi 13 Ultra)
└── nuwa/            -> file ROM của nuwa (Xiaomi 13 Pro)
    └── Global/      -> (tùy chọn) thư mục con theo vùng: CN / Global / EEA / RU / IN ...
```

Mỗi thư mục con cấp 1 là **một codename**. Thư mục con cấp 2 (nếu có) được hiểu là **vùng** và website sẽ tách thành từng nhánh tải riêng.

---

## 🎯 Cơ Chế Hoạt Động (Mô Hình Động 100%)

1. Bạn tạo thư mục theo **đúng codename** trong link tổng, rồi **kéo thả file ROM** vào đó.
2. Google Apps Script quét đệ quy, đọc codename từ **tên thư mục**, lấy phiên bản HyperOS (OS3.0, OS2.0...), Android (16.0, 15.0...), vùng và tạo link tải trực tiếp.
3. Website [hyperur.io.vn](https://hyperur.io.vn) **chỉ hiển thị codename nào đang có file ROM**. Codename có thư mục nhưng **chưa có file ROM thì không hiện phần tải**.
4. Khi bạn tải ROM máy mới lên Drive ➔ Website tự xuất hiện máy đó mà bạn **không cần đụng vào code**. Codename chưa có trong `devices_catalog.json` vẫn hiển thị (lấy chính codename làm tên).

---

## 📁 Định Dạng File ROM Chuẩn Của Bạn Trên Drive

Codename lấy từ **tên thư mục**, nên tên file chỉ cần chứa chuỗi phiên bản `OS...`. Định dạng khuyến nghị:

```text
UR_[codename]_[osBuild]_[androidVer].7z
```
*Ví dụ đặt file theo cấu trúc mới:*

```text
HYPERUR/
├── ishtar/
│   └── UR_ishtar_OS3.0.307.0.WMACNXM_16.7z      -> Xiaomi 13 Ultra • OS3.0 • Android 16 • vùng CN
├── fuxi/
│   ├── UR_fuxi_OS3.0.300.0.WNCCNXM_16.7z        -> vùng CN (suy ra từ mã build ...CNXM)
│   └── Global/
│       └── UR_fuxi_OS3.0.300.0.WNCMIXM_16.7z    -> vùng Global (suy ra từ tên thư mục)
└── nuwa/
    └── UR_nuwa_OS2.0.200.0.VNNCNXM_15.7z        -> OS2.0 • Android 15
```

Cách hệ thống đọc dữ liệu:
- **Codename** ➔ lấy từ **tên thư mục** (`ishtar`, `fuxi`, `nuwa`), không phụ thuộc tên file.
- **Phiên bản / Android** ➔ lấy từ chuỗi `OS...` trong tên file (hoặc suy ra từ chữ cái đầu mã build: `U`=14, `V`=15, `W`=16).
- **Vùng** ➔ ưu tiên tên thư mục con (`CN`, `Global`, `EEA`, `RU`, `IN`, `ID`, `TR`, `TW`, `JP`, `KR`); nếu không có thì suy ra từ mã build (`CNXM`➔CN, `MIXM`➔Global, `EUXM`➔EEA...).

*(Hỗ trợ cả `.7z`, `.zip`, `.tar`, `.tgz`, `.gz`, `.rar`).*

---

## 🐛 Endpoint Debug (dùng khi cần kiểm tra)

Web App hỗ trợ query string để debug nhanh. **Bỏ qua nếu mọi thứ chạy đúng.**

| Endpoint | Mục đích |
|---|---|
| `…/exec?version=1` | Trả về `{apiVersion, cacheSeconds, deployedAt}` — xác nhận code mới đã deploy chưa |
| `…/exec?refresh=1` | Xóa cache, quét lại Drive ngay lập tức |
| `…/exec?debug=1` | Summary rút gọn: `[{codename, romCount}]` |
| `…/exec?debug=raw` | Toàn bộ JSON `buildActiveRoms()` không qua cache |
| `…/exec?debug=tree` | Cây folder Drive đầy đủ (tên folder + file + size) |

Nếu endpoint `?debug=tree` trả về `codenames: {}` (rỗng) → folder `HYPERUR` không có thư mục con cấp 1 nào, hoặc tên thư mục không khớp regex codename.

---

## ⚡ Các Bước Kích Hoạt Realtime API Trên Google Apps Script (Trong 3 Phút)

File [google-apps-script/DriveApi.gs](../google-apps-script/DriveApi.gs) đã điền sẵn ID thư mục gốc mới (`ROOT_FOLDER_ID`). Bạn chỉ cần làm theo các bước sau:

> ⚠️ Phải tạo **dự án Apps Script riêng** cho Drive API. Không dán chung vào dự án Đăng ký Serial (`Code.gs`) vì cả hai đều có hàm `doGet` nên sẽ xung đột.

### Bước 1: Tạo dự án Apps Script
1. Truy cập: [https://script.google.com/](https://script.google.com/)
2. Bấm **Dự án mới (New project)**.
3. Đặt tên dự án: `HyperUR Drive API`.
4. Mở file [google-apps-script/DriveApi.gs](../google-apps-script/DriveApi.gs), copy toàn bộ nội dung và dán vào trình duyệt.

### Bước 2: Chạy thử nghiệm
1. Ở thanh công cụ bên trên, chọn hàm **`testScanFolder`**.
2. Nhấn nút **Chạy (Run)**.
3. Cấp quyền truy cập Google Drive cho script (chọn *Nâng cao ➔ Đi tới HyperUR Drive API*).
4. Xem trong *Execution log*: Script in ra từng codename kèm tên file, vùng và dung lượng.

### Bước 3: Triển khai thành Web App
1. Ở góc trên bên phải, bấm **Triển khai (Deploy)** ➔ chọn **Tùy chọn triển khai mới (New deployment)**.
2. Bấm vào icon bánh răng ⚙️ ➔ Chọn **Ứng dụng web (Web app)**.
3. Cài đặt:
   - **Mô tả**: `HyperUR Live API`
   - **Thực thi dưới dạng**: `Tôi (me@gmail.com)`
   - **Ai có quyền truy cập**: **Bất kỳ ai (Anyone)** *(Bắt buộc chọn cái này để website hyperur.io.vn có thể đọc dữ liệu mà không cần login)*.
4. Bấm **Triển khai (Deploy)**.
5. Copy đường link tại mục **URL ứng dụng web** (dạng `https://script.google.com/macros/s/AKfycb.../exec`).

### Bước 4: Dán URL vào Website
Mở file [json/config.js](../json/config.js), dán URL vừa copy vào `GOOGLE_DRIVE_API_URL`:
```javascript
window.HYPERUR_CONFIG = {
  GOOGLE_DRIVE_API_URL: "https://script.google.com/macros/s/AKfycb.../exec",
  ...
};
```

---

## ⏱️ Cài Đặt Trình Kích Hoạt Tự Động Quét (Mỗi 5 Phút)

1. Trong màn hình Google Apps Script, bấm biểu tượng **Đồng hồ (Triggers)** ở menu bên trái.
2. Bấm **Thêm trình kích hoạt (Add Trigger)** ở góc dưới bên phải.
3. Chọn các giá trị:
   - Hàm chạy: `refreshRomCache`
   - Nguồn sự kiện: `Được điều khiển theo thời gian (Time-driven)`
   - Loại trigger: `Bộ đếm thời gian theo phút (Minutes timer)`
   - Khoảng thời gian: `Mỗi 5 phút (Every 5 minutes)`
4. Bấm **Lưu (Save)**.

---

## 🌟 Trạng Thái Hiện Tại Của Link Tổng Mới
- Thư mục gốc `HYPERUR` hiện có **3 codename**: `fuxi`, `ishtar`, `nuwa`.
- Cả 3 thư mục **đang trống** ➔ website sẽ chưa hiện phần tải nào cho đến khi bạn kéo file ROM vào.
- Kiểm tra nhanh bất cứ lúc nào: `node scripts/scan_new_root.js` (in ra từng codename kèm số file ROM).
- Mở [download.html](../download.html) để xem danh sách máy có ROM.
