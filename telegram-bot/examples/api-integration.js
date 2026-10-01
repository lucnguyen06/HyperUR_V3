/**
 * Example API Integration
 * Tích hợp bot với REST API backend
 */

const express = require('express');
const app = express();
const Database = require('./database');

const db = new Database('./database/bot-data.json');

app.use(express.json());

/**
 * GET /api/bills/:userId
 * Lấy danh sách bills của user
 */
app.get('/api/bills/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const bills = db.getUserBills(userId);
    
    res.json({
      success: true,
      data: bills
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bills/status/:billId
 * Kiểm tra trạng thái đơn
 */
app.get('/api/bills/status/:billId', (req, res) => {
  try {
    const bill = db.getBillById(req.params.billId);
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: bill.id,
        status: bill.status,
        deviceCode: bill.deviceCode,
        romLink: bill.romLink,
        createdAt: bill.createdAt,
        approvedAt: bill.approvedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/stats
 * Thống kê tổng quan
 */
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/webhook/payment
 * Webhook từ payment gateway
 */
app.post('/api/webhook/payment', (req, res) => {
  try {
    const { transactionId, userId, amount, status } = req.body;
    
    // Verify payment signature
    // ...
    
    if (status === 'success') {
      // Auto-approve bills của user này
      const pendingBills = db.getUserBills(userId)
        .filter(b => b.status === 'pending');
      
      if (pendingBills.length > 0) {
        const bill = pendingBills[0];
        db.approveBill(bill.id, 'auto', null);
        
        // Notify user qua bot
        // bot.telegram.sendMessage(userId, '✅ Thanh toán thành công!...');
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/approve
 * Admin approve qua API
 */
app.post('/api/admin/approve', (req, res) => {
  try {
    const { billId, adminId, romLink } = req.body;
    
    // Validate admin
    const adminIds = process.env.ADMIN_IDS.split(',').map(id => parseInt(id));
    if (!adminIds.includes(adminId)) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    const bill = db.approveBill(billId, adminId, romLink);
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }
    
    res.json({
      success: true,
      data: bill
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start API server
const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`📡 API Server running on port ${PORT}`);
});

module.exports = app;
