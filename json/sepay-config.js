/**
 * SePay Configuration
 * HyperUR V3 - SePay Integration Settings
 */

window.SEPAY_CONFIG = {
  // SePay API Endpoint (test/production)
  API_URL: 'https://api.sepay.vn/v1',
  
  // SePay Webhook Receiver (your server)
  WEBHOOK_URL: 'https://hyperur.io.vn/api/sepay-webhook.php',
  
  // Bank Account Information for QR & Transfer
  BANK_INFO: {
    bankCode: 'MB',           // MBBank code
    accountNo: '0562903904',  // Bank account number (updated from VietQR)
    accountName: 'NGUYEN TAN LUC',
    amount: 50000,            // Default amount (VND)
  },
  
  // SePay Webhook Signature Key (from SePay dashboard)
  WEBHOOK_SECRET: 'your-sepay-webhook-secret-key', // ✏️ Replace with real secret from SePay
  
  // Payment Plans & Amounts
  PAYMENT_PLANS: {
    single: {
      amount: 50000,
      description: 'Ủng hộ 1 thiết bị',
      description_template: 'UR {serial}'
    },
    bulk_5: {
      amount: 225000,  // 45k per device
      description: 'Ủng hộ 5 thiết bị (45k/con)',
      discount: 10
    },
    bulk_15: {
      amount: 600000,  // 40k per device
      description: 'Ủng hộ 15+ thiết bị (40k/con)',
      discount: 20
    }
  },
  
  // SePay Transaction Status
  TRANSACTION_STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
  },
  
  // Polling interval for checking transaction status (milliseconds)
  STATUS_CHECK_INTERVAL: 3000,
  
  // Maximum polling attempts
  MAX_STATUS_CHECKS: 30
};
