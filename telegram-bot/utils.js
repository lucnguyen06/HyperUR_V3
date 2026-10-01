/**
 * Utility Functions for HyperUR Bot
 */

const { format } = require('date-fns');
const { vi } = require('date-fns/locale');

class Utils {
  /**
   * Format date to Vietnamese locale
   */
  static formatDate(date, formatStr = 'dd/MM/yyyy HH:mm') {
    return format(new Date(date), formatStr, { locale: vi });
  }

  /**
   * Format file size
   */
  static formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  /**
   * Sanitize filename
   */
  static sanitizeFilename(filename) {
    return filename.replace(/[^a-z0-9_\-\.]/gi, '_').toLowerCase();
  }

  /**
   * Generate short ID
   */
  static generateShortId(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Validate device code
   */
  static isValidDeviceCode(code) {
    // Basic validation: 3-20 chars, alphanumeric
    return /^[a-z0-9]{3,20}$/i.test(code);
  }

  /**
   * Extract device code from message
   */
  static extractDeviceCode(text) {
    const match = text.match(/\b([a-z0-9]{3,20})\b/i);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Truncate text
   */
  static truncate(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Escape markdown special characters
   */
  static escapeMarkdown(text) {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  /**
   * Check if URL is valid
   */
  static isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Get status badge
   */
  static getStatusBadge(status) {
    const badges = {
      pending: '🟡 Chờ duyệt',
      approved: '✅ Đã duyệt',
      rejected: '❌ Từ chối'
    };
    return badges[status] || '⚪ Không rõ';
  }

  /**
   * Sleep function
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry function with exponential backoff
   */
  static async retry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.sleep(delay * Math.pow(2, i));
      }
    }
  }

  /**
   * Parse command arguments
   */
  static parseCommand(text) {
    const parts = text.trim().split(/\s+/);
    return {
      command: parts[0].toLowerCase(),
      args: parts.slice(1)
    };
  }

  /**
   * Create pagination buttons
   */
  static createPaginationButtons(currentPage, totalPages, callbackPrefix) {
    const buttons = [];
    
    if (totalPages <= 1) return buttons;

    const row = [];
    
    if (currentPage > 1) {
      row.push({ text: '◀️ Trước', callback_data: `${callbackPrefix}_${currentPage - 1}` });
    }
    
    row.push({ text: `${currentPage}/${totalPages}`, callback_data: 'noop' });
    
    if (currentPage < totalPages) {
      row.push({ text: 'Sau ▶️', callback_data: `${callbackPrefix}_${currentPage + 1}` });
    }
    
    buttons.push(row);
    return buttons;
  }

  /**
   * Group array into chunks
   */
  static chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Calculate time ago
   */
  static timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    const intervals = {
      năm: 31536000,
      tháng: 2592000,
      tuần: 604800,
      ngày: 86400,
      giờ: 3600,
      phút: 60
    };
    
    for (const [name, secondsInInterval] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInInterval);
      if (interval >= 1) {
        return `${interval} ${name} trước`;
      }
    }
    
    return 'vừa xong';
  }
}

module.exports = Utils;
