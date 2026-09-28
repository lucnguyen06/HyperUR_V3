# 📧 Hướng Dẫn Hệ Thống Email & Tính Giá Động

## 🎯 Tổng Quan

Hệ thống mới cho phép tính giá động dựa trên số lượng thiết bị đã đăng ký với email của người dùng.

## 💰 Bảng Giá Bậc Thang

| Số Thiết Bị Đã Đăng Ký | Giá Thiết Bị Tiếp Theo | Badge Ưu Đãi |
|-------------------------|------------------------|--------------|
| 0-14 thiết bị           | **50.000đ**            | Không có     |
| 15-29 thiết bị          | **40.000đ**            | 🎁 Ưu đãi: Giảm 10k |
| 30+ thiết bị            | **35.000đ**            | 🎉 Ưu đãi VIP: Giảm 15k |

## 🔄 Cách Hoạt Động

### 1. Người dùng nhập email
- Hệ thống validate định dạng email realtime
- Sau 600ms không thay đổi → tự động check email

### 2. Kiểm tra email trong database
- Hiện tại: Sử dụng **LocalStorage** (demo)
- Production: Thay bằng **API call** đến backend

### 3. Hiển thị thông tin
- **Số thiết bị đã đăng ký** với email đó
- **Giá cho thiết bị tiếp theo** (tính theo bậc thang)
- **Badge ưu đãi** nếu đủ điều kiện (≥15 thiết bị)

### 4. Cập nhật giá trong form
- Giá hiển thị ở card "Đăng kí có Ủng hộ (Vĩnh viễn)" tự động thay đổi
- Card giá có highlight màu xanh nếu được ưu đãi

## 🧪 Test Demo

### Dữ liệu mẫu đã được thêm:
```javascript
'test@gmail.com'  → 5 thiết bị  → Giá: 50.000đ
'tho@gmail.com'   → 18 thiết bị → Giá: 40.000đ (Ưu đãi)
'sop@gmail.com'   → 35 thiết bị → Giá: 35.000đ (VIP)
```

### Cách test:
1. Mở file `serial.html` trong trình duyệt
2. Nhập email: `test@gmail.com` → Xem giá 50k
3. Nhập email: `tho@gmail.com` → Xem giá 40k + badge ưu đãi
4. Nhập email: `sop@gmail.com` → Xem giá 35k + badge VIP

## 🔧 Tích Hợp Production

### Thay LocalStorage bằng API:

```javascript
async function checkEmailAndUpdatePrice(email) {
    if (!EMAIL_REGEX.test(email)) return;

    // Show loader
    if (emailCheckLoader) emailCheckLoader.style.display = 'flex';

    try {
        // GỌI API THỰC TẾ
        const response = await fetch(`https://your-api.com/check-email?email=${encodeURIComponent(email)}`);
        const data = await response.json();
        
        const deviceCount = data.deviceCount || 0;
        
        // Calculate price for next device
        const priceInfo = calculatePrice(deviceCount);
        
        // Update UI...
        
    } catch (error) {
        console.error('API Error:', error);
    } finally {
        if (emailCheckLoader) emailCheckLoader.style.display = 'none';
    }
}
```

### Format API Response:
```json
{
    "success": true,
    "email": "user@example.com",
    "deviceCount": 18,
    "lastUpdated": "2026-09-28T01:40:00Z"
}
```

## 📝 Lưu Ý Quan Trọng

### 1. Xóa Demo Data
Trước khi deploy production, **XÓA** đoạn code này trong `serial.html`:

```javascript
// XÓA ĐOẠN NÀY TRƯỚC KHI DEPLOY
(function initDemoData() {
    const sampleData = { ... };
    localStorage.setItem(EMAIL_REG_STORAGE_KEY, JSON.stringify(sampleData));
})();
```

### 2. Bảo Mật API
- Thêm rate limiting để tránh spam check email
- Validate email ở backend
- Không expose thông tin nhạy cảm trong response

### 3. Cache
- Cache kết quả check email trong 5-10 phút
- Giảm tải cho server khi người dùng quay lại

### 4. Cập Nhật Số Lượng
Sau khi người dùng đăng ký thành công:
```javascript
// Cập nhật số lượng thiết bị cho email
function updateEmailRegistrationCount(email) {
    const registrations = getEmailRegistrations();
    const currentData = registrations[email.toLowerCase()] || { count: 0 };
    
    saveEmailRegistration(email, currentData.count + 1);
}
```

## 🎨 UI Components

### 1. Email Stats Card
- Icon thiết bị
- Số lượng đã đăng ký
- Hover effect

### 2. Price Card
- Icon tiền
- Giá cho thiết bị tiếp theo
- Badge ưu đãi (nếu có)
- Background gradient khi có ưu đãi

### 3. Loader
- SVG spinner animation
- Hiển thị khi đang check email
- Tự động ẩn sau khi có kết quả

## 📱 Responsive Design
- Desktop: 2 cột (Stats | Price)
- Mobile: 1 cột (Stack vertically)

## 🚀 Tính Năng Mở Rộng

### Gợi ý cho tương lai:
1. **Email verification** trước khi check
2. **History log** hiển thị danh sách thiết bị đã đăng ký
3. **Bulk registration** cho thợ/sốp (nhập nhiều serial cùng lúc)
4. **Loyalty program** tích điểm theo số lượng đăng ký
5. **Referral system** giới thiệu bạn bè được giảm giá

---

**Phát triển bởi:** HyperUR Team  
**Ngày cập nhật:** 28/09/2026
