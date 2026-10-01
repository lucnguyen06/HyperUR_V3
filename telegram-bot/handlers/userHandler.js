/**
 * User Handler - Xử lý các chức năng của user
 */

const { Markup } = require('telegraf');

class UserHandler {
  constructor(database) {
    this.db = database;
  }

  /**
   * SHOW USER BILLS
   */

  async showUserBills(ctx) {
    const userId = ctx.from.id;
    const bills = this.db.getUserBills(userId);

    if (bills.length === 0) {
      await ctx.reply(
        '📭 *Bạn chưa có đơn nào.*\n\n' +
        'Gửi bill thanh toán để đăng ký ROM!',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📤 Gửi Bill', 'send_bill')]
          ])
        }
      );
      return;
    }

    // Tạo message tổng quan
    const pendingCount = bills.filter(b => b.status === 'pending').length;
    const approvedCount = bills.filter(b => b.status === 'approved').length;
    const rejectedCount = bills.filter(b => b.status === 'rejected').length;

    let message = `
📋 *DANH SÁCH ĐƠN ĐĂNG KÝ CỦA BẠN*

📊 *Tổng quan:*
• Tổng đơn: ${bills.length}
• Chờ duyệt: ${pendingCount} 🟡
• Đã duyệt: ${approvedCount} ✅
• Từ chối: ${rejectedCount} ❌

📝 *Danh sách đơn:*
`;

    // Hiển thị 5 đơn gần nhất
    const recentBills = bills.slice(0, 5);
    
    for (const bill of recentBills) {
      const statusEmoji = this.getStatusEmoji(bill.status);
      const deviceInfo = bill.deviceCode || 'N/A';
      const timeStr = new Date(bill.createdAt).toLocaleDateString('vi-VN');
      
      message += `\n${statusEmoji} \`${bill.id}\`\n`;
      message += `   📱 ${deviceInfo} • ${timeStr}`;
    }

    if (bills.length > 5) {
      message += `\n\n_Và ${bills.length - 5} đơn khác..._`;
    }

    // Tạo inline keyboard
    const buttons = [];
    
    // Nút xem chi tiết từng đơn (tối đa 5 đơn gần nhất)
    for (let i = 0; i < Math.min(bills.length, 3); i++) {
      const bill = bills[i];
      buttons.push([
        Markup.button.callback(
          `${this.getStatusEmoji(bill.status)} ${bill.deviceCode || bill.id.substring(0, 8)}`,
          `view_bill_${bill.id}`
        )
      ]);
    }

    buttons.push([Markup.button.callback('📤 Gửi đơn mới', 'send_bill')]);

    await ctx.reply(
      message,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      }
    );
  }

  /**
   * SHOW BILL DETAIL
   */

  async showBillDetail(ctx, billId) {
    const userId = ctx.from.id;
    const bill = this.db.getBillById(billId);

    if (!bill) {
      await ctx.answerCbQuery('❌ Không tìm thấy đơn');
      return;
    }

    // Kiểm tra quyền xem
    if (bill.userId !== userId && !this.isAdmin(ctx)) {
      await ctx.answerCbQuery('⛔ Bạn không có quyền xem đơn này');
      return;
    }

    await ctx.answerCbQuery();

    // Tạo message chi tiết
    let message = `
📋 *CHI TIẾT ĐƠN ĐĂNG KÝ*

📝 *Mã đơn:* \`${bill.id}\`
📱 *Thiết bị:* \`${bill.deviceCode || 'Chưa rõ'}\`
📊 *Trạng thái:* ${this.getStatusEmoji(bill.status)} ${bill.status.toUpperCase()}

⏰ *Thời gian tạo:* ${new Date(bill.createdAt).toLocaleString('vi-VN')}
`;

    if (bill.status === 'approved') {
      message += `⏰ *Thời gian duyệt:* ${new Date(bill.approvedAt).toLocaleString('vi-VN')}\n`;
      
      if (bill.romLink) {
        message += `\n🔗 *Link tải ROM:*\n${bill.romLink}\n`;
      }
      
      message += `\n📖 *Hướng dẫn cài đặt:*\n${process.env.HYPERUR_WEBSITE_URL}/guide.html`;
    } else if (bill.status === 'rejected') {
      message += `⏰ *Thời gian từ chối:* ${new Date(bill.approvedAt).toLocaleString('vi-VN')}\n`;
      
      if (bill.notes) {
        message += `\n📋 *Lý do:* ${bill.notes}`;
      }
      
      message += `\n\n💬 Liên hệ hỗ trợ: @hypermodupdate`;
    } else if (bill.status === 'pending') {
      message += `\n⏳ *Trạng thái:* Đang chờ admin duyệt\n`;
      message += `⏱️ Admin thường xử lý trong vòng 24h`;
    }

    // Gửi ảnh bill kèm thông tin
    try {
      await ctx.telegram.sendPhoto(
        ctx.chat.id,
        bill.photoFileId,
        {
          caption: message,
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Quay lại', 'check_status')]
          ])
        }
      );
    } catch (error) {
      // Nếu không gửi được ảnh, chỉ gửi text
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Quay lại', 'check_status')]
        ])
      });
    }
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

  getStatusText(status) {
    const texts = {
      pending: 'Chờ duyệt',
      approved: 'Đã duyệt',
      rejected: 'Từ chối'
    };
    return texts[status] || 'Không rõ';
  }

  isAdmin(ctx) {
    const adminIds = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim()));
    return adminIds.includes(ctx.from.id);
  }
}

module.exports = UserHandler;
