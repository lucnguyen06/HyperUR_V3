/**
 * HyperUR V3 - Google Drive ROM API (Apps Script Web App)
 *
 * Cấu trúc Drive:
 *   HYPERUR (ROOT_FOLDER_ID)
 *   ├── fuxi/      -> các file ROM của fuxi
 *   ├── ishtar/    -> các file ROM của ishtar
 *   └── nuwa/
 *       └── Global/  (tùy chọn: thư mục con theo vùng CN / Global / EEA ...)
 *
 * Mỗi thư mục con cấp 1 là một codename. Codename nào có file ROM thì website hiển thị phần tải.
 *
 * Đây là project Apps Script RIÊNG (khác project Đăng ký Serial trong Code.gs vì cả hai đều có doGet).
 * Deploy: Web App • Execute as: Me • Who has access: Anyone
 * Trigger: refreshRomCache mỗi 5 phút để người dùng luôn nhận dữ liệu từ cache (phản hồi nhanh).
 */

const DRIVE_API_CONFIG = {
  ROOT_FOLDER_ID: '1hxTHOs5ua7Q5uWs236hGW_6X7jxaifKq',
  CACHE_KEY: 'hyperur_active_roms_v2',
  STALE_CACHE_KEY: 'hyperur_active_roms_v2_stale',
  CACHE_SECONDS: 600,           // cache 10 phút — đã debug xong, tăng từ 60s lên 600s
  MAX_DEPTH: 3,
  TIMEZONE: 'Asia/Ho_Chi_Minh',
  ROM_EXTENSION_REGEX: /\.(7z|zip|tgz|tar|gz|rar)$/i,
  CODENAME_ALIASES: { aurorapro: 'aurora' },
  // Dấu hiệu nhận biết code mới đã deploy — nếu endpoint ?version=1 trả về 'v4-folder-link' tức là đang chạy code mới
  API_VERSION: 'v4-folder-link'
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

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};

    // 0) ?version=1 → kiểm tra code mới đã deploy chưa
    if (params.version === '1') {
      return jsonResponse_({
        ok: true,
        apiVersion: DRIVE_API_CONFIG.API_VERSION,
        cacheKey: DRIVE_API_CONFIG.CACHE_KEY,
        cacheSeconds: DRIVE_API_CONFIG.CACHE_SECONDS,
        maxDepth: DRIVE_API_CONFIG.MAX_DEPTH,
        rootFolderId: DRIVE_API_CONFIG.ROOT_FOLDER_ID,
        deployedAt: new Date().toISOString()
      });
    }

    // 1) ?refresh=1 → xóa cache trước khi xử lý
    if (params.refresh === '1') {
      try {
        CacheService.getScriptCache().remove(DRIVE_API_CONFIG.CACHE_KEY);
      } catch (cacheErr) {
        // bỏ qua nếu cache lỗi
      }
    }

    // 2) ?debug=tree → trả về cấu trúc cây thư mục Drive (KHÔNG qua cache)
    if (params.debug === 'tree') {
      const tree = buildFolderTree_();
      tree._metadata = tree._metadata || {};
      tree._metadata.apiVersion = DRIVE_API_CONFIG.API_VERSION;
      return jsonResponse_(tree);
    }

    // 3) ?debug=raw → trả về kết quả buildActiveRoms() thô, KHÔNG qua cache
    if (params.debug === 'raw') {
      const data = buildActiveRoms();
      data._metadata = data._metadata || {};
      data._metadata.apiVersion = DRIVE_API_CONFIG.API_VERSION;
      data._metadata.servedFrom = 'debug-raw (no cache)';
      return jsonResponse_(data);
    }

    // 4) ?debug=1 → cấu trúc rút gọn (tên folder + số file ROM, không qua cache)
    if (params.debug === '1') {
      const data = buildActiveRoms();
      const codes = Object.keys(data).filter(k => k !== '_metadata');
      const summary = {
        _metadata: {
          ...data._metadata,
          apiVersion: DRIVE_API_CONFIG.API_VERSION,
          servedFrom: 'debug-summary (no cache)'
        },
        summary: codes.map(code => ({
          codename: code,
          romCount: Object.keys(data[code].roms || {}).length,
          roms: data[code].roms || {}
        }))
      };
      return jsonResponse_(summary);
    }

    // Mặc định: trả JSON thiết bị (qua cache)
    const json = getActiveRomsJson_();
    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    // Trả lỗi rõ ràng thay vì để Apps Script trả về "Script function not found" mơ hồ
    return jsonResponse_({
      _metadata: {
        error: true,
        errorMessage: String(err && err.message ? err.message : err),
        errorStack: String(err && err.stack ? err.stack : ''),
        apiVersion: DRIVE_API_CONFIG.API_VERSION,
        deployedAt: new Date().toISOString()
      }
    }, 500);
  }
}

