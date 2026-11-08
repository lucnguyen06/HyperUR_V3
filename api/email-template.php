<?php
/**
 * Email Template Generator
 * HyperUR V3 - Beautiful Email Template
 */

function generateEmailTemplate($data) {
    // Escape mọi giá trị user nhập trước khi chèn vào HTML email (chống HTML injection)
    $esc = function ($v) {
        return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    };

    $serial = $esc($data['serial'] ?? '');
    $codename = $esc(strtoupper($data['codename'] ?? ''));
    $planRaw = (string)($data['plan'] ?? '');
    $plan = $esc($planRaw);
    $rawSenderName = trim((string)($data['senderName'] ?? ''));
    $senderName = $esc($rawSenderName !== '' ? $rawSenderName : 'Không yêu cầu (Active Free)');
    $senderEmail = $esc($data['senderEmail'] ?? '');

    // Check if Free plan - SO KHỚP CHÍNH XÁC (không dùng strpos '36')
    $isFree = ($planRaw === 'Active Free' || strcasecmp($planRaw, 'Active Free (36 ngày)') === 0);

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

/**
 * Gửi email qua SMTP socket thuần (Zero-dependency, hỗ trợ TLS/SSL & AUTH LOGIN)
 * ponytail: Socket SMTP client tối giản; nâng cấp lên PHPMailer nếu cần S/MIME hoặc DKIM signing trực tiếp.
 */
function smtp_send($to, $subject, $htmlBody, $config = []) {
    $host = $config['host'] ?? (defined('SMTP_HOST') ? SMTP_HOST : 'smtp.gmail.com');
    $port = (int)($config['port'] ?? (defined('SMTP_PORT') ? SMTP_PORT : 587));
    $secure = strtolower($config['secure'] ?? (defined('SMTP_SECURE') ? SMTP_SECURE : 'tls'));
    $user = $config['user'] ?? (defined('SMTP_USER') ? SMTP_USER : '');
    $pass = $config['pass'] ?? (defined('SMTP_PASS') ? SMTP_PASS : '');
    $from = $config['from'] ?? (defined('EMAIL_FROM') ? EMAIL_FROM : $user);
    $fromName = $config['from_name'] ?? (defined('EMAIL_FROM_NAME') ? EMAIL_FROM_NAME : 'HyperUR');
    $replyTo = $config['reply_to'] ?? (defined('SUPPORT_EMAIL') ? SUPPORT_EMAIL : $from);

    $timeout = 12;
    $prefix = ($secure === 'ssl' || $port === 465) ? 'ssl://' : 'tcp://';
    $ctx = stream_context_create([
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true,
        ]
    ]);

    $socket = @stream_socket_client("{$prefix}{$host}:{$port}", $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $ctx);
    if (!$socket) {
        throw new Exception("Kết nối SMTP {$host}:{$port} thất bại: {$errstr} ({$errno})");
    }
    stream_set_timeout($socket, $timeout);

    $read = function () use ($socket) {
        $res = '';
        while (!feof($socket)) {
            $line = fgets($socket, 512);
            if ($line === false) break;
            $res .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        return $res;
    };

    $expect = function ($expectedCode, $cmd = null) use ($socket, $read) {
        if ($cmd !== null) {
            fputs($socket, $cmd . "\r\n");
        }
        $resp = $read();
        $code = (int)substr($resp, 0, 3);
        if ($expectedCode && $code !== $expectedCode) {
            throw new Exception("Lỗi SMTP lệnh '{$cmd}' (mong đợi {$expectedCode}, nhận {$code}): " . trim($resp));
        }
        return $resp;
    };

    $expect(220);

    $helloHost = !empty($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : 'localhost';
    $expect(250, "EHLO {$helloHost}");

    if ($secure === 'tls' && $port !== 465) {
        $expect(220, "STARTTLS");
        $cryptoMethod = STREAM_CRYPTO_METHOD_TLS_CLIENT;
        if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) {
            $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
        }
        if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) {
            $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
        }
        if (!@stream_socket_enable_crypto($socket, true, $cryptoMethod)) {
            throw new Exception("Không thể bật mã hóa TLS với máy chủ SMTP");
        }
        $expect(250, "EHLO {$helloHost}");
    }

    if (!empty($user) && !empty($pass)) {
        $expect(334, "AUTH LOGIN");
        $expect(334, base64_encode($user));
        $expect(235, base64_encode($pass));
    }

    $expect(250, "MAIL FROM:<{$from}>");
    $expect(250, "RCPT TO:<{$to}>");
    $expect(354, "DATA");

    $encSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $encFromName = '=?UTF-8?B?' . base64_encode($fromName) . '?=';

    $headers = [
        "From: {$encFromName} <{$from}>",
        "Reply-To: <{$replyTo}>",
        "To: <{$to}>",
        "Subject: {$encSubject}",
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "X-Mailer: HyperUR-Mailer/1.0",
        "Date: " . date('r'),
    ];

    $body = implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($htmlBody)) . "\r\n.";
    $expect(250, $body);

    @fputs($socket, "QUIT\r\n");
    @fclose($socket);
    return true;
}

