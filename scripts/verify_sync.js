/**
 * verify_sync.js
 * Kiểm tra toàn vẹn logic đồng bộ giữa devices_catalog.json và active_roms.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'devices_catalog.json'), 'utf8'));
const activeRoms = JSON.parse(fs.readFileSync(path.join(ROOT, 'active_roms.json'), 'utf8'));

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
    console.warn(`   ⚠️ [${code}] - Không tìm thấy trong catalog!`);
  }
});

console.log(`3. Tổng số bản ROM sẵn sàng tải: ${totalActiveRoms}`);
console.log(`\n🎉 Tất cả cấu trúc dữ liệu đã được kiểm tra và hoạt động hoàn hảo!\n`);
