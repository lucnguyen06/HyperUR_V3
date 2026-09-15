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
    isSyncing: false
  };

  // DOM Elements
  const gridEl = document.getElementById('devices-grid');
  const syncContainer = document.getElementById('drive-sync-container');
  const searchInput = document.getElementById('device-search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const brandTabs = document.getElementById('brand-tabs');
  const romDialog = document.getElementById('rom-dialog');
  const dialogName = document.getElementById('dialog-device-name');
  const dialogCode = document.getElementById('dialog-device-code');
  const dialogContent = document.getElementById('dialog-rom-content');
  const dialogCloseBtn = document.getElementById('dialog-close-btn');

  // Region display labels
  const REGION_LABELS = {
    'cn': 'Nội Địa Trung (CN)',
    'global': 'Quốc Tế (Global)',
    'eea': 'Châu Âu (EEA)',
    'ru': 'Nga (RU)',
    'in': 'Ấn Độ (IN)',
    'id': 'Indonesia (ID)',
    'tr': 'Thổ Nhĩ Kỳ (TR)',
    'tw': 'Đài Loan (TW)'
  };

  /**
   * Tải danh mục thiết bị và dữ liệu ROM từ Google Drive
   */
  async function loadDevices() {
    if (!gridEl) return;

    try {
      // 1. Tải danh mục thiết bị (devices_catalog.json tập trung)
      let catalogMap = null;
      try {
        const catRes = await fetch('./devices_catalog.json');
        if (catRes.ok) {
          catalogMap = await catRes.json();
        }
      } catch (e) {
        console.warn('Không tải được devices_catalog.json, thử fallback manifest:', e);
      }

      // Fallback nếu chưa có catalog: Tải từ manifest.json truyền thống
      if (!catalogMap) {
        catalogMap = await fallbackLoadManifest();
      }

      // 2. Tải danh sách ROM động từ Google Drive API hoặc active_roms.json
      const activeRoms = await fetchActiveDriveRoms();
      state.activeRomsMap = activeRoms || {};

      // 3. Hợp nhất dữ liệu danh mục máy với link tải Google Drive
      processDevicesAndRoms(catalogMap, state.activeRomsMap);

      // 4. Render thanh trạng thái đồng bộ Google Drive
      renderDriveSyncBar();

    } catch (error) {
      console.error('Lỗi khi tải thiết bị HyperUR:', error);
      if (gridEl) {
        gridEl.innerHTML = `
          <div class="no-results-box" style="grid-column: 1 / -1;">
            <span class="no-results-icon">⚠️</span>
            <h3 style="color: var(--text-strong); margin-bottom: 0.5rem;">Không thể kết nối danh mục thiết bị</h3>
            <p style="color: var(--muted); font-size: 0.95rem;">
              Vui lòng kiểm tra kết nối mạng hoặc thử làm mới trang.
            </p>
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
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

        const response = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          const driveData = await response.json();
          if (driveData && !driveData.error) {
            console.log('⚡ Đã kết nối Google Drive API thành công:', driveData);
            return driveData;
          }
        }
      } catch (err) {
        console.warn('Không thể kết nối trực tiếp Google Drive API URL, chuyển sang đọc active_roms.json:', err);
      }
    }

    // Đọc từ file active_roms.json cục bộ
    try {
      const localRes = await fetch('./active_roms.json');
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
        } catch (_) {}
      }));
    }
    return loadedMap;
  }

  /**
   * Hợp nhất danh mục thiết bị với dữ liệu ROM Google Drive
   */
  function processDevicesAndRoms(catalogMap, activeRoms) {
    state.allCatalogDevices = [];
    state.activeDevicesCount = 0;
    state.totalRomsCount = 0;

    for (const [code, devData] of Object.entries(catalogMap)) {
      if (!devData) continue;

      const driveEntry = activeRoms[code];
      const hasDriveRoms = driveEntry && driveEntry.roms && Object.keys(driveEntry.roms).length > 0;

      // Xây dựng danh sách branches và roms
      let mergedBranches = [];
      let totalAvailableRoms = 0;

      if (hasDriveRoms) {
        // Tạo branch đại diện cho bản build Google Drive chính thức
        const osVersions = [];
        for (const [osKey, r] of Object.entries(driveEntry.roms)) {
          osVersions.push({
            key: osKey,
            os: r.os || osKey,
            android: r.android || (osKey === 'OS2.0' ? '15.0' : '14.0'),
            download: r.download || '',
            fileName: r.fileName || '',
            size: r.size || '',
            date: r.date || '',
            hasDownload: !!r.download,
            isGoogleDrive: true
          });
          if (r.download) totalAvailableRoms++;
        }

        mergedBranches.push({
          branchName: 'Google Drive Official Release',
          region: 'cn',
          isGoogleDrive: true,
          osVersions: osVersions.sort(sortOsVersions)
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
        availableRomsCount: totalAvailableRoms
      };

      state.cache[code] = devItem;
      state.allCatalogDevices.push(devItem);
    }

    applyFiltering();
  }

  /**
   * Sắp xếp các phiên bản OS theo thứ tự mới nhất (OS3.0 -> OS2.0 -> OS1.0)
   */
  function sortOsVersions(a, b) {
    const aMatch = a.key.match(/^OS(\d+)\.(\d+)/);
    const bMatch = b.key.match(/^OS(\d+)\.(\d+)/);
    if (!aMatch || !bMatch) return 0;
    const aMajor = parseInt(aMatch[1]);
    const bMajor = parseInt(bMatch[1]);
    if (aMajor !== bMajor) return bMajor - aMajor;
    return parseInt(bMatch[2]) - parseInt(aMatch[2]);
  }

  /**
   * Lọc thiết bị theo chế độ:
   * - Chỉ máy có ROM trên Drive (state.onlyActiveRoms === true)
   * - Hoặc tất cả thiết bị
   */
  function applyFiltering() {
    state.byBrand = {
      all: [],
      xiaomi: [],
      redmi: []
    };

    // Chọn nguồn danh sách thiết bị
    const sourceList = state.onlyActiveRoms
      ? state.allCatalogDevices.filter(d => d.availableRomsCount > 0)
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
    renderGrid();
  }

  /**
   * Hiển thị thanh thông tin đồng bộ Google Drive
   */
  function renderDriveSyncBar() {
    if (!syncContainer) return;

    const activeCount = state.activeDevicesCount;
    const romCount = state.totalRomsCount;
    const isFiltered = state.onlyActiveRoms;

    syncContainer.innerHTML = `
      <div class="drive-sync-bar">
        <div class="drive-sync-info">
          <span class="drive-sync-dot"></span>
          <span>
            Đồng bộ Google Drive: 
            <strong class="drive-sync-highlight">${activeCount} thiết bị</strong> đang có ROM sẵn sàng (${romCount} bản tải)
          </span>
        </div>
        ${config.ENABLE_VIEW_TOGGLE !== false ? `
          <div class="drive-toggle-wrapper">
            <button class="drive-toggle-btn ${isFiltered ? 'active' : ''}" id="toggle-active-view-btn">
              <span>${isFiltered ? '✓ Chế độ: Chỉ hiện máy có ROM trên Drive' : 'Chế độ: Đang xem tất cả 121 máy'}</span>
            </button>
          </div>
        ` : ''}
      </div>
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
        <div class="no-results-box">
          <span class="no-results-icon">🔍</span>
          <h3 style="color: var(--text-strong); margin-bottom: 0.5rem;">Không tìm thấy thiết bị phù hợp</h3>
          <p style="color: var(--muted); font-size: 0.95rem; max-width: 500px; margin: 0 auto;">
            ${isOnlyActive 
              ? 'Hiện tại hệ thống chỉ hiển thị các dòng máy đã có file ROM trên Google Drive. Bạn có thể bấm nút "Chế độ xem" phía trên để xem toàn bộ 121 dòng máy.' 
              : 'Vui lòng thử tìm với từ khóa tên máy khác (ví dụ: K70, 14, F5) hoặc mã máy (houji, garnet).'}
          </p>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = filtered.map(dev => {
      const devName = dev.name.vi || dev.name.en || dev.code;
      const altName = dev.brand || 'Xiaomi';
      const availableCount = dev.availableRomsCount;
      const supportedOsList = Array.isArray(dev.supports) && dev.supports.length > 0 ? dev.supports : ['OS1.0', 'OS2.0'];

      return `
        <div class="device-card">
          <div class="device-card-header">
            <span class="device-code-badge">${dev.code}</span>
            <span class="device-type-badge">${dev.type || 'Phone'}</span>
          </div>

          <div class="device-image-container">
            <img 
              src="images/${dev.code}.png" 
              alt="${devName}"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
              loading="lazy"
            />
            <div class="device-image-placeholder" style="display: none;">📱</div>
          </div>

          <div class="device-details">
            <h3 class="device-title">${devName}</h3>
            <div class="device-subtitle">
              ${altName}
              ${dev.hasDriveRoms ? '<span class="rom-badge-gdrive">⚡ Google Drive</span>' : ''}
            </div>

            <div class="device-os-chips">
              ${supportedOsList.slice(0, 3).map(osKey => {
                const isAvail = dev.branches.some(b => b.osVersions.some(o => o.key === osKey && o.hasDownload));
                return `
                  <span class="os-chip ${isAvail ? 'available' : 'coming'}">
                    ${osKey}
                  </span>
                `;
              }).join('')}
            </div>

            <div class="device-action-wrapper">
              ${availableCount > 0 ? `
                <button class="device-download-btn" data-code="${dev.code}">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>Xem Bản Tải</span>
                  <span class="download-count">${availableCount} bản</span>
                </button>
              ` : `
                <span class="device-no-rom">Chưa có bản tải</span>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Mở modal tải ROM
   */
  function openRomModal(code) {
    const dev = state.cache[code];
    if (!dev || !romDialog) return;

    const devName = dev.name.vi || dev.name.en || dev.code;
    dialogName.textContent = devName;
    dialogCode.textContent = dev.code;

    const branches = dev.branches || [];

    if (branches.length === 0 || dev.availableRomsCount === 0) {
      dialogContent.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--muted); font-style: italic;">
          Chưa có bản ROM cập nhật cho thiết bị này trên Google Drive.
        </div>
      `;
    } else {
      dialogContent.innerHTML = branches.map(branch => {
        const regionLabel = REGION_LABELS[branch.region] || branch.region?.toUpperCase() || 'Official';

        const osCards = branch.osVersions.map(os => {
          if (!os.hasDownload) {
            return `
              <div class="popup-os-card coming">
                <div class="popup-os-meta">
                  <div class="popup-os-title">
                    <span>${os.key}</span>
                    ${os.android ? `<span class="popup-android-badge">Android ${os.android}</span>` : ''}
                  </div>
                  <div class="popup-os-version-text">${os.os}</div>
                </div>
                <span class="popup-coming-tag">⏳ Sắp ra mắt</span>
              </div>
            `;
          }

          return `
            <div class="popup-os-card">
              <div class="popup-os-meta">
                <div class="popup-os-title">
                  <span>${os.key}</span>
                  ${os.android ? `<span class="popup-android-badge">Android ${os.android}</span>` : ''}
                  ${os.isGoogleDrive ? `<span class="rom-badge-gdrive">⚡ Google Drive</span>` : ''}
                </div>
                <div class="popup-os-version-text">${os.os}</div>
                ${os.size || os.date ? `
                  <div class="popup-file-meta">
                    ${os.size ? `<span>📦 ${os.size}</span>` : ''}
                    ${os.date ? `<span>📅 ${os.date}</span>` : ''}
                  </div>
                ` : ''}
              </div>
              <div class="popup-os-actions">
                <button 
                  class="btn-icon copy-link-btn" 
                  style="width: 34px; height: 34px; border-radius: 8px;"
                  data-url="${os.download}"
                  title="Sao chép link tải Google Drive"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
                <a 
                  href="${os.download}" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="popup-download-link"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>Tải Về</span>
                </a>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="popup-branch">
            <div class="popup-branch-header">
              <span class="popup-branch-name">${branch.branchName}</span>
              <span class="popup-branch-region">${regionLabel}</span>
            </div>
            <div class="popup-os-list">
              ${osCards}
            </div>
          </div>
        `;
      }).join('');
    }

    if (typeof romDialog.showModal === 'function') {
      romDialog.showModal();
    } else {
      romDialog.setAttribute('open', '');
    }
  }

  /**
   * Đóng modal tải ROM
   */
  function closeRomModal() {
    if (!romDialog) return;
    if (typeof romDialog.close === 'function') {
      romDialog.close();
    } else {
      romDialog.removeAttribute('open');
    }
  }

  // Event Listeners cho nút tải
  if (gridEl) {
    gridEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.device-download-btn[data-code]');
      if (btn) {
        e.preventDefault();
        const code = btn.getAttribute('data-code');
        openRomModal(code);
      }
    });
  }

  // Sao chép link trong dialog
  if (dialogContent) {
    dialogContent.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.copy-link-btn[data-url]');
      if (copyBtn) {
        const url = copyBtn.getAttribute('data-url');
        navigator.clipboard.writeText(url).then(() => {
          alert('Đã sao chép link tải Google Drive vào bộ nhớ tạm!');
        }).catch(() => {
          prompt('Link tải ROM Google Drive:', url);
        });
      }
    });
  }

  if (dialogCloseBtn) {
    dialogCloseBtn.addEventListener('click', closeRomModal);
  }

  if (romDialog) {
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

  // Ô tìm kiếm
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (searchClearBtn) {
        searchClearBtn.style.display = state.searchQuery ? 'flex' : 'none';
      }
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
      searchClearBtn.style.display = 'none';
      renderGrid();
    });
  }

  // Phân loại hãng
  if (brandTabs) {
    brandTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.brand-tab[data-brand]');
      if (tab) {
        brandTabs.querySelectorAll('.brand-tab').forEach(b => b.classList.remove('active'));
        tab.classList.add('active');
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

  // Khởi động
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDevices);
  } else {
    loadDevices();
  }
})();
