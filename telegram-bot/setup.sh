#!/bin/bash

echo "========================================"
echo "  HyperUR Telegram Bot - Setup Script"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js chưa được cài đặt!"
    echo "Vui lòng tải Node.js tại: https://nodejs.org/"
    exit 1
fi

echo "[OK] Node.js đã được cài đặt"
node --version
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm chưa được cài đặt!"
    exit 1
fi

echo "[OK] npm đã được cài đặt"
npm --version
echo ""

# Install dependencies
echo "========================================"
echo "  Đang cài đặt dependencies..."
echo "========================================"
echo ""

npm install

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Cài đặt thất bại!"
    exit 1
fi

echo ""
echo "========================================"
echo "  Cài đặt thành công!"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "[INFO] Đang tạo file .env..."
    cp .env.example .env
    echo ""
    echo "[IMPORTANT] Vui lòng chỉnh sửa file .env:"
    echo "  1. Thêm BOT_TOKEN của bạn"
    echo "  2. Thêm ADMIN_IDS của bạn"
    echo "  3. Cập nhật HYPERUR_WEBSITE_URL"
    echo ""
    echo "Sau đó chạy: npm start"
else
    echo "[OK] File .env đã tồn tại"
    echo ""
    echo "Bạn có thể chạy bot bằng lệnh:"
    echo "  npm start"
fi

echo ""
