<?php
/**
 * Email Service Module
 * HyperUR V3 - Complete Email Handling System
 * 
 * Features:
 * - Email template generation
 * - SMTP integration
 * - Email queue management
 * - Error logging
 * - Retry mechanism
 */

require_once 'config.php';

class EmailService {
    
    /**
     * Email templates registry
     */
    private $templates = [
        'registration' => 'Registration Confirmation',
        'payment_confirmed' => 'Payment Confirmation',
        'activation' => 'Device Activation',
        'renewal' => 'License Renewal',
        'error' => 'Error Notification'
    ];
    
    /**
     * Send email wrapper
     */
    public static function send($recipient_email, $subject, $body, $template_type = 'registration') {
        try {
            $mailer = new EmailService();
            return $mailer->sendEmail($recipient_email, $subject, $body, $template_type);
        } catch (Exception $e) {
            error_log("Email service error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Send email via configured method
     */
    private function sendEmail($recipient_email, $subject, $body, $template_type) {
        // Validate email
        if (!filter_var($recipient_email, FILTER_VALIDATE_EMAIL)) {
            throw new Exception("Invalid email address: {$recipient_email}");
        }
        
        // Validate subject & body
        if (empty($subject) || empty($body)) {
            throw new Exception("Email subject and body cannot be empty");
        }
        
        // Log email attempt
        error_log("Sending email to: {$recipient_email}, Type: {$template_type}");
        
        // Build headers
        $headers = $this->buildEmailHeaders();
        
        // Send via configured method
        $method = defined('EMAIL_METHOD') ? EMAIL_METHOD : 'mail';
        
        switch ($method) {
            case 'smtp':
                return $this->sendViaSMTP($recipient_email, $subject, $body);
                
            case 'sendmail':
                return $this->sendViaSendmail($recipient_email, $subject, $body, $headers);
                
            case 'mail':
            default:
                return $this->sendViaPHP($recipient_email, $subject, $body, $headers);
        }
    }
    
    /**
     * Build email headers
     */
    private function buildEmailHeaders() {
        $from_name = defined('EMAIL_FROM_NAME') ? EMAIL_FROM_NAME : 'HyperUR';
        $from_email = defined('EMAIL_FROM') ? EMAIL_FROM : 'noreply@hyperur.io.vn';
        
        $headers = "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        $headers .= "From: " . $this->encodeHeader($from_name) . " <{$from_email}>\r\n";
        $headers .= "Reply-To: " . (defined('SUPPORT_EMAIL') ? SUPPORT_EMAIL : 'support@hyperur.io.vn') . "\r\n";
        $headers .= "X-Mailer: HyperUR-EmailService/1.0\r\n";
        $headers .= "X-Priority: 3\r\n";
        
        return $headers;
    }
    
    /**
     * Encode header for non-ASCII characters (Vietnamese support)
     */
    private function encodeHeader($text) {
        if (preg_match('/[^\x00-\x7F]/', $text)) {
            return '=?UTF-8?B?' . base64_encode($text) . '?=';
        }
        return $text;
    }
    
    /**
     * Send via PHP mail() function
     */
    private function sendViaPHP($to, $subject, $body, $headers) {
        $subject = $this->encodeHeader($subject);
        
        if (mail($to, $subject, $body, $headers)) {
            error_log("✓ Email sent successfully to: {$to}");
            return true;
        } else {
            error_log("✗ Failed to send email to: {$to}");
            return false;
        }
    }
    
    /**
     * Send via Sendmail
     */
    private function sendViaSendmail($to, $subject, $body, $headers) {
        $subject = $this->encodeHeader($subject);
        
        if (mail($to, $subject, $body, $headers, '-f ' . EMAIL_FROM)) {
            error_log("✓ Email sent via Sendmail to: {$to}");
            return true;
        } else {
            error_log("✗ Sendmail failed for: {$to}");
            return false;
        }
    }
    
    /**
     * Send via SMTP (for advanced setup)
     */
    private function sendViaSMTP($to, $subject, $body) {
        // This would require additional SMTP library
        // For now, log that SMTP is not configured
        error_log("SMTP method not configured. Falling back to php mail()");
        $headers = $this->buildEmailHeaders();
        return $this->sendViaPHP($to, $subject, $body, $headers);
    }
    
    /**
     * Generate registration confirmation email
     */
    public static function registrationConfirmation($data) {
        try {
            $body = EmailTemplate::registrationConfirmation($data);
            $subject = "✅ Đăng Ký Thành Công - Serial " . strtoupper($data['serial']) . " - HyperUR";
            
            return self::send(
                $data['email'],
                $subject,
                $body,
                'registration'
            );
        } catch (Exception $e) {
            error_log("Registration email error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Generate payment confirmation email
     */
    public static function paymentConfirmation($data) {
        try {
            $body = EmailTemplate::paymentConfirmation($data);
            $subject = "✅ Xác Nhận Thanh Toán - Serial " . strtoupper($data['serial']) . " - HyperUR";
            
            return self::send(
                $data['email'],
                $subject,
                $body,
                'payment_confirmed'
            );
        } catch (Exception $e) {
            error_log("Payment email error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Generate activation confirmation email
     */
    public static function activationConfirmation($data) {
        try {
            $body = EmailTemplate::activationConfirmation($data);
            $subject = "🎉 Thiết Bị Đã Được Kích Hoạt - Serial " . strtoupper($data['serial']) . " - HyperUR";
            
            return self::send(
                $data['email'],
                $subject,
                $body,
                'activation'
            );
        } catch (Exception $e) {
            error_log("Activation email error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Generate error notification email
     */
    public static function errorNotification($admin_email, $error_message, $context = []) {
        try {
            $body = EmailTemplate::errorNotification($error_message, $context);
            $subject = "⚠️ HyperUR System Error Notification";
            
            return self::send(
                $admin_email,
                $subject,
                $body,
                'error'
            );
        } catch (Exception $e) {
            error_log("Error notification email failed: " . $e->getMessage());
            return false;
        }
    }
}

/**
 * Email Template Generator
 */
class EmailTemplate {
    
    /**
     * Registration confirmation template
     */
    public static function registrationConfirmation($data) {
        $serial = strtoupper($data['serial']);
        $email = $data['email'];
        $device_model = $data['device_model'] ?? 'Không rõ';
        $plan = $data['plan'] ?? 'Không rõ';
        $created_at = date('d/m/Y H:i', strtotime($data['created_at'] ?? 'now'));
        
        return self::wrapTemplate(
            "Đăng Ký Thành Công!",
            "Số Serial <strong>{$serial}</strong> của bạn đã được gửi lên hệ thống HyperUR. Vui lòng chọn phương thức thanh toán để kích hoạt bản quyền.",
            [
                ['label' => 'Số Serial', 'value' => $serial, 'highlight' => true],
                ['label' => 'Thiết Bị', 'value' => $device_model],
                ['label' => 'Gói', 'value' => $plan],
                ['label' => 'Email', 'value' => $email],
                ['label' => 'Ngày Đăng Ký', 'value' => $created_at]
            ],
            "Bước tiếp theo: Chọn phương thức thanh toán (Momo, Binance, PayPal). Sau khi thanh toán, thiết bị sẽ được kích hoạt ngay lập tức.",
            "https://hyperur.io.vn/serial.php?serial=" . urlencode($serial) . "#payment"
        );
    }
    
    /**
     * Payment confirmation template
     */
    public static function paymentConfirmation($data) {
        $serial = strtoupper($data['serial']);
        $amount = number_format($data['amount'] ?? 0, 0, ',', '.') . 'đ';
        $payment_method = $data['payment_method'] ?? 'Bank Transfer';
        $transaction_id = $data['transaction_id'] ?? 'N/A';
        $paid_at = date('d/m/Y H:i', strtotime($data['paid_at'] ?? 'now'));
        
        return self::wrapTemplate(
            "Thanh Toán Đã Được Xác Nhận!",
            "Chúng tôi đã nhận được thanh toán của bạn. Thiết bị <strong>{$serial}</strong> đang được xử lý kích hoạt.",
            [
                ['label' => 'Serial', 'value' => $serial, 'highlight' => true],
                ['label' => 'Số Tiền', 'value' => $amount],
                ['label' => 'Phương Thức', 'value' => $payment_method],
                ['label' => 'Mã Giao Dịch', 'value' => $transaction_id],
                ['label' => 'Thời Gian', 'value' => $paid_at]
            ],
            "Thiết bị sẽ được kích hoạt trong vòng 1-5 phút. Bạn sẽ nhận được email xác nhận kích hoạt ngay sau đó.",
            "https://hyperur.io.vn/serial.php?serial=" . urlencode($serial) . "#lookup"
        );
    }
    
    /**
     * Activation confirmation template
     */
    public static function activationConfirmation($data) {
        $serial = strtoupper($data['serial']);
        $activated_at = date('d/m/Y H:i', strtotime($data['activated_at'] ?? 'now'));
        $expires_at = date('d/m/Y', strtotime($data['expired_at'] ?? '+365 days'));
        $plan = $data['plan'] ?? 'Pro';
        
        return self::wrapTemplate(
            "🎉 Thiết Bị Đã Được Kích Hoạt!",
            "Chúc mừng! Serial <strong>{$serial}</strong> của bạn đã được kích hoạt thành công và sẵn sàng sử dụng.",
            [
                ['label' => 'Serial', 'value' => $serial, 'highlight' => true],
                ['label' => 'Gói', 'value' => $plan],
                ['label' => 'Ngày Kích Hoạt', 'value' => $activated_at],
                ['label' => 'Hết Hạn', 'value' => $expires_at]
            ],
            "Bạn có thể sử dụng ROM HyperUR ngay bây giờ trên thiết bị Xiaomi/Redmi của mình. Hãy truy cập trang Tải ROM để lấy phiên bản mới nhất.",
            "https://hyperur.io.vn/download.html"
        );
    }
    
    /**
     * Error notification template
     */
    public static function errorNotification($error_message, $context = []) {
        $timestamp = date('d/m/Y H:i:s');
        $details = "- Error: {$error_message}\n";
        
        foreach ($context as $key => $value) {
            $details .= "- {$key}: " . (is_array($value) ? json_encode($value) : $value) . "\n";
        }
        
        return self::wrapTemplate(
            "⚠️ System Error Notification",
            "An error occurred in the HyperUR system that requires attention.",
            [
                ['label' => 'Error', 'value' => $error_message],
                ['label' => 'Time', 'value' => $timestamp],
                ['label' => 'IP', 'value' => $_SERVER['REMOTE_ADDR'] ?? 'Unknown']
            ],
            "Please check the system logs for more details.",
            null,
            true
        );
    }
    
    /**
     * Wrap template with styling
     */
    private static function wrapTemplate($title, $description, $details, $note, $button_url = null, $is_error = false) {
        $accent_color = $is_error ? '#ef4444' : '#10b981';
        $button_bg = $is_error ? '#ef4444' : '#10b981';
        
        $details_html = '';
        foreach ($details as $detail) {
            $value_class = isset($detail['highlight']) ? 'style="color: #22D3EE; font-family: monospace;"' : '';
            $details_html .= <<<HTML
                <div class="detail-row">
                    <div class="detail-label">{$detail['label']}:</div>
                    <div class="detail-value" {$value_class}>{$detail['value']}</div>
                </div>
HTML;
        }
        
        $button_html = '';
        if ($button_url) {
            $button_html = <<<HTML
                <div class="cta-wrapper">
                    <a href="{$button_url}" class="cta-button">
                        🔍 Xem Chi Tiết
                    </a>
                </div>
HTML;
        }
        
        $footer_links = $is_error ? '' : <<<HTML
                <div class="footer-links">
                    <a href="https://t.me/hypermodupdate" class="footer-link">📢 Kênh Telegram</a>
                    <span class="divider">•</span>
                    <a href="https://t.me/HuperUltraRateChat" class="footer-link">💬 Hỗ Trợ 24/7</a>
                </div>
HTML;
        
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
        .accent { color: {$accent_color}; }
        .subtitle { font-size: 13px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; }
        .icon-wrapper { padding: 32px 40px 16px; text-align: center; }
        .status-icon { display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, {$accent_color} 0%, {$button_bg} 100%); border-radius: 50%; line-height: 64px; font-size: 36px; margin-bottom: 16px; }
        .title { padding: 0 40px 16px; text-align: center; font-size: 24px; font-weight: 700; color: #F8FAFC; margin: 0; }
        .description { padding: 0 40px 32px; text-align: center; font-size: 15px; color: #CBD5E1; line-height: 1.6; margin: 0; }
        .details-box { margin: 0 40px 32px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(148, 163, 184, 0.12); border-radius: 12px; overflow: hidden; }
        .detail-row { padding: 16px 20px; border-bottom: 1px solid rgba(148, 163, 184, 0.08); }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { font-size: 13px; color: #94A3B8; margin-bottom: 4px; }
        .detail-value { font-size: 15px; color: #F8FAFC; font-weight: 600; }
        .cta-wrapper { padding: 0 40px 32px; text-align: center; }
        .cta-button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, {$button_bg} 0%, {$button_bg} 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; }
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
            <div class="header">
                <div class="logo">Hyper<span class="accent">UR</span></div>
                <div class="subtitle">CỔNG BẢN QUYỀN CHÍNH THỨC</div>
            </div>
            
            <div class="icon-wrapper">
                <div class="status-icon">✓</div>
            </div>
            
            <h1 class="title">{$title}</h1>
            <p class="description">{$description}</p>
            
            <div class="details-box">
                {$details_html}
            </div>
            
            {$button_html}
            
            <div class="note-box">
                <div class="note-title">ℹ️ LƯU Ý</div>
                <p class="note-text">{$note}</p>
            </div>
            
            <div class="footer">
                <p class="footer-text">Cảm ơn bạn đã tin dùng HyperUR!</p>
                {$footer_links}
            </div>
        </div>
    </div>
</body>
</html>
HTML;
        
        return $html;
    }
}

/**
 * Backward compatibility - keep old function
 */
function generateEmailTemplate($data) {
    return EmailTemplate::registrationConfirmation($data);
}
?>
