/**
 * Configuration file for HyperUR Bot
 * Centralized configuration management
 */

const path = require('path');

const config = {
  // Bot Configuration
  bot: {
    token: process.env.BOT_TOKEN,
    username: process.env.BOT_USERNAME || 'hyperur_bot',
    polling: process.env.BOT_POLLING !== 'false', // true by default
    webhook: {
      enabled: process.env.WEBHOOK_ENABLED === 'true',
      domain: process.env.WEBHOOK_DOMAIN,
      port: parseInt(process.env.WEBHOOK_PORT || '3000'),
      path: '/webhook'
    }
  },

  // Admin Configuration
  admin: {
    ids: (process.env.ADMIN_IDS || '')
      .split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id))
  },

  // Database Configuration
  database: {
    type: process.env.DB_TYPE || 'json', // json, mongodb
    path: process.env.DATABASE_FILE || './database/bot-data.json',
    mongodb: {
      uri: process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DB_NAME || 'hyperur_bot'
    }
  },

  // Storage Configuration
  storage: {
    bills: {
      folder: process.env.BILLS_FOLDER || './bills',
      maxSize: parseInt(process.env.MAX_BILL_SIZE || '5242880'), // 5MB default
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png']
    },
    logs: {
      folder: process.env.LOGS_FOLDER || './logs',
      enabled: process.env.ENABLE_LOGS !== 'false'
    }
  },

  // HyperUR Website Integration
  hyperur: {
    websiteUrl: process.env.HYPERUR_WEBSITE_URL || 'https://hyperur.com',
    apiUrl: process.env.HYPERUR_API_URL || 'http://localhost:3000/api',
    websitePath: path.resolve(__dirname, '../'),
    syncEnabled: process.env.HYPERUR_SYNC_ENABLED !== 'false'
  },

  // Features Toggle
  features: {
    autoApproval: process.env.FEATURE_AUTO_APPROVAL === 'true',
    deviceValidation: process.env.FEATURE_DEVICE_VALIDATION !== 'false',
    rateLimit: process.env.FEATURE_RATE_LIMIT !== 'false',
    analytics: process.env.FEATURE_ANALYTICS === 'true',
    cronJobs: process.env.FEATURE_CRON_JOBS !== 'false'
  },

  // Rate Limiting
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '5'),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000') // 1 minute
  },

  // Cron Jobs Schedule
  cron: {
    syncSerials: parseInt(process.env.CRON_SYNC_SERIALS || '300000'), // 5 min
    exportStats: parseInt(process.env.CRON_EXPORT_STATS || '600000'), // 10 min
    pendingReminder: parseInt(process.env.CRON_PENDING_REMINDER || '3600000'), // 1 hour
    cleanup: parseInt(process.env.CRON_CLEANUP || '1800000') // 30 min
  },

  // Messages Configuration
  messages: {
    language: process.env.DEFAULT_LANGUAGE || 'vi',
    maxLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '4096')
  },

  // Security
  security: {
    encryptDatabase: process.env.ENCRYPT_DATABASE === 'true',
    logSensitiveData: process.env.LOG_SENSITIVE_DATA === 'true',
    requireDeviceValidation: process.env.REQUIRE_DEVICE_VALIDATION !== 'false'
  },

  // Development
  development: {
    debug: process.env.NODE_ENV === 'development',
    verbose: process.env.VERBOSE === 'true',
    testMode: process.env.TEST_MODE === 'true'
  }
};

// Validation
function validateConfig() {
  const errors = [];

  if (!config.bot.token) {
    errors.push('BOT_TOKEN is required');
  }

  if (config.admin.ids.length === 0) {
    errors.push('At least one ADMIN_ID is required');
  }

  if (config.bot.webhook.enabled && !config.bot.webhook.domain) {
    errors.push('WEBHOOK_DOMAIN is required when webhook is enabled');
  }

  if (errors.length > 0) {
    throw new Error('Configuration validation failed:\n' + errors.join('\n'));
  }
}

// Export
module.exports = {
  ...config,
  validate: validateConfig
};
