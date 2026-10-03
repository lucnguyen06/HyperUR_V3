<?php
/**
 * Email Template Generator
 * HyperUR V3 - Beautiful Email Template
 */

function generateEmailTemplate($data) {
    $serial = strtoupper($data['serial']);
    $codename = strtoupper($data['codename']);
    $plan = $data['plan'];
    $senderName = $data['senderName'] ?? 'Không yêu cầu (Active Free)';
    $senderEmail = $data['senderEmail'];
    
    // Check if Free plan
    $isFree = (strpos($plan, 'Active Free') !== false || strpos($plan, '36') !== false);
    
    $description = $isFree 
        ? "Số Serial <strong>{$serial}</strong> đã được gửi lên hệ thống máy chủ để xác nhận kích hoạt gói Active Free (36 ngày). Bạn có thể kiểm tra trạng thái kích hoạt ngay bên dưới."
        : "Số Serial <strong>{$serial}</strong> đã được gửi lên hệ thống máy chủ để xác nhận kích hoạt bản quyền. Vui lòng đảm bảo bạn đã hoàn tất ủng hộ với nội dung cú pháp gợi ý để admin đối soát và kích hoạt trong vòng 5 - 30 phút.";
    
    $amount = $isFree ? '0đ (Miễn Phí 36 Ngày Trải Nghiệm)' : '50.000đ / thiết bị';
    
    $noteText = $isFree
        ? "Gói Active Free sẽ tự động kích hoạt trong vài phút. Bạn có thể kiểm tra trạng thái bằng cách tra cứu Serial trên website. Gói có hiệu lực 36 ngày kể từ ngày kích hoạt."
        : "Vui lòng chuyển khoản với nội dung: <strong>UR {$serial}</strong> để hệ thống admin duyệt tự động nhanh nhất. Admin sẽ kích hoạt bản quyền trong vòng 5-30 phút sau khi nhận được thanh toán. Nếu quá 30 phút chưa được kích hoạt, vui lòng liên hệ admin qua Telegram.";
    
    $html = <<<HTML
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
      <p class="description">{$description}</p>
      
      <!-- Details Box -->
      <div class="details-box">
        <div class="detail-row">
          <div class="detail-label">Số Serial:</div>
          <div class="detail-value serial-value">{$serial}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Mã Thiết Bị (Codename):</div>
          <div class="detail-value">{$codename}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Gói Đăng Ký:</div>
          <div class="detail-value plan-value">{$plan}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Mức Ủng Hộ:</div>
          <div class="detail-value amount-value">{$amount}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Người Gửi:</div>
          <div class="detail-value">{$senderName}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Email Liên Hệ:</div>
          <div class="detail-value serial-value">{$senderEmail}</div>
        </div>
      </div>
      
      <!-- CTA Button -->
      <div class="cta-wrapper">
        <a href="https://hyperur.io.vn/serial.html#lookup" class="cta-button">
          🔍 Kiểm Tra Trạng Thái Kích Hoạt Serial Ngay
        </a>
      </div>
      
      <!-- Important Note -->
      <div class="note-box">
        <div class="note-title">⚠️ LƯU Ý QUAN TRỌNG</div>
        <p class="note-text">{$noteText}</p>
      </div>
      
      <!-- Footer -->
      <div class="footer">
        <p class="footer-text">Cảm ơn bạn đã tin dùng HyperUR!</p>
        <div class="footer-links">
          <a href="https://t.me/hypermodupdate" class="footer-link">📢 Kênh Telegram</a>
          <span class="divider">•</span>
          <a href="https://t.me/HuperUltraRateChat" class="footer-link">💬 Hỗ Trợ 24/7</a>
        </div>
      </div>
      
    </div>
  </div>
</body>
</html>
HTML;

    return $html;
}
