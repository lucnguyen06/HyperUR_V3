/**
 * HyperUR V3 - Google Apps Script
 * Xử lý đăng ký Serial và tự động gửi email xác nhận
 * 
 * Deploy: Web App
 * Execute as: Me (your account)
 * Who has access: Anyone
 */

// ===== CẤU HÌNH =====
const CONFIG = {
  SHEET_NAME: 'Registrations', // Tên sheet lưu đăng ký
  WEBSITE_URL: 'https://hyperur.io.vn', // URL website của bạn
  SUPPORT_EMAIL: 'support@hyperur.io.vn', // Email hỗ trợ (nếu có)
  TELEGRAM_CHANNEL: 'https://t.me/hypermodupdate',
  TELEGRAM_CHAT: 'https://t.me/HuperUltraRateChat'
};

// ===== MAIN FUNCTIONS =====

/**
 * Xử lý POST request từ website (Đăng ký Serial)
 */
function doPost(e) {
  try {
    // Parse dữ liệu từ website
    const data = JSON.parse(e.postData.contents);
    
    // Validate dữ liệu
    if (!data.serial || !data.codename || !data.senderEmail) {
      return createResponse(false, 'Thiếu thông tin bắt buộc');
    }
    
    // Lưu vào Google Sheets
    saveToSheet(data);
    
    // Gửi email xác nhận cho user
    sendConfirmationEmail(data);
    
    // Trả về response thành công
    return createResponse(true, 'Đăng ký thành công và email đã được gửi');
    
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return createResponse(false, 'Lỗi hệ thống: ' + error.toString());
  }
}

/**
 * Xử lý GET request (Tra cứu Serial)
 */
function doGet(e) {
  try {
    const serial = e.parameter.serial;
    
    if (!serial) {
      return createResponse(false, 'Vui lòng cung cấp số Serial');
    }
    
    // Tìm kiếm trong sheet
    const result = findSerial(serial.toUpperCase());
    
    if (result) {
      return createResponse(true, 'Tìm thấy Serial', result);
    } else {
      return createResponse(false, 'Không tìm thấy Serial này trong hệ thống');
    }
    
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return createResponse(false, 'Lỗi hệ thống: ' + error.toString());
  }
}

// ===== HELPER FUNCTIONS =====

/**
 * Lưu thông tin đăng ký vào Google Sheets
 */
function saveToSheet(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  // Tạo sheet nếu chưa có
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    // Header row
    sheet.appendRow([
      'Timestamp',
      'Serial',
      'Codename',
      'Plan',
      'Payment Method',
      'Sender Name',
      'Sender Email',
      'Transaction Code',
      'Status',
      'Activated Date',
      'Expired Date'
    ]);
    // Format header
    const headerRange = sheet.getRange(1, 1, 1, 11);
    headerRange.setBackground('#10b981');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
  }
  
  // Kiểm tra xem Serial đã tồn tại chưa
  const existingRow = findSerialRow(data.serial.toUpperCase());
  
  if (existingRow > 0) {
    // Cập nhật thông tin
    sheet.getRange(existingRow, 1, 1, 11).setValues([[
      new Date(),
      data.serial.toUpperCase(),
      data.codename.toLowerCase(),
      data.plan,
      data.paymentMethod,
      data.senderName,
      data.senderEmail.toLowerCase(),
      data.transactionCode,
      'Pending', // Giữ nguyên status cũ hoặc update
      '', // Activated Date
      '' // Expired Date
    ]]);
  } else {
    // Thêm mới
    const isFree = data.plan.includes('Active Free') || data.plan.includes('36');
    const status = isFree ? 'Active' : 'Pending';
    const activatedDate = isFree ? new Date() : '';
    const expiredDate = isFree ? new Date(Date.now() + 36 * 24 * 60 * 60 * 1000) : ''; // +36 ngày
    
    sheet.appendRow([
      new Date(),
      data.serial.toUpperCase(),
      data.codename.toLowerCase(),
      data.plan,
      data.paymentMethod,
      data.senderName,
      data.senderEmail.toLowerCase(),
      data.transactionCode,
      status,
      activatedDate,
      expiredDate
    ]);
  }
}

/**
 * Tìm Serial trong sheet
 */
