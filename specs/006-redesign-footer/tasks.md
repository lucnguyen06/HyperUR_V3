# Tasks 006: Redesign Global Site Footer (Concept A — Astryx Editorial Grid)

- [x] **T1**: Add 11 VI/EN footer translation keys (`footer.statusEditorial`, `footer.colNav`, `footer.colComm`, `footer.colTeam`, `footer.navDownload`, `footer.navGuide`, `footer.commChannel`, `footer.commGroup`, `footer.roleLead`, `footer.copyrightClean`, `footer.disclaimer`) to `json/i18n.js` without breaking legacy keys.
- [x] **T2**: Append scoped `.ft-*` Astryx Editorial Grid stylesheet block (dark/light tokens, grid, hairlines, hover-gated rules, responsive `960px`/`680px`, `prefers-reduced-motion`) to `styles.css`.
- [x] **T3**: Replace legacy `<footer class="site-footer site-footer-minimal">` with `<footer class="ft-editorial">` across `index.html`, `download.html`, `guide.html`, and `serial.html`, setting `aria-current="page"` on each active page link.
- [x] **T4**: Verify JS syntax, VI/EN i18n parity, footer key coverage, single footer per page, CSS braces, zero `transition: all` in `.ft-*`, and local asset `images/logo_hyperur.jpg`.
- [x] **T5**: Update `HANDOFF.md` and mark `specs/006-redesign-footer/tasks.md` complete.
