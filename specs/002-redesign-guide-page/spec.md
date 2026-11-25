# Specification: 002 — Redesign `guide.html` (Editorial Field Manual)

## Goal
Redesign `guide.html` into a high-contrast, scannable **Editorial Field Manual** (Demo C) that integrates seamlessly with HyperUR V3's existing navbar, footer, and Dark/Light theme system while prioritizing reading comprehension and zero visual clutter.

## Requirements & Acceptance Criteria

### R1. Visual Direction & Layout (Demo C — Editorial Field Manual)
- **R1.1**: Preserve HyperUR V3's global sticky navbar, mobile drawer, theme toggle (`data-theme="dark" | "light"`), minimalist footer, scroll-to-top button, and `json/devices.js` script hook.
- **R1.2**: Replace heavy card/glassmorphism step containers with a clean **Split-Index editorial layout** (`max-width: 960px`, horizontal hairline dividers, 4fr left section index column + 8fr right content column capped at ~68ch measure, stacking cleanly to 1 column on mobile `< 768px`).
- **R1.3**: No decorative eyebrow/kicker above `<h1>`, no one-sided left accent bars on rounded boxes, no `transition: all`, and full `prefers-reduced-motion` support.

### R2. Content Requirements (User-Approved)
- **R2.1 — Điều kiện bắt buộc (Static, No Checkboxes)**: Display a scannable static list (no interactive checkboxes or tick counters) covering:
  1. Bootloader đã mở khóa (Unlocked) — `Bắt buộc`
  2. Sao lưu dữ liệu cá nhân (không bắt buộc; nếu có dữ liệu quan trọng tốt nhất hãy sao lưu lại để đề phòng trường hợp xấu nhất) — `Khuyến nghị`
  3. Pin thiết bị tối thiểu 50% — `An toàn`
  4. Cáp truyền dữ liệu tốt & kết nối USB trực tiếp — `Bắt buộc`
- **R2.2 — USB Port Connection Rule**: Explicitly instruct users:
  - PC: cắm cáp trực tiếp vào các cổng USB trên **mainboard (mặt sau)**, **tuyệt đối không** cắm các cổng ở mặt trước vỏ case hay qua hub chia USB.
  - Laptop: cắm trực tiếp vào cổng USB trên thân máy, **tuyệt đối không** cắm qua hub chia USB.
- **R2.3 — Bước 1 (Tải ROM & cài Driver)**: Codename verification, download `.tgz`/`.zip` from `download.html`, install Xiaomi Android USB Driver, enter Fastboot (`Nguồn + Giảm âm lượng`) and plug USB cable directly per R2.2.
- **R2.4 — Bước 2 (Flash ROM qua máy tính)**: Numbered steps using `Flashing_Tool_Windows_UR.bat`, inline copyable filename/path bar with accessible copy feedback (`aria-live="polite"`), safety note against disconnecting cable/power, and collapsible `<details>` fallback for Custom Recovery (`TWRP / OrangeFox`).
- **R2.5 — Bước 3 (Khởi động lần đầu & hoàn tất)**: Focus strictly on first boot duration (`3–5 phút`) and entering HyperUR welcome screen. **Exclude** Wi-Fi / Google Play Store / Play Integrity / eKYC copy.
- **R2.6 — Xử lý sự cố (Troubleshooting Table)**: 2-column reference table (`Triệu chứng` | `Cách xử lý`) for Bootloop (Format Data `yes`) and Windows 11 Fastboot detection (direct mainboard/laptop USB port, USB 2.0, Android Bootloader Interface driver). **Exclude** `flash_all_lock.bat` Hard-brick warning (stock ROM only).
- **R2.7 — Bottom Action Row**: Direct CTA to `download.html` plus secondary support link to Telegram community.

### R3. Accessibility, i18n & Web Quality
- Skip-to-content link, semantic landmarks (`<header>`, `<main>`, `<article>`, `<table>`, `<details>`, `<footer>`), visible `:focus-visible` states, `aria-hidden="true"` on decorative SVGs, `translate="no"` on technical filenames/paths/tokens, explicit `width`/`height` on footer logo image, and contrast ≥ 4.5:1 across both Dark and Light themes.
- Full VI/EN internationalization via `json/i18n.js` (`#lang-btn` toggle in navbar, `guide.*` keys for both `vi` and `en`, page-specific `title` and `<meta name="description">`, and `data-i18n-html` support).
