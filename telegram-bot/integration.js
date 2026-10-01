/**
 * Integration with HyperUR Website
 * Kết nối bot với hệ thống website HyperUR_V3
 */

const fs = require('fs-extra');
const path = require('path');

class HyperURIntegration {
  constructor(database) {
    this.db = database;
    this.websitePath = path.join(__dirname, '../../'); // Path to HyperUR_V3 root
  }

  /**
   * Đồng bộ serial đã đăng ký với website
   * Tạo file serial data để website có thể tra cứu
   */
  async syncSerialRegistrations() {
    try {
      const approvedBills = this.db.data.bills.filter(b => b.status === 'approved');
      
      const serialData = approvedBills.map(bill => {
        const user = this.db.data.users[bill.userId];
        
        return {
          serialNumber: this.generateSerial(bill),
          deviceCode: bill.deviceCode,
          registeredAt: bill.approvedAt,
          userId: bill.userId,
          username: bill.username,
          firstName: bill.firstName,
          romLink: bill.romLink,
          status: 'active'
        };
      });

      // Lưu vào file để website đọc
      const serialFilePath = path.join(this.websitePath, 'data', 'registered-serials.json');
      await fs.ensureDir(path.dirname(serialFilePath));
      await fs.writeJson(serialFilePath, {
        lastUpdate: new Date().toISOString(),
        count: serialData.length,
        serials: serialData
      }, { spaces: 2 });

      console.log(`✅ Đã đồng bộ ${serialData.length} serial với website`);
      return serialData;

    } catch (error) {
      console.error('❌ Lỗi đồng bộ serial:', error);
      return null;
    }
  }

  /**
   * Tạo serial number từ bill
   */
  generateSerial(bill) {
    // Format: HUR-DEVICECODE-TIMESTAMP
    const timestamp = new Date(bill.approvedAt).getTime().toString(36).toUpperCase();
    return `HUR-${bill.deviceCode.toUpperCase()}-${timestamp}`;
  }

  /**
   * Lấy danh sách thiết bị từ website catalog
   */
  async getDeviceList() {
    try {
      const catalogPath = path.join(this.websitePath, 'devices_catalog.json');
      
      if (await fs.pathExists(catalogPath)) {
        const catalog = await fs.readJson(catalogPath);
        return Object.keys(catalog);
      }

      // Fallback: Đọc từ manifest
      const manifestPath = path.join(this.websitePath, 'devices', 'manifest.json');
      if (await fs.pathExists(manifestPath)) {
        const manifest = await fs.readJson(manifestPath);
        return manifest.devices || [];
      }

      return [];

    } catch (error) {
      console.error('❌ Lỗi đọc danh sách thiết bị:', error);
      return [];
    }
  }

  /**
   * Kiểm tra device code có hợp lệ không
   */
  async validateDeviceCode(deviceCode) {
    const devices = await this.getDeviceList();
    return devices.includes(deviceCode.toLowerCase());
  }

  /**
   * Lấy thông tin thiết bị
   */
  async getDeviceInfo(deviceCode) {
    try {
      // Thử đọc từ catalog trước
      const catalogPath = path.join(this.websitePath, 'devices_catalog.json');
      if (await fs.pathExists(catalogPath)) {
        const catalog = await fs.readJson(catalogPath);
        if (catalog[deviceCode]) {
          return catalog[deviceCode];
        }
      }

      // Fallback: Đọc từ file riêng
      const devicePath = path.join(this.websitePath, 'devices', `${deviceCode}.json`);
      if (await fs.pathExists(devicePath)) {
        return await fs.readJson(devicePath);
      }

      return null;

    } catch (error) {
      console.error(`❌ Lỗi đọc thông tin thiết bị ${deviceCode}:`, error);
      return null;
    }
  }

  /**
   * Lấy ROM link từ Google Drive data
   */
  async getRomLink(deviceCode, osVersion = null) {
    try {
      const activeRomsPath = path.join(this.websitePath, 'active_roms.json');
      
      if (await fs.pathExists(activeRomsPath)) {
        const activeRoms = await fs.readJson(activeRomsPath);
        
        if (activeRoms[deviceCode]) {
          const deviceRoms = activeRoms[deviceCode].roms;
          
          if (osVersion && deviceRoms[osVersion]) {
            return deviceRoms[osVersion].download;
          }
          
          // Lấy ROM mới nhất
          const romKeys = Object.keys(deviceRoms).sort().reverse();
          if (romKeys.length > 0) {
            return deviceRoms[romKeys[0]].download;
          }
        }
      }

      return null;

    } catch (error) {
      console.error(`❌ Lỗi lấy ROM link cho ${deviceCode}:`, error);
      return null;
    }
  }

  /**
   * Export thống kê cho website
   */
  async exportStats() {
    try {
      const stats = this.db.getStats();
      const recentBills = this.db.data.bills
        .filter(b => b.status === 'approved')
        .slice(-20)
        .reverse();

      const exportData = {
        lastUpdate: new Date().toISOString(),
        stats: stats,
        recentRegistrations: recentBills.map(b => ({
          deviceCode: b.deviceCode,
          registeredAt: b.approvedAt
        })),
        popularDevices: this.getPopularDevices()
      };

      const statsPath = path.join(this.websitePath, 'data', 'bot-stats.json');
      await fs.ensureDir(path.dirname(statsPath));
      await fs.writeJson(statsPath, exportData, { spaces: 2 });

      console.log('✅ Đã export thống kê');
      return exportData;

    } catch (error) {
      console.error('❌ Lỗi export thống kê:', error);
      return null;
    }
  }

  /**
   * Lấy thiết bị phổ biến
   */
  getPopularDevices() {
    const deviceCount = {};
    
    this.db.data.bills
      .filter(b => b.status === 'approved' && b.deviceCode)
      .forEach(b => {
        deviceCount[b.deviceCode] = (deviceCount[b.deviceCode] || 0) + 1;
      });

    return Object.entries(deviceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ code, count }));
  }

  /**
   * Tạo badge HTML cho website
   */
  generateBadgeHtml() {
    const stats = this.db.getStats();
    
    return `
<!-- HyperUR Bot Stats Badge -->
<div class="hyperur-bot-badge">
  <span class="badge-icon">🤖</span>
  <span class="badge-text">
    ${stats.approvedBills} người đã đăng ký qua Telegram Bot
  </span>
  <a href="https://t.me/your_bot_username" class="badge-link">Đăng ký ngay →</a>
</div>
    `.trim();
  }
}

module.exports = HyperURIntegration;
