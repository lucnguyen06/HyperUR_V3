# HyperUR - Quản Trị Serial & Admin

Trang quản trị serial bản quyền ROM HyperUR. Cho phép thêm, sửa, xóa, gia hạn serial và theo dõi nhật ký hoạt động admin.

Ngoài ra còn có **Trang Quản Lý Admin** (`admin-users.html`) **chỉ dành cho Super Admin** — dùng để thêm/sửa/xóa/reset mật khẩu các tài khoản admin trong hệ thống.

---

## 📂 Cấu trúc

```text
HyperUR_V3/
├── admin/
│   ├── admin.html              # Trang quản trị serial (mọi admin)
│   ├── admin.css               # Stylesheet chung cho admin.html & admin-users.html
│   ├── admin.js                # Logic client-side cho admin.html (CRUD serial, filter, log)
│   ├── admin-users.html        # Quản trị TÀI KHOẢN ADMIN (CHỈ Super Admin)
│   ├── admin-users.css         # CSS bổ sung riêng cho admin-users.html
│   └── admin-users.js          # Logic client-side cho admin-users.html
├── add_serial.php              # Endpoint thêm serial nhanh qua URL (public)
├── api/
│   ├── _bootstrap.php          # Bootstrap chung: header JSON, CORS, session an toàn
│   ├── .htaccess               # Chặn truy cập config/log qua HTTP
│   ├── config.php              # ⚠️ Tạo từ config.example.php (KHÔNG commit)
│   ├── config.example.php      # Template cấu hình
│   ├── admin-auth.php          # Đăng nhập / đăng xuất / đổi mật khẩu (admin_users)
│   ├── admin-serials.php       # CRUD bảng `serial` (STT, Device, Serial, Gmail, Time)
│   ├── admin-logs.php          # Đọc bảng `admin_logs` (audit log)
│   ├── admin-users.php         # CRUD bảng `admin_users` — CHỈ Super Admin
│   ├── serial-register.php     # API đăng ký serial (POST)
│   ├── serial-lookup.php       # API tra cứu serial (GET)
│   ├── email-template.php      # Email HTML template
│   └── update-link.js          # Webhook ROM files (Vercel Serverless)
└── sql/
    └── schema.sql              # Schema đầy đủ: serial, admin_users, admin_logs, registrations, activity_logs
```

---

## 🚀 Cài đặt

### Bước 1: Import database

```bash
mysql -u <user> -p <dbname> < sql/schema.sql
```

Schema sẽ tạo 5 bảng: `serial`, `admin_users`, `admin_logs`, `registrations`, `activity_logs`.

### Bước 2: Tạo file cấu hình

```bash
cp api/config.example.php api/config.php
```

Mở `api/config.php` và cập nhật:

```php
define('DB_HOST', 'localhost');
define('DB_USER', 'your_db_user');
define('DB_PASS', 'your_db_password');
define('DB_NAME', 'your_db_name');
define('API_SECRET', 'chuoi-random-dai');
```

> ⚠️ `api/config.php` đã nằm trong `.gitignore` — **không bao giờ commit** file này.

### Bước 3: Tạo tài khoản Super Admin đầu tiên

Bỏ comment phần 6 trong `sql/schema.sql`, thay hash bằng hash bạn tự sinh:

```bash
php -r "echo password_hash('MatKhauCuaBan', PASSWORD_DEFAULT), PHP_EOL;"
```

### Bước 4: Truy cập

- **Bảng quản trị serial:** `https://your-domain.com/admin/admin.html` — mọi admin
- **Bảng quản trị admin:** `https://your-domain.com/admin/admin-users.html` — **chỉ Super Admin**
- **Thêm serial nhanh:** `https://your-domain.com/add_serial.php?serial=abc12345&time=unlimited`

---

## 🔐 Đăng nhập

Tài khoản nằm trong bảng `admin_users`. Mật khẩu hash bằng `password_hash($pw, PASSWORD_DEFAULT)` (bcrypt).

Phân quyền:
- `superadmin` — toàn quyền, bao gồm quản lý tài khoản admin khác
- `admin` — chỉ quản lý serial & xem log

---

## 🧩 Tính năng

### Quản lý Serial (bảng `serial`)

- Xem danh sách với phân trang (mặc định 50 dòng/trang)
- Tìm kiếm theo STT / Serial / Email / Device
- Lọc theo tên thiết bị (dropdown tự sinh từ dữ liệu)
- Lọc theo trạng thái: **Vĩnh viễn** / **Đang hiệu lực** / **Hết hạn**
- Sắp xếp theo STT / Device / Serial / Gmail / Time (nhấp vào header cột)
- **Thêm serial mới**: nhập Device / Serial / Gmail / Time
- **Sửa serial**: cập nhật Device / Gmail / Time (Serial là read-only ở UI)
- **Xóa serial** (1 hoặc nhiều)
- **Gia hạn serial**: +7/+30/+90/+180/+365 ngày hoặc set Unlimited (-1)
- **Bulk actions**: Set Unlimited hàng loạt / Xóa hàng loạt
- **Xuất CSV** (theo filter hiện tại)
- **Sao chép serial** vào clipboard khi nhấp vào ô Serial

