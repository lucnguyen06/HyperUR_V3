# Specification: 003 — Full Public-Site i18n (VI / EN)

## Goal
Provide complete, synchronized Vietnamese (`vi`) and English (`en`) internationalization across all public pages of HyperUR V3 (excluding `admin/`): `index.html`, `download.html` (+ `json/devices.js`), `serial.html` (+ `serial.js`), `features.html`, and `firmware.html` (`guide.html` is already complete).

## Requirements & Acceptance Criteria

### R1. Core i18n Engine (`json/i18n.js`)
- **R1.1**: Dispatch a `CustomEvent('hyperur:langchange', { detail: { lang } })` on `window` whenever language initializes or switches via `setLang()`/`toggleLang()`, enabling dynamic JS renderers (`index.html` Firmware Studio, `json/devices.js`, `serial.js`) to re-render immediately without page reload.
- **R1.2**: Support parameterized placeholder replacement via `I18n.t(key, vars)` (e.g., `I18n.t('download.syncFolders', { count: 42 })`).
- **R1.3**: Keep complete VI/EN key parity for all public pages: `index.html` (`studio.*`, `meta.*`), `download.html` (`download.*`), `serial.html` (`serial.*`), `features.html` (`redirect.*`), and `firmware.html` (`redirect.*`).

### R2. Homepage (`index.html`)
- **R2.1**: Fix `<meta name="description">` to use `data-i18n-meta-key="meta.description"` and `<title data-i18n-title-key="meta.title">`.
- **R2.2**: Add `data-i18n` attributes to the entire **Firmware Studio** section (header, 5 module buttons, screen nav controls, zoom button, verified badge, CTA link, lightbox labels).
- **R2.3**: Localize `STUDIO_SCREENS`, `STUDIO_MODULES`, screen counter (`Màn hình X / Y` vs `Screen X / Y`), and `ULTRA_MODES` captions dynamically, re-rendering on `hyperur:langchange`.

### R3. Download Page (`download.html` & `json/devices.js`)
- **R3.1**: Add `#lang-btn` toggle in navbar, load `json/i18n.js`, add `data-i18n*` attributes to all static elements (navbar, hero, search input/clear, brand tabs, loading placeholder, footer, ROM modal header, scroll-to-top).
- **R3.2**: Localize all dynamic UI rendered by `json/devices.js` (Drive sync bar, view toggle button, empty search state, device card action buttons & count pill, ROM modal empty/region/coming/copy/download states, clipboard alerts) and re-render on `hyperur:langchange`.

### R4. Serial Hub (`serial.html` & `serial.js`)
- **R4.1**: Add `#lang-btn` toggle in navbar, load `json/i18n.js`, add `data-i18n*` attributes to all static elements (navbar, hero, tabs, cross-banners, stepper, form labels/hints/placeholders, help accordions, plan card, payment method cards, QR panel labels, floating submit bar, trust badges, lookup card, empty state, history header, success modal, QR lightbox, footer).
- **R4.2**: Localize dynamic UI strings in `serial.js` (price tier labels/badges, email validation/stats, device preview, serial format preview, payment QR captions, validation toasts, submit success modal copy, lookup loading/result/not-found states, copy feedback, QR lightbox titles) while preserving backend API payload/enum values (`registrationType`, `paymentMethod` sent to PHP API stay intact!). Re-sync dynamic UI on `hyperur:langchange`.

### R5. Redirect Pages (`features.html`, `firmware.html`)
- **R5.1**: Load `json/i18n.js` and bind `data-i18n` / `data-i18n-html` / `data-i18n-title-key` so fallback redirect screens respect the user's saved language preference.

### R6. Out of Scope
- `admin/admin.html` and `admin/admin-users.html` remain Vietnamese-only per user request.