function jsonResponse_(obj, statusCode) {
  // ContentService không hỗ trợ status code tùy chỉnh; chỉ truyền vào body
  return ContentService
    .createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Quét cây thư mục Drive gốc và trả về danh sách folder + file (dùng để debug cấu trúc). */
function buildFolderTree_() {
  const tree = {
    rootFolderId: DRIVE_API_CONFIG.ROOT_FOLDER_ID,
    scannedAt: new Date().toISOString(),
    maxDepth: DRIVE_API_CONFIG.MAX_DEPTH,
    codenames: {}
  };
  const root = DriveApp.getFolderById(DRIVE_API_CONFIG.ROOT_FOLDER_ID);
  const codenameFolders = root.getFolders();
  while (codenameFolders.hasNext()) {
    const folder = codenameFolders.next();
    tree.codenames[folder.getName()] = scanTree_(folder, 0);
  }
  return tree;
}

function scanTree_(folder, depth) {
  const node = {
    id: folder.getId(),
    type: 'folder',
    folders: [],
    files: []
  };
  if (depth < DRIVE_API_CONFIG.MAX_DEPTH) {
    const subs = folder.getFolders();
    while (subs.hasNext()) {
      const sub = subs.next();
      node.folders.push(scanTree_(sub, depth + 1));
    }
  }
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    node.files.push({
      id: f.getId(),
      name: f.getName(),
      mimeType: f.getMimeType(),
      size: f.getSize(),
      modified: Utilities.formatDate(f.getLastUpdated(), DRIVE_API_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm')
    });
  }
  return node;
}

/** Chạy bằng Trigger (Time-driven, mỗi 5 phút) để làm mới cache. */
function refreshRomCache() {
  const json = JSON.stringify(buildActiveRoms());
  putCache_(json);
  Logger.log('Đã làm mới cache: ' + json.length + ' bytes');
}

/** Chạy tay trong editor để xem kết quả quét. */
function testScanFolder() {
  const data = buildActiveRoms();
  Logger.log(JSON.stringify(data._metadata));
  Object.keys(data).filter(k => k !== '_metadata').forEach(code => {
    const roms = data[code].roms;
    Object.keys(roms).forEach(key => {
      Logger.log(code + ' | ' + roms[key].fileName + ' | ' + roms[key].region + ' | ' + roms[key].size);
    });
  });
}

function getActiveRomsJson_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(DRIVE_API_CONFIG.CACHE_KEY);
  if (cached) return cached;

  try {
    const json = JSON.stringify(buildActiveRoms());
    putCache_(json);
    return json;
  } catch (err) {
    // Quét Drive lỗi -> trả bản dự phòng (sống lâu hơn) thay vì báo lỗi
    const stale = cache.get(DRIVE_API_CONFIG.STALE_CACHE_KEY);
    if (stale) return stale;
    throw err;
  }
}