### Dashboard thống kê

- Tổng số serial
- Số serial Vĩnh viễn (Time = "unlimited")
- Số serial đang hiệu lực
- Số serial đã hết hạn
- Số thiết bị khác nhau (codename)

### Nhật ký hoạt động (bảng `admin_logs`)

- Xem tất cả thao tác admin
- Lọc theo admin / hành động / khoảng thời gian
- Xem chi tiết `old_data` / `new_data` cho mỗi thao tác

### Tài khoản

- **Đổi mật khẩu**: yêu cầu mật khẩu cũ + mới (≥ 6 ký tự)
- **Đăng xuất**: có xác nhận

---

## 📊 Schema

### `admin_users` (đăng nhập)

```sql
id            INT UNSIGNED  PRIMARY KEY
username      VARCHAR(50)   UNIQUE
password      VARCHAR(255)  -- bcrypt hash
full_name     VARCHAR(100)
role          ENUM('superadmin','admin')
active        TINYINT(1)
created_at    DATETIME
last_login    DATETIME
```

### `serial` (bảng chính)

```sql
STT           INT           -- mã số hiển thị
Device        VARCHAR(50)   -- "Xiaomi 14 - HOUJI"
Serial        VARCHAR(50)   -- "a8c19d2f"
Gmail         VARCHAR(100)  -- "user@example.com"
Time          VARCHAR(50)   -- "unlimited" | "ddmmyyyy" | "YYYY-MM-DD"
```

### `admin_logs` (audit)

Mỗi thao tác CRUD đều được tự động ghi lại với IP, mô tả, `old_data`, `new_data`.

---

## 🔌 API Endpoints

### `api/admin-auth.php`

| Method | Action | Body |
|--------|--------|------|
| POST | `login` | `{username, password}` |
| POST | `logout` | — |
| GET | `check` | — |
| POST | `change_password` | `{old_password, new_password}` |

### `api/admin-serials.php`

| Method | Action | Ghi chú |
|--------|--------|---------|
| GET | `list` | `search, device, status, sort_by, sort_dir, page, per_page` |
| GET | `get&stt=NN` | — |
| GET | `stats` | dashboard |
| GET | `devices` | danh sách codename |
| POST | `add` | `{device, serial, gmail, time}` |
| POST | `update` | `{stt, device, serial, gmail, time}` |
| POST | `delete` | `{stt}` |
| POST | `bulk_delete` | `{stts:[...]}` |
| POST | `renew` | `{stt, days}` (days = -1 → unlimited) |
| POST | `bulk_unlimited` | `{stts:[...]}` |
| GET | `export` | CSV download |

### `api/admin-logs.php`

| Method | Action | Ghi chú |
|--------|--------|---------|
| GET | `list` | `search, username, log_action, from, to, page, per_page` |
| GET | `facets` | distinct usernames / actions / tables |

### `api/admin-users.php` (CHỈ Super Admin)

| Method | Action | Ghi chú |
|--------|--------|---------|
| GET | `list` | `search, role, active, page, per_page` |
| GET | `stats` | — |
| GET | `get&id=NN` | — |
| GET | `activity&id=NN` | 30 log gần nhất của admin đó |
| POST | `add` | `{username, password, full_name?, role?}` |
| POST | `update` | `{id, full_name?, role?, active?}` |
| POST | `delete` | `{id}` |
| POST | `reset_password` | `{id, new_password}` (≥ 6 ký tự) |
| POST | `toggle_active` | `{id}` |

Mọi thao tác trên `admin-users.php` đều yêu cầu `role = 'superadmin'`. Nếu không phải superadmin sẽ trả về HTTP 403.

### `add_serial.php` (public — xem mục Bảo mật)

```text
GET  /add_serial.php?serial=XXXXX[&device=YYY&gmail=ZZZ&time=unlimited][&format=json][&token=SECRET]
POST /add_serial.php  (tương tự, an toàn hơn vì serial nằm trong body)
```

- Validate serial: `[A-Za-z0-9]{4,32}`
- Kiểm tra trùng case-insensitive → trả `409` nếu đã tồn tại
- Tự cấp `STT = MAX(STT) + 1` (tự nhảy qua khoảng trống)
- Ghi `admin_logs` với `admin_id = 0`, `username = '0'`, `action = 'add_serial_auto'`

---

## 🛡️ Quản lý Admin (`admin/admin-users.html`)

