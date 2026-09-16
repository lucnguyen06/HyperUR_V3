# HƯỚNG DẪN & TÀI LIỆU TÙY CHỈNH INTRO LOADING SCREEN (WELCOME TO HYPERUR)

Tài liệu này hướng dẫn chi tiết về cấu trúc, cách thức hoạt động và các phương pháp tùy chỉnh giao diện **Màn hình Chào mừng (Intro Splash Screen)** và **Huy hiệu Chào mừng (Hero Welcome Badge)** của hệ sinh thái HyperUR V3.

---

## 1. TỔNG QUAN TÍNH NĂNG

Hệ thống Intro Loading Screen mang đậm ngôn ngữ thiết kế **HyperOS Titanium Glassmorphism & Aurora Glow**:
- **Màn hình Intro (`#hyperur-splash-screen`)**:
  - Xuất hiện trang trọng ngay khi người dùng truy cập website.
  - Hiển thị khối logo chữ **UR** phát sáng 3D với 2 vòng quỹ đạo xoay tròn điện quang.
  - Tiêu đề quét sáng kim loại neon: **`WELCOME TO HyperUR`**.
  - Thanh năng lượng (Progress Indicator) chạy mượt mà theo đường cong gia tốc `ease-out` trong **4.0s** hiển thị rõ nét, tự động mờ dần chuyển cảnh vào trang chủ.
  - Nút **Bỏ qua (Skip)** và phím tắt **`Escape`** giúp vào trang ngay lập tức nếu không muốn chờ.
- **Huy hiệu Chào mừng (`#welcome-hero-badge`)**:
  - Đặt trang nhã ở phần đầu Hero section của trang chủ.
  - Cho phép người dùng bấm vào để **xem lại (replay)** animation intro bất kỳ lúc nào.

---

## 2. CẤU TRÚC KỸ THUẬT

### 2.1. Cấu trúc HTML (trong `index.html`)

```html
<!-- Màn hình Intro Splash Screen -->
<div id="hyperur-splash-screen" class="hyperur-splash-screen" aria-hidden="true">
    <div class="splash-backdrop">
        <div class="splash-aurora-glow splash-glow-1"></div>
        <div class="splash-aurora-glow splash-glow-2"></div>
        <div class="splash-grid-mesh"></div>
    </div>
    <div class="splash-content">
        <!-- Logo UR phát sáng 3D -->
        <div class="splash-logo-container">
            <div class="splash-logo-halo"></div>
            <div class="splash-logo-core">
                <span class="splash-logo-letter">UR</span>
                <div class="splash-ring splash-ring-1"></div>
                <div class="splash-ring splash-ring-2"></div>
            </div>
        </div>
        <!-- Nội dung chữ chào đón -->
        <div class="splash-text-container">
            <div class="splash-tagline">HYPEROS OPTIMIZATION ECOSYSTEM</div>
            <h2 class="splash-title">
                <span class="splash-word-welcome">WELCOME</span>
                <span class="splash-word-to">TO</span>
                <span class="splash-brand-text">Hyper<span class="brand-accent">UR</span></span>
            </h2>
            <p class="splash-subtext">Khai phóng tiềm năng • Mượt mà tuyệt đỉnh</p>
        </div>
        <!-- Thanh tiến trình tải -->
        <div class="splash-loader-track">
            <div class="splash-loader-indicator" id="splash-loader-indicator"></div>
        </div>
        <!-- Nút bỏ qua -->
        <button id="splash-skip-btn" class="splash-skip-btn" type="button" aria-label="Bỏ qua màn hình chào">
            <span>Bỏ qua</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
    </div>
</div>
```

### 2.2. Huy hiệu Hero Badge (trong phần `#hero`)

```html
<div class="welcome-hero-badge" id="welcome-hero-badge" title="Nhấn để xem lại hiệu ứng chào mừng">
    <div class="welcome-badge-glow"></div>
    <span class="welcome-badge-icon" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
    </span>
    <span class="welcome-badge-text">
        <span class="welcome-prefix">WELCOME TO</span>
        <span class="welcome-name">HYPERUR</span>
    </span>
    <span class="welcome-badge-status">
        <span class="welcome-status-dot"></span>
        <span>STOCK-BASED CUSTOM ROM • XIAOMI / REDMI</span>
    </span>
</div>
```

