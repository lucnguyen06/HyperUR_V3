/**
 * HyperUR Telegram Bot - Bill Management System
 * Nhận và xử lý bill đăng ký ROM từ user
 */

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs-extra');
const path = require('path');
const { format } = require('date-fns');
const config = require('./config');
const Database = require('./database');
const BillHandler = require('./handlers/billHandler');
const AdminHandler = require('./handlers/adminHandler');
const UserHandler = require('./handlers/userHandler');
const CallbackHandler = require('./callbackHandler');
const CronJobs = require('./cronJobs');
const Logger = require('./logger');

// Validate config
try {
  config.validate();
} catch (error) {
  console.error('❌ Configuration Error:', error.message);
  process.exit(1);
}

// Khởi tạo logger
const logger = new Logger(config.storage.logs.folder);

// Khởi tạo bot
const bot = new Telegraf(config.bot.token);

// Khởi tạo database
const db = new Database(config.database.path);

// Khởi tạo handlers
const billHandler = new BillHandler(db);
const adminHandler = new AdminHandler(db);
const userHandler = new UserHandler(db);

// Danh sách admin IDs
const ADMIN_IDS = config.admin.ids;

// Middleware kiểm tra admin
const isAdmin = (ctx) => {
  return ADMIN_IDS.includes(ctx.from.id);
};

// Setup callback handler
const callbackHandler = new CallbackHandler(bot, db);

// Setup cron jobs (nếu enabled)
let cronJobs = null;
if (config.features.cronJobs) {
  cronJobs = new CronJobs(bot, db);
}

/**
 * ========================================
 * COMMAND HANDLERS
 * ========================================
 */

// /start - Chào mừng user
bot.command('start', async (ctx) => {
  const firstName = ctx.from.first_name || 'bạn';
  
  await ctx.replyWithPhoto(
    { url: 'https://t.me/i/userpic/320/hypermodupdate.jpg' },
    {
      caption: `🚀 *Chào mừng ${firstName} đến với HyperUR Bot!*\n\n` +
        `Bot hỗ trợ đăng ký và quản lý ROM HyperOS cho thiết bị Xiaomi/Redmi.\n\n` +
        `📋 *Các chức năng chính:*\n` +
        `• Gửi bill thanh toán để đăng ký ROM\n` +
        `• Tra cứu trạng thái đơn đăng ký\n` +
        `• Nhận link tải ROM sau khi được duyệt\n` +
        `• Hỗ trợ 121+ thiết bị HyperOS 1.0 - 3.0\n\n` +
        `💡 *Hướng dẫn sử dụng:*\n` +
        `1️⃣ Gửi ảnh bill thanh toán cho bot\n` +
        `2️⃣ Điền đầy đủ thông tin:\n` +
        `   • Email liên hệ\n` +
        `   • Mã thiết bị (codename)\n` +
        `   • Số serial thiết bị\n` +
        `   • Mã giao dịch / Lời nhắn CK\n` +
        `3️⃣ Chờ admin duyệt (thường < 24h)\n` +
        `4️⃣ Nhận link ROM qua bot\n\n` +
        `🌐 Website: ${process.env.HYPERUR_WEBSITE_URL || 'hyperur.com'}\n` +
        `📢 Channel: @hypermodupdate`,
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📤 Gửi Bill', 'send_bill')],
        [Markup.button.callback('🔍 Tra Cứu Đơn', 'check_status')],
        [Markup.button.url('🌐 Website HyperUR', process.env.HYPERUR_WEBSITE_URL || 'https://t.me/hypermodupdate')]
      ])
    }
  );
});

// /help - Hướng dẫn
bot.command('help', async (ctx) => {
  await ctx.reply(
    `📚 *HƯỚNG DẪN SỬ DỤNG BOT*\n\n` +
    `*Lệnh cơ bản:*\n` +
    `/start - Khởi động bot\n` +
    `/help - Xem hướng dẫn\n` +
    `/mybills - Xem danh sách bill của bạn\n` +
    `/cancel - Hủy thao tác hiện tại\n\n` +
    `*Cách gửi bill:*\n` +
    `1. Gửi ảnh bill thanh toán trực tiếp cho bot\n` +
    `2. Bot sẽ hỏi thông tin thiết bị\n` +
    `3. Nhập codename máy (ví dụ: houji, garnet)\n` +
    `4. Xác nhận thông tin\n` +
    `5. Chờ admin duyệt\n\n` +
    `*Tra cứu:*\n` +
    `Dùng /mybills để xem tất cả bill đã gửi`,
    { parse_mode: 'Markdown' }
  );
});