/** Chạy tay 1 lần trong editor để tạo trigger tự làm ấm cache mỗi 5 phút. */
function installRefreshTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'refreshRomCache') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshRomCache').timeBased().everyMinutes(5).create();
  refreshRomCache();
  Logger.log('Đã tạo trigger refreshRomCache mỗi 5 phút.');
}

function putCache_(json) {
  try {
    const cache = CacheService.getScriptCache();
    cache.put(DRIVE_API_CONFIG.CACHE_KEY, json, DRIVE_API_CONFIG.CACHE_SECONDS);
    // Bản dự phòng sống 6 giờ (tối đa của CacheService)
    cache.put(DRIVE_API_CONFIG.STALE_CACHE_KEY, json, 21600);
  } catch (err) {
    // CacheService giới hạn 100KB / key; vượt quá thì bỏ qua cache
    Logger.log('Không thể ghi cache: ' + err);
  }
}

function buildActiveRoms() {
  const result = {
    _metadata: {
      lastSync: new Date().toISOString(),
      totalDevices: 0,
      totalRoms: 0,
      source: 'HyperUR Live Google Drive Sync',
      rootFolderId: DRIVE_API_CONFIG.ROOT_FOLDER_ID
    }
  };

  const root = DriveApp.getFolderById(DRIVE_API_CONFIG.ROOT_FOLDER_ID);
  const codenameFolders = root.getFolders();

  while (codenameFolders.hasNext()) {
    const folder = codenameFolders.next();
    const codename = normalizeCodename_(folder.getName());
    if (!codename) continue;
    // Khởi tạo entry ngay khi thấy folder hợp lệ, kể cả khi folder rỗng.
    // Trước đây chỉ tạo khi collectRomFiles_() gặp file ROM đầu tiên ➔ folder rỗng bị "ẩn".
    if (!result[codename]) {
      const folderId = folder.getId();
      result[codename] = {
        device: codename,
        roms: {},
        // Thêm 2 trường để web mở folder Drive khi click thẻ rỗng:
        folderId: folderId,
        folderUrl: 'https://drive.google.com/drive/folders/' + folderId
      };
    }
    collectRomFiles_(folder, codename, null, 0, result);
  }

  const codes = Object.keys(result).filter(k => k !== '_metadata');
  result._metadata.totalDevices = codes.length;
  result._metadata.totalRoms = codes.reduce((sum, c) => sum + Object.keys(result[c].roms).length, 0);
  return result;
}

function collectRomFiles_(folder, codename, regionHint, depth, result) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    if (!DRIVE_API_CONFIG.ROM_EXTENSION_REGEX.test(fileName)) continue;

    const info = parseRomFileName(fileName, regionHint);
    const fileId = file.getId();

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
      size: formatBytes_(file.getSize()),
      date: Utilities.formatDate(file.getLastUpdated(), DRIVE_API_CONFIG.TIMEZONE, 'yyyy-MM-dd')
    };
  }

  if (depth >= DRIVE_API_CONFIG.MAX_DEPTH) return;

  const subFolders = folder.getFolders();
  while (subFolders.hasNext()) {
    const sub = subFolders.next();
    const subRegion = REGION_FOLDER_NAMES[sub.getName().trim().toLowerCase()] || regionHint;
    collectRomFiles_(sub, codename, subRegion, depth + 1, result);
  }
}

/**
 * Hỗ trợ: UR_amethyst_OS3.0.305.0.WOPCNXM_16.7z, HyperUR_fuxi_OS3.0.300.0.WNCCNXM.zip, ...
 */
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

  return { baseName: baseName, osBuild: osBuild, osKey: osKey, android: android, region: region };
}

function normalizeCodename_(name) {
  const code = String(name || '').trim().toLowerCase();
  if (!/^[a-z0-9_]+$/.test(code)) return '';
  return DRIVE_API_CONFIG.CODENAME_ALIASES[code] || code;
}

function formatBytes_(bytes) {
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
