# 🔍 Kiểm Tra Google Drive API - HyperUR

**Ngày:** 2026-10-03  
**Yêu cầu:** Kiểm tra xem Google Drive API (HyperUR_API) còn hoạt động không

---

## 📋 Thông Tin API Hiện Tại

### Google Drive API URL (từ config.js):
```
https://script.google.com/macros/s/AKfycbzaD5HJUbNeKUQYfRUQDzpe7p9oHijySTbnFw9Cujt2HK1PXYS87ssEY_TLqeDe2xZOeA/exec
```

### Chức năng:
- **Mục đích**: Lấy danh sách ROM từ Google Drive realtime
- **Format response**: JSON object với cấu trúc:
  ```json
  {
    "codename": {
      "roms": {
        "region": {
          "url": "https://drive.google.com/...",
          "name": "Tên file ROM",
          "size": "Dung lượng"
        }
      }
    }
  }
  ```

### Sử dụng trong:
- ✅ `download.html` - Trang tải ROM
- ✅ `json/devices.js` - Module tải danh sách thiết bị

---

## 🛠️ Cách Kiểm Tra

### Phương pháp 1: Sử dụng Test Page (Đã tạo)

1. **Mở file test trong browser:**
   ```
   test-drive-api.html
   ```

2. **Trang test sẽ tự động:**
   - Đọc URL từ `json/config.js`
   - Kết nối đến Google Apps Script
   - Hiển thị thống kê ROM
   - Cho biết API còn hoạt động không

3. **Kết quả hiển thị:**
   - ✅ Trạng thái kết nối (Success/Error)
   - 📊 Số thiết bị có ROM
   - 📊 Tổng số file ROM
   - ⏱️ Thời gian response (ms)
   - 🌍 Phân bố ROM theo region (CN, Global, EEA...)
   - 📄 Full JSON response

### Phương pháp 2: Kiểm Tra Trực Tiếp Trên Website

1. **Mở trang download:**
   ```
   https://hyperur.io.vn/download.html
   ```

2. **Mở Console (F12):**
   - Xem log: `"⚡ Đã kết nối Google Drive API thành công:"`
   - Hoặc: `"Không thể kết nối trực tiếp Google Drive API URL..."`

3. **Kiểm tra UI:**
   - ✅ Có thanh "Đồng Bộ Google Drive" phía trên danh sách
   - ✅ Hiển thị "Đã đồng bộ: X thiết bị | Y ROM"
   - ✅ Màu xanh = thành công, màu vàng = fallback local

### Phương pháp 3: Test Bằng Curl (PowerShell)

```powershell
# Test API endpoint
Invoke-WebRequest -Uri "https://script.google.com/macros/s/AKfycbzaD5HJUbNeKUQYfRUQDzpe7p9oHijySTbnFw9Cujt2HK1PXYS87ssEY_TLqeDe2xZOeA/exec" `
  -Method GET `
  -UseBasicParsing | Select-Object StatusCode, @{n='ContentLength';e={$_.Content.Length}}
```

**Kết quả mong đợi:**
- `StatusCode: 200`
- `ContentLength: > 1000` (có dữ liệu JSON)

---

## 🔧 Cách Sửa Nếu API Không Hoạt Động

### Tình huống 1: API không phản hồi (Timeout/Error)

**Nguyên nhân có thể:**
- Google Apps Script deployment đã bị xóa/disabled
- URL deployment đã thay đổi
- Script có lỗi runtime

**Cách sửa:**

1. **Mở Google Apps Script:**
   - Truy cập: https://script.google.com
   - Tìm project: "HyperUR Drive API" (hoặc tên tương tự)

2. **Kiểm tra Deployment:**
   - Click **Deploy** → **Manage deployments**
   - Kiểm tra Web app có còn active không
   - Lưu ý URL deployment

3. **Test Script:**
   - Chạy function test trong Apps Script Editor
   - Xem Log: **Execution log** để tìm lỗi

4. **Deploy lại nếu cần:**
   - **Deploy** → **New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Copy URL mới

5. **Cập nhật config.js:**
   ```javascript
   GOOGLE_DRIVE_API_URL: "URL_MỚI_VỪA_COPY"
   ```

### Tình huống 2: API trả về dữ liệu rỗng `{}`

**Nguyên nhân:**
- Google Drive folder không có ROM nào
- Script không quét được folder
- Quyền truy cập Google Drive bị thay đổi

**Cách sửa:**

1. **Kiểm tra Google Drive folder:**
   ```
   https://drive.google.com/drive/u/2/folders/1WxXT6Mx7ZdknKh_gd-dQr0Jturtkypyq
   ```
   - Đảm bảo có các folder thiết bị (marble, unicorn, etc.)
   - Mỗi folder thiết bị có subfolder region (cn, global, etc.)
   - Mỗi subfolder có file ROM (.zip, .tgz, v.v.)

