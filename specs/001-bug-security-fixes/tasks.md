# Tasks: 001 — Bug Fixes & Security Hardening

- [x] **T1**: Fix `bind_param` type string (`'isssssssss'`) in `api/admin-auth.php`, `api/admin-serials.php`, and `api/admin-users.php`.
- [x] **T2**: Fix `admin_id = 0`, `$log_id = null`, prepared statement on `registrations`, and `REMOTE_ADDR` IP whitelist check in `add_serial.php`.
- [x] **T3**: Harden `check_serial2.php` (fail-closed token auth for HTTP, CLI support, optional IP whitelist via `REMOTE_ADDR`, time validation, prepared statements, `admin_id = 0`) and document config constants in `api/config.example.php`.
- [x] **T4**: Secure mutating actions in `api/qr-active.php` (`POST` + admin session, remove error message leakage) and align `rotateQrAccount()` in `serial.js`.
- [x] **T5**: Fix `api/payment-webhook.php` (require `UR` prefix in step 10c, defer `registrations` activation until after `$amountOk`, fix `$regUpdated` and `$serialInserted`/`$serialExisted`) and align `FREE_PLAN_WHITELIST` in `api/email-template.php`.
- [x] **T6**: Sync `scripts/sepay-e2e/run.ps1`, `README.md`, and `md/DEVELOPER_ARCHITECTURE.md`.
- [x] **T7**: Verify syntax/linting on modified files and run two-axis review (`Standards` + `Spec`).
