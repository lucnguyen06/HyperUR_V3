# Plan 004: Redesign `download.html`

## Architecture & File Changes
1. **`download.html`**:
   - Keep existing floating glass navbar (`#lang-btn`, `#mobile-menu-btn`, `#theme-btn`), mobile menu script, footer, `<dialog id="rom-dialog">`, and script load order (`json/config.js`, `json/i18n.js`, `json/devices.js`).
   - Add `JetBrains Mono` Google Font alongside `Be Vietnam Pro` / `Inter` to match `guide.html`.
   - Replace `.page-hero` + disconnected search/tabs/sync sections with scoped `.dl-shell` layout:
     - `.dl-spotlight` hero + prominent search input (`#device-search-input`, `#search-clear-btn`, `/` hint) + dynamic quick chips (`#dl-quick-chips`).
     - `.dl-toolbar` combining `#brand-tabs` (left) and `#drive-sync-container` (right).
     - `.dl-grid` (`#devices-grid`) with clean loading state.
     - Non-blocking `#dl-toast` live region for copy feedback.
2. **`json/devices.js`**:
   - Preserve all Google Drive / `devices_catalog.json` / fallback `manifest.json` data loading, `processDevicesAndRoms`, `applyFiltering`, and `scheduleNextSync` logic intact.
   - Update `renderDriveSyncBar()` to output compact inline toolbar HTML inside `#drive-sync-container`.
   - Add `renderQuickChips()` to populate up to 5 real active codename quick-filter chips + active-state highlight.
   - Update `renderGrid()` to render the refined Clean Bento `.dl-card` (real `images/{code}.png` + clean SVG fallback, uncrowded title, monospace codename + brand + status dot/count, no `OS3.0`/`OS2.0` pills, primary **Open Drive** + secondary **Details** button).
   - Update `openRomModal(code)` with clean SVG metadata icons (no raw emojis), track `state.openModalCode` so `hyperur:langchange` refreshes open modal content, and use non-blocking toast (`showToast`) instead of `alert()` when copying links.
   - Add `/` keyboard shortcut to focus `#device-search-input`.
3. **`json/i18n.js`**:
   - Add new VI / EN keys (`download.quickSearch`, `download.resetChip`, `download.detailsBtn`, `download.emptyFolderBadge`, `download.shortcutHint`, `download.noBuildsShort`, `download.openDriveShort`, `download.syncShort`, etc.) keeping 100% VI/EN parity.
4. **`styles.css`**:
   - Append scoped `.dl-*` styles (and refined `#rom-dialog.dl-dialog` overrides) at the end of `styles.css` supporting both Dark and Light themes, high contrast buttons (`#1d4ed8`), focus-visible rings, responsive grids, and `prefers-reduced-motion`.

## Verification Plan
- `node --check json/devices.js` and `node --check json/i18n.js`.
- Inline `<script>` syntax validation across `download.html`.
- Full VI/EN key-parity and placeholder-parity check across all public pages.
- Contrast & static CSS audit on `.dl-*` tokens.
