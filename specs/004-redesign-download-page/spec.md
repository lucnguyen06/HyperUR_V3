# Spec 004: Redesign `download.html` (Command Spotlight & Clean Bento Cards)

## Context & Goal
Redesign the public ROM downloads page (`download.html`), its dynamic renderer (`json/devices.js`), its scoped stylesheet section (`styles.css`), and its VI/EN translation entries (`json/i18n.js`) using the approved **Concept C — Command Spotlight & Clean Bento Cards** direction.

## Functional Requirements
1. **Command Spotlight Header**:
   - Compact kicker (`0.9rem`, bold monospace), clear page title, concise subtitle displaying the **real Google Drive device count** (`state.driveCodenamesCount`) dynamically after sync (no hardcoded `189+`).
   - Prominent Spotlight search input supporting real-time filtering by device name (VI/EN), codename, or brand, plus `/` keyboard shortcut to focus and clear button to reset.
   - Quick-search codename chips (auto-populated from top available Drive devices plus a Reset chip when a query is active).
2. **Stale-While-Revalidate & Session-Scoped Caching**:
   - Cache Drive ROM data in `sessionStorage` (`hyperur-active-roms`) so in-session reloads render immediately (<50ms) while live sync runs in the background, and cache clears automatically when closing the tab/browser.
   - Apply the same `sessionStorage` cache policy across public pages (including `serial.js` email count cache, QR rotation cache, and lookup history cache), while keeping UI preferences (`hyperur-theme`, `hyperur-lang`) in `localStorage`.
2. **Unified Filter & Drive Sync Toolbar**:
   - Brand segmented tabs (`All`, `Xiaomi`, `Redmi`) with live count badges (`#count-all`, `#count-xiaomi`, `#count-redmi`).
   - Integrated Google Drive live sync indicator (folder count, ready builds count, last sync timestamp with tooltip, and optional view-mode toggle button controlled by `config.ENABLE_VIEW_TOGGLE`).
   - No `OS3.0` / `OS2.0` filter bar or OS pills on device cards (per user feedback).
3. **Clean Bento Device Cards**:
   - Display real device thumbnail `images/{codename}.png` with a clean vector/monogram fallback when an image is unavailable (no raw emojis).
   - Full-width device title without right-side badge crowding (prevents awkward 2-line wrapping on short names like "Xiaomi 17 Ultra").
   - Clean metadata row displaying monospace `codename`, brand, and build availability status (`{count} builds` / `Empty folder`).
   - Two clear actions per card:
     - Primary button: **Open Drive** (`<a target="_blank" rel="noopener noreferrer">`) linking directly to the device's Google Drive folder (falls back to modal if `folderUrl` is missing).
     - Secondary button: **Details / Builds** (`<button data-modal-code>`) opening the native `<dialog id="rom-dialog">` build list modal to inspect regions, build strings, file sizes, dates, and copy direct download links.
4. **Native `<dialog>` Build Inspector Modal**:
   - Preserves native `<dialog>` accessibility (backdrop click close, Escape close, close button).
   - Refined visual hierarchy without emoji clutter; supports copying direct Google Drive download links with a non-blocking toast notification (replacing blocking `alert()`).
   - Re-renders automatically if the user switches language while open.
5. **Full VI / EN i18n & Dark / Light Theme Support**:
   - All static and dynamic copy localized in `json/i18n.js` (`vi` and `en` parity = 100%).
   - WCAG AA contrast across both `[data-theme="dark"]` and `[data-theme="light"]` themes.
   - Responsive across desktop, tablet, and mobile viewports; respects `prefers-reduced-motion`.

## Non-Goals / Constraints
- Do not change Google Drive API fetching logic, caching, or auto-sync cadence in `json/devices.js`.
- Do not modify `admin/` pages or shared navbar/footer behavior of other pages.
