# ⚡ Hướng Dẫn Cấu Hình & Hoạt Động Webhook SePay (Tự Động Kích Hoạt Serial)

Tài liệu chi tiết về cơ chế hoạt động, thiết lập SePay Webhook và quy trình tự động kích hoạt bản quyền ROM HyperUR 24/7.

---

## 1. 📌 Tổng Quan Cơ Chế Hoạt Động

Khi khách hàng thanh toán qua VietQR trên website `serial.html`:
1. Website sinh ra mã QR chứa sẵn cú pháp chuyển khoản chuẩn:
   ```text
   UR <mã_máy> <số_serial> <email>
   Ví dụ: UR marble 5A1C8D2F user@gmail.com
   ```
2. Khách chuyển khoản ➔ Tiền vào tài khoản MBBank ➔ Cổng SePay bắt giao dịch trong 1 - 3 giây.
3. SePay gửi HTTP POST Webhook đến máy chủ HyperUR:
   ```text
   https://hyperur.io.vn/api/payment-webhook.php
   ```
4. Server xác thực chữ ký bảo mật **HMAC-SHA256**, bóc tách mã Serial từ nội dung chuyển khoản, kiểm tra chống trùng lặp và tự động nâng cấp trạng thái bản quyền thành **Active (Vĩnh viễn)**.
5. Thời gian hoàn tất toàn bộ quy trình: **10 - 30 giây** kể từ khi khách bấm xác nhận trên app ngân hàng.

---

## 2. ⚙️ Cài Đặt Trên SePay Dashboard

