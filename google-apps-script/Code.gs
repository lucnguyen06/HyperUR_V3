/**
 * =========================================================================
 * HYPERUR V3 - GOOGLE DRIVE AUTO-SYNC & API SCRIPT (Google Apps Script)
 * =========================================================================
 * Script này tự động quét thư mục Google Drive chứa các bản ROM HyperUR:
 * - Link Tổng (Root): https://drive.google.com/drive/u/2/folders/1WxXT6Mx7ZdknKh_gd-dQr0Jturtkypyq
 *   + Thư mục con "China" (ID: 1gSFtHeF7SAINCDG5lBJ5o3RBMS-s90St)
 *   + Thư mục con "Glb"   (ID: 1PoSGGsS9T9hyEN2GOAZAXqiIchC5Z61n)
 * 
 * Tự động hỗ trợ quét đệ quy tất cả thư mục con, nhận diện định dạng file ROM:
 * Ví dụ: UR_amethyst_OS3.0.305.0.WOPCNXM_16.7z
 * =========================================================================
 */

// ==================== CẤU HÌNH HỆ THỐNG ====================
const CONFIG = {
  // 1. ID thư mục Google Drive chính (Link Tổng)
  FOLDER_ID: "1WxXT6Mx7ZdknKh_gd-dQr0Jturtkypyq",

  // Danh sách thư mục quét đã được lược bỏ (đã gỡ 2026-09-16) vì ID cũ hết hạn/bị revoke.
  // Code chỉ quét đệ quy từ FOLDER_ID gốc và tự nhận diện region theo tên thư mục con
  // (chứa "glb"/"global" -> global, mặc định còn lại -> cn).

  // 2. Cấu hình GitOps GitHub (Tùy chọn tự động commit active_roms.json lên GitHub)
  GITHUB: {
    ENABLED: false,                         // Đổi thành true nếu muốn tự động commit lên GitHub
    OWNER: "lucnguyen06",                   // Tên tài khoản GitHub
    REPO: "HyperUR_V3",                     // Tên repository GitHub
    BRANCH: "main",                         // Nhánh chính (main hoặc master)
    FILE_PATH: "active_roms.json",          // Đường dẫn file trong repo
    TOKEN: "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"      // GitHub Personal Access Token (quyền 'repo')
  },

  // 3. Cấu hình Webhook tới server riêng (Tùy chọn)
  WEBHOOK: {
    ENABLED: false,
    URL: "https://hyperur.io.vn/api/update-link",
    SECRET_TOKEN: "ma_bao_mat_cua_ban"
  }
};

/**
 * Bóc tách thông tin file ROM:
 * Chuẩn thực tế HyperUR:
 * UR_[codename]_[osBuild]_[androidVer].7z (hoặc .zip)
 * Ví dụ: UR_amethyst_OS3.0.305.0.WOPCNXM_16.7z
 * 
 * Cũng hỗ trợ chuẩn:
 * HyperUR_[codename]_[osKey]_[osBuild]_[androidVer].zip
 */
function parseRomFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return null;
  }
  const cleanName = fileName.replace(/\.(7z|zip|tar|rar|bin)$/i, '');

  // Chuẩn thực tế: UR_amethyst_OS3.0.305.0.WOPCNXM_16
  const regexActual = /^(?:UR|HyperUR)_([a-zA-Z0-9]+)_(OS\d+\.\d+[^_]*)_(\d+(?:\.\d+)?)$/i;
  let match = cleanName.match(regexActual);
  if (match) {
    let codename = match[1].toLowerCase();
    if (codename === 'aurorapro') codename = 'aurora';
    const osBuild = match[2];
    const androidVer = match[3].includes('.') ? match[3] : match[3] + '.0';
    const osKeyMatch = osBuild.match(/^OS\d+\.\d+/);
    const osKey = osKeyMatch ? osKeyMatch[0] : 'OS3.0';

    return {
      codename: codename,
      osKey: osKey,
      osBuild: osBuild,
      androidVer: androidVer
    };
  }

  // Chuẩn 2: HyperUR_houji_OS2.0_OS2.0.12.0.VNCCNXM_15.0
  const regexStandard = /^(?:HyperUR|UR)_([a-zA-Z0-9]+)_(OS\d+\.\d+)_([A-Za-z0-9._]+)_(\d+\.\d+)$/i;
  match = cleanName.match(regexStandard);
  if (match) {
    let codename = match[1].toLowerCase();
    if (codename === 'aurorapro') codename = 'aurora';
    return {
      codename: codename,
      osKey: match[2].toUpperCase(),
      osBuild: match[3],
      androidVer: match[4]
    };
  }

  // Chuẩn 3: UR_houji_OS3.0.306.0.WNCCNXM
  const regexSimple = /^(?:HyperUR|UR)_([a-zA-Z0-9]+)_(OS\d+\.\d+[^_]*)$/i;
  match = cleanName.match(regexSimple);
  if (match) {
    let codename = match[1].toLowerCase();
    if (codename === 'aurorapro') codename = 'aurora';
    const osBuild = match[2];
    const osKeyMatch = osBuild.match(/^OS\d+\.\d+/);
    const osKey = osKeyMatch ? osKeyMatch[0] : 'OS2.0';
    return {
      codename: codename,
      osKey: osKey,
      osBuild: osBuild,
      androidVer: osKey.includes('3') ? '16.0' : (osKey.includes('2') ? '15.0' : '14.0')
    };
  }

  return null;
}

/**
 * Quét toàn bộ file trong một thư mục Google Drive
 */
function scanFolderFiles(folder, defaultRegion, activeRoms, uniqueDevices) {
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    const parsed = parseRomFileName(fileName);

    if (!parsed) {
      continue;
    }

    const { codename, osKey, osBuild, androidVer } = parsed;
    const fileId = file.getId();
    
    // Link tải trực tiếp từ Google Drive
    const directDownloadLink = "https://drive.google.com/uc?export=download&id=" + fileId;
    const viewLink = file.getUrl();
    const fileSizeMB = (file.getSize() / (1024 * 1024)).toFixed(1);
    const sizeFormatted = fileSizeMB > 1024 ? (fileSizeMB / 1024).toFixed(2) + " GB" : fileSizeMB + " MB";

    if (!activeRoms[codename]) {
      activeRoms[codename] = {
        device: codename,
        roms: {}
      };
    }

    // Xác định key lưu trữ:
    // Nếu chưa có ROM nào cho osKey này (VD: "OS3.0") thì lưu key là osKey để giữ cấu trúc chuẩn
    // Nếu có thêm bản build khác của cùng osKey (VD: nezha có cả 309 và 312), chuyển sang lưu theo tên osBuild để không bị đè
    let romKey = osKey;
    if (activeRoms[codename].roms[romKey]) {
      const existing = activeRoms[codename].roms[romKey];
      if (existing.os !== osBuild) {
        activeRoms[codename].roms[existing.os] = existing;
        delete activeRoms[codename].roms[romKey];
        romKey = osBuild;
      }
    } else {
      const isDuplicateOs = Object.keys(activeRoms[codename].roms).some(function(k) {
        return activeRoms[codename].roms[k].osKey === osKey;
      });
      if (isDuplicateOs) {
        romKey = osBuild;
      }
    }

    activeRoms[codename].roms[romKey] = {
      os: osBuild,
      osKey: osKey,
      android: androidVer,
      region: defaultRegion || "cn",
      download: directDownloadLink,
      viewUrl: viewLink,
      fileId: fileId,
      fileName: fileName,
      size: sizeFormatted,
      date: Utilities.formatDate(file.getLastUpdated(), "GMT+7", "yyyy-MM-dd")
    };

    uniqueDevices.add(codename);
  }
}

/**
 * Quét toàn bộ cây thư mục Google Drive (Thư mục gốc + tất cả thư mục con)
 */
