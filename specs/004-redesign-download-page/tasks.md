# Tasks: 004 — Redesign `download.html`

- [x] **T1**: Add new VI / EN translation keys for the redesigned download UI in `json/i18n.js`.
- [x] **T2**: Update `download.html` structure to Command Spotlight & Clean Bento layout (preserving navbar, footer, scripts, and accessibility).
- [x] **T3**: Update `json/devices.js` to render refined Clean Bento cards (no OS chips, uncrowded title, real device images), compact sync bar, quick codename chips, `/` shortcut, and non-blocking toast + modal refresh on `hyperur:langchange`.
- [x] **T4**: Append scoped `.dl-*` and `.dl-dialog` styles (Dark & Light modes, WCAG AA contrast, responsive, reduced-motion) to `styles.css`.
- [x] **T5**: Verify JS syntax, inline scripts, 100% VI/EN i18n key parity, and clean diff.
- [x] **T6**: Post-review refinements — enlarge `.dl-kicker` to `0.9rem`, replace hardcoded `189+` with live Google Drive device count (`#dl-hero-desc`), add Stale-While-Revalidate background sync, and migrate all site data caches (`devices.js` & `serial.js`) to `sessionStorage` (auto-cleared on tab/browser close).
