/**
 * HyperUR V3 - Configuration
 * Cấu hình liên kết Google Drive API và chế độ hiển thị danh sách thiết bị
 */

window.HYPERUR_CONFIG = {
  // 1. Google Apps Script Web App URL (Realtime API)
  // Triển khai mới 2026-10-14 01:40 (đã có endpoint debug + 60s cache).
  // Để trống -> website đọc file dự phòng json/active_roms.json (sinh bằng: node scripts/scan_new_root.js --write).
  GOOGLE_DRIVE_API_URL: "https://script.google.com/macros/s/AKfycbyKp3hC87kGB_hpmNXoyDVrQGfqcIvnHhdWgHG124EajwJCguhIkxIJbjuR4ONij5oG/exec",

  // 2. Chế độ lọc thiết bị theo Google Drive:
  // true  -> CHỈ HIỂN THỊ những thiết bị ĐANG CÓ ROM trên Google Drive (theo yêu cầu của bạn).
  // false -> Hiển thị toàn bộ thiết bị trong devices_catalog.json (máy chưa có ROM hiện "Chưa có bản tải").
  ONLY_SHOW_ACTIVE_ROMS: true,

  // 3. Cho phép người dùng bấm nút chuyển đổi qua lại giữa "Chỉ máy có ROM" và "Tất cả máy"
  ENABLE_VIEW_TOGGLE: true,

  // 4. Chu kỳ tự động quét lại Google Drive (phút).
  // Sau khi trang tải xong, hệ thống sẽ tự gọi lại loadDevices() mỗi X phút
  // để cập nhật ROM mới mà người dùng không cần F5.
  CACHE_DURATION_MINUTES: 15,

  // 5. Link thư mục Google Drive chính (Link Tổng)
  // Mỗi thư mục con cấp 1 trong link này là một codename (fuxi, ishtar, nuwa...).
  // Codename nào có file ROM thì website mới hiển thị phần tải của máy đó.
  DRIVE_ROOT_FOLDER_URL: "https://drive.google.com/drive/u/2/folders/1hxTHOs5ua7Q5uWs236hGW_6X7jxaifKq",

  // 6. Tên miền chính thức của website
  SITE_DOMAIN: "https://hyperur.io.vn",

  // 7. Cấu hình Web App Google Apps Script nhận form Đăng ký Serial (doPost)
  SERIAL_REGISTER_API_URL: "https://script.google.com/macros/s/AKfycbx1RfaT5NevKzW1A2F3oZUcODX5qSVSoumLEKMya1753zNlb9OU4zT4pMElWph6jKmRLg/exec",

  // 8. Cấu hình Web App Google Apps Script tra cứu Serial (doGet)
  SERIAL_LOOKUP_API_URL: "https://script.google.com/macros/s/AKfycbx1RfaT5NevKzW1A2F3oZUcODX5qSVSoumLEKMya1753zNlb9OU4zT4pMElWph6jKmRLg/exec"
};

