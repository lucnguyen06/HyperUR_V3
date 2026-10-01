/**
 * HyperUR Bot - Callback Actions Handler
 * Xử lý các callback từ inline buttons
 */

const BillHandler = require('./handlers/billHandler');
const AdminHandler = require('./handlers/adminHandler');
const UserHandler = require('./handlers/userHandler');

class CallbackHandler {
  constructor(bot, db) {
    this.bot = bot;
    this.db = db;
    this.billHandler = new BillHandler(db);
    this.adminHandler = new AdminHandler(db);
    this.userHandler = new UserHandler(db);
    
    this.setupCallbacks();
  }

  setupCallbacks() {
    // Confirm send bill
    this.bot.action('confirm_send_bill', async (ctx) => {
      await ctx.answerCbQuery('✅ Đã xác nhận');
      
      // Process the saved photo
      const userId = ctx.from.id;
      const tempBill = this.billHandler.tempBills.get(userId);
      
      if (!tempBill) {
        await ctx.reply('❌ Phiên làm việc hết hạn. Vui lòng gửi lại ảnh.');
        return;
      }

      // Simulate photo message
      ctx.message = { photo: [{ file_id: tempBill.photoFileId }] };
      this.billHandler.setUserState(userId, 'awaiting_bill');
      await this.billHandler.processBillPhoto(ctx);
    });

    // Cancel send bill
    this.bot.action('cancel_send_bill', async (ctx) => {
      await ctx.answerCbQuery('❌ Đã hủy');
      await ctx.editMessageText('Đã hủy gửi bill.');
      this.billHandler.clearUserState(ctx.from.id);
    });

    // Submit bill with device code (old format)
    this.bot.action(/^submit_bill_(.+)$/, async (ctx) => {
      const deviceCode = ctx.match[1];
      await ctx.answerCbQuery('📤 Đang gửi...');
      await this.billHandler.submitBill(ctx, deviceCode);
    });

    // Submit bill final (new format with all info)
    this.bot.action('submit_bill_final', async (ctx) => {
      await ctx.answerCbQuery('📤 Đang gửi...');
      await this.billHandler.submitBill(ctx);
    });

    // Cancel submit
    this.bot.action('cancel_submit', async (ctx) => {
      await ctx.answerCbQuery('❌ Đã hủy');
      await ctx.editMessageText('Đã hủy gửi đơn.');
      this.billHandler.clearUserState(ctx.from.id);
    });

    // Admin panel actions
    this.bot.action('admin_pending', async (ctx) => {
      await ctx.answerCbQuery();
      await this.adminHandler.showPendingBills(ctx);
    });

    this.bot.action('admin_stats', async (ctx) => {
      await ctx.answerCbQuery();
      await this.adminHandler.showStats(ctx);
    });

    this.bot.action('admin_refresh', async (ctx) => {
      await ctx.answerCbQuery('🔄 Đang làm mới...');
      await this.adminHandler.showAdminPanel(ctx);
    });

    // Admin bill detail
    this.bot.action(/^admin_bill_(.+)$/, async (ctx) => {
      const billId = ctx.match[1];
      await this.userHandler.showBillDetail(ctx, billId);
    });
  }
}

module.exports = CallbackHandler;