function scanGoogleDriveFolder() {
  const activeRoms = {
    _metadata: {
      lastSync: new Date().toISOString(),
      totalDevices: 0,
      totalRoms: 0,
      source: "HyperUR Live Google Drive Sync"
    }
  };

  const uniqueDevices = new Set();

  // 1. Quét theo danh sách subfolders đã định nghĩa trước
  if (CONFIG.SUBFOLDERS && CONFIG.SUBFOLDERS.length > 0) {
    for (let i = 0; i < CONFIG.SUBFOLDERS.length; i++) {
      const sub = CONFIG.SUBFOLDERS[i];
      try {
        const f = DriveApp.getFolderById(sub.id);
        scanFolderFiles(f, sub.region, activeRoms, uniqueDevices);
      } catch (err) {
        console.warn("Không thể truy cập thư mục " + sub.name + ": " + err.toString());
      }
    }
  }

  // 2. Quét đệ quy từ thư mục gốc
  if (CONFIG.FOLDER_ID && CONFIG.FOLDER_ID.trim() !== "") {
    try {
      const rootFolder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
      scanFolderFiles(rootFolder, "cn", activeRoms, uniqueDevices);

      // Quét tất cả thư mục con bên trong thư mục gốc
      const subFoldersIter = rootFolder.getFolders();
      while (subFoldersIter.hasNext()) {
        const subF = subFoldersIter.next();
        const subName = subF.getName().toLowerCase();
        const subRegion = subName.includes("glb") || subName.includes("global") ? "global" : "cn";
        scanFolderFiles(subF, subRegion, activeRoms, uniqueDevices);
      }
    } catch (e) {
      console.warn("Lỗi khi quét thư mục gốc: " + e.toString());
    }
  }

  // Đếm tổng số ROM
  let totalRoms = 0;
  for (const code of uniqueDevices) {
    totalRoms += Object.keys(activeRoms[code].roms).length;
  }

  activeRoms._metadata.totalDevices = uniqueDevices.size;
  activeRoms._metadata.totalRoms = totalRoms;

  return activeRoms;
}

/**
 * =========================================================================
 * ENDPOINT WEB APP (doGet)
 * Cho phép website HyperUR (https://hyperur.io.vn) fetch dữ liệu thời gian thực
 * =========================================================================
 */
