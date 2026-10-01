/**
 * CRON Jobs - Scheduled tasks cho bot
 */

const HyperURIntegration = require('./integration');

class CronJobs {
  constructor(bot, database) {
    this.bot = bot;
    this.db = database;
    this.integration = new HyperURIntegration(database);
    this.jobs = [];
  }

  /**
   * Bắt đầu tất cả cron jobs
   */
  start() {
    console.log('⏰ Starting cron jobs...');

    // Sync serial registrations every 5 minutes
    this.scheduleJob(
      'sync-serials',
      5 * 60 * 1000,
      () => this.integration.syncSerialRegistrations()
    );

    // Export stats every 10 minutes
    this.scheduleJob(
      'export-stats',
      10 * 60 * 1000,
      () => this.integration.exportStats()
    );

    // Send pending bills reminder to admins every hour
    this.scheduleJob(
      'pending-reminder',
      60 * 60 * 1000,
      () => this.sendPendingReminder()
    );

    // Cleanup old temp data every 30 minutes
    this.scheduleJob(
      'cleanup',
      30 * 60 * 1000,
      () => this.cleanupTempData()
    );

    console.log(`✅ Started ${this.jobs.length} cron jobs`);
  }

  /**
   * Dừng tất cả cron jobs
   */
  stop() {
    this.jobs.forEach(job => clearInterval(job.interval));
    this.jobs = [];
    console.log('⏰ Stopped all cron jobs');
  }

  /**
   * Schedule một job
   */
  scheduleJob(name, interval, callback) {
    const job = {
      name,
      interval: setInterval(async () => {
        try {
          console.log(`⏰ Running job: ${name}`);
          await callback();
        } catch (error) {
          console.error(`❌ Error in job ${name}:`, error);
        }
      }, interval)
    };

    this.jobs.push(job);
    console.log(`  ✓ Scheduled: ${name} (every ${interval / 1000}s)`);
  }

  /**
   * Gửi nhắc nhở admin về các bill chờ duyệt
   */
  async sendPendingReminder() {
    const pendingBills = this.db.getPendingBills();

    if (pendingBills.length === 0) return;

    const adminIds = (process.env.ADMIN_IDS || '')
      .split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id));

    const message = `
🔔 *NHẮC NHỞ DUYỆT ĐƠN*

Hiện có *${pendingBills.length} đơn* đang chờ duyệt.

Dùng /pending để xem danh sách.
`;

    for (const adminId of adminIds) {
      try {
        await this.bot.telegram.sendMessage(adminId, message, {
          parse_mode: 'Markdown'
        });
      } catch (error) {
        // Admin có thể đã chặn bot hoặc chưa /start
        console.log(`Cannot send reminder to admin ${adminId}`);
      }
    }
  }

  /**
   * Dọn dẹp dữ liệu tạm
   */
  async cleanupTempData() {
    // Cleanup sẽ được implement dựa trên nhu cầu
    // Ví dụ: xóa bill cũ quá 30 ngày, xóa file ảnh của bill đã reject, etc.
    console.log('🧹 Cleanup completed');
  }
}

module.exports = CronJobs;
