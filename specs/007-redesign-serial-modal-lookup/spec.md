# Spec 007: Redesign `#success-dialog` (Concept 1A) & `#lookup-result-container` (Concept 2A)

## Context & Goal
Following Spec 005 (`serial.html` Concept A — Astryx Payment Split), two surfaces on `serial.html` remained in legacy or broken styling:
1. **Part 1 (`#success-dialog`)**: Dark-mode `--sr-*` CSS tokens were scoped only to `.sr-page` (leaving buttons inside `#success-dialog` transparent/borderless in Dark Mode), the vertical layout exceeded ~900px height, the transfer memo broke mid-email next to its copy button, `crypto_intl` payments fell back to MBBank VietQR in the modal, and obsolete `isFree` (36-day) dead code remained in `serial.js` / `json/i18n.js`.
2. **Part 2 (`#lookup-result-container` & `.lookup-history-item`)**: `.lookup-result-card` and `.lookup-status-pill` referenced undefined `--radius-xl` and `--radius-full` variables (producing sharp 0px square corners), Email Multi-Device & Pending QR views hardcoded dark inline styles that broke Light Mode, and the overall visual grammar clashed with the flat Astryx Payment Split page.

This spec adopts the user-approved **Concept 1A (Split Checkout Ngang)** for Part 1 and **Concept 2A (Astryx Flat Ledger & Status Rail)** for Part 2 across all 5 real lookup states, loading state, and lookup history.

## Functional & Design Requirements

### 1. Part 1: `#success-dialog` — Concept 1A (Split Checkout Ngang)
- **Dark & Light Theme Parity**: Scope dark-mode `--sr-*` tokens onto `.sr-page, .sr-modal, .sr-lightbox, .sr-toast` (plus `--sr-error-text`, `--sr-error-soft`, `--sr-backdrop`) so `#success-dialog` renders cleanly in both themes.
- **Horizontal 2-Column Split Checkout (`.sr-modal-shell`, max-width ~712px desktop, stacked <= 680px)**:
  - **Header (`.sr-modal-head`)**: Saved pill (`Đã lưu Serial`), title (`Quét Mã QR Để Kích Hoạt!`), monospace SN chip (`#modal-serial-val`), and top-right `×` close button (`#modal-close-x`).
  - **Left Column (`.sr-modal-qr-pane`)**: Optional `crypto_intl` sub-tab switcher (`#modal-intl-switcher`: Binance Pay 5 USDT | PayPal 5 USD), clickable white QR card (`#modal-qr-frame` with channel badge, `#modal-qr-img`, footer caption), tabular amount (`#modal-amount-val`), tier tag (`#modal-tier-tag`), and zoom hint.
  - **Right Column (`.sr-modal-info-pane`)**: Hairline-divided receipt (`Device`, `Plan`, `Email`), full-width transfer memo card (`.sr-modal-syntax-card` with header copy button `#modal-btn-copy-syntax` + full-width `#modal-qr-syntax` so long memos never clip awkwardly mid-email), dynamic channel rows (`#modal-bank-group` with copyable STK & Owner, `#modal-binance-group` with copyable UID, `#modal-paypal-group` with copyable link), and SePay/channel note (`#modal-qr-hint-text`).
  - **Footer (`.sr-modal-footer`)**: Ghost close button (`#modal-close-btn`) and Primary lookup CTA (`#modal-lookup-link`).
- **Channel & Lightbox Accuracy**:
  - `syncModalPaymentView()` handles both `mbbank` (dynamic `qrAccounts[currentQrIndex]` VietQR + 50k/40k pricing) and `crypto_intl` (Binance Pay / PayPal QR images & account rows).
  - Clicking `#modal-qr-frame` closes `<dialog>` temporarily (`reopenSuccessAfterLightbox = true`), opens `#qr-lightbox-modal` cleanly above the page without `<dialog>` top-layer occlusion, and restores `successDialog.showModal()` when the lightbox closes.
- **Cleanup**: Remove obsolete 36-day `isFree` branch in `serial.js` and `serial.modalFreeTitle` / `serial.modalFreeDesc` from `json/i18n.js`. Keep inline `#reg-center-payment-wrapper` revealed when submitting.

### 2. Part 2: `#lookup-result-container` & History — Concept 2A (Astryx Flat Ledger & Status Rail)
- **Unified `.sr-res-card` Architecture**:
  - `16px` border-radius (`var(--sr-radius-box)`), hairline border, `3px` semantic left rail (`.is-active`, `.is-pending`, `.is-expired`, `.is-not-found`, `.is-email`), zero neon drop glow, Animate UI `srPanelEnter` entrance.
  - Header with `40×40` rounded-square tinted `.sr-res-icon`, title, monospace identifier (`SN:` or `Email:`) + inline `.sr-copy-btn`, and rounded status `.sr-res-badge` (animated `.sr-res-pulse-dot` strictly for `isPending`, static `.sr-res-dot` for all other states).
- **All 5 Real Lookup States + Loading**:
  1. **Not Found (`.is-not-found`)**: Concise description, single hairline-bordered diagnostic box (`.sr-res-checks-box`), Primary CTA (`#1d4ed8`) to register (`Đăng ký Serial {sn} ngay` or `Đăng ký bản quyền mới`), and Ghost Telegram CTA. Clicking `[data-jump-to-register]` prefills `#sender-email-input` when the missed query is an email (`data-jump-is-email="1"`), or `#serial-input` when it is a Serial.
  2. **Active (`.is-active`)**: Hairline 2×2 `.sr-res-ledger` (`Device`, `Plan`, `Date`, `Expiry`), 2-column `.sr-res-perks` list, Primary (`download.html`) + Ghost (`guide.html`, Telegram support).
  3. **Pending (`.is-pending`)**: Hairline 2×2 `.sr-res-ledger` + theme-safe `.sr-res-pay-box` (clickable QR `[data-lookup-qr-zoom]`, copyable STK & Owner, full-width transfer memo + copy button, crisp SVG warning note) + Primary (`#btn-recheck-payment`) + Ghost (Telegram).
  4. **Expired (`.is-expired`)**: Hairline 2×2 `.sr-res-ledger` + `.sr-res-expired-note` (`serial.expiredRenewNote`) + Primary (`[data-jump-to-register]` → `Upgrade to Lifetime`) + Ghost (Telegram renew).
  5. **Email Multi-Device List (`.is-email`)**: Hairline-divided `.sr-res-device-list` resolving device display name from `devicesMap` where available, codename tag, copyable `SN:`, plan/date, and semantic status pill + Primary (`download.html`) + Ghost (`guide.html`).
  - **Loading State & History**: Clean `.sr-empty-state` spinner card in `performLookup()`, and scoped `.sr-page .lookup-history-*` Astryx cards matching Dark & Light themes with zero `transition: all`.
- **Security & Standards**: Escape all dynamic strings interpolated into `innerHTML` via `escapeHtml()`. Maintain 100% VI/EN i18n parity, hover-gated fine-pointer rules, `:focus-visible`, and `prefers-reduced-motion: reduce`.
