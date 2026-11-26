# Plan 006: Redesign Global Site Footer (Concept A — Astryx Editorial Grid)

## File Changes
1. **`json/i18n.js`**: Add 11 VI/EN key pairs under `// Footer` (`footer.statusEditorial`, `footer.colNav`, `footer.colComm`, `footer.colTeam`, `footer.navDownload`, `footer.navGuide`, `footer.commChannel`, `footer.commGroup`, `footer.roleLead`, `footer.copyrightClean`, `footer.disclaimer`) while keeping legacy `footer.*` keys intact.
2. **`styles.css`**: Append scoped `/* GLOBAL SITE FOOTER — ASTRYX EDITORIAL GRID (.ft-*) */` section with dark/light semantic tokens, asymmetric 4-column editorial grid, hairline dividers, monospace handles, hover-gated fine-pointer states, `:focus-visible`, responsive breakpoints (`960px`, `680px`), and `prefers-reduced-motion` support.
3. **`index.html`, `download.html`, `guide.html`, `serial.html`**: Replace `<footer class="site-footer site-footer-minimal">...</footer>` with `<footer class="ft-editorial">...</footer>`, setting `aria-current="page"` on each page's active footer navigation link.
4. **`HANDOFF.md` & `specs/006-redesign-footer/tasks.md`**: Document the completed footer redesign and mark all tasks done.
5. **Verification**: Validate JS syntax (`node --check`), 100% VI/EN i18n key parity, footer i18n resolution, single `.ft-editorial` per page, `aria-current="page"` correctness, CSS brace balance, zero `transition: all` in `.ft-*`, and `images/logo_hyperur.jpg` presence.
