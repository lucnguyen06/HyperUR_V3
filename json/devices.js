/**
 * HyperUR V3 - Devices Module (Google Drive Realtime & Dynamic Component)
 * Tự động đồng bộ với Google Drive API & hiển thị ĐỘNG danh sách thiết bị.
 * Chỉ hiển thị những thiết bị đang có file ROM trên Google Drive.
 */

(function () {
  'use strict';

  // Đọc cấu hình hệ thống từ config.js (hoặc giá trị mặc định an toàn)
  const config = window.HYPERUR_CONFIG || {
    GOOGLE_DRIVE_API_URL: "",
    ONLY_SHOW_ACTIVE_ROMS: true,
    ENABLE_VIEW_TOGGLE: true,
    CACHE_DURATION_MINUTES: 10
  };

  // Trạng thái ứng dụng
  const state = {
    allCatalogDevices: [],
    activeRomsMap: {},
    activeDevicesCount: 0,
    totalRomsCount: 0,
    // Danh sách codename có thư mục trên Google Drive (kể cả khi folder rỗng).
    // Dùng để hiện máy ngay khi folder được tạo, dù chưa upload ROM.
    driveCodenames: [],
    driveCodenamesCount: 0,
    onlyActiveRoms: config.ONLY_SHOW_ACTIVE_ROMS !== false,
    devices: [],
    byBrand: {
      all: [],
      xiaomi: [],
      redmi: []
    },
    activeBrand: 'all',
    searchQuery: '',
    cache: {},
    isSyncing: false,
    lastSyncAt: null,
    lastSyncError: null,
    openModalCode: null
  };

  // DOM Elements
  const gridEl = document.getElementById('devices-grid');
  const syncContainer = document.getElementById('drive-sync-container');
  const searchInput = document.getElementById('device-search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const searchKbd = document.getElementById('dl-search-kbd');
  const quickChipsEl = document.getElementById('dl-quick-chips');
  const brandTabs = document.getElementById('brand-tabs');
  const romDialog = document.getElementById('rom-dialog');
  const dialogName = document.getElementById('dialog-device-name');
  const dialogCode = document.getElementById('dialog-device-code');
  const dialogContent = document.getElementById('dialog-rom-content');
  const dialogCloseBtn = document.getElementById('dialog-close-btn');
  const toastEl = document.getElementById('dl-toast');
  const heroDescEl = document.getElementById('dl-hero-desc');

  function updateHeroDesc() {
    if (!heroDescEl) return;
    const count = state.driveCodenamesCount || 0;
    if (count > 0) {
      heroDescEl.textContent = tr(
        'download.descWithCount',
        'Khám phá và tải về các bản ROM HyperUR chính thức. Hiện đang đồng bộ {count} dòng điện thoại và máy tính bảng Xiaomi, Redmi trực tiếp từ Google Drive.',
        { count }
      );
    } else {
      heroDescEl.textContent = tr(
        'download.desc',
        'Khám phá và tải về các bản ROM HyperUR chính thức cho các dòng điện thoại và máy tính bảng Xiaomi, Redmi được đồng bộ trực tiếp từ Google Drive.'
      );
    }
  }

  let toastTimer = null;
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, 2400);
  }

  // i18n helper (tương thích an toàn khi không nạp i18n.js)
  function getLang() {
    return (typeof I18n !== 'undefined' && I18n.currentLang) ? I18n.currentLang : 'vi';
  }
  function tr(key, fallback, vars) {
    if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') {
      const val = I18n.t(key, vars);
      if (val && val !== key) return val;
    }
    let out = fallback;
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach(k => {
        out = out.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
      });
    }
    return out;
  }

  // Region display labels (VI / EN)
  const REGION_LABELS_BY_LANG = {
    vi: {
      'cn': 'Nội Địa Trung (CN)',
      'global': 'Quốc Tế (Global)',
      'eea': 'Châu Âu (EEA)',
      'ru': 'Nga (RU)',
      'in': 'Ấn Độ (IN)',
      'id': 'Indonesia (ID)',
      'tr': 'Thổ Nhĩ Kỳ (TR)',
      'tw': 'Đài Loan (TW)',
      'jp': 'Nhật Bản (JP)',
      'kr': 'Hàn Quốc (KR)'
    },
    en: {
      'cn': 'China (CN)',
      'global': 'Global',
      'eea': 'Europe (EEA)',
      'ru': 'Russia (RU)',
      'in': 'India (IN)',
      'id': 'Indonesia (ID)',
      'tr': 'Turkey (TR)',
      'tw': 'Taiwan (TW)',
      'jp': 'Japan (JP)',
      'kr': 'Korea (KR)'
    }
  };
  function getRegionLabel(code) {
    const lang = getLang();
    const map = REGION_LABELS_BY_LANG[lang] || REGION_LABELS_BY_LANG.vi;
    return map[code] || (code ? String(code).toUpperCase() : 'Official');
  }

  /**
   * Đọc dữ liệu ROM Google Drive đã cache trong phiên duyệt web hiện tại (sessionStorage).
   * Cache tự động bị trình duyệt xóa hoàn toàn khi người dùng đóng tab / thoát web.
   */
  const DRIVE_CACHE_KEY = 'hyperur-active-roms';
  try { localStorage.removeItem(DRIVE_CACHE_KEY); } catch (_) {}

  function getCachedDriveRoms() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(DRIVE_CACHE_KEY) || 'null');
      if (saved && saved._metadata && Object.keys(saved).some(k => k !== '_metadata')) {
        return saved;
      }
    } catch (_) {}
    return null;
  }

  /**
   * Tải danh mục thiết bị và dữ liệu ROM từ Google Drive
   * Dùng cơ chế Stale-While-Revalidate: nếu trình duyệt đã có cache Drive gần nhất,
   * render danh sách máy ngay lập tức (<50ms) rồi đồng bộ nền dữ liệu mới từ Drive.
   */
  async function loadDevices() {
    if (!gridEl) return;

    try {
      // 1. Tải danh mục thiết bị (devices_catalog.json cục bộ — rất nhanh)
      let catalogMap = null;
      try {
        const catRes = await fetch('./json/devices_catalog.json');
        if (catRes.ok) {
          catalogMap = await catRes.json();
        }
      } catch (e) {
        console.warn('Không tải được devices_catalog.json, thử fallback manifest:', e);
      }

      if (!catalogMap) {
        catalogMap = await fallbackLoadManifest();
      }

      // 2. Hiển thị ngay dữ liệu đã lưu trong phiên hiện tại (sessionStorage) để reload không bị kẹt spinner
      const cachedRoms = getCachedDriveRoms();
      state.isSyncing = true;
      state.lastSyncError = null;

      if (cachedRoms) {
        state.activeRomsMap = cachedRoms;
        processDevicesAndRoms(catalogMap, state.activeRomsMap);
      }
      renderDriveSyncBar();

      // 3. Đồng bộ dữ liệu mới nhất từ Google Drive API ở chế độ nền
      const freshRoms = await fetchActiveDriveRoms();
      state.isSyncing = false;
      state.lastSyncAt = new Date();

      if (freshRoms && Object.keys(freshRoms).length > 0) {
        state.activeRomsMap = freshRoms;
        processDevicesAndRoms(catalogMap, state.activeRomsMap);
      } else if (!cachedRoms) {
        state.activeRomsMap = {};
        processDevicesAndRoms(catalogMap, state.activeRomsMap);
      }

      // 4. Cập nhật thanh trạng thái đồng bộ Google Drive
      renderDriveSyncBar();

    } catch (error) {
      console.error('Lỗi khi tải thiết bị HyperUR:', error);
      state.isSyncing = false;
      state.lastSyncAt = new Date();
      state.lastSyncError = error && error.message ? error.message : tr('download.unknownError', 'Lỗi không xác định');
      renderDriveSyncBar();
      // Chỉ hiện khung lỗi nếu chưa có dữ liệu thiết bị nào đang hiển thị
      if (gridEl && state.allCatalogDevices.length === 0) {
        gridEl.innerHTML = `
          <div class="dl-empty-state">
            <div class="dl-empty-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3>${tr('download.loadErrTitle', 'Không thể kết nối danh mục thiết bị')}</h3>
            <p>${tr('download.loadErrDesc', 'Vui lòng kiểm tra kết nối mạng hoặc thử làm mới trang.')}</p>
          </div>
        `;
      }
    }
  }

  /**
   * Lấy danh sách ROM từ Google Apps Script Web App hoặc file active_roms.json
   */
  async function fetchActiveDriveRoms() {
    const apiUrl = config.GOOGLE_DRIVE_API_URL && config.GOOGLE_DRIVE_API_URL.trim() !== ""
      ? config.GOOGLE_DRIVE_API_URL
      : null;

    // Nếu có cấu hình Web App URL từ Google Apps Script
    if (apiUrl) {
      // Cache lạnh trên Apps Script có thể mất 15-30s -> timeout dài hơn và thử lại 1 lần.
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          // Chống browser cache dữ liệu cũ khi deploy hosting
          const reqUrl = apiUrl + (apiUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
          const response = await fetch(reqUrl, {
            signal: controller.signal,
            cache: 'no-store'
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const driveData = await response.json();
            // Tin vào API khi nó trả về đúng định dạng, kể cả khi Drive đang chưa có ROM nào.
            if (driveData && !driveData.error && driveData._metadata && !driveData._metadata.error) {
              const deviceCount = Object.keys(driveData).filter(k => k !== '_metadata').length;
              console.log(`⚡ Đã kết nối Google Drive API thành công: ${deviceCount} máy có ROM`);
              try { sessionStorage.setItem(DRIVE_CACHE_KEY, JSON.stringify(driveData)); } catch (_) {}
              return driveData;
            }
          }
        } catch (err) {
          console.warn(`Google Drive API lỗi (lần ${attempt}):`, err);
        }
      }

      // API không phản hồi: dùng bản gần nhất trong phiên hiện tại (sessionStorage)
      try {
        const saved = JSON.parse(sessionStorage.getItem(DRIVE_CACHE_KEY) || 'null');
        if (saved && saved._metadata) {
          console.warn('Dùng dữ liệu ROM trong phiên hiện tại (API chưa phản hồi).');
          return saved;
        }
      } catch (_) {}
    }

    // Đọc từ file active_roms.json cục bộ
    try {
      const localRes = await fetch('./json/active_roms.json?_t=' + Date.now());
      if (localRes.ok) {
        return await localRes.json();
      }
    } catch (err) {
      console.warn('Chưa tìm thấy active_roms.json:', err);
    }

    return {};
  }

  /**
   * Fallback loader cho cấu trúc cũ nếu chưa có catalog
   */
  async function fallbackLoadManifest() {
    const manifestRes = await fetch('./devices/manifest.json');
    if (!manifestRes.ok) throw new Error('Failed to load manifest');
    const manifest = await manifestRes.json();
    const codenames = manifest.devices || [];

    const loadedMap = {};
    const batchSize = 12;
    for (let i = 0; i < codenames.length; i += batchSize) {
      const batch = codenames.slice(i, i + batchSize);
      await Promise.all(batch.map(async (code) => {
        try {
          const res = await fetch(`./devices/${code}.json`);
          if (res.ok) loadedMap[code] = await res.json();
        } catch (_) { }
      }));
    }
    return loadedMap;
  }

  /**
   * Hợp nhất danh mục thiết bị với dữ liệu ROM Google Drive
   *
   * Quy tắc hiển thị (theo yêu cầu của bạn):
   *  - Codename NÀO CÓ THƯ MỤC trên Google Drive ➔ hiển thị máy đó trên web (kể cả khi folder rỗng).
   *  - Codename chỉ có trong devices_catalog.json mà KHÔNG có folder Drive ➔ KHÔNG hiển thị
   *    (vì mục đích là chỉ phục vụ máy có ROM thật trên Drive của bạn).
   *  - Nếu folder Drive có ROM ➔ đẩy danh sách link tải; nếu rỗng ➔ hiện "Chưa có bản tải".
   */
  function processDevicesAndRoms(catalogMap, activeRoms) {
    state.allCatalogDevices = [];
    state.activeDevicesCount = 0;
    state.totalRomsCount = 0;
    state.driveCodenames = [];

    // Danh sách codename từ Drive (mọi thư mục con cấp 1, kể cả rỗng)
    const driveCodes = Object.keys(activeRoms).filter(k => k !== '_metadata');
    state.driveCodenames = driveCodes.slice();
    state.driveCodenamesCount = driveCodes.length;

    // Chỉ xử lý codename CÓ THƯ MỤC trên Drive (theo yêu cầu của bạn).
    // Codename nào có trong catalog nhưng chưa có folder Drive ➔ bỏ qua.
    const allCodes = driveCodes;

    for (const code of allCodes) {
      const devData = catalogMap[code] || { name: { en: code }, brand: 'Xiaomi', type: 'phone' };

      const driveEntry = activeRoms[code];
      const hasDriveRoms = driveEntry && driveEntry.roms && Object.keys(driveEntry.roms).length > 0;

      // Xây dựng danh sách branches và roms
      let mergedBranches = [];
      let totalAvailableRoms = 0;

      if (hasDriveRoms) {
        // Gom ROM theo vùng (thư mục con CN / Global / EEA... trong folder codename)
        const byRegion = {};
        for (const [rawKey, r] of Object.entries(driveEntry.roms)) {
          const majorKey = r.osKey || (r.os && r.os.match(/^OS\d+\.\d+/) ? r.os.match(/^OS\d+\.\d+/)[0] : rawKey.match(/^OS\d+\.\d+/) ? rawKey.match(/^OS\d+\.\d+/)[0] : rawKey);
          const region = r.region || 'cn';
          if (!byRegion[region]) byRegion[region] = [];
          byRegion[region].push({
            key: majorKey,
            os: r.os || rawKey,
            android: r.android || (majorKey === 'OS2.0' ? '15.0' : (majorKey === 'OS1.0' ? '14.0' : '16.0')),
            download: r.download || '',
            fileName: r.fileName || '',
            size: r.size || '',
            date: r.date || '',
            hasDownload: !!r.download,
            isGoogleDrive: true
          });
          if (r.download) totalAvailableRoms++;
        }

        Object.keys(byRegion).sort().forEach(region => {
          mergedBranches.push({
            branchName: 'Google Drive Official Release',
            region: region,
            isGoogleDrive: true,
            osVersions: byRegion[region].sort(sortOsVersions)
          });
        });

        state.activeDevicesCount++;
        state.totalRomsCount += totalAvailableRoms;
      }

      // Giữ lại các branches tĩnh phụ nếu có
      if (devData.branches && Array.isArray(devData.branches)) {
        devData.branches.forEach(b => {
          if (b.roms && Object.keys(b.roms).length > 0) {
            const staticOsList = [];
            for (const [osKey, r] of Object.entries(b.roms)) {
              // Tránh trùng lặp nếu Google Drive đã có phiên bản này
              const alreadyHas = mergedBranches.some(mb => mb.osVersions.some(ov => ov.key === osKey));
              if (!alreadyHas && r.download) {
                staticOsList.push({
                  key: osKey,
                  os: r.os || osKey,
                  android: r.android || '',
                  download: r.download || '',
                  hasDownload: !!r.download,
                  isGoogleDrive: false
                });
                totalAvailableRoms++;
              }
            }
            if (staticOsList.length > 0) {
              mergedBranches.push({
                branchName: b.name?.en || b.branchCode || 'HyperOS Stable',
                region: b.region || 'cn',
                osVersions: staticOsList.sort(sortOsVersions)
              });
            }
          }
        });
      }

      const brand = devData.brand || 'Xiaomi';
      const devItem = {
        code: code,
        name: devData.name || { en: code },
        brand: brand,
        type: devData.type || 'phone',
        supports: devData.supports || ['OS1.0', 'OS2.0'],
        branches: mergedBranches,
        hasDriveRoms: hasDriveRoms,
        // Codename có folder trên Drive (kể cả rỗng) ➔ true
        hasDriveFolder: true,
        // Link mở folder Google Drive (dùng khi click thẻ rỗng)
        folderId: driveEntry ? (driveEntry.folderId || '') : '',
        folderUrl: driveEntry ? (driveEntry.folderUrl || '') : '',
        availableRomsCount: totalAvailableRoms
      };

      state.cache[code] = devItem;
      state.allCatalogDevices.push(devItem);
    }

    updateHeroDesc();
    applyFiltering();
  }

  /**
   * Sắp xếp các phiên bản OS theo thứ tự mới nhất (OS3.0 -> OS2.0 -> OS1.0)
   */
  function sortOsVersions(a, b) {
    const aMatch = (a.key || '').match(/^OS(\d+)\.(\d+)/);
    const bMatch = (b.key || '').match(/^OS(\d+)\.(\d+)/);
    if (!aMatch || !bMatch) return 0;
    const aMajor = parseInt(aMatch[1]);
    const bMajor = parseInt(bMatch[1]);
    if (aMajor !== bMajor) return bMajor - aMajor;
    const minorDiff = parseInt(bMatch[2]) - parseInt(aMatch[2]);
    if (minorDiff !== 0) return minorDiff;
    return (b.os || '').localeCompare(a.os || '', undefined, { numeric: true });
  }

  /**
   * Lọc thiết bị theo chế độ:
   * - Chỉ máy có folder trên Google Drive (state.onlyActiveRoms === true) ➔ mặc định
   *   Hiện TẤT CẢ codename có folder Drive, kể cả khi folder rỗng (chưa có ROM).
   * - Hoặc tất cả thiết bị
   */
  function applyFiltering() {
    state.byBrand = {
      all: [],
      xiaomi: [],
      redmi: []
    };

    // Chọn nguồn danh sách thiết bị
    // - onlyActiveRoms = true (mặc định): hiện tất cả codename có folder trên Drive
    //   (kể cả folder rỗng - sẽ hiện thẻ "Chưa có bản tải").
    // - onlyActiveRoms = false: hiện tất cả thiết bị trong catalog (kể cả máy chưa có folder Drive).
    const sourceList = state.onlyActiveRoms
      ? state.allCatalogDevices.filter(d => d.hasDriveFolder)
      : state.allCatalogDevices;

    sourceList.forEach(dev => {
      state.byBrand.all.push(dev);

      const brandKey = (dev.brand || '').toLowerCase();
      if (brandKey.includes('redmi')) {
        state.byBrand.redmi.push(dev);
      } else {
        state.byBrand.xiaomi.push(dev);
      }
    });

    // Sắp xếp bảng chữ cái A-Z
    Object.values(state.byBrand).forEach(list => {
      list.sort((a, b) => {
        const nameA = (a.name.vi || a.name.en || a.code).toLowerCase();
        const nameB = (b.name.vi || b.name.en || b.code).toLowerCase();
        return nameA.localeCompare(nameB);
      });
    });

    state.devices = state.byBrand.all;

    updateCounters();
    renderQuickChips();
    renderGrid();
  }

  /**
   * Hiển thị các chip gợi ý tìm kiếm nhanh codename ngay dưới thanh Spotlight
   */
  function renderQuickChips() {
    if (!quickChipsEl) return;

    const preferred = ['nezha', 'xuanyuan', 'dada', 'aurora', 'houji', 'miro', 'vermeer', 'garnet', 'manet', 'peridot'];
    const availableCodes = new Set(state.byBrand.all.map(d => d.code));
    const chips = [];

    preferred.forEach(c => {
      if (availableCodes.has(c) && chips.length < 5) chips.push(c);
    });
    for (const dev of state.byBrand.all) {
      if (chips.length >= 5) break;
      if (!chips.includes(dev.code)) chips.push(dev.code);
    }

    if (chips.length === 0) {
      quickChipsEl.innerHTML = '';
      return;
    }

    const activeQ = state.searchQuery.trim().toLowerCase();
    quickChipsEl.innerHTML = `
      <span class="dl-quick-label">${tr('download.quickSearch', 'Tìm nhanh:')}</span>
      ${chips.map(code => `
        <button type="button" class="dl-quick-chip ${activeQ === code.toLowerCase() ? 'active' : ''}" data-quick-code="${code}">${code}</button>
      `).join('')}
      ${activeQ ? `<button type="button" class="dl-quick-chip dl-quick-reset" data-quick-code="">${tr('download.resetSearch', 'Đặt lại')}</button>` : ''}
    `;
  }

  /**
   * Hiển thị thanh thông tin đồng bộ Google Drive tích hợp gọn trong toolbar
   */
  function renderDriveSyncBar() {
    if (!syncContainer) return;

    const folderCount = state.driveCodenamesCount || 0;
    const romCount = state.totalRomsCount;
    const isFiltered = state.onlyActiveRoms;

    let timeShort = '';
    if (state.lastSyncAt instanceof Date && !isNaN(state.lastSyncAt)) {
      const hh = String(state.lastSyncAt.getHours()).padStart(2, '0');
      const mm = String(state.lastSyncAt.getMinutes()).padStart(2, '0');
      timeShort = `${hh}:${mm}`;
    }

    const syncTooltip = state.isSyncing
      ? tr('download.syncing', 'Đang đồng bộ...')
      : (state.lastSyncError
        ? tr('download.syncTooltipErr', 'Lần đồng bộ gần nhất gặp lỗi: {error}', { error: state.lastSyncError })
        : tr('download.syncTooltipOk', 'Thời điểm đồng bộ Google Drive gần nhất') + (timeShort ? ` (${timeShort})` : ''));

    const dotClass = state.isSyncing ? 'is-syncing' : (state.lastSyncError ? 'is-error' : '');
    const statusRight = state.isSyncing
      ? `<span class="dl-sync-time">· ${tr('download.syncing', 'Đang đồng bộ...')}</span>`
      : (timeShort ? `<span class="dl-sync-time">· ${timeShort}</span>` : '');

    syncContainer.innerHTML = `
      <div class="dl-sync-meta" title="${syncTooltip}">
        <span class="dl-sync-dot ${dotClass}" aria-hidden="true"></span>
        <span>${tr('download.driveSyncShort', 'Drive: {folders} máy · {roms} bản', { folders: folderCount, roms: romCount })}</span>
        ${statusRight}
      </div>
      ${config.ENABLE_VIEW_TOGGLE !== false && state.allCatalogDevices.length > 0 ? `
        <button type="button" class="dl-view-toggle ${isFiltered ? 'active' : ''}" id="toggle-active-view-btn">
          ${isFiltered
            ? tr('download.viewActiveShort', 'Có folder ({count})', { count: folderCount })
            : tr('download.viewAllShort', 'Tất cả ({count})', { count: state.allCatalogDevices.length })}
        </button>
      ` : ''}
    `;

    const toggleBtn = document.getElementById('toggle-active-view-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        state.onlyActiveRoms = !state.onlyActiveRoms;
        applyFiltering();
        renderDriveSyncBar();
      });
    }
  }

  /**
   * Cập nhật số lượng thiết bị trên các thẻ phân loại hãng
   */
  function updateCounters() {
    const elAll = document.getElementById('count-all');
    const elXiaomi = document.getElementById('count-xiaomi');
    const elRedmi = document.getElementById('count-redmi');

    if (elAll) elAll.textContent = state.byBrand.all.length;
    if (elXiaomi) elXiaomi.textContent = state.byBrand.xiaomi.length;
    if (elRedmi) elRedmi.textContent = state.byBrand.redmi.length;
  }

  /**
   * Render danh sách thẻ thiết bị vào grid
   */
  function renderGrid() {
    if (!gridEl) return;

    const currentList = state.byBrand[state.activeBrand] || state.byBrand.all;
    const q = state.searchQuery.toLowerCase().trim();

    const filtered = currentList.filter(d => {
      if (!q) return true;
      const nameEn = (d.name.en || '').toLowerCase();
      const nameVi = (d.name.vi || '').toLowerCase();
      const code = d.code.toLowerCase();
      const brand = (d.brand || '').toLowerCase();
      return nameEn.includes(q) || nameVi.includes(q) || code.includes(q) || brand.includes(q);
    });

    if (filtered.length === 0) {
      const isOnlyActive = state.onlyActiveRoms;
      gridEl.innerHTML = `
        <div class="dl-empty-state">
          <div class="dl-empty-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <h3>${tr('download.noResultsTitle', 'Không tìm thấy thiết bị phù hợp')}</h3>
          <p>
            ${isOnlyActive
          ? tr('download.noResultsActive', 'Hiện tại hệ thống chỉ hiển thị các dòng máy đã có file ROM trên Google Drive. Bạn có thể bấm nút "Chế độ xem" phía trên để xem toàn bộ {count} dòng máy.', { count: state.allCatalogDevices.length })
          : tr('download.noResultsAll', 'Vui lòng thử tìm với từ khóa tên máy khác (ví dụ: K70, 14, F5) hoặc mã máy (houji, garnet).')}
          </p>
        </div>
      `;
      return;
    }

    const lang = getLang();
    const openDriveLabel = tr('download.openDriveShort', 'Mở Drive');
    const detailsLabel = tr('download.detailsBtn', 'Chi tiết');

    gridEl.innerHTML = filtered.map(dev => {
      const devName = (dev.name && (dev.name[lang] || dev.name.en || dev.name.vi)) || dev.code;
      const altName = dev.brand || 'Xiaomi';
      const availableCount = dev.availableRomsCount;
      const hasBuilds = availableCount > 0;
      const statusText = hasBuilds
        ? tr('download.readyBuilds', '{count} bản sẵn sàng', { count: availableCount })
        : tr('download.emptyFolderShort', 'Folder trống');

      return `
        <article class="dl-card">
          <div class="dl-card-main">
            <div class="dl-card-thumb">
              <img
                src="images/${dev.code}.png"
                alt="${devName}"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                loading="lazy"
              />
              <div class="dl-card-thumb-fallback" style="display: none;" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="6" y="2" width="12" height="20" rx="2.5" ry="2.5"></rect>
                  <line x1="12" y1="18" x2="12.01" y2="18"></line>
                </svg>
              </div>
            </div>

            <div class="dl-card-info">
              <h3 class="dl-card-title">${devName}</h3>
              <div class="dl-card-meta">
                <span class="dl-card-code">${dev.code}</span>
                <span class="dl-meta-sep" aria-hidden="true">·</span>
                <span class="dl-card-brand">${altName}</span>
              </div>
              <div class="dl-card-status ${hasBuilds ? 'is-ready' : 'is-empty'}">
                <span class="dl-status-dot" aria-hidden="true"></span>
                <span>${statusText}</span>
              </div>
            </div>
          </div>

          <div class="dl-card-actions">
            <a
              class="dl-btn-primary device-download-btn ${hasBuilds ? '' : 'is-muted'}"
              href="${dev.folderUrl || '#'}"
              target="_blank"
              rel="noopener noreferrer"
              data-code="${dev.code}"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>${openDriveLabel}</span>
            </a>
            <button type="button" class="dl-btn-secondary js-open-details" data-code="${dev.code}">
              ${detailsLabel}
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  /**
   * Mở modal tải ROM
   */
  function openRomModal(code) {
    const dev = state.cache[code];
    if (!dev || !romDialog) return;

    state.openModalCode = code;
    const lang = getLang();
    const devName = (dev.name && (dev.name[lang] || dev.name.en || dev.name.vi)) || dev.code;
    dialogName.textContent = devName;
    dialogCode.textContent = dev.code;

    const branches = dev.branches || [];
    const driveUrl = dev.folderUrl || ('https://drive.google.com/drive/folders/' + (dev.folderId || ''));

    if (branches.length === 0 || dev.availableRomsCount === 0) {
      dialogContent.innerHTML = `
        <div class="dl-modal-empty">
          <div class="dl-empty-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div class="dl-modal-empty-title">${tr('download.emptyFolderTitle', 'Folder Google Drive đang trống')}</div>
          <p class="dl-modal-empty-desc">
            ${tr('download.emptyFolderDesc', 'Thư mục <code>{code}</code> trên Google Drive chưa có file ROM nào. Khi bạn upload ROM lên, danh sách tải sẽ tự động xuất hiện.', { code: dev.code })}
          </p>
          <a href="${driveUrl}" target="_blank" rel="noopener noreferrer" class="dl-btn-primary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>${tr('download.openGDriveFolder', 'Mở Folder Google Drive')}</span>
          </a>
        </div>
      `;
    } else {
      dialogContent.innerHTML = branches.map(branch => {
        const regionLabel = getRegionLabel(branch.region);

        const osCards = branch.osVersions.map(os => {
          if (!os.hasDownload) {
            return `
              <div class="dl-build-item is-coming">
                <div class="dl-build-top">
                  <div class="dl-build-tags">
                    <span class="dl-tag">${os.key}</span>
                    ${os.android ? `<span class="dl-tag">Android ${os.android}</span>` : ''}
                  </div>
                  <span class="dl-tag is-amber">${tr('download.comingSoon', '⏳ Sắp ra mắt')}</span>
                </div>
                <div class="dl-build-ver">${os.os}</div>
              </div>
            `;
          }

          return `
            <div class="dl-build-item">
              <div class="dl-build-top">
                <div class="dl-build-tags">
                  <span class="dl-tag is-ready">${os.key}</span>
                  ${os.android ? `<span class="dl-tag">Android ${os.android}</span>` : ''}
                </div>
                ${os.size ? `<span class="dl-build-size">${os.size}</span>` : ''}
              </div>
              <div class="dl-build-ver">${os.os}</div>
              <div class="dl-build-foot">
                <span class="dl-build-date">${os.date || 'Google Drive'}</span>
                <div class="dl-build-actions">
                  <button
                    type="button"
                    class="dl-btn-secondary dl-btn-sm copy-link-btn"
                    data-url="${os.download}"
                    title="${tr('download.copyLinkTitle', 'Sao chép link tải Google Drive')}"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <span>${tr('download.copyShort', 'Chép link')}</span>
                  </button>
                  <a
                    href="${driveUrl}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="dl-btn-primary dl-btn-sm"
                    title="${tr('download.openFolderTitle', 'Mở folder Google Drive chứa ROM')}"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>${tr('download.openDriveShort', 'Mở Drive')}</span>
                  </a>
                </div>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="dl-branch-group">
            <div class="dl-branch-header">
              <span class="dl-branch-name">${branch.branchName}</span>
              <span class="dl-branch-region">${regionLabel}</span>
            </div>
            <div class="dl-build-list">
              ${osCards}
            </div>
          </div>
        `;
      }).join('');
    }

    if (!romDialog.open) {
      if (typeof romDialog.showModal === 'function') {
        romDialog.showModal();
      } else {
        romDialog.setAttribute('open', '');
      }
    }
  }

  /**
   * Đóng modal tải ROM
   */
  function closeRomModal() {
    state.openModalCode = null;
    if (!romDialog) return;
    if (typeof romDialog.close === 'function') {
      romDialog.close();
    } else {
      romDialog.removeAttribute('open');
    }
  }

  // Event Listeners trong grid: Mở Chi tiết modal hoặc fallback Mở Drive
  if (gridEl) {
    gridEl.addEventListener('click', (e) => {
      const detailBtn = e.target.closest('.js-open-details[data-code]');
      if (detailBtn) {
        const code = detailBtn.getAttribute('data-code');
        if (code) openRomModal(code);
        return;
      }
      const btn = e.target.closest('.device-download-btn[data-code]');
      if (!btn) return;
      const href = btn.getAttribute('href');
      if (href && href !== '#') return;
      e.preventDefault();
      const code = btn.getAttribute('data-code');
      if (code) openRomModal(code);
    });
  }

  // Sao chép link trong dialog (dùng toast thay vì alert chặn UI)
  if (dialogContent) {
    dialogContent.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.copy-link-btn[data-url]');
      if (copyBtn) {
        const url = copyBtn.getAttribute('data-url');
        navigator.clipboard.writeText(url).then(() => {
          showToast(tr('download.copiedAlert', 'Đã sao chép link tải Google Drive vào bộ nhớ tạm!'));
        }).catch(() => {
          prompt(tr('download.copyPrompt', 'Link tải ROM Google Drive:'), url);
        });
      }
    });
  }

  if (dialogCloseBtn) {
    dialogCloseBtn.addEventListener('click', closeRomModal);
  }

  if (romDialog) {
    romDialog.addEventListener('close', () => {
      state.openModalCode = null;
    });
    romDialog.addEventListener('click', (e) => {
      const rect = romDialog.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        closeRomModal();
      }
    });
  }

  function updateSearchControls() {
    const hasQuery = !!state.searchQuery;
    if (searchClearBtn) searchClearBtn.style.display = hasQuery ? 'flex' : 'none';
    if (searchKbd) searchKbd.style.display = hasQuery ? 'none' : '';
  }

  // Ô tìm kiếm
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      updateSearchControls();
      renderQuickChips();
      renderGrid();
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      state.searchQuery = '';
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      updateSearchControls();
      renderQuickChips();
      renderGrid();
    });
  }

  // Click nhanh chip codename
  if (quickChipsEl) {
    quickChipsEl.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-quick-code]');
      if (!chip) return;
      state.searchQuery = chip.getAttribute('data-quick-code') || '';
      if (searchInput) searchInput.value = state.searchQuery;
      updateSearchControls();
      renderQuickChips();
      renderGrid();
    });
  }

  // Phím tắt "/" để focus nhanh ô tìm kiếm
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && searchInput && document.activeElement !== searchInput) {
      const tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !(romDialog && romDialog.open)) {
        e.preventDefault();
        searchInput.focus();
      }
    }
  });

  // Phân loại hãng
  if (brandTabs) {
    brandTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-brand]');
      if (tab) {
        brandTabs.querySelectorAll('[data-brand]').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        state.activeBrand = tab.getAttribute('data-brand') || 'all';
        renderGrid();
      }
    });
  }

  // Dark/Light Theme toggle
  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) {
    const savedTheme = localStorage.getItem('hyperur-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('hyperur-theme', next);
      updateThemeIcon(next);
    });
  }

  function updateThemeIcon(theme) {
    const iconMoon = document.querySelector('.icon-moon');
    const iconSun = document.querySelector('.icon-sun');
    if (iconMoon && iconSun) {
      if (theme === 'light') {
        iconMoon.style.display = 'none';
        iconSun.style.display = 'block';
      } else {
        iconMoon.style.display = 'block';
        iconSun.style.display = 'none';
      }
    }
  }

  // Tự động đồng bộ lại Google Drive theo chu kỳ CACHE_DURATION_MINUTES (phút).
  // Dùng setTimeout tự nối tiếp để tránh chồng request khi Drive phản hồi chậm.
  let autoSyncTimer = null;

  function scheduleNextSync() {
    if (autoSyncTimer) clearTimeout(autoSyncTimer);
    const minutes = Math.max(1, Number(config.CACHE_DURATION_MINUTES) || 15);
    autoSyncTimer = setTimeout(async () => {
      try {
        console.log(`⏰ Auto-sync Google Drive (mỗi ${minutes} phút) đang chạy...`);
        await loadDevices();
      } catch (e) {
        console.warn('Auto-sync lỗi, sẽ thử lại sau', minutes, 'phút:', e);
      } finally {
        scheduleNextSync();
      }
    }, minutes * 60 * 1000);
  }

  // Tự động cập nhật UI khi người dùng chuyển đổi ngôn ngữ VI / EN
  window.addEventListener('hyperur:langchange', () => {
    updateHeroDesc();
    if (syncContainer && state.lastSyncAt) {
      renderDriveSyncBar();
    }
    if (quickChipsEl && state.allCatalogDevices.length > 0) {
      renderQuickChips();
    }
    if (gridEl && state.allCatalogDevices.length > 0) {
      renderGrid();
    }
    if (state.openModalCode && romDialog && romDialog.open) {
      openRomModal(state.openModalCode);
    }
  });

  // Khởi động lần đầu, sau đó bật lịch tự đồng bộ.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await loadDevices();
      scheduleNextSync();
    });
  } else {
    loadDevices().then(scheduleNextSync);
  }
})();
