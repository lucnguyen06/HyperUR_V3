/**
 * HƯỚNG DẪN NÂNG CAO - HYPERUR TELEGRAM BOT
 */

# 🚀 Nâng Cao & Tùy Chỉnh

## 1. Tích Hợp Google Drive API

### Tự động lấy link ROM từ Google Drive

```javascript
// config/googleDrive.js
const { google } = require('googleapis');

class GoogleDriveAPI {
  constructor() {
    this.auth = new google.auth.GoogleAuth({
      keyFile: 'credentials.json',
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
  }

  async getFileLink(deviceCode) {
    const drive = google.drive({ version: 'v3', auth: this.auth });
    
    const response = await drive.files.list({
      q: `name contains '${deviceCode}'`,
      fields: 'files(id, name, webViewLink)'
    });

    return response.data.files[0]?.webViewLink;
  }
}

module.exports = GoogleDriveAPI;
```

### Thêm vào adminHandler.js:

```javascript
const GoogleDriveAPI = require('./config/googleDrive');
const gdrive = new GoogleDriveAPI();

async approveBill(ctx, billId) {
  const bill = this.db.getBillById(billId);
  
  // Tự động lấy link ROM
  const romLink = await gdrive.getFileLink(bill.deviceCode);
  
  if (romLink) {
    await this.handleRomLinkInput(ctx, billId, romLink);
  } else {
    // Hỏi admin nhập thủ công
    // ...existing code
  }
}
```

## 2. Payment Gateway Integration

### Tích hợp Momo/ZaloPay API

```javascript
// config/payment.js
class PaymentGateway {
  async verifyMomoTransaction(transactionId) {
    // Call Momo API
    const response = await fetch('https://api.momo.vn/...', {
      method: 'POST',
      body: JSON.stringify({ transactionId })
    });
    
    return response.json();
  }
}
```

### Tự động duyệt sau khi xác thực payment:

```javascript
// Thêm vào billHandler.js
async verifyAndAutoApprove(bill) {
  const payment = new PaymentGateway();
  const isValid = await payment.verifyMomoTransaction(bill.transactionId);
  
  if (isValid) {
    this.db.approveBill(bill.id, 'auto', null);
    // Notify user...
  }
}
```

## 3. Webhook Mode (Production)

### Thay vì polling, dùng webhook:

```javascript
// bot.js - thay bot.launch() bằng:

const express = require('express');
const app = express();

app.use(bot.webhookCallback('/webhook'));

bot.telegram.setWebhook(`${process.env.WEBHOOK_DOMAIN}/webhook`);

app.listen(process.env.WEBHOOK_PORT || 3000, () => {
  console.log('Webhook server running');
});
```

### Cấu hình .env:

```env
WEBHOOK_DOMAIN=https://yourdomain.com
WEBHOOK_PORT=3000
```

## 4. Multi-Language Support

### Tạo file i18n/vi.json và i18n/en.json:

```javascript
// i18n/vi.json
{
  "welcome": "Chào mừng {name}!",
  "send_bill": "Gửi Bill",
  "check_status": "Tra Cứu"
}

// i18n.js
const translations = {
  vi: require('./i18n/vi.json'),
  en: require('./i18n/en.json')
};

function t(key, lang = 'vi', params = ) {
  let text = translations[lang][key] || key;
  Object.entries(params).forEach(([k, v]) => {
    text = text.replace(`{${k}}`, v);
  });
  return text;
}

// Sử dụng:
ctx.reply(t('welcome', 'vi', { name: ctx.from.first_name }));
```

## 5. Rate Limiting

### Chống spam:

```javascript
// middleware/rateLimit.js
class RateLimit {
  constructor() {
    this.users = new Map();
  }

  check(userId, maxRequests = 5, windowMs = 60000) {
    const now = Date.now();
    const userRequests = this.users.get(userId) || [];
    
    // Filter requests trong window
    const recentRequests = userRequests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return false; // Rate limited
    }
    
    recentRequests.push(now);
    this.users.set(userId, recentRequests);
    return true;
  }
}

// Sử dụng:
const rateLimit = new RateLimit();

bot.on('photo', async (ctx, next) => {
  if (!rateLimit.check(ctx.from.id, 3, 60000)) {
    return ctx.reply('⚠️ Bạn gửi quá nhanh. Vui lòng đợi 1 phút.');
  }
  await next();
});
```

