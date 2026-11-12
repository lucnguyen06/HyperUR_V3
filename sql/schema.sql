-- ============================================================
-- HyperUR V3 - Database Schema
-- ============================================================
-- Chạy file này trong phpMyAdmin hoặc MySQL console để tạo đầy đủ
-- các bảng mà backend PHP (`api/*.php`, `add_serial.php`) cần dùng.
--
--   mysql -u <user> -p <dbname> < sql/schema.sql
--
-- Bảng:
--   registrations   - đăng ký serial từ website (api/serial-register.php)
--   activity_logs   - log tra cứu / đăng ký của user
--   admin_users     - tài khoản đăng nhập trang quản trị
--   admin_logs      - audit log thao tác admin
--   serial          - bảng serial bản quyền ROM (nguồn tra cứu chính)
--   payment_transactions - sổ nhận tiền từ webhook SePay
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';

-- ------------------------------------------------------------
-- 1. registrations - đăng ký serial từ website
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `registrations` (
    `id`               INT AUTO_INCREMENT PRIMARY KEY,
    `serial`           VARCHAR(50)  NOT NULL UNIQUE,
    `codename`         VARCHAR(100) NOT NULL,
    `plan`             VARCHAR(100) DEFAULT NULL,
    `payment_method`   VARCHAR(50)  DEFAULT NULL,
    `sender_name`      VARCHAR(100) DEFAULT NULL,
    `sender_email`     VARCHAR(100) NOT NULL,
    `transaction_code` VARCHAR(100) DEFAULT NULL,
    `status`           ENUM('Pending', 'Active', 'Expired', 'Suspended') DEFAULT 'Pending',
    `activated_at`     DATETIME     DEFAULT NULL,
    `expired_at`       DATETIME     DEFAULT NULL,
    `created_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_serial` (`serial`),
    INDEX `idx_email`  (`sender_email`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. activity_logs - log hành động của user (register / lookup)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `activity_logs` (
    `id`         INT AUTO_INCREMENT PRIMARY KEY,
    `serial`     VARCHAR(50) NOT NULL,
    `action`     VARCHAR(50) NOT NULL,
    `description` TEXT,
    `ip_address` VARCHAR(45) DEFAULT NULL,
    `user_agent` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_serial`  (`serial`),
    INDEX `idx_action`  (`action`),
    INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. admin_users - tài khoản trang quản trị
--    Password hash bằng password_hash($pw, PASSWORD_DEFAULT) (bcrypt)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_users` (
    `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `username`   VARCHAR(50)  NOT NULL,
    `password`   VARCHAR(255) NOT NULL,
    `full_name`  VARCHAR(100) DEFAULT NULL,
    `role`       ENUM('superadmin', 'admin') NOT NULL DEFAULT 'admin',
    `active`     TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_login` DATETIME     DEFAULT NULL,
    UNIQUE KEY `uq_username` (`username`),
    INDEX `idx_role`   (`role`),
    INDEX `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. admin_logs - audit log thao tác quản trị
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_logs` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `admin_id`    INT UNSIGNED NOT NULL DEFAULT 0,
    `username`    VARCHAR(50)  NOT NULL DEFAULT '0',
    `action`      VARCHAR(50)  NOT NULL,
    `table_name`  VARCHAR(50)  DEFAULT NULL,
    `record_id`   VARCHAR(50)  DEFAULT NULL,
    `description` TEXT,
    `old_data`    LONGTEXT     DEFAULT NULL,
    `new_data`    LONGTEXT     DEFAULT NULL,
    `ip_address`  VARCHAR(45)  DEFAULT NULL,
    `user_agent`  VARCHAR(500) DEFAULT NULL,
    `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_admin`   (`admin_id`),
    INDEX `idx_action`  (`action`),
    INDEX `idx_table`   (`table_name`),
    INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5. serial - bảng serial bản quyền ROM
--    ⚠️ KHÔNG có PRIMARY KEY tự động.
--       STT là số nguyên hiển thị; khi xóa sẽ tạo khoảng trống.
--       Khi thêm mới, backend tự tìm STT trống lớn nhất + 1.
--    ⚠️ Không có UNIQUE trên Serial (backend tự kiểm tra trùng
--       case-insensitive trước khi INSERT).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `serial` (
    `STT`    INT         NOT NULL,
    `Device` VARCHAR(50) NOT NULL DEFAULT 'Mobile',
    `Serial` VARCHAR(50) NOT NULL,
    `Gmail`  VARCHAR(100) NOT NULL,
    `Time`   VARCHAR(50) NOT NULL DEFAULT 'unlimited',  -- 'unlimited' | 'YYYY-MM-DD' | 'ddmmyyyy'
    INDEX `idx_stt`    (`STT`),
    INDEX `idx_serial` (`Serial`),
    INDEX `idx_device` (`Device`),
    INDEX `idx_gmail`  (`Gmail`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. payment_transactions - sổ nhận tiền từ webhook SePay
--    (các endpoint payment-webhook-dev1.php / payment-webhook-dev2.php tự tạo nếu thiếu, nhưng nên tạo
--     sẵn để kiểm soát index / collation)
--    UNIQUE(sepay_id) là cơ chế CHỐNG TRÙNG giao dịch:
--    SePay có thể retry cùng một giao dịch nhiều lần.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payment_transactions` (
    `id`               INT AUTO_INCREMENT PRIMARY KEY,
    `sepay_id`         BIGINT       NOT NULL,
    `gateway`          VARCHAR(50)  DEFAULT NULL,
    `account_number`   VARCHAR(50)  DEFAULT NULL,
    `transfer_type`    VARCHAR(10)  DEFAULT NULL,
    `transfer_amount`  BIGINT       NOT NULL DEFAULT 0,
    `content`          VARCHAR(500) DEFAULT NULL,
    `description`      VARCHAR(500) DEFAULT NULL,
    `reference_code`   VARCHAR(100) DEFAULT NULL,
    `transaction_date` DATETIME     DEFAULT NULL,
    `matched_serial`   VARCHAR(50)  DEFAULT NULL,
    `matched_email`    VARCHAR(100) DEFAULT NULL,
    `status`           ENUM('matched','unmatched','ignored','error') DEFAULT 'unmatched',
    `note`             VARCHAR(255) DEFAULT NULL,
    `raw_payload`      LONGTEXT     DEFAULT NULL,
    `created_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_sepay_id` (`sepay_id`),
    INDEX `idx_serial`  (`matched_serial`),
    INDEX `idx_status`  (`status`),
    INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 7. system_settings - cấu hình & bộ đếm toàn hệ thống
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_settings` (
    `setting_key`   VARCHAR(50) PRIMARY KEY,
    `setting_value` TEXT NOT NULL,
    `updated_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. Tạo tài khoản Super Admin đầu tiên
-- ============================================================
-- ⚠️ THAY MẬT KHẨU BÊN DƯỚI TRƯỚC KHI CHẠY.
-- Hash dưới đây là của mật khẩu mẫu: HyperUR@2026
-- Đổi bằng PHP:  php -r "echo password_hash('MatKhauMoi', PASSWORD_DEFAULT), PHP_EOL;"
-- ------------------------------------------------------------
-- INSERT INTO `admin_users` (`username`, `password`, `full_name`, `role`, `active`)
-- VALUES (
--     'superadmin',
--     '$2y$10$REPLACE_WITH_YOUR_OWN_BCRYPT_HASH',
--     'Super Admin',
--     'superadmin',
--     1
-- );

-- ============================================================
-- 8. Kiểm tra
-- ============================================================
SELECT 'Database setup completed!' AS status;
SHOW TABLES;
