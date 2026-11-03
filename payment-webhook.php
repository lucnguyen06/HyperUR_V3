<?php
/**
 * HyperUR - Fallback Webhook Endpoint (Root level)
 * Chuyển tiếp request sang api/payment-webhook.php phòng trường hợp
 * cấu hình URL trên SePay thiếu thư mục /api/.
 */
require_once __DIR__ . '/api/payment-webhook.php';
