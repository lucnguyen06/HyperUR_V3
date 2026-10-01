/**
 * Example: Google Drive API Integration
 * Tự động lấy ROM link từ Google Drive
 */

const { google } = require('googleapis');
const fs = require('fs');

class GoogleDriveIntegration {
  constructor() {
    this.drive = null;
    this.initialized = false;
  }

  /**
   * Initialize Google Drive API
   * Cần credentials.json từ Google Cloud Console
   */
  async initialize() {
    try {
      // Load credentials từ file
      const credentials = JSON.parse(
        fs.readFileSync('./config/google-credentials.json', 'utf8')
      );

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
      });

      this.drive = google.drive({ version: 'v3', auth });
      this.initialized = true;

      console.log('✅ Google Drive API initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive API:', error);
      throw error;
    }
  }

  /**
   * Tìm file ROM theo device code
   */
  async findRomFile(deviceCode, osVersion = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Build search query
      let query = `name contains '${deviceCode}' and mimeType != 'application/vnd.google-apps.folder'`;
      
      if (osVersion) {
        query += ` and name contains '${osVersion}'`;
      }

      // Search files
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink, size, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 10
      });

      const files = response.data.files;

      if (files.length === 0) {
        console.log(`No ROM found for ${deviceCode}`);
        return null;
      }

      // Trả về file mới nhất
      const file = files[0];

      return {
        id: file.id,
        name: file.name,
        link: file.webViewLink,
        size: this.formatFileSize(file.size),
        date: new Date(file.modifiedTime).toLocaleDateString('vi-VN')
      };

    } catch (error) {
      console.error('Error finding ROM file:', error);
      return null;
    }
  }

  /**
   * Lấy tất cả ROM files trong folder
   */
  async listAllRoms(folderId) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder'`,
        fields: 'files(id, name, webViewLink, size, modifiedTime)',
        orderBy: 'name',
        pageSize: 100
      });

      return response.data.files.map(file => ({
        id: file.id,
        name: file.name,
        link: file.webViewLink,
        size: this.formatFileSize(file.size),
        date: new Date(file.modifiedTime).toLocaleDateString('vi-VN')
      }));

    } catch (error) {
      console.error('Error listing ROMs:', error);
      return [];
    }
  }

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
  }

  /**
   * Extract device code from filename
   */
  extractDeviceCode(filename) {
    // Example: "HyperOS_houji_OS2.0_V14.0.24.12.01.zip"
    const match = filename.match(/HyperOS_(\w+)_/);
    return match ? match[1] : null;
  }

  /**
   * Extract OS version from filename
   */
  extractOsVersion(filename) {
    const match = filename.match(/OS(\d+\.\d+)/);
    return match ? match[0] : null;
  }
}

module.exports = GoogleDriveIntegration;

// Example usage in adminHandler.js:
/*
const GoogleDriveIntegration = require('./examples/google-drive-integration');
const gdrive = new GoogleDriveIntegration();

async approveBill(ctx, billId) {
  const bill = this.db.getBillById(billId);
  
  // Auto-fetch ROM link from Google Drive
  const romFile = await gdrive.findRomFile(bill.deviceCode);
  
  if (romFile) {
    // Tự động duyệt với link từ Drive
    await this.handleRomLinkInput(ctx, billId, romFile.link);
    
    await ctx.reply(
      `✅ Đã tìm thấy ROM tự động!\n\n` +
      `📱 File: ${romFile.name}\n` +
      `📦 Size: ${romFile.size}\n` +
      `📅 Date: ${romFile.date}`
    );
  } else {
    // Không tìm thấy, hỏi admin nhập thủ công
    await ctx.reply('⚠️ Không tìm thấy ROM tự động. Vui lòng nhập link:');
  }
}
*/