function doGet(e) {
  try {
    const cache = CacheService.getScriptCache();
    let cachedData = cache.get("active_roms_json");

    const forceRefresh = e && e.parameter && e.parameter.action === "refresh";

    if (!cachedData || forceRefresh) {
      const data = scanGoogleDriveFolder();
      cachedData = JSON.stringify(data);
      // Cache 2 phút để tối ưu tốc độ mà vẫn cập nhật ROM mới cực nhanh
      cache.put("active_roms_json", cachedData, 120);
    }

    return ContentService.createTextOutput(cachedData)
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const errPayload = JSON.stringify({
      error: true,
      message: error.toString()
    });
    return ContentService.createTextOutput(errPayload)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * =========================================================================
 * ENDPOINT TIẾP NHẬN FORM ĐĂNG KÝ SERIAL (doPost)
 * Nhận dữ liệu đăng ký serial từ register.html và lưu vào Google Sheet
 * =========================================================================
 */
function doPost(e) {
  try {
    let data = {};
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        data = e.parameter || {};
      }
    } else if (e.parameter) {
      data = e.parameter;
    }

    const serial = (data.serial || data.serialNumber || "").toString().trim().toUpperCase();
    const codename = (data.codename || data.deviceCodename || "").toString().trim().toLowerCase();
    const plan = data.plan || data.registrationType || "Đăng kí có Ủng hộ (Vĩnh viễn)";
    const paymentMethod = data.paymentMethod || "Góp Quỹ MoMo (Chính Thức)";
    const senderName = data.senderName || "";
    const transactionCode = data.transactionCode || "";
    const timestamp = data.timestamp || new Date().toISOString();

    // Mở hoặc tạo Google Sheet lưu danh sách đăng ký
    let ss = null;
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (err) {}

    if (!ss && CONFIG.SPREADSHEET_ID) {
      try {
        ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      } catch (err) {}
    }

    if (ss) {
      let sheet = ss.getSheetByName("Serial_Registrations");
      if (!sheet) {
        sheet = ss.insertSheet("Serial_Registrations");
        // Header
        sheet.appendRow([
          "Thời Gian",
          "Số Serial",
          "Mã Thiết Bị (Codename)",
          "Gói Đăng Ký",
          "Phương Thức Ủng Hộ",
          "Tên Người Gửi",
          "Nội Dung & Mã GD",
          "Trạng Thái"
        ]);
        sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
      }

      sheet.appendRow([
        new Date().toLocaleString("vi-VN"),
        serial,
        codename,
        plan,
        paymentMethod,
        senderName,
        transactionCode,
        "Chờ kích hoạt"
      ]);
    }

    const response = {
      success: true,
      message: "Đã tiếp nhận thông tin đăng ký serial thành công!",
      serial: serial,
      codename: codename
    };

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * =========================================================================
 * HÀM TRIGGER CHẠY ĐỊNH KỲ (MỖI 5 PHÚT)
 * =========================================================================
 */
function checkDriveUpdates() {
  console.log("⏳ Bắt đầu quét Google Drive...");
  try {
    const activeRoms = scanGoogleDriveFolder();
    const activeRomsJson = JSON.stringify(activeRoms, null, 2);

    CacheService.getScriptCache().put("active_roms_json", activeRomsJson, 600);

    if (CONFIG.GITHUB.ENABLED) {
      commitToGitHub(activeRomsJson);
    }

    if (CONFIG.WEBHOOK.ENABLED) {
      sendWebhookNotification(activeRoms);
    }

    console.log("✅ Quét thành công: " + activeRoms._metadata.totalDevices + " máy, " + activeRoms._metadata.totalRoms + " ROM.");
  } catch (err) {
    console.error("❌ Lỗi khi quét: " + err.toString());
  }
}

/**
 * Tự động commit active_roms.json lên GitHub Repository
 */
function commitToGitHub(jsonContent) {
  const { OWNER, REPO, BRANCH, FILE_PATH, TOKEN } = CONFIG.GITHUB;
  if (!TOKEN || TOKEN.includes("xxxx")) return;

  const apiUrl = "https://api.github.com/repos/" + OWNER + "/" + REPO + "/contents/" + FILE_PATH;
  
  let currentSha = null;
  try {
    const getRes = UrlFetchApp.fetch(apiUrl + "?ref=" + BRANCH, {
      method: "get",
      headers: {
        "Authorization": "token " + TOKEN,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "GoogleAppsScript-HyperUR"
      },
      muteHttpExceptions: true
    });
    if (getRes.getResponseCode() === 200) {
      const getJson = JSON.parse(getRes.getContentText());
      currentSha = getJson.sha;
    }
  } catch (e) {}

  const base64Content = Utilities.base64Encode(jsonContent, Utilities.Charset.UTF_8);
  const payload = {
    message: "Auto-sync active ROMs from Google Drive [skip ci]",
    content: base64Content,
    branch: BRANCH
  };
  if (currentSha) payload.sha = currentSha;

  UrlFetchApp.fetch(apiUrl, {
    method: "put",
    headers: {
      "Authorization": "token " + TOKEN,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "GoogleAppsScript-HyperUR"
    },
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function sendWebhookNotification(payloadData) {
  try {
    UrlFetchApp.fetch(CONFIG.WEBHOOK.URL, {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + CONFIG.WEBHOOK.SECRET_TOKEN },
      payload: JSON.stringify(payloadData),
      muteHttpExceptions: true
    });
  } catch (e) {}
}

/**
 * Chạy thử nghiệm trong trình soạn thảo Apps Script
 * (Chọn hàm 'testScanFolder' ở thanh menu trên cùng rồi bấm nút 'Chạy' / 'Run')
 */
function testScanFolder() {
  console.log("🧪 Đang chạy thử nghiệm quét Drive...");
  const result = scanGoogleDriveFolder();
  console.log("✅ Quét xong! Tổng thiết bị: " + result._metadata.totalDevices + ", Tổng số bản ROM: " + result._metadata.totalRoms);

  // Tự động kiểm tra và in ra bất kỳ thiết bị nào có từ 2 bản ROM trở lên
  const multiRomList = [];
  for (const key of Object.keys(result)) {
    if (key === '_metadata') continue;
    const count = Object.keys(result[key].roms || {}).length;
    if (count > 1) {
      multiRomList.push(key + " (" + count + " bản)");
    }
  }

  if (multiRomList.length > 0) {
    console.log("⭐ Các thiết bị đang có nhiều bản ROM: " + multiRomList.join(", "));
  }
}
