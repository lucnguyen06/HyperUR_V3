/**
 * HyperUR V3 - Scan Google Drive ROOT (Service Account, MAX_DEPTH=5)
 * ----------------------------------------------------------------
 * Quét thư mục Drive gốc (ROOT_FOLDER_ID) và sinh ra:
 *   - scripts/drive_scan_report.json  : báo cáo chi tiết cấu trúc cây thư mục
 *   - json/active_roms.json           : dữ liệu dự phòng cho website (khi dùng --write)
 *
 * Cấu trúc Drive mà script này giả định:
 *   <ROOT_FOLDER_ID>
 *   ├── fuxi/                <- thư mục con cấp 1 = codename
 *   │   ├── fuxi_OS1.0....    <- ROM nằm thẳng tại codename
 *   │   └── Global/          <- (tùy chọn) thư mục vùng
 *   │       └── fuxi_OS2.0.300.0.WNCCNXM.zip
 *   ├── ishtar/
 *   └── nuwa/
 *
 * Mỗi thư mục con cấp 1 là một codename. Codename nào có file ROM thì web mới hiện phần tải.
 *
 * ----------------------------------------------------------------
 * Cách dùng:
 *
 *   1) Cài dependency (chỉ lần đầu):
 *        cd scripts
 *        npm install
 *
 *   2) Đặt Service Account key vào:
 *        scripts/.secrets/hyperur-drive.json
 *      (đã được .gitignore bảo vệ, KHÔNG commit)
 *
 *   3) Trên Google Drive, share thư mục ROOT_FOLDER_ID cho email
 *      của Service Account với quyền "Viewer" (chỉ cần đọc).
 *
 *   4) Chạy:
 *        node scripts/scan_new_root.js                  # chỉ in ra console
 *        node scripts/scan_new_root.js --write          # ghi json/active_roms.json
 *        node scripts/scan_new_root.js --root=<folderId>
 *        node scripts/scan_new_root.js --key=path/to/sa.json
 *
 * ----------------------------------------------------------------
 * Logic 100% khớp với google-apps-script/DriveApi.gs (chỉ khác:
 *   - Dùng googleapis thay vì DriveApp
 *   - MAX_DEPTH=5 thay vì 3
 *   - Đệ quy bằng list-folders API thay vì folder.getFolders() đệ quy)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// =====================================================================
// CẤU HÌNH (giữ đồng bộ với google-apps-script/DriveApi.gs)
// =====================================================================
const DRIVE_API_CONFIG = {
  ROOT_FOLDER_ID: '1hxTHOs5ua7Q5uWs236hGW_6X7jxaifKq',
  CACHE_KEY: 'hyperur_active_roms_v2',
  CACHE_SECONDS: 600,
  MAX_DEPTH: 5,
  TIMEZONE: 'Asia/Ho_Chi_Minh',
  ROM_EXTENSION_REGEX: /\.(7z|zip|tgz|tar|gz|rar)$/i,
  CODENAME_ALIASES: { aurorapro: 'aurora' },
  // Service Account key path - có thể override bằng --key=<path>
  DEFAULT_SA_PATH: path.join(__dirname, '.secrets', 'hyperur-drive.json')
};

const REGION_FOLDER_NAMES = {
  cn: 'cn', china: 'cn',
  global: 'global', glb: 'global', mi: 'global',
  eea: 'eea', eu: 'eea', europe: 'eea',
  ru: 'ru', russia: 'ru',
  in: 'in', india: 'in',
  id: 'id', indonesia: 'id',
  tr: 'tr', turkey: 'tr',
  tw: 'tw', taiwan: 'tw',
  jp: 'jp', japan: 'jp',
  kr: 'kr', korea: 'kr'
};

const BUILD_REGION_CODES = {
  CN: 'cn', MI: 'global', EU: 'eea', RU: 'ru', IN: 'in',
  ID: 'id', TR: 'tr', TW: 'tw', JP: 'jp', KR: 'kr'
};

const ANDROID_BY_BUILD_LETTER = { U: '14.0', V: '15.0', W: '16.0' };
const ANDROID_BY_OS_KEY = { 'OS1.0': '14.0', 'OS2.0': '15.0', 'OS3.0': '16.0' };

// =====================================================================
// PARSE CLI ARGS
// =====================================================================
const ARGS = process.argv.slice(2);
const WRITE = ARGS.includes('--write');
const ROOT_ID_OVERRIDE = (() => {
  const a = ARGS.find(x => x.startsWith('--root='));
  return a ? a.slice('--root='.length) : null;
})();
const KEY_OVERRIDE = (() => {
  const a = ARGS.find(x => x.startsWith('--key='));
  return a ? a.slice('--key='.length) : null;
})();

const ROOT_ID = ROOT_ID_OVERRIDE || DRIVE_API_CONFIG.ROOT_FOLDER_ID;
const SA_PATH = KEY_OVERRIDE || DRIVE_API_CONFIG.DEFAULT_SA_PATH;

// =====================================================================
// HÀM TIỆN ÍCH (giống DriveApi.gs)
// =====================================================================
function normalizeCodename(name) {
  const code = String(name || '').trim().toLowerCase();
  if (!/^[a-z0-9_]+$/.test(code)) return '';
  return DRIVE_API_CONFIG.CODENAME_ALIASES[code] || code;
}

function parseRomFileName(fileName, regionHint) {
  const baseName = fileName.replace(DRIVE_API_CONFIG.ROM_EXTENSION_REGEX, '');
  const osMatch = baseName.match(/OS\d+(?:\.\d+)+(?:\.[A-Z0-9]+)?/i);
  const osBuild = osMatch ? osMatch[0].toUpperCase() : '';
  const osKeyMatch = osBuild.match(/^OS\d+\.\d+/);
  const osKey = osKeyMatch ? osKeyMatch[0] : 'OS3.0';

  const buildCodeMatch = osBuild.match(/\.([A-Z]{5,9})$/);
  const buildCode = buildCodeMatch ? buildCodeMatch[1] : '';

  let android = '';
  const androidMatch = baseName.match(/_(\d{2})(?:\.\d+)?$/);
  if (androidMatch) {
    android = androidMatch[1] + '.0';
  } else if (buildCode && ANDROID_BY_BUILD_LETTER[buildCode.charAt(0)]) {
    android = ANDROID_BY_BUILD_LETTER[buildCode.charAt(0)];
  } else {
    android = ANDROID_BY_OS_KEY[osKey] || '';
  }

  let region = regionHint || '';
  if (!region) {
    const regionMatch = buildCode.match(/(CN|MI|EU|RU|IN|ID|TR|TW|JP|KR)XM$/);
    region = regionMatch ? BUILD_REGION_CODES[regionMatch[1]] : 'cn';
  }

  return { baseName, osBuild, osKey, android, region };
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return value.toFixed(i >= 3 ? 2 : 0) + ' ' + units[i];
}

function formatDateIso(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d)) return '';
  // YYYY-MM-DD theo timezone VN
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DRIVE_API_CONFIG.TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d);
  const get = t => (parts.find(p => p.type === t) || {}).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// =====================================================================
// GOOGLE DRIVE API CLIENT
// =====================================================================
function getDriveClient() {
  if (!fs.existsSync(SA_PATH)) {
    throw new Error(
      `Không tìm thấy Service Account key tại: ${SA_PATH}\n` +
      `  → Hãy tạo thư mục scripts/.secrets/ và đặt file JSON key vào đó\n` +
      `  → Hoặc truyền --key=/đường/dẫn/file.json\n` +
      `  → File key lấy từ Google Cloud Console > IAM & Admin > Service Accounts > Keys`
    );
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: SA_PATH,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
  return google.drive({ version: 'v3', auth });
}

async function listAll(drive, folderId, mimeType) {
  // Phân trang qua tất cả file/folder con (mỗi trang 100 mục)
  const items = [];
  let pageToken = null;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='${mimeType}' and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
      pageSize: 1000,
      pageToken: pageToken || undefined,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    if (res.data.files) items.push(...res.data.files);
    pageToken = res.data.nextPageToken || null;
  } while (pageToken);
  return items;
}

// =====================================================================
// QUÉT ĐỆ QUY (MAX_DEPTH cấp, cùng logic DriveApi.gs)
// =====================================================================
async function collectRomFiles(drive, folderId, codename, regionHint, depth, result, tree) {
  // Lấy file ROM trong folder hiện tại
  const files = await listAll(drive, folderId, 'application/octet-stream')
    .catch(() => []); // một số file Drive có mime khác; ta vẫn sẽ lọc theo tên

  // Gộp cả "mimeType khác" nếu vẫn là file và có đuôi ROM (Drive hay set octet-stream cho .7z/.zip)
  // Ở đây ta đã list theo octet-stream; bù lại bằng cách gọi thêm list với mimeType rỗng:
  const allFiles = files.length > 0 ? files : [];
  if (allFiles.length === 0) {
    // Lấy tất cả file trong folder (không filter mime), rồi tự lọc theo tên
    let pageToken = null;
    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
        pageSize: 1000,
        pageToken: pageToken || undefined,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });
      if (res.data.files) allFiles.push(...res.data.files);
      pageToken = res.data.nextPageToken || null;
    } while (pageToken);
  }

  for (const file of allFiles) {
    const fileName = file.name;
    if (!DRIVE_API_CONFIG.ROM_EXTENSION_REGEX.test(fileName)) continue;

    const info = parseRomFileName(fileName, regionHint);
    const fileId = file.id;

    if (!result[codename]) {
      result[codename] = { device: codename, roms: {} };
    }

    let key = info.osBuild || info.baseName;
    if (result[codename].roms[key]) key = key + '_' + fileId.slice(0, 6);

    result[codename].roms[key] = {
      os: info.osBuild || info.baseName,
      osKey: info.osKey,
      android: info.android,
      region: info.region,
      download: 'https://drive.google.com/uc?export=download&id=' + fileId,
      viewUrl: 'https://drive.google.com/file/d/' + fileId + '/view',
      fileId: fileId,
      fileName: fileName,
      size: formatBytes(Number(file.size) || 0),
      date: formatDateIso(file.modifiedTime)
    };

    if (tree) {
      tree.roms.push({ name: fileName, id: fileId, region: info.region });
    }
  }

  if (depth >= DRIVE_API_CONFIG.MAX_DEPTH) return;

  // Đệ quy vào thư mục con
  const subFolders = await listAll(drive, folderId, 'application/vnd.google-apps.folder');
  for (const sub of subFolders) {
    const subName = sub.name.trim().toLowerCase();
    const subRegion = REGION_FOLDER_NAMES[subName] || regionHint;
    const subTree = { name: sub.name, region: subRegion, folders: [], roms: [] };
    if (tree) tree.folders.push(subTree);
    await collectRomFiles(drive, sub.id, codename, subRegion, depth + 1, result, subTree);
  }
}

// =====================================================================
// MAIN
// =====================================================================
async function main() {
  console.log('=== HyperUR V3 - Drive Scanner (Service Account) ===');
  console.log(`Root folder ID : ${ROOT_ID}`);
  console.log(`SA key path    : ${SA_PATH}`);
  console.log(`MAX_DEPTH      : ${DRIVE_API_CONFIG.MAX_DEPTH}`);
  console.log(`Mode           : ${WRITE ? 'WRITE json/active_roms.json' : 'REPORT ONLY'}`);

  const drive = getDriveClient();

  // Khởi tạo cấu trúc kết quả (đồng định dạng DriveApi.gs)
  const result = {
    _metadata: {
      lastSync: new Date().toISOString(),
      totalDevices: 0,
      totalRoms: 0,
      source: 'HyperUR Live Google Drive Sync',
      rootFolderId: ROOT_ID,
      maxDepth: DRIVE_API_CONFIG.MAX_DEPTH
    }
  };
  const report = {
    rootFolderId: ROOT_ID,
    scannedAt: new Date().toISOString(),
    maxDepth: DRIVE_API_CONFIG.MAX_DEPTH,
    codenames: {}
  };

  // Lấy tất cả folder con cấp 1 của ROOT
  const codenameFolders = await listAll(drive, ROOT_ID, 'application/vnd.google-apps.folder');
  console.log(`Thư mục con cấp 1 (codename): ${codenameFolders.length}`);

  for (const folder of codenameFolders) {
    const codename = normalizeCodename(folder.name);
    if (!codename) {
      console.log(`  ↪ Bỏ qua "${folder.name}" (không phải codename hợp lệ)`);
      continue;
    }
    const tree = { folderId: folder.id, folders: [], roms: [] };
    report.codenames[folder.name] = tree;
    await collectRomFiles(drive, folder.id, codename, null, 0, result, tree);

    const totalRoms = Object.keys(result[codename]?.roms || {}).length;
    console.log(`  • ${folder.name.padEnd(20)} codename=${codename.padEnd(14)} ${totalRoms} ROM`);
  }

  const codes = Object.keys(result).filter(k => k !== '_metadata');
  result._metadata.totalDevices = codes.length;
  result._metadata.totalRoms = codes.reduce((s, c) => s + Object.keys(result[c].roms).length, 0);

  // ----- Ghi report (luôn luôn) -----
  const reportPath = path.join(__dirname, 'drive_scan_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n📄 Đã ghi report: ${reportPath}`);

  // ----- Ghi file dự phòng (chỉ khi --write) -----
  if (WRITE) {
    const target = path.join(__dirname, '..', 'json', 'active_roms.json');
    fs.writeFileSync(target, JSON.stringify(result, null, 2), 'utf8');
    console.log(`💾 Đã ghi file dự phòng: ${target}`);
    console.log(`   ↪ ${result._metadata.totalDevices} máy / ${result._metadata.totalRoms} ROM`);
  } else {
    console.log(`\nℹ️  (Thêm --write để ghi json/active_roms.json)`);
    console.log(`   Sẽ ghi: ${result._metadata.totalDevices} máy / ${result._metadata.totalRoms} ROM`);
  }

  // ----- In tóm tắt -----
  console.log('\n--- Tóm tắt ---');
  codes.sort().forEach(code => {
    const r = result[code];
    const versions = Object.keys(r.roms);
    console.log(`  [${code}] (${versions.length} ROM)`);
    versions.forEach(v => {
      const rom = r.roms[v];
      console.log(`     ${v.padEnd(28)} region=${rom.region.padEnd(6)} android=${rom.android || '-'} size=${rom.size}`);
    });
  });
}

main().catch(err => {
  console.error('\n❌ Lỗi:', err.message);
  if (err.message && err.message.includes('insufficient authentication scopes')) {
    console.error('   → Kiểm tra Service Account đã được share thư mục Drive gốc chưa.');
  }
  if (err.code === 'ENOENT') {
    console.error('   → Kiểm tra đường dẫn file key Service Account.');
  }
  process.exit(1);
});