2. **Kiểm tra quyền truy cập:**
   - Folder phải được share: "Anyone with the link"
   - Script phải có quyền đọc Drive

3. **Chạy lại script quét:**
   - Trong Apps Script, chạy function `doGet()` hoặc `scanDrive()`
   - Kiểm tra log xem có lỗi không

### Tình huống 3: Muốn dùng Fallback (active_roms.json)

Nếu không muốn dùng Google Apps Script API, có thể:

1. **Tắt API trong config.js:**
   ```javascript
   GOOGLE_DRIVE_API_URL: "", // Để trống
   ```

2. **Tạo file `json/active_roms.json` thủ công:**
   ```json
   {
     "marble": {
       "roms": {
         "cn": {
           "url": "https://drive.google.com/file/d/...",
           "name": "HyperUR_marble_CN_V3.0.zip",
           "size": "3.2 GB"
         },
         "global": {
           "url": "https://drive.google.com/file/d/...",
           "name": "HyperUR_marble_Global_V3.0.zip",
           "size": "3.1 GB"
         }
       }
     }
   }
   ```

3. **Website sẽ tự động fallback** đọc từ file local này

---

## 📊 Kiểm Tra Kết Quả

### ✅ API Hoạt Động Bình Thường:

**Console log:**
```
⚡ Đã kết nối Google Drive API thành công: {marble: {...}, unicorn: {...}}
```

**UI hiển thị:**
- Thanh sync màu xanh: "✓ Đã đồng bộ: 45 thiết bị | 120 ROM | Google Drive"
- Danh sách thiết bị hiển thị đầy đủ
- Click thiết bị → Dialog hiển thị link tải ROM

**Test page:**
- Status: ✅ Kết nối thành công!
- Thống kê: Hiển thị số thiết bị, ROM, response time
- JSON: Hiển thị đầy đủ dữ liệu ROM

### ⚠️ API Không Hoạt Động (Fallback):

**Console log:**
```
Không thể kết nối trực tiếp Google Drive API URL, chuyển sang đọc active_roms.json
```

**UI hiển thị:**
- Thanh sync màu vàng: "⚡ Fallback: 45 thiết bị | 120 ROM | Local JSON"
- Vẫn hiển thị danh sách thiết bị (nếu có active_roms.json)
- Hoặc "Chưa có ROM nào" nếu không có file local

**Test page:**
- Status: ❌ Lỗi kết nối hoặc timeout
- Error message chi tiết

---

## 🎯 Action Items

### Cần làm ngay:

1. **Mở `test-drive-api.html` trong browser** để kiểm tra API
   - File đã được tạo sẵn trong project root
   - Tự động test khi mở trang
   - Hiển thị kết quả chi tiết

2. **Xem kết quả:**
   - ✅ Nếu thành công → Không cần làm gì
   - ❌ Nếu lỗi → Làm theo hướng dẫn sửa ở trên

3. **Báo cáo kết quả:**
   - API còn hoạt động không?
   - Có bao nhiêu thiết bị/ROM?
   - Thời gian response bao lâu?

---

## 📝 Ghi Chú

### Cấu trúc Google Drive chuẩn:

```
📁 HyperUR ROMs (Root folder)
├── 📁 marble (Codename)
│   ├── 📁 cn
│   │   └── 📄 HyperUR_marble_CN_V3.0.zip
│   ├── 📁 global
│   │   └── 📄 HyperUR_marble_Global_V3.0.zip
│   └── 📁 eea
│       └── 📄 HyperUR_marble_EEA_V3.0.zip
├── 📁 unicorn
│   ├── 📁 cn
│   └── 📁 global
└── ... (các codename khác)
```

### Google Apps Script phải:
- Quét tất cả subfolder trong root folder
- Phát hiện codename (tên folder cấp 1)
- Phát hiện region (tên folder cấp 2)
- Lấy thông tin file ROM (name, url, size)
- Trả về JSON format chuẩn

---

## ✨ Kết Luận

**API URL hiện tại:**
```
https://script.google.com/macros/s/AKfycbzaD5HJUbNeKUQYfRUQDzpe7p9oHijySTbnFw9Cujt2HK1PXYS87ssEY_TLqeDe2xZOeA/exec
```

**Để kiểm tra:**
1. Mở `test-drive-api.html` trong browser
2. Hoặc mở `download.html` và xem Console (F12)
3. Hoặc test bằng PowerShell curl

**Nếu có vấn đề:**
- Xem log trong test page
- Check Google Apps Script deployment
- Hoặc dùng fallback với active_roms.json

---

**Created:** 2026-10-03  
**By:** HyperUR Team  
**Purpose:** Hướng dẫn kiểm tra và debug Google Drive API
