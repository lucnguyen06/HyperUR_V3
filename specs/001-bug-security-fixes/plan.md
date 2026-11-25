# Implementation Plan: 001 — Bug Fixes & Security Hardening

## Technical Approach

1. **Audit Logging (`api/admin-auth.php`, `api/admin-serials.php`, `api/admin-users.php`, `add_serial.php`)**
   - Change `bind_param('iissssssss', ...)` to `bind_param('isssssssss', ...)` in all 3 admin API files.
   - In `add_serial.php`, initialize `$log_id = null;`, change `$sys_user_id = 0;`, and check `$_SERVER['REMOTE_ADDR']` in `is_ip_allowed()` (keeping `client_ip()` only for informational display or directly using `REMOTE_ADDR` for security checks).

2. **Bot Activation Endpoint (`check_serial2.php`, `api/config.example.php`)**
   - Add fail-closed HTTP authentication helper:
     - Bypass auth only when `php_sapi_name() === 'cli'`.
     - Resolve allowed token from `CHECK_SERIAL_TOKEN`, fallback `ADD_SERIAL_TOKEN`, fallback `API_SECRET` (ignoring empty or `CHANGE_ME_*` placeholders).
     - Reject with `500` if no valid secret configured; reject with `403` if token mismatch or IP outside optional `CHECK_SERIAL_IP_ALLOW` / `ADD_SERIAL_IP_ALLOW` (`REMOTE_ADDR`).
   - Validate `$timeRaw` strictly (`unlimited`/`lifetime`, `trial`/`36`/`36days`, `ddmmyyyy`, `YYYY-MM-DD`).
   - Convert remaining string-interpolated `UPDATE registrations`, `INSERT INTO registrations`, and `INSERT INTO admin_logs` queries to prepared statements with `admin_id = 0`.
   - Document `CHECK_SERIAL_TOKEN` and `CHECK_SERIAL_IP_ALLOW` in `api/config.example.php`.

3. **QR Rotation API (`api/qr-active.php`, `serial.js`)**
   - Require `api/_bootstrap.php` (safe CORS + admin session) for `api/qr-active.php` (keeping `GET` readable).
   - Guard `record_scan`, `record_submit`, and `switch_next` with `REQUEST_METHOD === 'POST'` (else `405`) and `isset($_SESSION['admin_id'], $_SESSION['admin_username'])` (else `401`).
   - Remove `'error' => $e->getMessage()` from public JSON fallback and log via `error_log()`.
   - Update `rotateQrAccount()` in `serial.js` to simply call `syncQrStateFromServer()`.

4. **SePay Payment Webhook (`api/payment-webhook.php`, `api/email-template.php`)**
   - In step `10c`: require `$urIdx !== false` in `$allTokens` (from stripped text) and only accept a candidate serial that appears at index `> $urIdx`. Record `$needsDirectRegInsert = true` without writing to DB yet.
   - Initialize `$regUpdated = false; $serialInserted = false; $serialExisted = false;` cleanly after `$amountOk` check passes.
   - In step `11a`: update existing `$regRow` OR, if `$needsDirectRegInsert`, execute the `INSERT ... ON DUPLICATE KEY UPDATE` into `registrations` and set `$regUpdated = true` on success.
   - In step `11b`: when `$serialRow` exists, set `$serialExisted = true; $serialInserted = false;` and run `UPDATE` only if current `Time !== 'unlimited'`.
   - In `api/email-template.php`: align `$isFree` check with all 3 `FREE_PLAN_WHITELIST` values from `api/serial-register.php`.

5. **E2E Script & Docs (`scripts/sepay-e2e/run.ps1`, `README.md`, `md/DEVELOPER_ARCHITECTURE.md`)**
   - Update `run.ps1` to copy `api/payment-webhook-dev1.php`, set `SEPAY_WEBHOOK_SECRET_DEV_1`, add `system_settings` DDL, and point test URLs at `/payment-webhook-dev1.php`.
   - Refresh `README.md` and `md/DEVELOPER_ARCHITECTURE.md` to match current files and security model.

## Verification Strategy
- Check JS syntax with `node --check serial.js`.
- Check PowerShell syntax of `scripts/sepay-e2e/run.ps1` using PowerShell parser (`[System.Management.Automation.Language.Parser]::ParseFile`).
- Check PHP syntax (if PHP binary is available; otherwise perform static structural/AST-level inspection and parallel two-axis `code-review` subagents per `AGENTS.md`).
