/**
 * Database Handler - Quản lý dữ liệu bot
 */

const fs = require('fs-extra');
const path = require('path');

class Database {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {
      bills: [],
      users: {},
      settings: {}
    };
    
    this.load();
  }

  // Load dữ liệu từ file
  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(raw);
        console.log('✅ Database loaded successfully');
      } else {
        this.save();
        console.log('📝 Created new database file');
      }
    } catch (error) {
      console.error('❌ Error loading database:', error);
      this.data = { bills: [], users: {}, settings: {} };
    }
  }

  // Lưu dữ liệu vào file
  save() {
    try {
      fs.ensureDirSync(path.dirname(this.filePath));
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (error) {
      console.error('❌ Error saving database:', error);
    }
  }

  /**
   * BILL MANAGEMENT
   */

  // Tạo bill mới
  createBill(billData) {
    const bill = {
      id: this.generateId(),
      userId: billData.userId,
      username: billData.username,
      firstName: billData.firstName,
      photoPath: billData.photoPath,
      photoFileId: billData.photoFileId,
      deviceCode: billData.deviceCode || null,
      email: billData.email || null,
      serial: billData.serial || null,
      transaction: billData.transaction || null,
      status: 'pending', // pending, approved, rejected
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
      romLink: null,
      notes: ''
    };

    this.data.bills.push(bill);
    this.save();
    return bill;
  }

  // Lấy bill theo ID
  getBillById(billId) {
    return this.data.bills.find(b => b.id === billId);
  }

  // Lấy bills của user
  getUserBills(userId) {
    return this.data.bills.filter(b => b.userId === userId).sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  // Lấy bills chờ duyệt
  getPendingBills() {
    return this.data.bills.filter(b => b.status === 'pending').sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  // Update bill
  updateBill(billId, updates) {
    const bill = this.getBillById(billId);
    if (!bill) return null;

    Object.assign(bill, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return bill;
  }

  // Approve bill
  approveBill(billId, adminId, romLink = null) {
    return this.updateBill(billId, {
      status: 'approved',
      approvedBy: adminId,
      approvedAt: new Date().toISOString(),
      romLink: romLink
    });
  }

  // Reject bill
  rejectBill(billId, adminId, reason = '') {
    return this.updateBill(billId, {
      status: 'rejected',
      approvedBy: adminId,
      approvedAt: new Date().toISOString(),
      notes: reason
    });
  }

  /**
   * USER MANAGEMENT
   */

  // Lấy hoặc tạo user
  getOrCreateUser(userId, userData = {}) {
    if (!this.data.users[userId]) {
      this.data.users[userId] = {
        id: userId,
        username: userData.username || null,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        createdAt: new Date().toISOString(),
        billCount: 0,
        lastActive: new Date().toISOString()
      };
      this.save();
    } else {
      // Update last active
      this.data.users[userId].lastActive = new Date().toISOString();
      if (userData.username) this.data.users[userId].username = userData.username;
      if (userData.firstName) this.data.users[userId].firstName = userData.firstName;
      this.save();
    }
    
    return this.data.users[userId];
  }

  // Tăng số lượng bill của user
  incrementUserBillCount(userId) {
    const user = this.getOrCreateUser(userId);
    user.billCount = (user.billCount || 0) + 1;
    this.save();
  }

  /**
   * STATISTICS
   */

  getStats() {
    const totalBills = this.data.bills.length;
    const pendingBills = this.data.bills.filter(b => b.status === 'pending').length;
    const approvedBills = this.data.bills.filter(b => b.status === 'approved').length;
    const rejectedBills = this.data.bills.filter(b => b.status === 'rejected').length;
    const totalUsers = Object.keys(this.data.users).length;

    return {
      totalBills,
      pendingBills,
      approvedBills,
      rejectedBills,
      totalUsers
    };
  }

  /**
   * UTILITIES
   */

  generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `${timestamp}-${random}`;
  }
}

module.exports = Database;