/**
 * Gửi email thống nhất: ưu tiên SMTP, tự động fallback sang mail() PHP
 */
function sendHyperEmail($toEmail, $subject, $htmlBody) {
    // 1. Thử gửi bằng SMTP nếu bật và có pass
    $smtpEnabled = defined('SMTP_ENABLED') && SMTP_ENABLED;
    $smtpHost = defined('SMTP_HOST') ? SMTP_HOST : '';
    $smtpUser = defined('SMTP_USER') ? SMTP_USER : '';
    $smtpPass = defined('SMTP_PASS') ? SMTP_PASS : '';

    if ($smtpEnabled && !empty($smtpHost) && !empty($smtpUser) && !empty($smtpPass)) {
        try {
            smtp_send($toEmail, $subject, $htmlBody);
            return ['success' => true, 'method' => 'smtp'];
        } catch (\Throwable $e) {
            error_log("[sendHyperEmail] SMTP error: " . $e->getMessage() . " -> Thử fallback sang mail()");
        }
    }

    // 2. Fallback sang PHP mail()
    // ponytail: fallback mail() dùng envelope -f; nếu From là gmail.com thì dùng domain hosting để tránh DMARC reject
    $fromEmail = defined('EMAIL_FROM') ? EMAIL_FROM : 'noreply@hyperur.io.vn';
    $fromName = defined('EMAIL_FROM_NAME') ? EMAIL_FROM_NAME : 'HyperUR';
    $replyTo = defined('SUPPORT_EMAIL') ? SUPPORT_EMAIL : $fromEmail;

    $envelopeFrom = $fromEmail;
    if (stripos($fromEmail, '@gmail.com') !== false) {
        $hostDomain = !empty($_SERVER['HTTP_HOST']) ? preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST']) : 'hyperur.io.vn';
        if (!in_array($hostDomain, ['localhost', '127.0.0.1'], true)) {
            $envelopeFrom = 'noreply@' . ltrim($hostDomain, 'www.');
            $fromEmail = $envelopeFrom;
        }
    }

    $encSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $encFromName = '=?UTF-8?B?' . base64_encode($fromName) . '?=';

    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "From: {$encFromName} <" . $fromEmail . ">\r\n";
    $headers .= "Reply-To: " . $replyTo . "\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";

    $sent = @mail($toEmail, $encSubject, $htmlBody, $headers, "-f " . escapeshellarg($envelopeFrom));
    if (!$sent) {
        $sent = @mail($toEmail, $encSubject, $htmlBody, $headers);
    }

    if (!$sent) {
        $err = error_get_last();
        $msg = $err['message'] ?? 'mail() trả về false';
        error_log("[sendHyperEmail] Gửi mail tới {$toEmail} thất bại: {$msg}");
        return ['success' => false, 'error' => $msg, 'method' => 'mail'];
    }

    return ['success' => true, 'method' => 'mail'];
}

