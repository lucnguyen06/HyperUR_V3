# Plan 005: Redesign `serial.html` (Astryx Payment Split)

## File Changes
1. **`json/i18n.js`**: Add 13 new VI / EN key pairs (`serial.summaryPlanLabel`, `serial.summaryPlanVal`, `serial.summaryDeviceLabel`, `serial.summarySnLabel`, `serial.summaryWaiting`, `serial.paySub`, `serial.helpHeading`, `serial.qrInlineReady`, `serial.copiedBtn`, `serial.copyCmdFastboot`, `serial.openLookupQuick`, `serial.trustSePay`, `serial.lookupSub`).
2. **`serial.html`**: Replace `<main class="main-content">` with `.sr-page` Concept A Astryx Payment Split markup while preserving header/navbar, `#success-dialog`, `#qr-lightbox-modal`, footer, `#reg-toast`, `#sr-live-status`, and all functional element IDs used by `serial.js`. Update script query bust to `serial.js?v=20261125_astrx`.
3. **`serial.js`**:
   - Update `activateTab` to drive `#serial-tab-slider` via measured `offsetLeft`/`offsetWidth` (plus `ResizeObserver`) and apply `.sr-enter-right` / `.sr-enter-left` directional blur-slide transitions.
   - Add `.sr-collapsible-trigger` toggle handler (`aria-expanded` + `.is-open`).
   - Keep `#sr-summary-device`, `#sr-summary-serial`, and `#sr-radio-vnd-price` synchronized live (including on `hyperur:langchange`), pulsing `#donation-amount-val` on price changes.
   - Upgrade clipboard copying (`copyTextToClipboard` + `markCopyBtnCopied`) with animated stroke-draw checkmark + `Đã chép`/`Copied` 2s feedback across all copy buttons and dynamic lookup cards, updating `#sr-live-status`.
   - Clean up dynamic button HTML restore and lookup empty/result markup to stay visually consistent without raw emojis where applicable.
4. **`styles.css`**: Append scoped `/* SERIAL PAGE REDESIGN — ASTRYX PAYMENT SPLIT (.sr-*) */` CSS block covering dark/light semantic tokens, hairline dividers, Astryx RadioList, Collapsible, Gliding tabs, Sticky Order Summary, Checkout QR, Lookup cards, Modal & Lightbox polish, reduced-motion, and hover-gated rules.
5. **Verification & Handoff**: Validate `node --check`, CSS braces, zero `transition: all`, full 6-page VI/EN i18n parity, DOM ID parity, update `tasks.md` and `HANDOFF.md`.
