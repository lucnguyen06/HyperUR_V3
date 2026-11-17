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
    $senderName = $esc($rawSenderName !== '' ? $rawSenderName : 'Không cung cấp');
    $senderEmail = $esc($data['senderEmail'] ?? '');

    // Check if Free plan - SO KHỚP CHÍNH XÁC (không dùng strpos '36')
    $isFree = ($planRaw === 'Active Free' || strcasecmp($planRaw, 'Active Free (36 ngày)') === 0);

    $description = $isFree
        ? "Serial <strong>{$serial}</strong> đã được gửi lên hệ thống để xác nhận kích hoạt gói <strong>Active Free 36 ngày</strong>. Bạn có thể kiểm tra trạng thái kích hoạt bằng nút bên dưới."
        : "Serial <strong>{$serial}</strong> đã được gửi lên hệ thống để xác nhận kích hoạt bản quyền. Vui lòng hoàn tất ủng hộ để admin đối soát và kích hoạt trong khoảng <strong>5–30 phút</strong>.";
    
    $amount = $isFree ? 'Miễn phí' : '50.000đ / thiết bị';
    
    $noteText = $isFree
        ? "Gói Active Free tự động kích hoạt trong vài phút và có hiệu lực 36 ngày kể từ ngày kích hoạt. Bạn có thể tra cứu Serial trên website để theo dõi trạng thái."
        : "Khi chuyển khoản, vui lòng để lại nội dung <strong>UR {$serial}</strong> để admin đối soát nhanh chóng. Thời gian kích hoạt dự kiến từ 5–30 phút. Nếu quá 30 phút, hãy liên hệ admin qua Telegram.";
    
    $noteTitle = $isFree ? 'Thông tin gói trải nghiệm' : 'Hướng dẫn hoàn tất kích hoạt';
    $preheader = $esc('Đã tiếp nhận Serial ' . ($data['serial'] ?? '') . '. Tra cứu trạng thái kích hoạt HyperUR của bạn.');

    $html = <<<HTML
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>HyperUR — Đã tiếp nhận Serial</title>
  <style>
    body { margin: 0; padding: 0; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    a { text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .outer-pad { padding: 16px 8px !important; }
      .content-pad { padding-left: 22px !important; padding-right: 22px !important; }
      .email-title { font-size: 26px !important; line-height: 34px !important; }
      .detail-label, .detail-value { display: block !important; width: auto !important; text-align: left !important; }
      .detail-label { padding: 12px 0 3px !important; border-bottom: 0 !important; }
      .detail-value { padding: 0 0 12px !important; }
      .cta-button { display: block !important; padding-left: 12px !important; padding-right: 12px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f4f7fb; color:#172033; font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">{$preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background-color:#f4f7fb;">
    <tr>
      <td class="outer-pad" align="center" style="padding:36px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 8px 30px rgba(23,32,51,0.08);">
          <tr>
            <td align="center" style="padding:30px 32px 26px; background:#0b1220; border-bottom:3px solid #14b8a6;">
              <div style="font-size:28px; line-height:34px; font-weight:800; letter-spacing:-0.5px; color:#ffffff;">Hyper<span style="color:#5eead4;">UR</span></div>
              <div style="padding-top:6px; font-size:12px; line-height:18px; font-weight:700; letter-spacing:1.5px; color:#94a3b8;">CỔNG BẢN QUYỀN CHÍNH THỨC</div>
            </td>
          </tr>
          <tr>
            <td class="content-pad" align="center" style="padding:34px 32px 12px;">
              <div style="display:inline-block; width:58px; height:58px; line-height:58px; border-radius:50%; background:#d1fae5; color:#047857; font-size:32px; font-weight:bold;">&#10003;</div>
              <h1 class="email-title" style="margin:18px 0 12px; font-size:30px; line-height:38px; font-weight:750; color:#111827;">Đã tiếp nhận Serial của bạn</h1>
              <p style="margin:0; font-size:16px; line-height:26px; color:#596579;">{$description}</p>
            </td>
          </tr>
          <tr>
            <td class="content-pad" style="padding:24px 32px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#f0fdfa; border:1px solid #99f6e4; border-radius:12px;">
                <tr>
                  <td style="padding:16px 20px; border-bottom:1px solid #ccfbf1;">
                    <div class="detail-label" style="font-size:12px; line-height:18px; font-weight:700; letter-spacing:0.7px; color:#55766f; text-transform:uppercase;">Số serial</div>
                    <div class="detail-value" style="padding-top:4px; font-size:21px; line-height:29px; font-weight:800; color:#0f766e; font-family:'Courier New',Consolas,monospace; word-break:break-all;">{$serial}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="38%" class="detail-label" style="font-size:14px; line-height:21px; color:#64748b;">Thiết bị</td>
                        <td width="62%" class="detail-value" align="right" style="font-size:14px; line-height:21px; font-weight:700; color:#1e293b;">{$codename}</td>
                      </tr>
                      <tr>
                        <td class="detail-label" style="padding-top:10px; font-size:14px; line-height:21px; color:#64748b;">Gói đăng ký</td>
                        <td class="detail-value" align="right" style="padding-top:10px; font-size:14px; line-height:21px; font-weight:700; color:#0f766e;">{$plan}</td>
                      </tr>
                      <tr>
                        <td class="detail-label" style="padding-top:10px; font-size:14px; line-height:21px; color:#64748b;">Mức ủng hộ</td>
                        <td class="detail-value" align="right" style="padding-top:10px; font-size:14px; line-height:21px; font-weight:700; color:#b45309;">{$amount}</td>
                      </tr>
                      <tr>
                        <td class="detail-label" style="padding-top:10px; font-size:14px; line-height:21px; color:#64748b;">Người gửi</td>
                        <td class="detail-value" align="right" style="padding-top:10px; font-size:14px; line-height:21px; font-weight:700; color:#1e293b;">{$senderName}</td>
                      </tr>
                      <tr>
                        <td class="detail-label" style="padding-top:10px; font-size:14px; line-height:21px; color:#64748b;">Email liên hệ</td>
                        <td class="detail-value" align="right" style="padding-top:10px; font-size:14px; line-height:21px; font-weight:700; color:#0f766e; word-break:break-all;">{$senderEmail}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="content-pad" align="center" style="padding:26px 32px 0;">
              <a href="https://hyperur.io.vn/serial.html#lookup" class="cta-button" style="display:inline-block; padding:14px 24px; background:#0f766e; color:#ffffff; font-size:15px; line-height:22px; font-weight:700; border-radius:9px; box-shadow:0 4px 12px rgba(15,118,110,0.20);">Tra cứu trạng thái kích hoạt &rarr;</a>
            </td>
          </tr>
          <tr>
            <td class="content-pad" style="padding:24px 32px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#fffbeb; border-left:4px solid #f59e0b; border-radius:8px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <div style="font-size:13px; line-height:20px; font-weight:800; color:#92400e;">{$noteTitle}</div>
                    <p style="margin:5px 0 0; font-size:14px; line-height:23px; color:#6b5727;">{$noteText}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 32px; background:#f8fafc; border-top:1px solid #e8edf3;">
              <p style="margin:0 0 10px; font-size:13px; line-height:20px; color:#64748b;">Cảm ơn bạn đã tin dùng HyperUR!</p>
              <p style="margin:0; font-size:13px; line-height:22px;">
                <a href="https://t.me/hypermodupdate" style="color:#0f766e; font-weight:700;">Kênh Telegram</a>
                <span style="padding:0 8px; color:#cbd5e1;">&bull;</span>
                <a href="https://t.me/HuperUltraRateChat" style="color:#0f766e; font-weight:700;">Hỗ trợ 24/7</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
            // Không ghi lệnh SMTP: có thể chứa mật khẩu AUTH hoặc toàn bộ nội dung email.
            throw new Exception("Lỗi phản hồi SMTP (mong đợi {$expectedCode}, nhận {$code}): " . trim($resp));
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
    $smtpError = null;

    if ($smtpEnabled && !empty($smtpHost) && !empty($smtpUser) && !empty($smtpPass)) {
        try {
            smtp_send($toEmail, $subject, $htmlBody);
            return ['success' => true, 'method' => 'smtp'];
        } catch (\Throwable $e) {
            $smtpError = $e->getMessage();
            error_log("[sendHyperEmail] SMTP error: " . $smtpError . " -> Thử fallback sang mail()");
        }
    } elseif ($smtpEnabled) {
        $smtpError = 'SMTP đã bật nhưng thiếu SMTP_HOST, SMTP_USER hoặc SMTP_PASS trong api/config.php';
        error_log('[sendHyperEmail] ' . $smtpError);
    } else {
        $smtpError = 'SMTP chưa được bật trong api/config.php';
    }

    if (!function_exists('mail')) {
        $error = $smtpError . '; hosting không hỗ trợ hoặc đã vô hiệu hóa hàm mail()';
        error_log('[sendHyperEmail] ' . $error);
        return ['success' => false, 'error' => $error, 'method' => 'mail'];
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

    $mailError = null;
    try {
        error_clear_last();
        $sent = @mail($toEmail, $encSubject, $htmlBody, $headers, "-f " . escapeshellarg($envelopeFrom));
        if (!$sent) {
            $sent = @mail($toEmail, $encSubject, $htmlBody, $headers);
        }
        if (!$sent) {
            $err = error_get_last();
            $mailError = $err['message'] ?? 'mail() trả về false';
        }
    } catch (\Throwable $e) {
        $sent = false;
        $mailError = $e->getMessage();
    }

    if (!$sent) {
        $msg = $smtpError . '; PHP mail(): ' . $mailError;
        error_log("[sendHyperEmail] Gửi mail tới {$toEmail} thất bại: {$msg}");
        return ['success' => false, 'error' => $msg, 'method' => 'mail'];
    }

    return ['success' => true, 'method' => 'mail'];
}

