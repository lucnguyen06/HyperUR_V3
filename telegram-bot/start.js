#!/usr/bin/env node

/**
 * HyperUR Bot Launcher Script
 * Quick start script with validation
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Starting HyperUR Telegram Bot...\n');

// Check if .env exists
if (!fs.existsSync('.env')) {
  console.error('❌ File .env không tồn tại!');
  console.log('📝 Tạo file .env từ .env.example:');
  console.log('   cp .env.example .env\n');
  console.log('Sau đó chỉnh sửa thông tin BOT_TOKEN và ADMIN_IDS');
  process.exit(1);
}

// Load environment
require('dotenv').config();

// Validate required environment variables
const required = ['BOT_TOKEN', 'ADMIN_IDS'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Thiếu biến môi trường:');
  missing.forEach(key => console.log(`   - ${key}`));
  console.log('\nVui lòng cập nhật file .env');
  process.exit(1);
}

// Check directories
const dirs = [
  process.env.BILLS_FOLDER || './bills',
  path.dirname(process.env.DATABASE_FILE || './database/bot-data.json')
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

console.log('✅ Environment validated\n');

// Start bot
console.log('🤖 Initializing bot...\n');
require('./bot');
