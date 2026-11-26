# Spec 008: Dynamic Admin Telegram Routing by Transfer Recipient

## Context & Goal
HyperUR uses two rotating MBBank SePay VA accounts (`qrAccounts` in `serial.js` and `QR_ACCOUNTS` in `api/qr-active.php`):
- **Nguyễn Tấn Lực** (`NGUYEN TAN LUC`, `VQRQAMNWP9901`, plus international Binance Pay / PayPal) → Telegram **`@lcnguy06`**
- **Nguyễn Văn Túc** (`NGUYEN VAN TUC`, `VQRQANJTA5424`) → Telegram **`@Usagi79`**

Previously, every "Hỏi Admin / Hỗ Trợ Kỹ Thuật Admin / Nhắn Admin" CTA in `serial.js` hardcoded `https://t.me/lcnguy06`. When a user transferred to Nguyễn Văn Túc (`VQRQANJTA5424`), clicking support routed them to `@lcnguy06` instead of `@Usagi79`.

## Requirements
1. **Recipient Allowlist & Mapping**:
   - `VQRQAMNWP9901` / `NGUYEN TAN LUC` / international (`crypto_intl`) → `@lcnguy06`.
   - `VQRQANJTA5424` / `NGUYEN VAN TUC` → `@Usagi79`.
2. **Backend Persistence (`sql/schema.sql`, `api/serial-register.php`, `api/serial-lookup.php`)**:
   - Store `recipient_acc` (`VARCHAR(50)`) and `recipient_name` (`VARCHAR(100)`) on `registrations`.
   - Allowlist `recipientAcc` server-side in `api/serial-register.php` (`VQRQAMNWP9901` or `VQRQANJTA5424` only) and safely auto-migrate missing columns via `SHOW COLUMNS` before running 12-param prepared `INSERT`/`UPDATE` statements (falling back to 10-param queries if columns cannot be added).
   - Return `recipientAcc` and `recipientName` from `api/serial-lookup.php` (from `registrations`, falling back to `payment_transactions` `account_number`/`raw_payload` inspection when `registrations` lacks recipient metadata).
3. **Frontend Lookup Routing & Astryx Picker (`serial.js`, `styles.css`, `json/i18n.js`, `serial.html`)**:
   - Send `recipientAcc` and `recipientName` on registration submit and cache in `sessionStorage` (`hyperur_serial_recipients`).
   - When `resolveAdminForLookup()` finds a recorded recipient (from API or `sessionStorage`), render a direct 1-click Telegram link to that admin (`(@lcnguy06)` or `(@Usagi79)`) with a pre-filled message referencing `@{admin}` and `{recipient}`.
   - When the recipient is unknown (e.g., `Not Found` without local session cache, or legacy record without recipient metadata), render an Astryx collapsible 2-admin picker (`.sr-admin-picker`) so the user chooses which account holder they transferred to (`Nguyễn Tấn Lực · @lcnguy06` or `Nguyễn Văn Túc · @Usagi79`), highlighting the currently active QR (`Theo mã QR`) on Pending lookup results when applicable.
   - Maintain 100% VI/EN i18n parity, Dark/Light theme parity, hover-gated rules, `:focus-visible`, and `prefers-reduced-motion: reduce`.
