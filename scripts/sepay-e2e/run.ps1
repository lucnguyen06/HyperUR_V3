# ============================================================
#  Script ch?y E2E test cho SePay webhook (Windows / PowerShell)
# ============================================================
#  T?o m?t "b?n sao sandbox" c?a api/ trong scripts/sepay-e2e/app/
#  v?i config.php tr? v?o DATABASE TEST, r?i kh?i ??ng PHP built-in
#  server v? ch?y client test.
#
#  KH?NG ??ng v?o api/config.php th?t (DB production).
# ============================================================

$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$e2e     = Join-Path $PSScriptRoot '.'
$appDir  = Join-Path $e2e 'app'
$php     = 'C:\xampp\php\php.exe'
$mysql   = 'C:\xampp\mysql\bin\mysql.exe'
$port    = 8899
$dbName  = 'hyperur_sepay_test'

Write-Host "==> Don dep sandbox cu..." -ForegroundColor Cyan
if (Test-Path $appDir) { Remove-Item $appDir -Recurse -Force }
New-Item -ItemType Directory -Path $appDir -Force | Out-Null

Write-Host "==> Copy cac file API can thiet..." -ForegroundColor Cyan
Copy-Item (Join-Path $root 'api\payment-webhook.php') $appDir
Copy-Item (Join-Path $root 'api\_sepay-lib.php')     $appDir

# config.php ri?ng cho test
$testConfig = @'
<?php
define('DB_HOST', '127.0.0.1');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'hyperur_sepay_test');

define('SEPAY_WEBHOOK_SECRET', 'test_secret_key_1234567890');
define('SEPAY_MIN_AMOUNT', 40000);
define('SEPAY_DEFAULT_EMAIL', 'default@hyperur.test');

define('WEBSITE_URL', 'http://localhost');
define('SUPPORT_EMAIL', 'test@hyperur.test');
define('EMAIL_FROM', 'test@hyperur.test');
define('EMAIL_FROM_NAME', 'HyperUR Test');

date_default_timezone_set('Asia/Ho_Chi_Minh');
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/test-error.log');
'@
Set-Content -Path (Join-Path $appDir 'config.php') -Value $testConfig -Encoding ASCII
# L?u ?: KH?NG d?ng -Encoding UTF8 v?i PowerShell 5.1
# (n? th?m BOM -> BOM b? in ra tr??c header, l?m header() / http_response_code()
#  th?t b?i v? JSON response b? l?i parse)