---

## 3. CÁCH TÙY CHỈNH THEO Ý MUỐN

### 3.1. Thay đổi thời gian chạy animation (Duration)
Trong đoạn mã script ở cuối file `index.html`:
```javascript
const totalDuration = 3200; // Thời gian hiện tại là 3.2 giây (3200ms)
```
- Nếu muốn chạy chậm hơn nữa (ví dụ 4 giây): sửa thành `4000`.
- Nếu muốn nhanh hơn (ví dụ 2 giây): sửa thành `2000`.

### 3.2. Thay đổi văn bản hiển thị
- **Đổi chữ "WELCOME TO"**: Sửa thẻ `<span class="splash-word-welcome">WELCOME</span>`.
- **Đổi câu khẩu hiệu**: Sửa thẻ `<p class="splash-subtext">Khai phóng tiềm năng • Mượt mà tuyệt đỉnh</p>`.
- **Đổi danh vị phụ**: Sửa thẻ `<div class="splash-tagline">HYPEROS OPTIMIZATION ECOSYSTEM</div>`.

### 3.3. Cấu hình chỉ hiện 1 lần duy nhất mỗi phiên duyệt web
Mặc định hiện tại màn hình mở đầu sẽ xuất hiện khi tải trang và có thể xem lại khi bấm vào badge.
Nếu bạn muốn **chỉ xuất hiện 1 lần duy nhất khi người dùng mở web lần đầu trong phiên** (F5 các trang sau không hiện lại nữa):

Trong hàm khởi động ở cuối `index.html`, thay đổi:
```javascript
// Thay vì luôn chạy:
runIntro();

// Đổi thành kiểm tra sessionStorage:
if (!sessionStorage.getItem('hyperur_splash_viewed')) {
    runIntro();
} else {
    // Ẩn ngay nếu đã xem trong phiên này
    splash.style.display = 'none';
}
```

### 3.4. Mang Intro Screen sang các trang khác (`download.html`, `guide.html`,...)
1. Sao chép toàn bộ khối `<!-- HYPERUR WELCOME INTRO SPLASH ANIMATION -->` đặt ngay sau thẻ `<body>` của trang đó.
2. Sao chép đoạn script `<script>` điều khiển intro đặt trước thẻ đóng `</body>`.
3. File `styles.css` đã được viết chung nên sẽ tự động nhận diện và hiển thị đẹp mắt mà không cần viết lại CSS.

---

## 4. BẢNG TRA CỨU CSS TẠI `styles.css`

| Tên Lớp (Class Name) | Mục đích & Hiệu ứng |
| :--- | :--- |
| `.hyperur-splash-screen` | Khung bao toàn màn hình, nền Cosmic Aurora Gradient với độ sâu màu cực cao |
| `.splash-aurora-glow` | Vùng sáng năng lượng đổi màu mờ ảo 90px blur (`@keyframes splashAuroraPulse`) |
| `.splash-logo-core` | Hộp kính bo góc 24px đựng chữ H, đổ bóng ngọc bích 3D |
| `.splash-ring-1`, `.splash-ring-2` | 2 vòng quỹ đạo viền nét đứt quay ngược chiều nhau (`@keyframes splashSpin`) |
| `.splash-brand-text` | Chữ HyperUR phủ dải màu Aurora Neon quét sáng kim loại (`@keyframes splashTextShine`) |
| `.welcome-hero-badge` | Huy hiệu kính mờ lơ lửng trên Hero (`@keyframes welcomeBadgeFloat`) |
| `.welcome-badge-glow` | Vệt sáng quét ngang qua huy hiệu (`@keyframes welcomeShimmer`) |

---

## 5. PHÍM TẮT & TIỆN ÍCH NGƯỜI DÙNG

- **Bấm phím `Escape`**: Tắt ngay lập tức màn hình intro để vào website.
- **Bấm nút "Bỏ qua"**: Tắt mượt mà trong 0.2s.
- **Bấm vào Huy hiệu Hero**: Kích hoạt phát lại (replay) toàn bộ animation chào đón.
- **Trợ năng (Accessibility)**: Tự động tắt hoạt ảnh phức tạp khi người dùng kích hoạt chế độ giảm chuyển động (`prefers-reduced-motion: reduce`) trên hệ điều hành.