// /mybills - Xem danh sách bill của user
bot.command('mybills', async (ctx) => {
  await userHandler.showUserBills(ctx);
});

// /cancel - Hủy thao tác
bot.command('cancel', async (ctx) => {
  await billHandler.cancelCurrentAction(ctx);
  await ctx.reply('❌ Đã hủy thao tác hiện tại.', Markup.removeKeyboard());
});

/**
 * ========================================
 * ADMIN COMMANDS
 * ========================================
 */

// /admin - Panel admin
bot.command('admin', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ Bạn không có quyền truy cập lệnh này.');
  }
  
  await adminHandler.showAdminPanel(ctx);
});

// /pending - Xem bill chờ duyệt
bot.command('pending', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ Bạn không có quyền truy cập lệnh này.');
  }
  
  await adminHandler.showPendingBills(ctx);
});

// /stats - Thống kê
bot.command('stats', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ Bạn không có quyền truy cập lệnh này.');
  }
  
  await adminHandler.showStats(ctx);
});

/**
 * ========================================
 * CALLBACK QUERY HANDLERS
 * ========================================
 */

bot.action('send_bill', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    `📤 *Gửi Bill Đăng Ký ROM*\n\n` +
    `Vui lòng gửi ảnh bill thanh toán của bạn.\n\n` +
    `✅ Chấp nhận: JPG, PNG\n` +
    `📌 Lưu ý: Ảnh phải rõ ràng, đầy đủ thông tin`,
    { parse_mode: 'Markdown' }
  );
  
  billHandler.setUserState(ctx.from.id, 'awaiting_bill');
});

bot.action('check_status', async (ctx) => {
  await ctx.answerCbQuery();
  await userHandler.showUserBills(ctx);
});

// Admin approve/reject callbacks
bot.action(/^approve_(.+)$/, async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.answerCbQuery('⛔ Không có quyền');
  }
  
  const billId = ctx.match[1];
  await adminHandler.approveBill(ctx, billId);
});

bot.action(/^reject_(.+)$/, async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.answerCbQuery('⛔ Không có quyền');
  }
  
  const billId = ctx.match[1];
  await adminHandler.rejectBill(ctx, billId);
});

bot.action(/^view_bill_(.+)$/, async (ctx) => {
  const billId = ctx.match[1];
  await userHandler.showBillDetail(ctx, billId);
});

/**
 * ========================================
 * MESSAGE HANDLERS
 * ========================================
 */

// Nhận ảnh bill
bot.on('photo', async (ctx) => {
  await billHandler.handlePhotoUpload(ctx);
});

// Nhận text response
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const state = billHandler.getUserState(userId);
  
  if (state === 'awaiting_email') {
    await billHandler.handleEmailInput(ctx);
  } else if (state === 'awaiting_device') {
    await billHandler.handleDeviceInput(ctx);
  } else if (state === 'awaiting_serial') {
    await billHandler.handleSerialInput(ctx);
  } else if (state === 'awaiting_transaction') {
    await billHandler.handleTransactionInput(ctx);
  } else {
    // Default text handler
    await ctx.reply(
      'Sử dụng /start để bắt đầu hoặc /help để xem hướng dẫn.'
    );
  }
});

/**
 * ========================================
 * ERROR HANDLING
 * ========================================
 */

bot.catch((err, ctx) => {
  logger.error(`Error for ${ctx.updateType}`, { error: err.message, userId: ctx.from?.id });
  ctx.reply('⚠️ Đã xảy ra lỗi. Vui lòng thử lại sau.');
});

/**
 * ========================================
 * BOT LAUNCH
 * ========================================
 */

// Tạo thư mục lưu trữ
fs.ensureDirSync(config.storage.bills.folder);
fs.ensureDirSync(path.dirname(config.database.path));
if (config.storage.logs.enabled) {
  fs.ensureDirSync(config.storage.logs.folder);
}

// Khởi động bot
bot.launch({
  dropPendingUpdates: true
}).then(() => {
  logger.info('HyperUR Telegram Bot started successfully');
  console.log('🚀 HyperUR Telegram Bot đã khởi động!');
  console.log(`👥 Admin IDs: ${ADMIN_IDS.join(', ')}`);
  console.log(`📁 Bills folder: ${config.storage.bills.folder}`);
  console.log(`🗄️  Database: ${config.database.path}`);
  console.log(`🌐 Website: ${config.hyperur.websiteUrl}`);
  
  // Start cron jobs
  if (cronJobs) {
    cronJobs.start();
  }
});

// Graceful shutdown
const shutdown = (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  if (cronJobs) {
    cronJobs.stop();
  }
  
  bot.stop(signal);
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

module.exports = bot;
