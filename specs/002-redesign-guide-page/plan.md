# Implementation Plan: 002 — Redesign `guide.html`

## Files to Modify
1. `guide.html`
   - Load `JetBrains Mono` alongside `Inter` and `Be Vietnam Pro` (consistent with `index.html` / `serial.html`).
   - Add `<a href="#guide-main" class="skip-link">` and `<meta name="theme-color">`.
   - Keep shared HyperUR V3 navbar, mobile drawer, footer, scroll-to-top, and `json/devices.js`.
   - Implement the Editorial Field Manual layout (`guide-editorial-shell`, `guide-editorial-hero`, `guide-editorial-row` split-index rows, static requirements list, copyable script bar with clipboard handler + `aria-live`, collapsible TWRP/OrangeFox `<details>`, 2-column troubleshooting table, and bottom action row).
2. `styles.css`
   - Append isolated `.guide-editorial*` styles (Dark + `[data-theme="light"]` overrides + responsive breakpoints + `prefers-reduced-motion`) without mutating styles used by other pages.

## Verification
- Run Impeccable mechanical detector: `impeccable.cmd detect --json guide.html styles.css`
- Verify inline JS syntax in `guide.html` and check all internal links, `aria-*` attributes, and responsive rules.
- If a headless browser / screenshot tool is available via `impeccable shot`, visually inspect rendered desktop & mobile views.
