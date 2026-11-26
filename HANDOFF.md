# Project Handoff — HyperUR V3

> **Last updated**: 2026-11-26  
> **Git status**: Spec `007`–`008` committed and pushed to `origin/main`.

---

## 1. Completed Work (Mapped to Spec Kit)

All specifications, plans, and completed task checklists live under `specs/` (initialized with GitHub Spec Kit in `.specify/`):

1. **Backend Bug & Security Fixes** — see `specs/001-bug-security-fixes/`
   - Fixed `admin_logs` `bind_param` type string (`'isssssssss'`), fail-closed auth on `check_serial2.php`, admin-only mutations on `api/qr-active.php`, `api/payment-webhook.php` amount/prefix/idempotency gates, `add_serial.php` `REMOTE_ADDR` & CIDR handling, `api/email-template.php` whitelist, `scripts/sepay-e2e/run.ps1`, `README.md`, and `md/DEVELOPER_ARCHITECTURE.md`.
   - **Note**: XAMPP PHP 8.5.13 (`C:\xampp\php\php.exe`) and MariaDB 10.11.19 (`C:\xampp\mysql\bin\mysql.exe`) are installed locally (19/19 PHP files pass `php -l`; `sql/schema.sql` and Spec 008 queries validated on MariaDB 10.11.19 `--bootstrap`), while live HTTP E2E still requires local `api/config.php` or running `scripts/sepay-e2e/run.ps1`.

2. **Redesigned `guide.html` (Editorial Field Manual)** — see `specs/002-redesign-guide-page/`
   - Scoped `.guide-*` styles appended to `styles.css`, full Dark/Light theme + VI/EN i18n.
   - **User-approved content rules (DO NOT revert)**:
     - Page title: **"Cài đặt ROM HyperUR"** (not "V3").
     - **No interactive checkboxes** on prerequisites; data backup is marked **Recommended** (not mandatory) with advice to back up important personal data just in case.
     - **No `flash_all_lock.bat` warning** (only applies to stock ROMs).
     - **No Play Integrity / eKYC / Google Play setup paragraph**.
     - Explicit USB rule included: connect directly to PC motherboard rear ports or laptop direct ports — never front-case ports or USB hubs.

3. **Full Public-Site i18n (VI / EN)** — see `specs/003-public-pages-i18n/`
   - Upgraded `json/i18n.js` (`I18n.t(key, vars)`, `hyperur:langchange` custom event, `data-i18n-html`, `data-i18n-title`, page title/meta translation, **429/429 VI/EN keys verified 100% in sync**).
   - Localized all 6 public pages (`index.html`, `download.html`, `guide.html`, `serial.html`, `features.html`, `firmware.html`) + dynamic JS (`json/devices.js`, `serial.js`).
   - **Scope constraint (DO NOT change)**: `admin/admin.html` and `admin/admin-users.html` are intentionally **Vietnamese-only**.
   - **Backend compatibility (DO NOT change)**: Hidden form values in `serial.html` / `serial.js` (`#reg-type-value`, `#payment-method-value`) and `api/serial-register.php` payload fields must remain in their original Vietnamese strings to match PHP/DB expectations.

4. **Redesigned `download.html` (Command Spotlight & Clean Bento Cards)** — see `specs/004-redesign-download-page/`
   - Scoped `.dl-*` and `.dl-dialog` styles appended to `styles.css`; full Dark/Light + VI/EN support.
   - **User-approved UI/behavior rules (DO NOT revert)**:
     - **No `OS3.0` / `OS2.0` chips** on device cards and no OS filter bar.
     - Clean Bento cards show real device thumbnails (`images/{codename}.png`), full-width device title (no right-side pill squeezing the title), `codename · Brand`, build count status dot, and 2 actions (`Open Drive` + `Builds/Details` modal).
     - `.dl-kicker` set to `0.9rem` bold monospace for legibility.
     - Hero subtitle (`#dl-hero-desc`) dynamically displays the **real live Google Drive device count** (`state.driveCodenamesCount`), replacing the old hardcoded `189+`.
     - **Stale-While-Revalidate + Session-only caching**: All site data caches (`hyperur-active-roms` in `json/devices.js`; `EMAIL_STORAGE_KEY`, `qr_current_index`, `qr_payment_count`, `LOOKUP_HISTORY_KEY` in `serial.js`; `hyperur_splash_viewed` in `index.html`) use **`sessionStorage`** so reloading in-session is instant while closing the tab/browser automatically wipes all cached data. Only UI preferences (`hyperur-theme`, `hyperur-lang`) remain in `localStorage`.

