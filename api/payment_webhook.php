<?php
/**
 * HyperUR - Fallback Webhook Endpoint (Underscore filename)
 * Chuyển tiếp request sang payment-webhook.php phòng trường hợp
 * cấu hình URL trên SePay gõ nhầm dấu gạch dưới thay vì gạch ngang.
 */
require_once __DIR__ . '/payment-webhook.php';
