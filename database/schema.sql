-- HyperUR V3 Database Schema
-- MySQL Database cho Serial Registration System

CREATE DATABASE IF NOT EXISTS hyperur_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE     ;

-- Bảng đăng ký Serial
CREATE TABLE IF NOT EXISTS registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    serial VARCHAR(50) NOT NULL UNIQUE,
    codename VARCHAR(50) NOT NULL,
    plan VARCHAR(100) NOT NULL,
    payment_method VARCHAR(100),
    sender_name VARCHAR(100),
    sender_email VARCHAR(255) NOT NULL,
    transaction_code VARCHAR(100),
    status ENUM('Pending', 'Active', 'Expired', 'Cancelled') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP NULL,
    expired_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    notes TEXT,
    
    INDEX idx_serial (serial),
    INDEX idx_email (sender_email),
    INDEX idx_codename (codename),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng log hoạt động
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    serial VARCHAR(50),
    action VARCHAR(50) NOT NULL,
    description TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_serial (serial),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dữ liệu mẫu (optional)
-- INSERT INTO registrations (serial, codename, plan, payment_method, sender_name, sender_email, transaction_code, status, activated_at, expired_at)
-- VALUES 
-- ('TEST123456', 'marble', 'Active Free (36 ngày)', 'Active Free (0đ - Dùng thử 36 ngày)', 'Test User', 'test@example.com', 'ACTIVE_FREE_36_DAYS', 'Active', NOW(), DATE_ADD(NOW(), INTERVAL 36 DAY));
