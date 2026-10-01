#!/usr/bin/env node

/**
 * Interactive Setup Wizard for HyperUR Bot
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

console.log(`
╔════════════════════════════════════════╗
║   HyperUR Telegram Bot Setup Wizard   ║
╔════════════════════════════════════════╗
`);

async function setup() {
  console.log('\n📋 Trả lời các câu hỏi sau để cấu hình bot:\n');

  // Bot Token
  console.log('1️⃣  BOT TOKEN');
  console.log('   Lấy token từ @BotFather trên Telegram');
  const botToken = await question('   Token: ');

  if (!botToken || botToken.length < 40) {
    console.log('\n❌ Token không hợp lệ!');
    process.exit(1);
  }

  // Admin IDs
  console.log('\n2️⃣  ADMIN IDs');
  console.log('   Nhập User ID của admin (ngăn cách bằng dấu phẩy)');
  console.log('   Lấy ID từ @userinfobot');
  const adminIds = await question('   Admin IDs: ');

  if (!adminIds || adminIds.trim().length === 0) {
    console.log('\n❌ Cần ít nhất 1 admin ID!');
    process.exit(1);
  }

  // Website URL
  console.log('\n3️⃣  WEBSITE URL');
  console.log('   URL của website HyperUR (hoặc để trống)');
  const websiteUrl = await question('   URL: ') || 'https://hyperur.com';

  // Bot Username
  console.log('\n4️⃣  BOT USERNAME (tùy chọn)');
  const botUsername = await question('   Username (@your_bot): ') || 'hyperur_bot';

  // Tạo file .env
  const envContent = `# Telegram Bot Configuration
BOT_TOKEN=${botToken}
BOT_USERNAME=${botUsername}
ADMIN_IDS=${adminIds}

# HyperUR Website
HYPERUR_WEBSITE_URL=${websiteUrl}
HYPERUR_API_URL=http://localhost:3000/api

# Storage
BILLS_FOLDER=./bills
DATABASE_FILE=./database/bot-data.json
LOGS_FOLDER=./logs

# Features
FEATURE_CRON_JOBS=true
FEATURE_DEVICE_VALIDATION=true
FEATURE_RATE_LIMIT=true

# Rate Limiting
RATE_LIMIT_MAX=5
RATE_LIMIT_WINDOW=60000

# Development
NODE_ENV=production
`;

  fs.writeFileSync('.env', envContent);

  console.log('\n✅ File .env đã được tạo thành công!');
  console.log('\n📦 Tiếp theo, cài đặt dependencies:');
  console.log('   npm install\n');
  console.log('🚀 Sau đó khởi động bot:');
  console.log('   npm start\n');

  rl.close();
}

setup().catch(error => {
  console.error('\n❌ Lỗi:', error.message);
  rl.close();
  process.exit(1);
});
