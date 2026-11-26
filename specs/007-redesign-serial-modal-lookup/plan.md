# Plan 007: Redesign `#success-dialog` (Concept 1A) & `#lookup-result-container` (Concept 2A)

## File Changes
1. **`json/i18n.js`**:
   - Remove obsolete `serial.modalFreeTitle` and `serial.modalFreeDesc` from `vi` and `en`.
   - Add 14 new VI/EN translation keys covering Concept 1A modal labels/hints (`serial.modalSavedPill`, `serial.modalZoomHint`, `serial.modalAccShort`, `serial.modalBinanceUidShort`, `serial.modalPaypalLinkShort`, `serial.modalQrHintClean`, `serial.modalIntlHint`) and Concept 2A lookup states (`serial.notFoundCheckTitle`, `serial.btnRegisterThisSnShort`, `serial.btnRegisterNewLicense`, `serial.expiredRenewNote`, `serial.btnUpgradeLifetime`, `serial.pendingQrShortSub`, `serial.pendingWarningClean`).
2. **`serial.html`**:
   - Replace `<dialog id="success-dialog">` markup (`lines 647–719`) with Concept 1A Split Checkout structure (`.sr-modal-shell`, `.sr-modal-head`, `.sr-modal-split-body`, `.sr-modal-qr-pane`, `#modal-intl-switcher`, `.sr-modal-info-pane`, `.sr-modal-footer`), preserving all functional IDs (`#modal-serial-val`, `#modal-codename-val`, `#modal-plan-val`, `#modal-amount-val`, `#modal-email-val`, `#modal-payment-qr-box`, `#modal-qr-img`, `#modal-qr-syntax`, `#modal-btn-copy-syntax`, `#modal-qr-acc-val`, `#modal-qr-owner-val`, `#modal-lookup-link`, `#modal-close-btn`).
   - Bump script query string to `serial.js?v=20261126_astrx3`.
3. **`serial.js`**:
   - Add `escapeHtml(str)` helper for XSS-safe dynamic rendering across lookup cards and history.
   - Add `syncModalPaymentView()` supporting both `mbbank` and `crypto_intl` (`binance` / `paypal`) inside `#success-dialog`, remove dead `isFree` branch, wire `#modal-close-x` and modal intl sub-tabs, and sync on `hyperur:langchange`.
   - Upgrade `openQrLightbox()` / `closeQrLightbox()` to support modal QR (safely closing/restoring native `<dialog>` top layer) and pending lookup QR zoom.
   - Redesign `performLookup()` loading card and `renderLookupResultCard()` across all 5 states (`email`, `active`, `pending`, `expired`, `notfound`) using Concept 2A `.sr-res-*` semantic classes with zero hardcoded dark inline styles, and fix `[data-jump-to-register]` email prefill.
4. **`styles.css`**:
   - Expand dark-mode `--sr-*` token selector to `.sr-page, .sr-modal, .sr-lightbox, .sr-toast` and add `--sr-error-text`, `--sr-error-soft`, `--sr-backdrop` tokens for Dark and Light themes.
   - Add scoped CSS for Concept 1A `.sr-modal-*`, Concept 2A `.sr-res-*`, and `.sr-page .lookup-history-*` with zero `transition: all`, fine-pointer hover gates, `:focus-visible`, responsive breakpoints (`<= 680px` / `<= 640px`), and `prefers-reduced-motion: reduce`.
5. **Verification & Handoff**:
   - Run Node syntax checks, VI/EN i18n parity & usage checks, CSS brace balance & zero `transition: all` checks, dead-code/hardcoded-style audit, and DOM ID parity check.
   - Update `specs/007-redesign-serial-modal-lookup/tasks.md` and `HANDOFF.md`.
