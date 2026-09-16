/**
 * HyperUR V3 - Configuration
 * Cấu hình liên kết Google Drive API và chế độ hiển thị danh sách thiết bị
 */

window.HYPERUR_CONFIG = {
  // 1. Google Apps Script Web App URL (Realtime API)
  GOOGLE_DRIVE_API_URL: "https://script.google.com/macros/s/AKfycbxKY0UfmpiB3famqdN7GkYeIVU002SVQDeIA0MGOrIL3MKj6MzFgE3OYNiqMhRET6VI/exec",

  // 2. Chế độ lọc thiết bị theo Google Drive:
  // true  -> CHỈ HIỂN THỊ những thiết bị ĐANG CÓ ROM trên Google Drive (theo yêu cầu của bạn).
  // false -> Hiển thị tất cả 121 thiết bị (thiết bị chưa có ROM sẽ hiển thị "Chưa có bản tải").
  ONLY_SHOW_ACTIVE_ROMS: true,

  // 3. Cho phép người dùng bấm nút chuyển đổi qua lại giữa "Chỉ máy có ROM" và "Tất cả máy"
  ENABLE_VIEW_TOGGLE: true,

  // 4. Thời gian lưu bộ nhớ cache (phút) để tăng tốc độ tải trang
  CACHE_DURATION_MINUTES: 10,

  // 5. Link thư mục Google Drive chính (Link Tổng)
  DRIVE_ROOT_FOLDER_URL: "https://drive.google.com/drive/u/2/folders/1WxXT6Mx7ZdknKh_gd-dQr0Jturtkypyq",

  // 6. Tên miền chính thức của website
  SITE_DOMAIN: "https://hyperur.io.vn",

  // 7. Cấu hình Web App Google Apps Script nhận form Đăng ký Serial (doPost)
  SERIAL_REGISTER_API_URL: "https://script.google.com/macros/s/AKfycbwjfPzSOkWstEAAZw4D6TqzS6D9dshHRHBkyW_mip7ledWRjSZSCt_Z6MmVfA-Lu8V-/exec"
};

