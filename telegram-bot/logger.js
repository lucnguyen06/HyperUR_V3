/**
 * Logger utility for HyperUR Bot
 */

const fs = require('fs-extra');
const path = require('path');

class Logger {
  constructor(logDir = './logs') {
    this.logDir = logDir;
    fs.ensureDirSync(logDir);
  }

  /**
   * Log levels
   */
  static LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
  };

  /**
   * Format log message
   */
  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message
    };

    if (data) {
      logEntry.data = data;
    }

    return JSON.stringify(logEntry);
  }

  /**
   * Write to log file
   */
  async writeToFile(level, message, data) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `${date}.log`);
      const formattedMessage = this.formatMessage(level, message, data);
      
      await fs.appendFile(logFile, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Log methods
   */
  error(message, data = null) {
    console.error(`❌ [ERROR] ${message}`, data || '');
    this.writeToFile(Logger.LEVELS.ERROR, message, data);
  }

  warn(message, data = null) {
    console.warn(`⚠️ [WARN] ${message}`, data || '');
    this.writeToFile(Logger.LEVELS.WARN, message, data);
  }

  info(message, data = null) {
    console.log(`ℹ️ [INFO] ${message}`, data || '');
    this.writeToFile(Logger.LEVELS.INFO, message, data);
  }

  debug(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 [DEBUG] ${message}`, data || '');
      this.writeToFile(Logger.LEVELS.DEBUG, message, data);
    }
  }

  /**
   * Log user action
   */
  logUserAction(userId, action, details = {}) {
    this.info(`User ${userId} - ${action}`, details);
  }

  /**
   * Log admin action
   */
  logAdminAction(adminId, action, billId, details = {}) {
    this.info(`Admin ${adminId} - ${action} - Bill ${billId}`, details);
  }
}

module.exports = Logger;
