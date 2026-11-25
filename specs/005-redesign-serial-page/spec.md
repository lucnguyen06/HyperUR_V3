# Spec 005: Redesign `serial.html` (Concept A — Astryx Payment Split)

## Context & Goal
Redesign the public Serial Registration & Lookup page (`serial.html`), its dynamic script (`serial.js`), its VI/EN dictionary (`json/i18n.js`), and its scoped stylesheet section (`styles.css`) using the user-approved **Concept A — Astryx Payment Split** (Meta Astryx `payment-form` grammar + Animate UI motion language), while keeping 100% of backend API contracts, SePay QR rotation, pricing logic, URL query parameters, and `sessionStorage` caches intact.

## Functional & Design Requirements
1. **Header & Gliding Tab Bar (`.sr-header`, `.sr-gliding-tabs`)**:
   - Bold monospace kicker (`0.9rem`, `serial.kicker`), clear page title, concise subtitle.
   - Gliding tab switcher (`Đăng Ký Serial` | `Tra Cứu Serial`) using `#serial-tab-slider` driven by real measured `offsetLeft`/`offsetWidth` (with `ResizeObserver`) and directional blur-slide entrances (`±12px`, `blur(5px)`) when switching panels.
   - Remove redundant cross-navigation banners, fake all-active 3-step stepper, oversized redundant VIP plan card, and pinned floating bottom action bar.
2. **Concept A — Astryx Payment Split Register Flow (`#panel-register`)**:
   - **Left Column (`.sr-card`)** divided by clean hairline dividers (`.sr-divider`):
     - Section 1 (`serial.sec1Title`, `serial.sec1Sub`): Contact Email (`#sender-email-input`) with real-time DB tier lookup (`#email-reg-stats`), 2-column Device Codename (`#codename-input` + `#devices-datalist` + `#device-preview-box`) & Hardware Serial (`#serial-input` + `#serial-clean-btn` + validation badge), and an **Astryx Collapsible** Fastboot (`fastboot getvar serialno`) / ADB (`adb get-serialno`) command helper (closed by default, smooth CSS grid row expansion `0fr → 1fr`, click-to-copy command buttons).
     - Section 2 (`serial.payChannelLabel`, `serial.paySub`): **Astryx RadioList** (`#payment-methods-grid`) with descriptions and right-aligned tabular pricing (`50.000đ`/`40.000đ` for `mbbank`, `$5.00` for `crypto_intl`).
   - **Right Sticky Column (`aside.sr-summary-col`, `.sr-summary-card`)**:
     - Live Order Summary showing applicable price (`#donation-amount-val` with `tabular-nums` + subtle blur swap on price/channel change), Plan, Device (`#sr-summary-device`), Serial (`#sr-summary-serial`), live Transfer Syntax (`#suggested-syntax` + quick copy button `#btn-copy-syntax-quick`), Primary Submit button (`#btn-submit-form`), and compact Trust line.
     - Submitting reveals `#reg-center-payment-wrapper` inline directly inside the Summary card (with VietQR/Binance/PayPal QR image, bank/crypto details, copy buttons, and `#btn-quick-lookup-tab`), alongside `#success-dialog`.
3. **Spotlight Lookup Flow (`#panel-lookup`)**:
   - Clean search card (`#lookup-form`, `#lookup-serial-input`, `#lookup-clear-btn`, `#lookup-submit-btn`) + collapsible Fastboot/ADB guide, `#lookup-result-container` (clean vector empty state, active/pending/not-found cards), and `#lookup-history-wrapper`.
4. **Animate UI Motion & Accessibility**:
   - Exact curves (`--sr-ease-out`, `--sr-ease-soft`, `--sr-ease-draw`, `--sr-ease-fill`, `--sr-ease-enter`), zero `transition: all`, all `:hover` gated inside `@media (hover: hover) and (pointer: fine)`, press feedback (`scale(0.97)`/`scale(0.985)`), immediate `:focus-visible`, animated stroke-draw checkmark + blur label swap (`Chép` → `Đã chép` / `Copy` → `Copied` for 2s) + `#sr-live-status` live region, full `@media (prefers-reduced-motion: reduce)` support, and zero raw emojis in static HTML.
5. **Backend Compatibility & i18n**:
   - Preserve `#reg-type-value` (`'Đăng kí có Ủng hộ (Vĩnh viễn)'`), `#payment-method-value` (`'Chuyển Khoản VietQR (24/7)'` / `'Quốc Tế & Crypto (Binance Pay / PayPal - Only 5$)'`), `api/serial-register.php` / `api/serial-lookup.php` / `api/qr-active.php` contracts, and `sessionStorage` caches.
   - Maintain 100% VI/EN parity in `json/i18n.js` and full Dark / Light theme WCAG AA contrast.