Trang này **chỉ dành cho Super Admin** dùng để quản lý tài khoản admin trong bảng `admin_users`. Mọi thao tác đều có audit log với action `admin_add`, `admin_update`, `admin_delete`, `admin_reset_password`, `admin_toggle_active`.

### Tính năng

- Dashboard: tổng admin / superadmin / admin thường / đang hoạt động / đang khoá / online hôm nay
- **Danh sách admin** với filter theo username/ID/họ tên, role, trạng thái
- **Thêm admin mới**: `username`, `password` (≥ 6 ký tự), `full_name`, `role`
- **Sửa admin**: cập nhật `full_name`, `role`, `active` (username read-only)
- **Reset mật khẩu**: superadmin đặt mật khẩu mới cho bất kỳ ai
- **Khoá / mở khoá** tài khoản (toggle active)
- **Xoá vĩnh viễn** (không thể xoá chính mình, không thể xoá superadmin cuối cùng đang hoạt động)
- Tab **Hoạt động**: chọn 1 admin → xem 30 log gần nhất của admin đó

### An toàn bắt buộc (server-side)

- ✅ Không thể tự xoá chính mình (`Cannot delete own account`)
- ✅ Không thể hạ quyền / khoá / xoá **Super Admin cuối cùng** còn hoạt động
- ✅ Username chỉ chấp nhận `[a-z0-9._-]{3,50}`, kiểm tra trùng (case-insensitive)
- ✅ Mật khẩu ≥ 6 ký tự, hash bằng `password_hash(..., PASSWORD_DEFAULT)` (bcrypt)
- ✅ Mọi thao tác ghi vào `admin_logs` (IP, user-agent, `old_data`, `new_data`)

---

## 🔒 Bảo mật

### Những gì đã được gia cố trong bản này

- **Session an toàn** (`api/_bootstrap.php`): cookie `HttpOnly` + `SameSite=Lax` + `Secure` khi HTTPS, `session.use_strict_mode`, tên session riêng (`HYPERUR_ADMIN_SESSID`), timeout phiên 8 giờ.
- **CORS chặt**: các endpoint admin **không còn** trả `Access-Control-Allow-Origin: *` kèm `Credentials: true` (cấu hình cũ vừa sai spec vừa cho phép cross-site đọc dữ liệu). Giờ chỉ cho phép same-origin, hoặc origin khai báo trong `ADMIN_ALLOWED_ORIGINS`.
- **Chặn truy cập file nhạy cảm** qua `api/.htaccess`: `config.php`, `config.example.php`, `_bootstrap.php`, `email-template.php`, `*.log`.
- **`serial-register.php`**: bỏ lỗi logic auto-activate — trước đây chỉ cần plan chứa chuỗi `"36"` là được kích hoạt miễn phí; giờ so khớp chính xác theo whitelist. Thêm validate `serial` / `codename` / độ dài các trường.
- **`email-template.php`**: escape toàn bộ giá trị user nhập (`htmlspecialchars`) trước khi chèn vào HTML email → chặn HTML injection.
- **`add_serial.php`**: hỗ trợ `ADD_SERIAL_TOKEN` và `ADD_SERIAL_IP_ALLOW` (whitelist CIDR) trong `config.php`.

### Khuyến nghị thêm

1. **Bật `ADD_SERIAL_TOKEN`** trong `api/config.php` — endpoint `add_serial.php` mặc định public.
2. **Đặt `ADMIN_ALLOWED_ORIGINS`** nếu admin panel chạy khác domain.
3. **Bổ sung CSRF token** cho các form admin (bản hiện tại chưa có).
4. Chạy HTTPS bắt buộc cho toàn site.

### Đã có sẵn

- Prepared statements ở toàn bộ query có tham số
- `change_password` yêu cầu mật khẩu cũ (không chỉ dựa vào session)
- `bulk_delete` giới hạn tối đa 1000 STT/lần
- Audit log tự động ghi IP, user-agent, `old_data`, `new_data`

---

## ⚠️ Lưu ý quan trọng

1. Bảng `serial` **KHÔNG có PRIMARY KEY tự động**. `STT` là số nguyên hiển thị; khi xóa sẽ tạo khoảng trống. Khi thêm mới, hệ thống tự tìm STT trống lớn nhất + 1.
2. Không có ràng buộc UNIQUE trên `Serial`. Hệ thống cảnh báo nếu trùng (case-insensitive) khi thêm/sửa.
3. Cột `Time` lưu cả `"unlimited"` lẫn ngày (legacy: `ddmmyyyy`, mới: `YYYY-MM-DD`). Hệ thống tự chuẩn hoá.
4. Trang admin **chưa có CSRF token** — nếu cần bảo mật cao hơn, bổ sung token trong form và header.

---

## 🌗 Theme

Hỗ trợ 2 chế độ Sáng / Tối, đồng bộ với `localStorage('hyperur-theme')` của các trang khác trong site.
