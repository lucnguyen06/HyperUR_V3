# Spec 006: Redesign Global Site Footer (Concept A — Astryx Editorial Grid)

## Context & Goal
Replace the legacy centered minimalist footer (`.site-footer-minimal`, hardcoded `189+` device count, missing site navigation and Telegram community links) with the user-approved **Concept A — Astryx Editorial Grid** (`.ft-editorial`) across all 4 public HyperUR V3 pages (`index.html`, `download.html`, `guide.html`, `serial.html`), `styles.css`, and `json/i18n.js`.

## Functional & Design Requirements
1. **Asymmetric 4-Column Editorial Grid (`.ft-editorial`, `.ft-grid`)**:
   - Desktop layout: `grid-template-columns: 1.85fr 1fr 1.15fr 1fr`, tablet `1.4fr 1fr` (`<= 960px`), mobile `1fr` (`<= 680px`).
   - Crisp `1px` hairline top border and baseline divider; zero decorative blur orbs, glassmorphism blobs, or gradient text.
2. **Column Content & Structure**:
   - **Col 1 (Brand & Status)**: `images/logo_hyperur.jpg` (`32x32`, `border-radius: 9px`, `loading="lazy"`) paired with solid `HyperUR` wordmark, concise description (`footer.desc`), inline emerald status dot, and `HyperOS 1.0 – 4.0 · Xiaomi / Redmi / POCO` (`footer.statusEditorial` — removing hardcoded `189+`).
   - **Col 2 (`Điều hướng` / `Navigation`)**: Links to `index.html`, `download.html`, `guide.html`, and `serial.html`, with `aria-current="page"` on the current page's link.
   - **Col 3 (`Cộng đồng` / `Community`)**: External Telegram links to `https://t.me/hypermodupdate` (`@hypermodupdate`) and `https://t.me/HuperUltraRateChat` (`@HuperUltraRateChat`) with `target="_blank" rel="noopener noreferrer"` and arrow-up-right icon.
   - **Col 4 (`Phát triển` / `Maintainers`)**: External Telegram links to `https://t.me/lcnguy06` (`@lcnguy06`) and `https://t.me/Usagi79` (`@Usagi79`) with `Core Lead & Dev` subtitle.
3. **Bottom Baseline (`.ft-bottom`)**:
   - Left: `© 2026 HyperUR Team. Bảo lưu mọi quyền.` (`footer.copyrightClean`) and `Dự án độc lập, không trực thuộc Xiaomi Inc.` (`footer.disclaimer`).
   - Right: Back-to-top anchor `<a href="#" class="ft-top-btn">` (`footer.scrollTop`).
4. **Themes, i18n, Motion & Accessibility**:
   - Full Dark (`Obsidian`) and Light (`Titanium Pearl`) WCAG AA contrast via scoped `.ft-editorial` and `[data-theme="light"] .ft-editorial` CSS tokens.
   - 100% VI/EN translation key parity in `json/i18n.js`.
   - Animate UI motion discipline: explicit property transitions (`cubic-bezier(0.22, 1, 0.36, 1)`), hover states gated inside `@media (hover: hover) and (pointer: fine)`, `scale(0.97)` press feedback on `.ft-top-btn`, visible `:focus-visible` outlines, full `@media (prefers-reduced-motion: reduce)` support, zero `transition: all`, and zero raw emojis.

## Non-Goals / Constraints
- Do not modify `admin/` pages, `features.html` / `firmware.html` redirect stubs, the sticky navbar, the floating `.scroll-to-top` button, or backend/JS APIs.
- Keep legacy `.site-footer` styles intact in `styles.css` to avoid breaking any external/archived references.