Write-Host "==> Tao database test '$dbName'..." -ForegroundColor Cyan
& $mysql -u root -e "CREATE DATABASE IF NOT EXISTS $dbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
& $mysql -u root $dbName -e @"
CREATE TABLE IF NOT EXISTS ``registrations`` (
    ``id``               INT AUTO_INCREMENT PRIMARY KEY,
    ``serial``           VARCHAR(50)  NOT NULL UNIQUE,
    ``codename``         VARCHAR(100) NOT NULL,
    ``plan``             VARCHAR(100) DEFAULT NULL,
    ``payment_method``   VARCHAR(50)  DEFAULT NULL,
    ``sender_name``      VARCHAR(100) DEFAULT NULL,
    ``sender_email``     VARCHAR(100) NOT NULL,
    ``transaction_code`` VARCHAR(100) DEFAULT NULL,
    ``status``           ENUM('Pending','Active','Expired','Suspended') DEFAULT 'Pending',
    ``activated_at``     DATETIME DEFAULT NULL,
    ``expired_at``       DATETIME DEFAULT NULL,
    ``created_at``       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ``updated_at``       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX ``idx_serial`` (``serial``),
    INDEX ``idx_email``  (``sender_email``)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ``serial`` (
    ``STT``    INT NOT NULL,
    ``Device`` VARCHAR(50) NOT NULL DEFAULT 'Mobile',
    ``Serial`` VARCHAR(50) NOT NULL,
    ``Gmail``  VARCHAR(100) NOT NULL,
    ``Time``   VARCHAR(50) NOT NULL DEFAULT 'unlimited',
    INDEX ``idx_stt``    (``STT``),
    INDEX ``idx_serial`` (``Serial``)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ``admin_logs`` (
    ``id``          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ``admin_id``    INT UNSIGNED NOT NULL DEFAULT 0,
    ``username``    VARCHAR(50)  NOT NULL DEFAULT '0',
    ``action``      VARCHAR(50)  NOT NULL,
    ``table_name``  VARCHAR(50)  DEFAULT NULL,
    ``record_id``   VARCHAR(50)  DEFAULT NULL,
    ``description`` TEXT,
    ``old_data``    LONGTEXT    DEFAULT NULL,
    ``new_data``    LONGTEXT    DEFAULT NULL,
    ``ip_address``  VARCHAR(45)  DEFAULT NULL,
    ``user_agent``  VARCHAR(500) DEFAULT NULL,
    ``created_at``  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX ``idx_record`` (``record_id``)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bang so nhan tien (webhook cung tu tao neu thieu, nhung tao san cho test)
CREATE TABLE IF NOT EXISTS ``payment_transactions`` (
    ``id``               INT AUTO_INCREMENT PRIMARY KEY,
    ``sepay_id``         BIGINT       NOT NULL,
    ``gateway``          VARCHAR(50)  DEFAULT NULL,
    ``account_number``   VARCHAR(50)  DEFAULT NULL,
    ``transfer_type``    VARCHAR(10)  DEFAULT NULL,
    ``transfer_amount``  BIGINT       NOT NULL DEFAULT 0,
    ``content``          VARCHAR(500) DEFAULT NULL,
    ``description``      VARCHAR(500) DEFAULT NULL,
    ``reference_code``   VARCHAR(100) DEFAULT NULL,
    ``transaction_date`` DATETIME     DEFAULT NULL,
    ``matched_serial``   VARCHAR(50)  DEFAULT NULL,
    ``matched_email``    VARCHAR(100) DEFAULT NULL,
    ``status``           ENUM('matched','unmatched','ignored','error') DEFAULT 'unmatched',
    ``note``             VARCHAR(255) DEFAULT NULL,
    ``raw_payload``      LONGTEXT     DEFAULT NULL,
    ``created_at``       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY ``uq_sepay_id`` (``sepay_id``),
    INDEX ``idx_serial`` (``matched_serial``),
    INDEX ``idx_status`` (``status``)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"@

Write-Host "==> Khoi dong PHP server (port $port)..." -ForegroundColor Cyan

# Don sach server cu con treo tren port nay (truoc khi start)
$stale = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($stale) {
    foreach ($c in $stale) {
        Write-Host "    Don process cu PID=$($c.OwningProcess)" -ForegroundColor Yellow
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

$srv = Start-Process -FilePath $php `
    -ArgumentList @('-S', "127.0.0.1:$port", '-t', $appDir) `
    -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 3

try {
    Write-Host "==> Chay E2E test (bo chinh)..." -ForegroundColor Cyan
    & $php (Join-Path $e2e 'client.php') "http://127.0.0.1:$port/payment-webhook.php"
    $code1 = $LASTEXITCODE

    Write-Host ""
    Write-Host "==> Chay test thanh toan LAN 2 (chong trung serial)..." -ForegroundColor Cyan
    & $php (Join-Path $e2e 'client-dup.php') "http://127.0.0.1:$port/payment-webhook.php"
    $code2 = $LASTEXITCODE

    Write-Host ""
    Write-Host "==> Chay test RETRY sau khi xu ly that bai..." -ForegroundColor Cyan
    & $php (Join-Path $e2e 'client-retry.php') "http://127.0.0.1:$port/payment-webhook.php"
    $code3 = $LASTEXITCODE

    $code = if ($code1 -ne 0 -or $code2 -ne 0 -or $code3 -ne 0) { 1 } else { 0 }
} finally {
    Write-Host "==> Dung PHP server..." -ForegroundColor Cyan
    if ($srv -and -not $srv.HasExited) { Stop-Process -Id $srv.Id -Force }
}

exit $code