function findSerial(serial) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) return null;
  
  const data = sheet.getDataRange().getValues();
  
  // Bỏ qua header row
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === serial.toUpperCase()) {
      return {
        serial: data[i][1],
        codename: data[i][2],
        plan: data[i][3],
        senderEmail: data[i][6],
        status: data[i][8],
        activatedDate: data[i][9] ? formatDate(data[i][9]) : '',
        expiredDate: data[i][10] ? formatDate(data[i][10]) : '',
        registeredDate: formatDate(data[i][0])
      };
    }
  }
  
  return null;
}

/**
 * Tìm row number của Serial
 */
function findSerialRow(serial) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) return -1;
  
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === serial.toUpperCase()) {
      return i + 1; // Row index (1-based)
    }
  }
  
  return -1;
}

/**
 * Gửi email xác nhận cho user
 */
function sendConfirmationEmail(data) {
  const isFree = data.plan.includes('Active Free') || data.plan.includes('36');
  const serial = data.serial.toUpperCase();
  const codename = data.codename.toUpperCase();
  
  const subject = `✅ Xác Nhận Đăng Ký Serial ${serial} - HyperUR`;
  
  const htmlBody = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #0F172A; }
    .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.98) 100%); border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 16px; overflow: hidden; }
    .header { padding: 32px 40px 24px; text-align: center; border-bottom: 1px solid rgba(148, 163, 184, 0.1); }
    .logo { font-size: 28px; font-weight: 800; color: #F8FAFC; margin-bottom: 8px; }
    .accent { color: #10b981; }
    .subtitle { font-size: 13px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; }
    .icon-wrapper { padding: 32px 40px 16px; text-align: center; }
    .success-icon { display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; line-height: 64px; font-size: 36px; margin-bottom: 16px; }
    .title { padding: 0 40px 16px; text-align: center; font-size: 24px; font-weight: 700; color: #F8FAFC; margin: 0; }
    .description { padding: 0 40px 32px; text-align: center; font-size: 15px; color: #CBD5E1; line-height: 1.6; margin: 0; }
    .details-box { margin: 0 40px 32px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(148, 163, 184, 0.12); border-radius: 12px; overflow: hidden; }
    .detail-row { padding: 16px 20px; border-bottom: 1px solid rgba(148, 163, 184, 0.08); }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { font-size: 13px; color: #94A3B8; margin-bottom: 4px; }
    .detail-value { font-size: 15px; color: #F8FAFC; font-weight: 600; }
    .serial-value { color: #22D3EE; font-family: 'Courier New', monospace; font-size: 16px; }
    .plan-value { color: #10b981; }
    .amount-value { color: #fbbf24; font-size: 16px; }
    .cta-wrapper { padding: 0 40px 32px; text-align: center; }
    .cta-button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; }
    .note-box { margin: 0 40px 32px; background: rgba(249, 115, 22, 0.08); border: 1px solid rgba(249, 115, 22, 0.2); border-radius: 10px; padding: 16px 20px; }
    .note-title { font-size: 13px; color: #fb923c; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .note-text { font-size: 14px; color: #CBD5E1; line-height: 1.6; margin: 0; }
    .footer { padding: 24px 40px; background: rgba(15, 23, 42, 0.8); border-top: 1px solid rgba(148, 163, 184, 0.1); text-align: center; }
    .footer-text { font-size: 13px; color: #94A3B8; margin: 0 0 12px; }
    .footer-links { margin-top: 16px; }
    .footer-link { display: inline-block; margin: 0 8px; color: #22D3EE; text-decoration: none; font-size: 13px; }
    .divider { color: #475569; margin: 0 4px; }
  </style>
</head>
<body>
  <div style="padding: 40px 20px; background-color: #0F172A;">
    <div class="container">
      
      <!-- Header -->
      <div class="header">
        <div class="logo">Hyper<span class="accent">UR</span></div>
        <div class="subtitle">CỔNG BẢN QUYỀN CHÍNH THỨC</div>
      </div>
      
      <!-- Success Icon -->
      <div class="icon-wrapper">
        <div class="success-icon">✓</div>
      </div>
      
      <!-- Title -->
      <h1 class="title">Đã Gửi Serial Lên Hệ Thống!</h1>
      
      <!-- Description -->
      <p class="description">
        ${isFree 
          ? `Số Serial <strong>${serial}</strong> đã được gửi lên hệ thống máy chủ để xác nhận kích hoạt gói Active Free (36 ngày). Bạn có thể kiểm tra trạng thái kích hoạt ngay bên dưới.`
          : `Số Serial <strong>${serial}</strong> đã được gửi lên hệ thống máy chủ để xác nhận kích hoạt bản quyền. Vui lòng đảm bảo bạn đã hoàn tất ủng hộ với nội dung cú pháp gợi ý để admin đối soát và kích hoạt trong vòng 5 - 30 phút.`
        }
      </p>
      
      <!-- Details Box -->
      <div class="details-box">
        <div class="detail-row">
          <div class="detail-label">Số Serial:</div>
          <div class="detail-value serial-value">${serial}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Mã Thiết Bị (Codename):</div>
          <div class="detail-value">${codename}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Gói Đăng Ký:</div>
          <div class="detail-value plan-value">${data.plan}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Mức Ủng Hộ:</div>
          <div class="detail-value amount-value">${isFree ? '0đ (Miễn Phí 36 Ngày Trải Nghiệm)' : '50.000đ / thiết bị'}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Người Gửi:</div>
          <div class="detail-value">${data.senderName || 'Không yêu cầu (Active Free)'}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Email Liên Hệ:</div>
          <div class="detail-value serial-value">${data.senderEmail}</div>
        </div>
      </div>
      
      <!-- CTA Button -->
      <div class="cta-wrapper">
        <a href="${CONFIG.WEBSITE_URL}/serial.html#lookup" class="cta-button">
          🔍 Kiểm Tra Trạng Thái Kích Hoạt Serial Ngay
        </a>
      </div>
      
      <!-- Important Note -->
      <div class="note-box">
        <div class="note-title">⚠️ LƯU Ý QUAN TRỌNG</div>
        <p class="note-text">
          ${isFree
            ? `Gói Active Free sẽ tự động kích hoạt trong vài phút. Bạn có thể kiểm tra trạng thái bằng cách tra cứu Serial trên website. Gói có hiệu lực 36 ngày kể từ ngày kích hoạt.`
            : `Vui lòng chuyển khoản với nội dung: <strong>UR ${serial}</strong> để hệ thống admin duyệt tự động nhanh nhất. Admin sẽ kích hoạt bản quyền trong vòng 5-30 phút sau khi nhận được thanh toán. Nếu quá 30 phút chưa được kích hoạt, vui lòng liên hệ admin qua Telegram.`
          }
        </p>
      </div>
      
      <!-- Footer -->
      <div class="footer">
        <p class="footer-text">Cảm ơn bạn đã tin dùng HyperUR!</p>
        <div class="footer-links">
          <a href="${CONFIG.TELEGRAM_CHANNEL}" class="footer-link">📢 Kênh Telegram</a>
          <span class="divider">•</span>
          <a href="${CONFIG.TELEGRAM_CHAT}" class="footer-link">💬 Hỗ Trợ 24/7</a>
        </div>
      </div>
      
    </div>
  </div>
</body>
</html>
  `;
  
  // Gửi email
  MailApp.sendEmail({
    to: data.senderEmail,
    subject: subject,
    htmlBody: htmlBody
  });
  
  Logger.log(`✉️ Email xác nhận đã gửi tới: ${data.senderEmail}`);
}

/**
 * Tạo response JSON
 */
function createResponse(success, message, data = null) {
  const response = {
    success: success,
    message: message
  };
  
  if (data) {
    response.data = data;
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Format date
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Test function - Chạy để test gửi email
 */
function testEmail() {
  const testData = {
    serial: 'TEST123456',
    codename: 'marble',
    plan: 'Active Free (36 ngày)',
    paymentMethod: 'Active Free (0đ - Dùng thử 36 ngày)',
    senderName: 'Test User',
    senderEmail: 'your-email@gmail.com', // Thay bằng email của bạn để test
    transactionCode: 'ACTIVE_FREE_36_DAYS'
  };
  
  sendConfirmationEmail(testData);
  Logger.log('✅ Test email đã được gửi!');
}