## 6. Database Migration sang MongoDB

### Thay vì JSON, dùng MongoDB:

```javascript
// database/mongodb.js
const { MongoClient } = require('mongodb');

class MongoDatabase {
  async connect() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    this.db = client.db('hyperur_bot');
  }

  async createBill(billData) {
    const result = await this.db.collection('bills').insertOne(billData);
    return result.ops[0];
  }

  async getBillById(billId) {
    return this.db.collection('bills').findOne({ id: billId });
  }
}
```

## 7. Analytics & Tracking

### Theo dõi metrics:

```javascript
// analytics.js
class Analytics {
  async track(event, userId, data = {}) {
    // Gửi đến Google Analytics hoặc service khác
    await fetch('https://analytics.google.com/...', {
      method: 'POST',
      body: JSON.stringify({
        event,
        userId,
        timestamp: new Date(),
        ...data
      })
    });
  }
}

// Sử dụng:
const analytics = new Analytics();

bot.command('start', async (ctx) => {
  await analytics.track('bot_start', ctx.from.id);
  // ...
});
```

## 8. Notification System

### Gửi thông báo theo lịch:

```javascript
// notifications.js
class NotificationSystem {
  async sendDailyReport() {
    const stats = this.db.getStats();
    const pendingCount = this.db.getPendingBills().length;
    
    const message = `
📊 BÁO CÁO NGÀY ${new Date().toLocaleDateString('vi-VN')}

• Tổng đơn hôm nay: ${stats.todayBills}
• Đơn chờ duyệt: ${pendingCount}
• Tỷ lệ duyệt: ${stats.approvalRate}%
    `;
    
    // Gửi cho admins
    for (const adminId of ADMIN_IDS) {
      await bot.telegram.sendMessage(adminId, message);
    }
  }
}

// Cron job chạy mỗi ngày 9h sáng
const cron = require('node-cron');
cron.schedule('0 9 * * *', () => {
  notificationSystem.sendDailyReport();
});
```

## 9. Backup System

### Tự động backup database:

```javascript
// backup.js
const fs = require('fs-extra');
const path = require('path');

async function backupDatabase() {
  const date = new Date().toISOString().split('T')[0];
  const backupPath = path.join('backups', `backup-${date}.json`);
  
  await fs.ensureDir('backups');
  await fs.copy(
    process.env.DATABASE_FILE,
    backupPath
  );
  
  console.log(`✅ Backup created: ${backupPath}`);
  
  // Xóa backup cũ > 30 ngày
  await cleanOldBackups();
}

// Chạy backup mỗi ngày
const cron = require('node-cron');
cron.schedule('0 0 * * *', backupDatabase);
```

## 10. Testing

### Unit tests với Jest:

```javascript
// __tests__/database.test.js
const Database = require('../database');

describe('Database', () => {
  let db;

  beforeEach(() => {
    db = new Database('./test-db.json');
  });

  test('should create bill', () => {
    const bill = db.createBill({
      userId: 123,
      deviceCode: 'houji'
    });
    
    expect(bill.id).toBeDefined();
    expect(bill.status).toBe('pending');
  });

  test('should approve bill', () => {
    const bill = db.createBill({ userId: 123 });
    const approved = db.approveBill(bill.id, 456);
    
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe(456);
  });
});
```

## 11. Docker Deployment

### Dockerfile:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### docker-compose.yml:

```yaml
version: '3.8'
services:
  bot:
    build: .
    env_file: .env
    volumes:
      - ./bills:/app/bills
      - ./database:/app/database
    restart: unless-stopped
```

### Chạy với Docker:

```bash
docker-compose up -d
```

## 12. Monitoring & Alerts

### Sử dụng PM2 cho production:

```bash
npm install -g pm2

# Chạy bot với PM2
pm2 start bot.js --name hyperur-bot

# Xem logs
pm2 logs hyperur-bot

# Restart
pm2 restart hyperur-bot

# Auto start on boot
pm2 startup
pm2 save
```

## 🔒 Security Best Practices

1. **Không commit .env và credentials**
2. **Validate tất cả input từ user**
3. **Rate limiting cho mọi endpoint**
4. **Encrypt sensitive data trong database**
5. **Sử dụng HTTPS cho webhook**
6. **Thường xuyên backup database**
7. **Monitor bot logs cho hoạt động bất thường**

## 📚 Resources

- [Telegraf Documentation](https://telegraf.js.org/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
