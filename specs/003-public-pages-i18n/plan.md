# Implementation Plan: 003 — Full Public-Site i18n (VI / EN)

1. **`json/i18n.js`**:
   - Add `I18n.t(key, vars)` interpolation (`{name}` replacement).
   - Dispatch `window.dispatchEvent(new CustomEvent('hyperur:langchange', { detail: { lang: this.currentLang } }))` after `applyTranslations()` in `init()` and `setLang()`.
   - Add all VI/EN translation entries for `studio.*`, `download.*`, `serial.*`, and `redirect.*`.

2. **`index.html`**:
   - Update `<meta name="description">` and `<title>` attributes.
   - Add `data-i18n` / `data-i18n-aria-label` / `data-i18n-title` to Firmware Studio markup and lightbox.
   - Refactor Firmware Studio JS data (`STUDIO_SCREENS`, `STUDIO_MODULES`, `ULTRA_MODES`) to read localized strings for current language (`vi` / `en`) and listen to `hyperur:langchange`.

3. **`download.html` & `json/devices.js`**:
   - Add `#lang-btn` + `json/i18n.js` + `data-i18n*` across `download.html`.
   - Update `json/devices.js` with a safe `tr(key, fallback, vars)` helper using `window.I18n`, localized `REGION_LABELS`, localized device name preference (`dev.name[lang] || dev.name.en || dev.name.vi || dev.code`), and a `window.addEventListener('hyperur:langchange', ...)` listener to refresh sync bar, grid, and open modal.

4. **`features.html` & `firmware.html`**:
   - Add `json/i18n.js` and `data-i18n*` attributes to heading, description, button, and `<title>`.

5. **`serial.html` & `serial.js`**:
   - Add `#lang-btn` + `json/i18n.js` + `data-i18n*` across `serial.html`.
   - Add `tr(key, fallback, vars)` helper in `serial.js`, localize dynamic labels, toasts, modal messages, lookup cards, and QR lightbox while keeping backend-facing form values (`#reg-type-value`, `#payment-method-value`) unchanged so PHP API matching (`FREE_PLAN_WHITELIST`, DB records) is never broken. Subscribe to `hyperur:langchange`.

6. **Verification**:
   - Run automated Node.js audit script across ALL 6 public HTML pages + `json/i18n.js` + `json/devices.js` + `serial.js` verifying zero JS syntax errors, zero missing keys in `vi` or `en`, and zero untranslated visible headings on public pages.