Truy cập: [my.sepay.vn](https://my.sepay.vn/) ➔ Mục **Cài đặt Webhooks** ➔ **Tạo / Sửa Webhook**:

### Tab 1: Cơ bản
- **Kích hoạt webhook**: BẬT (Công tắc xanh).
- **Tên webhook**: `HyperUR`
- **URL nhận webhook \***:
  ```text
  https://hyperur.io.vn/api/payment-webhook.php
  ```
- **Loại giao dịch**: Chọn `Tiền vào` (`transferType: in`).
- **Định dạng dữ liệu**: Chọn `JSON (khuyến nghị)`.
- **Tự động gửi lại khi server trả lỗi**: BẬT (SePay sẽ tự retry tối đa 7 lần trong 5 giờ nếu mạng hoặc server gián đoạn).

### Tab 2: Tài khoản
- Chọn **Tất cả tài khoản** (hoặc tích chọn các tài khoản MBBank đang xoay vòng nhận tiền).

### Tab 3: Bảo mật
- Chọn phương thức: **HMAC-SHA256 (khuyến nghị)**.
- Copy chuỗi **Secret Key** (Mẫu: `whsec_AtVlWG36RT8pZFCbVn81jGfxsvr3RApX`).
- ⚠️ *Lưu ý: Chuỗi Secret Key này chỉ hiển thị đầy đủ 1 lần duy nhất, cần lưu ngay vào `api/config.php`.*

---

## 3. 🔑 Cấu Hình Trên Server (`api/config.php`)

Mở file `api/config.php` trên hosting cPanel hoặc máy chủ web:

```php
// ===== SePay Webhook Configuration =====

// 1. Secret Key HMAC-SHA256 từ SePay Dashboard:
define('SEPAY_WEBHOOK_SECRET', 'whsec_AtVlWG36RT8pZFCbVn81jGfxsvr3RApX');

// 2. TRƯỜNG HỢP DÙNG NHIỀU TÀI KHOẢN SEPAY KHÁC NHAU:
// Nếu 2 STK nằm ở 2 tài khoản SePay riêng biệt, chỉ cần phân cách các Secret bằng dấu phẩy:
// define('SEPAY_WEBHOOK_SECRET', 'whsec_KEY_TAI_KHOAN_1, whsec_KEY_TAI_KHOAN_2');

// 3. Số tiền tối thiểu để tự động kích hoạt (dưới mức này chỉ ghi log, không kích hoạt):
define('SEPAY_MIN_AMOUNT', 20000); // 20.000 VNĐ

// 4. Email mặc định nếu không đọc được email từ nội dung CK:
define('SEPAY_DEFAULT_EMAIL', 'hyperur2026@gmail.com');

// 5. (Tùy chọn) Báo tiền vào qua Telegram Admin:
define('TELEGRAM_BOT_TOKEN', 'YOUR_BOT_TOKEN');
define('TELEGRAM_ADMIN_CHAT_ID', 'YOUR_TELEGRAM_CHAT_ID');
```

---

## 4. 🛡️ Cơ Chế An Toàn & Bảo Mật 4 Lớp

File `api/payment-webhook.php` được thiết kế chuẩn an toàn tài chính:

```
[Request từ SePay]
       │
       ▼
[Lớp 1: Chống Replay] ── (Kiểm tra X-SePay-Timestamp lệch quá 5 phút? ➔ 401 Từ chối)
       │
       ▼
[Lớp 2: Xác thực HMAC] ── (Ký sha256 trên rawBody bytes gốc ➔ Sai chữ ký ➔ 401 Từ chối)
       │
       ▼
[Lớp 3: Chống Trùng Lặp] ── (Kiểm tra sepay_id trong `payment_transactions` ➔ Đã xử lý ➔ 200 Bỏ qua)
       │
       ▼
[Lớp 4: Thuật Toán Bóc Tách] ── (Chấm điểm Serial Scoring: +100 điểm đúng vị trí, +50 sau 'UR')
       │
       ▼
[KÍCH HOẠT THÀNH CÔNG] ── Cập nhật registrations + Ghi bảng serial + Tăng bộ đếm xoay QR
```

1. **Xác thực HMAC-SHA256**: Chống giả mạo request từ bên thứ ba. Kẻ xấu không có `SEPAY_WEBHOOK_SECRET` sẽ bị chặn ở cổng 401.
2. **Chống Replay Attack**: Header `X-SePay-Timestamp` nếu quá 300 giây (5 phút) sẽ bị hủy ngay.
3. **Idempotency (Chống trùng giao dịch)**: Bảng `payment_transactions` có khóa duy nhất `UNIQUE KEY (sepay_id)`. SePay gửi lặp lại 7 lần cũng chỉ kích hoạt 1 lần duy nhất, không lo trùng STT hay đúp đơn.
4. **Bóc tách Serial thông minh (Serial Scoring)**: Nằm trong file `api/_sepay-lib.php`:
   - Dù khách hàng gõ thiếu mã máy, viết hoa, viết thường, có dấu hay không dấu: thuật toán vẫn nhận diện chính xác mã Serial thiết bị.

---

## 5. 🛠️ Xử Lý Tình Huống Ngoại Lệ (Troubleshooting)

### Trường hợp 1: Khách quên ghi nội dung chuyển khoản hoặc ghi sai Serial
1. Vào phpMyAdmin mở bảng `payment_transactions`.
2. Tìm dòng giao dịch có `status = 'unmatched'`. Cột `content` sẽ hiển thị nguyên văn nội dung khách đã chuyển.
3. Sau khi đối chiếu xác nhận với khách, bạn kích hoạt nhanh bằng cách mở URL:
   ```text
   https://hyperur.io.vn/add_serial.php?serial=MÃ_SERIAL&device=TÊN_MÁY&gmail=EMAIL&time=unlimited&token=Tl29126@@@
   ```

### Trường hợp 2: Khách chuyển thiếu tiền (< 20.000đ)
- Webhook tự động ghi nhận vào `payment_transactions` với ghi chú: `Số tiền Xđ < tối thiểu 20.000đ`.
- Hệ thống gửi tin nhắn cảnh báo vào Telegram Admin để bạn liên hệ khách chuyển bổ sung.

### Trường hợp 3: Kiểm tra Webhook còn hoạt động không
Mở trực tiếp trên trình duyệt:
```text
https://hyperur.io.vn/api/payment-webhook.php
```
Kết quả trả về JSON chuẩn:
```json
{
  "success": true,
  "message": "SePay webhook endpoint is alive",
  "hmacConfigured": true,
  "apiKeyConfigured": false
}
```
Nếu `hmacConfigured: true` nghĩa là máy chủ đã sẵn sàng 100%.
