# Specification: 001 — Bug Fixes & Security Hardening

## Problem Statement
Codebase inspection of `HyperUR_V3` uncovered critical security gaps, database audit-log corruption, payment webhook activation flaws, an out-of-sync E2E script, and stale documentation.

## Requirements & Acceptance Criteria

### R1. Fix `admin_logs` Audit Logging Bugs
- **R1.1**: `write_admin_log` in `api/admin-auth.php`, `api/admin-serials.php`, and `api/admin-users.php` MUST bind `username` as string (`'isssssssss'`), not integer (`'iissssssss'`).
- **R1.2**: `add_serial.php` and `check_serial2.php` MUST insert `admin_id = 0` (matching `admin_logs.admin_id INT UNSIGNED NOT NULL DEFAULT 0`) rather than `NULL`, and `add_serial.php` MUST initialize `$log_id = null` before logging.

### R2. Harden `check_serial2.php` & `add_serial.php`
- **R2.1**: HTTP requests to `check_serial2.php` MUST fail closed unless authenticated via a configured non-placeholder secret (`CHECK_SERIAL_TOKEN`, fallback `ADD_SERIAL_TOKEN` or `API_SECRET`), supplied via `X-API-Token`, `Authorization: Bearer <token>`, or `token` parameter using `hash_equals()`. Missing/placeholder server secret returns HTTP `500`; invalid/missing client token returns HTTP `403`.
- **R2.2**: CLI execution (`php_sapi_name() === 'cli'`) of `check_serial2.php` MUST remain functional without HTTP token headers.
- **R2.3**: Optional IP whitelist (`CHECK_SERIAL_IP_ALLOW`, fallback `ADD_SERIAL_IP_ALLOW`) in `check_serial2.php` and `ADD_SERIAL_IP_ALLOW` in `add_serial.php` MUST check `$_SERVER['REMOTE_ADDR']` (not spoofable `X-Forwarded-For`).
- **R2.4**: All SQL queries in `check_serial2.php` MUST use prepared statements, and `time` input MUST be validated (`unlimited`/`lifetime`, `trial`/`36`/`36days`, `ddmmyyyy`, `YYYY-MM-DD`); invalid values return HTTP `400`.
- **R2.5**: Document `CHECK_SERIAL_TOKEN` and `CHECK_SERIAL_IP_ALLOW` in `api/config.example.php`.

### R3. Restrict State Mutation in `api/qr-active.php`
- **R3.1**: `GET /api/qr-active.php` (default read action) remains publicly accessible for displaying the active VietQR account.
- **R3.2**: Mutating actions (`record_scan`, `record_submit`, `switch_next`) MUST require `POST` (return `405` otherwise) AND an authenticated admin session (`$_SESSION['admin_id']`, `$_SESSION['admin_username']`; return `401` otherwise).
- **R3.3**: Internal exception messages MUST be logged with `error_log()`, never returned in public JSON responses.
- **R3.4**: In `serial.js`, `rotateQrAccount()` MUST sync QR state from server (`GET`) instead of posting an unauthenticated `record_submit` mutation (actual rotation count is incremented server-side by verified SePay webhooks).

### R4. Fix Payment Webhook Logic in `api/payment-webhook.php`
- **R4.1**: Direct-transfer auto-registration (step `10c`) MUST NOT write `status = 'Active'` to `registrations` before verifying `$amountOk` (`$transferAmount >= $minAmount`). Underpaid transfers MUST never activate `registrations` or `serial`.
- **R4.2**: Step `10c` MUST require the explicit `UR` transfer prefix (`UR ...`) and select a valid serial token strictly after `UR`, so unrelated bank transfers (e.g., `"chuyen tien mua rom"`) are marked `unmatched` instead of falsely activating words like `"CHUYEN"`.
- **R4.3**: `$regUpdated` MUST accurately reflect whether `registrations` was created or updated during step 11a (never overwritten to `false` afterward).
- **R4.4**: When a serial already exists in `serial`, `$serialExisted` MUST be set to `true` and `$serialInserted` MUST remain `false`; if `Time` is already `'unlimited'`, skip redundant `UPDATE`.

### R5. Sync E2E Script & Documentation
- **R5.1**: `scripts/sepay-e2e/run.ps1` MUST copy `api/payment-webhook-dev1.php`, define `SEPAY_WEBHOOK_SECRET_DEV_1` in the test config, create `system_settings` in the test DB, and run all 3 E2E clients against `payment-webhook-dev1.php`.
- **R5.2**: Update `README.md` (accurate device count of 190 JSON files, remove dead `./telegram-bot/ADVANCED.md` link and duplicate Deployment section) and `md/DEVELOPER_ARCHITECTURE.md` (reference `scripts/sepay-e2e/run.ps1` instead of non-existent `tests/test_all_features.php`, and note `check_serial2.php` / `qr-active.php` auth).

## Edge Cases
- Direct bank transfer with valid `UR <codename> <serial>` and amount `< 40000` must record `unmatched` in `payment_transactions` without creating an `Active` row in `registrations`.
- Direct bank transfer without `UR` prefix and amount `>= 40000` must record `unmatched` with `matched: false`.
- Existing `pending` serial in `serial` table paid via SePay upgrades `Time` to `'unlimited'` with `serialExisted = true, serialInserted = false`.
- `api/email-template.php` free-plan check should align with all 3 `FREE_PLAN_WHITELIST` entries in `api/serial-register.php`.