5. **Redesigned `serial.html` (Concept A — Astryx Payment Split)** — see `specs/005-redesign-serial-page/`
   - Built with Meta Astryx `payment-form` grammar + Animate UI motion tokens/rules (gliding `#serial-tab-slider` tabs, hairline-divided flat sections, Collapsible Fastboot/ADB helper, Astryx `RadioList` payment selector with tabular pricing, sticky Order Summary & inline QR checkout, stroke-draw animated copy feedback, hover-gated rules, `prefers-reduced-motion` support, zero `transition: all`).
   - Preserves all PHP/GAS backend API contracts, SePay QR rotation, URL params (`?tab=lookup`, `?serial=`, `?serial_prefill=`), and `sessionStorage` caches.
   - Post-redesign polish: removed legacy `.payment-method-card` CSS leakage on `#payment-methods-grid` and scoped `.sr-price-meta .tier-pill`, stacked `.sr-two-col` field headers and shortened placeholders (`amethyst, fuxi` / `5A1C8D2F`) for clean VI/EN alignment, and unified Vietnamese unit wording (`con` → `máy`).

6. **Redesigned Global Site Footer (Concept A — Astryx Editorial Grid)** — see `specs/006-redesign-footer/`
   - Replaced the legacy centered minimalist footer (`.site-footer-minimal`, hardcoded `189+`, missing navigation & community links) with `.ft-editorial` across all 4 public pages (`index.html`, `download.html`, `guide.html`, `serial.html`), `styles.css`, and `json/i18n.js`.
   - Features an asymmetric 4-column editorial grid (Brand & OS status using local `images/logo_hyperur.jpg`, Navigation with `aria-current="page"`, Telegram Community channels, and Core Lead maintainers), hairline dividers, Dark/Light theme parity, 100% VI/EN i18n coverage, hover-gated rules, `:focus-visible`, and `prefers-reduced-motion` support.

7. **Redesigned `serial.html` Modal & Lookup Cards (Concept 1A + Concept 2A)** — see `specs/007-redesign-serial-modal-lookup/`
   - **Part 1 (`#success-dialog`, Concept 1A — Split Checkout Ngang)**: Fixed Dark-mode `--sr-*` token scoping across `.sr-modal`, `.sr-lightbox`, and `.sr-toast`; redesigned modal into a compact 2-column horizontal checkout with top-right `×` close, full `crypto_intl` (Binance Pay / PayPal) sub-tab support, non-breaking full-width transfer memo + copy buttons, `<dialog>` top-layer-safe QR lightbox handoff, and removed leftover obsolete 36-day `isFree` dead code from `serial.js` and `json/i18n.js`.
   - **Part 2 (`#lookup-result-container` & `.lookup-history-*`, Concept 2A — Astryx Flat Ledger & Status Rail)**: Replaced legacy `.lookup-result-card` (broken `--radius-xl`/`--radius-full` sharp corners and Light-Mode-breaking dark inline styles) with `.sr-res-card` across all 5 lookup states (`email`, `active`, `pending`, `expired`, `notfound`), loading spinner, and Astryx-styled lookup history; added `escapeHtml()` sanitization and email prefill support on `[data-jump-to-register]`.

8. **Dynamic Admin Telegram Routing (`@lcnguy06` / `@Usagi79`)** — see `specs/008-admin-telegram-routing/`
   - Added `recipient_acc` and `recipient_name` to `sql/schema.sql`, `api/serial-register.php` (strict allowlist + safe `SHOW COLUMNS` auto-migration + 12-param prepared statements), and `api/serial-lookup.php` (with `payment_transactions` fallback for webhook-matched serials).
   - Updated `serial.js`, `json/i18n.js`, `styles.css`, and `serial.html` to cache selected QR recipients (`NGUYEN TAN LUC` / `VQRQAMNWP9901` → `@lcnguy06`, `NGUYEN VAN TUC` / `VQRQANJTA5424` → `@Usagi79`), route directly when the recipient is known, and show a collapsible Astryx 2-admin picker (`.sr-admin-picker`) when the recipient is unknown.

---

## 2. Suggested Next Steps
1. **Runtime PHP/MySQL Verification**: Test `api/serial-register.php`, `api/payment-webhook.php`, `api/qr-active.php`, `check_serial2.php`, and `add_serial.php` on an environment with PHP 8.x + MySQL (or run `scripts/sepay-e2e/run.ps1`).
2. **Optional Next UI Redecoration**: The remaining public page body after `guide.html`, `download.html`, `serial.html`, and the shared global footer is `index.html` (check hero/feature sections if further Astryx alignment is desired).

---

## 3. Useful Verification Commands
- **JS syntax**: `node --check json/i18n.js; node --check json/devices.js; node --check serial.js`
- **PHP syntax (XAMPP)**: `& 'C:\xampp\php\php.exe' -l api/serial-register.php; & 'C:\xampp\php\php.exe' -l api/serial-lookup.php`
- **Git safe.directory note (Windows)**: If git reports dubious ownership, prefix with `git -c safe.directory=<repo-path> ...`.

## 4. Suggested Skills for the Next Agent
Read `AGENTS.md` first, then load only what matches the next task:
- `impeccable` & `frontend-design` — for any further UI redesigns (`serial.html`, `index.html`).
- `prototype` — when the user asks to preview redesign demos before editing production HTML/CSS.
- `code-review` & `differential-review` — before committing/merging the accumulated backend + frontend diff.
- `chrome-devtools` — for live visual/responsive/a11y checks on localhost.
