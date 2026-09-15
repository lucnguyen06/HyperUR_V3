/**
 * build_catalog.js
 * Script tự động quét 121 file trong thư mục devices/ và gộp thành devices_catalog.json
 * Giúp tối ưu hóa tốc độ tải trang web HyperUR V3 (từ 121 HTTP requests xuống còn 1 request duy nhất)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEVICES_DIR = path.join(ROOT_DIR, 'devices');
const MANIFEST_PATH = path.join(DEVICES_DIR, 'manifest.json');
const OUTPUT_PATH = path.join(ROOT_DIR, 'devices_catalog.json');

function buildCatalog() {
  console.log('🚀 Bắt đầu gộp danh mục thiết bị HyperUR...');

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`❌ Không tìm thấy file: ${MANIFEST_PATH}`);
    process.exit(1);
  }

  const manifestData = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const codenames = manifestData.devices || [];
  console.log(`📋 Tìm thấy ${codenames.length} thiết bị trong manifest.json`);

  const catalog = {};
  let successCount = 0;
  let missingCount = 0;

  for (const code of codenames) {
    const filePath = path.join(DEVICES_DIR, `${code}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const devData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Trích xuất thương hiệu chính
        let brand = 'Xiaomi';
        if (devData.branches && devData.branches.length > 0) {
          const foundBrand = devData.branches.find(b => b.brand)?.brand;
          if (foundBrand) brand = foundBrand;
        }

        // Làm gọn thông tin branch (loại bỏ link tĩnh cũ nếu cần hoặc giữ nguyên khung metadata)
        const branchesMeta = (devData.branches || []).map(b => ({
          name: b.name || { en: b.branchCode },
          branchCode: b.branchCode || code,
          brand: b.brand || brand,
          region: b.region || 'cn',
          device: b.device || devData.name
        }));

        catalog[code] = {
          code: code,
          name: devData.name || { en: code },
          brand: brand,
          type: devData.type || 'phone',
          codeName: devData.code || '',
          supports: devData.supports || ['OS1.0', 'OS2.0'],
          android: devData.android || [],
          branches: branchesMeta
        };

        successCount++;
      } catch (err) {
        console.warn(`⚠️ Lỗi khi đọc file ${code}.json:`, err.message);
      }
    } else {
      console.warn(`⚠️ Không tìm thấy file thiết bị: ${code}.json`);
      missingCount++;
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`✅ Hoàn tất! Đã xuất ${successCount} thiết bị vào: ${OUTPUT_PATH}`);
  if (missingCount > 0) {
    console.log(`ℹ️ Số thiết bị thiếu file: ${missingCount}`);
  }
}

buildCatalog();
