-- ============================================
-- HyperUR V3 Database Setup Script
-- ============================================
-- Run this script in phpMyAdmin or MySQL console
-- to create database, tables, and user permissions

-- 1. Create Database (if not exists)
CREATE DATABASE IF NOT EXISTS ycoozxap_hyperur_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- 2. Use the database
USE ycoozxap_hyperur_db;

-- 3. Create registrations table
CREATE TABLE IF NOT EXISTS registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    serial VARCHAR(50) NOT NULL UNIQUE,
    codename VARCHAR(100) NOT NULL,
    plan VARCHAR(100) DEFAULT NULL,
    payment_method VARCHAR(50) DEFAULT NULL,
    sender_name VARCHAR(100) DEFAULT NULL,
    sender_email VARCHAR(100) NOT NULL,
    transaction_code VARCHAR(100) DEFAULT NULL,
    status ENUM('Pending', 'Active', 'Expired', 'Suspended') DEFAULT 'Pending',
    activated_at DATETIME DEFAULT NULL,
    expired_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_serial (serial),
    INDEX idx_email (sender_email),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    serial VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_serial (serial),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Grant permissions to user (IMPORTANT)
-- Replace 'ycoozxap' and 'Tl29126@@@' with your actual username and password
GRANT ALL PRIVILEGES ON ycoozxap_hyperur_db.* TO 'ycoozxap'@'localhost' IDENTIFIED BY 'Tl29126@@@';
FLUSH PRIVILEGES;

-- 6. Verify setup
SELECT 'Database setup completed!' as status;
SHOW TABLES;
