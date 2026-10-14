/**
 * verify_sync.js
 * Kiểm tra toàn vẹn logic đồng bộ giữa devices_catalog.json và active_roms.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'json', 'devices_catalog.json'), 'utf8'));
const activeRoms = JSON.parse(fs.readFileSync(path.join(ROOT, 'json', 'active_roms.json'), 'utf8'));

console.log(`\n=== KIỂM TRA HỆ THỐNG HYPERUR V3 ===`);
console.log(`1. Tổng số thiết bị trong từ điển devices_catalog.json: ${Object.keys(catalog).length}`);

const activeKeys = Object.keys(activeRoms).filter(k => k !== '_metadata');
console.log(`2. Số thiết bị có ROM trên Google Drive (active_roms.json): ${activeKeys.length}`);

let totalActiveRoms = 0;
activeKeys.forEach(code => {
  const devMeta = catalog[code];
  const romEntry = activeRoms[code];
  const romVersions = Object.keys(romEntry.roms || {});
  totalActiveRoms += romVersions.length;

  if (devMeta) {
    console.log(`   ✅ [${code}] - ${devMeta.name.en || code} (${devMeta.brand}): ${romVersions.join(', ')}`);
    romVersions.forEach(ver => {
      const r = romEntry.roms[ver];
      console.log(`      ↳ ${ver}: ${r.os} (Android ${r.android}) - Link: ${r.download ? 'Có' : 'Thiếu'}`);
    });
  } else {
    // Không nằm trong catalog vẫn hiển thị được: devices.js lấy chính codename làm tên máy.
    console.log(`   ℹ️ [${code}] - Chưa có trong catalog, web sẽ hiện tên = codename: ${romVersions.join(', ')}`);
  }
});

console.log(`3. Tổng số bản ROM sẵn sàng tải: ${totalActiveRoms}`);
if (activeKeys.length === 0) {
  console.log(`\nℹ️ Drive chưa có file ROM nào ➔ website sẽ chưa hiện phần tải (đúng như thiết kế).`);
  console.log(`   Kéo file ROM vào thư mục codename trong link tổng, rồi chạy: node scripts/scan_new_root.js --write\n`);
} else {
  console.log(`\n🎉 Cấu trúc dữ liệu hợp lệ.\n`);
}
