/**
 * Admin Handler - Xử lý các chức năng admin
 */

const { Markup } = require('telegraf');

class AdminHandler {
  constructor(database) {
    this.db = database;
  }

  /**
   * ADMIN PANEL
   */

  async showAdminPanel(ctx) {
    const stats = this.db.getStats();

    const message = `
🔐 *ADMIN PANEL - HYPERUR BOT*

📊 *Thống kê hệ thống:*
• Tổng đơn: ${stats.totalBills}
• Chờ duyệt: ${stats.pendingBills} 🟡
• Đã duyệt: ${stats.approvedBills} ✅
• Từ chối: ${stats.rejectedBills} ❌
• Tổng users: ${stats.totalUsers}

⏰ Cập nhật: ${new Date().toLocaleString('vi-VN')}
`;

    await ctx.reply(
      message,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔔 Đơn chờ duyệt (' + stats.pendingBills + ')', 'admin_pending')],
          [Markup.button.callback('📊 Thống kê chi tiết', 'admin_stats')],
          [Markup.button.callback('🔄 Làm mới', 'admin_refresh')]
        ])
      }
    );
  }

  /**
   * SHOW PENDING BILLS
   */

  async showPendingBills(ctx) {
    const pendingBills = this.db.getPendingBills();

    if (pendingBills.length === 0) {
      await ctx.reply('✅ Không có đơn nào đang chờ duyệt.');
      return;
    }

    await ctx.reply(
      `🔔 *${pendingBills.length} ĐơN CHỜ DUYỆT*\n\n` +
      'Đang gửi chi tiết từng đơn...',
      { parse_mode: 'Markdown' }
    );

    // Gửi từng bill
    for (const bill of pendingBills.slice(0, 10)) { // Giới hạn 10 đơn mỗi lần
      await this.sendBillToAdmin(ctx, bill);
    }

    if (pendingBills.length > 10) {
      await ctx.reply(
        `ℹ️ Còn ${pendingBills.length - 10} đơn khác. ` +
        'Dùng /pending để xem tiếp.'
      );
    }
  }

  /**
   * SEND BILL DETAILS TO ADMIN
   */

  async sendBillToAdmin(ctx, bill) {
    const message = `
📝 *Mã đơn:* \`${bill.id}\`
👤 *User:* ${bill.firstName}${bill.username ? ` (@${bill.username})` : ''}
👤 *User ID:* \`${bill.userId}\`
📱 *Thiết bị:* \`${bill.deviceCode || 'Chưa rõ'}\`
⏰ *Thời gian:* ${new Date(bill.createdAt).toLocaleString('vi-VN')}
📊 *Trạng thái:* ${this.getStatusEmoji(bill.status)} ${bill.status.toUpperCase()}
`;

    try {
      await ctx.telegram.sendPhoto(
        ctx.chat.id,
        bill.photoFileId,
        {
          caption: message,
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Duyệt', `approve_${bill.id}`),
              Markup.button.callback('❌ Từ chối', `reject_${bill.id}`)
            ],
            [Markup.button.callback('📋 Chi tiết', `admin_bill_${bill.id}`)]
          ])
        }
      );
    } catch (error) {
      console.error('Error sending bill to admin:', error);
    }
  }

  /**
   * APPROVE BILL
   */

  async approveBill(ctx, billId) {
    const bill = this.db.getBillById(billId);

    if (!bill) {
      await ctx.answerCbQuery('❌ Không tìm thấy đơn');
      return;
    }

    if (bill.status !== 'pending') {
      await ctx.answerCbQuery('⚠️ Đơn này đã được xử lý');
      return;
    }

    // Hỏi link ROM
    await ctx.answerCbQuery('✅ Đang xử lý...');
    await ctx.reply(
      `✅ *Duyệt đơn ${billId}*\n\n` +
      `📱 Thiết bị: \`${bill.deviceCode}\`\n\n` +
      `Vui lòng gửi link ROM cho thiết bị này:\n` +
      `(Hoặc gửi "ok" để duyệt không có link)`,
      { parse_mode: 'Markdown' }
    );

    // Lưu trạng thái chờ link ROM
    this.pendingApproval = { billId, adminId: ctx.from.id };
  }

  async handleRomLinkInput(ctx, billId, romLink) {
    const bill = this.db.approveBill(billId, ctx.from.id, romLink !== 'ok' ? romLink : null);

    if (!bill) {
      await ctx.reply('❌ Không thể duyệt đơn');
      return;
    }

    // Thông báo cho admin
    await ctx.reply(
      `✅ *Đã duyệt đơn thành công!*\n\n` +
      `📝 Mã đơn: \`${bill.id}\`\n` +
      `📱 Thiết bị: \`${bill.deviceCode}\`\n` +
      `${romLink && romLink !== 'ok' ? `🔗 Link ROM: ${romLink}` : ''}`,
      { parse_mode: 'Markdown' }
    );

    // Thông báo cho user
    await this.notifyUser(ctx, bill, 'approved');

    this.pendingApproval = null;
  }

  /**
   * REJECT BILL
   */

  async rejectBill(ctx, billId) {
    const bill = this.db.getBillById(billId);

    if (!bill) {
      await ctx.answerCbQuery('❌ Không tìm thấy đơn');
      return;
    }

    if (bill.status !== 'pending') {
      await ctx.answerCbQuery('⚠️ Đơn này đã được xử lý');
      return;
    }

    await ctx.answerCbQuery('❌ Đang xử lý...');
    await ctx.reply(
      `❌ *Từ chối đơn ${billId}*\n\n` +
      `📱 Thiết bị: \`${bill.deviceCode}\`\n\n` +
      `Vui lòng nhập lý do từ chối:\n` +
      `(Hoặc gửi "ok" để từ chối không ghi lý do)`,
      { parse_mode: 'Markdown' }
    );

    // Lưu trạng thái chờ lý do
    this.pendingRejection = { billId, adminId: ctx.from.id };
  }

  async handleRejectReasonInput(ctx, billId, reason) {
    const bill = this.db.rejectBill(billId, ctx.from.id, reason !== 'ok' ? reason : '');

    if (!bill) {
      await ctx.reply('❌ Không thể từ chối đơn');
      return;
    }

    // Thông báo cho admin
    await ctx.reply(
      `❌ *Đã từ chối đơn!*\n\n` +
      `📝 Mã đơn: \`${bill.id}\`\n` +
      `📱 Thiết bị: \`${bill.deviceCode}\`\n` +
      `${reason && reason !== 'ok' ? `📋 Lý do: ${reason}` : ''}`,
      { parse_mode: 'Markdown' }
    );

    // Thông báo cho user
    await this.notifyUser(ctx, bill, 'rejected');

    this.pendingRejection = null;
  }

  /**
   * NOTIFY USER
   */

  async notifyUser(ctx, bill, status) {
    let message = '';

    if (status === 'approved') {
      message = `
✅ *ĐƠN ĐĂNG KÝ ĐÃ ĐƯỢC DUYỆT!*

📝 Mã đơn: \`${bill.id}\`
📱 Thiết bị: \`${bill.deviceCode}\`
⏰ Thời gian duyệt: ${new Date(bill.approvedAt).toLocaleString('vi-VN')}

${bill.romLink ? `🔗 *Link tải ROM:*\n${bill.romLink}\n\n` : ''}📖 Hướng dẫn cài đặt: ${process.env.HYPERUR_WEBSITE_URL}/guide.html
💬 Hỗ trợ: @hypermodupdate

Cảm ơn bạn đã tin tưởng HyperUR! 🚀
`;
    } else if (status === 'rejected') {
      message = `
❌ *ĐƠN ĐĂNG KÝ KHÔNG ĐƯỢC DUYỆT*

📝 Mã đơn: \`${bill.id}\`
📱 Thiết bị: \`${bill.deviceCode}\`
⏰ Thời gian: ${new Date(bill.approvedAt).toLocaleString('vi-VN')}

${bill.notes ? `📋 Lý do: ${bill.notes}\n\n` : ''}Vui lòng liên hệ admin để được hỗ trợ: @hypermodupdate
`;
    }

    try {
      await ctx.telegram.sendMessage(bill.userId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error(`Error notifying user ${bill.userId}:`, error);
    }
  }

  /**
   * SHOW STATISTICS
   */

  async showStats(ctx) {
    const stats = this.db.getStats();
    const pendingBills = this.db.getPendingBills();
    const recentBills = this.db.data.bills.slice(-10).reverse();

    const message = `
📊 *THỐNG KÊ CHI TIẾT*

*Tổng quan:*
• Tổng đơn: ${stats.totalBills}
• Chờ duyệt: ${stats.pendingBills} 🟡
• Đã duyệt: ${stats.approvedBills} ✅
• Từ chối: ${stats.rejectedBills} ❌
• Tổng users: ${stats.totalUsers}

*Tỷ lệ duyệt:*
${stats.totalBills > 0 ? `• ${((stats.approvedBills / stats.totalBills) * 100).toFixed(1)}% đơn được duyệt` : '• Chưa có dữ liệu'}

*10 đơn gần nhất:*
${recentBills.map(b => {
  return `• ${this.getStatusEmoji(b.status)} \`${b.id}\` - ${b.deviceCode || 'N/A'}`;
}).join('\n')}

⏰ ${new Date().toLocaleString('vi-VN')}
`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  /**
   * UTILITIES
   */

  getStatusEmoji(status) {
    const emojis = {
      pending: '🟡',
      approved: '✅',
      rejected: '❌'
    };
    return emojis[status] || '⚪';
  }
}

module.exports = AdminHandler;
