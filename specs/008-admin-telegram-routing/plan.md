# Plan 008: Dynamic Admin Telegram Routing

## File Changes
1. **`sql/schema.sql`**: Add `recipient_acc` and `recipient_name` columns to `registrations`.
2. **`api/serial-register.php`**: Allowlist `recipientAcc`, safely check/add `recipient_acc` and `recipient_name` via `SHOW COLUMNS`, and persist them in 12-param prepared `INSERT`/`UPDATE` statements (10-param fallback if migration is unavailable).
3. **`api/serial-lookup.php`**: Query `recipient_acc` and `recipient_name` from `registrations` (with `SHOW COLUMNS` guard), fall back to `payment_transactions` (`matched_serial`), and return `recipientAcc` / `recipientName` in lookup responses.
4. **`json/i18n.js`**: Parameterize `serial.tgSupportMsg` and `serial.tgNotFoundMsg` with `@{admin}` and `{recipient}`, and add `serial.adminPickerTitle`, `serial.adminLucChannels`, `serial.adminTucChannels`, `serial.adminQrMatchTag` in both `vi` and `en`.
5. **`serial.js`**: Enrich `qrAccounts` with `displayName` and `telegram`, add `sessionStorage` recipient cache (`hyperur_serial_recipients`), `matchQrAccount()`, `resolveAdminForLookup()`, `buildTelegramUrl()`, `renderAdminPickerHtml()`, send `recipientAcc`/`recipientName` on registration, sync Pending QR with recorded recipient, and render direct routing or collapsible 2-admin picker in `renderLookupResultCard()`.
6. **`styles.css`**: Add `.sr-admin-picker*` and `.sr-admin-choice*` Astryx styles (Dark/Light tokens, zero `transition: all`, fine-pointer hover gates, `:focus-visible`, mobile `1fr`, `prefers-reduced-motion`).
7. **`serial.html`**: Bump script cache-buster to `serial.js?v=20261126_astrx4`.
8. **Verification & Handoff**: Check JS syntax, PHP syntax or `bind_param`/brace balance, VI/EN i18n parity, CSS braces & transitions, and sync `tasks.md` + `HANDOFF.md`.
