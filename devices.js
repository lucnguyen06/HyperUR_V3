/**
 * HyperUR - Devices Module (Dedicated Dynamic Component)
 * Responsible ONLY for loading 121 devices, search, brand filtering, and ROM download modal.
 */

(function () {
  'use strict';

  // State for devices only
  const state = {
    devices: [],
    byBrand: {
      all: [],
      xiaomi: [],
      redmi: []
    },
    activeBrand: 'all',
    searchQuery: '',
    cache: {}
  };

  // DOM Elements
  const gridEl = document.getElementById('devices-grid');
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
   * Fetch device manifest and all device JSON data
   */
  async function loadDevices() {
    if (!gridEl) return;
    try {
      const manifestRes = await fetch('./devices/manifest.json');
      if (!manifestRes.ok) throw new Error('Failed to load manifest');
      const manifest = await manifestRes.json();
      const codenames = manifest.devices || [];

      // Batch load device details
      const batchSize = 12;
      const loadedMap = {};

      for (let i = 0; i < codenames.length; i += batchSize) {
        const batch = codenames.slice(i, i + batchSize);
        const batchPromises = batch.map(async (code) => {
          try {
            const res = await fetch(`./devices/${code}.json`);
            if (res.ok) {
              const data = await res.json();
              loadedMap[code] = data;
            }
          } catch (err) {
            console.warn(`Could not load device ${code}:`, err);
          }
        });
        await Promise.all(batchPromises);
      }

      processDevices(loadedMap);
    } catch (error) {
      console.error('Error loading devices:', error);
      if (gridEl) {
        gridEl.innerHTML = `
          <div class="no-results-box" style="grid-column: 1 / -1;">
            <p style="color: var(--accent-rose);">Không thể tải danh sách thiết bị. Vui lòng thử lại sau.</p>
          </div>
        `;
      }
    }
  }

  /**
   * Organize devices into brand categories
   */
  function processDevices(deviceMap) {
    state.byBrand = {
      all: [],
      xiaomi: [],
      redmi: []
    };

    const seenCodes = new Set();

    for (const [code, data] of Object.entries(deviceMap)) {
      if (!data || !data.branches) continue;

      const brands = [...new Set(
        data.branches
          .filter(b => b.brand)
          .map(b => b.brand.toLowerCase())
      )];

      if (brands.length === 0) brands.push('xiaomi');

      const devItem = {
        code: code,
        name: data.name || { zh: code, en: code },
        brand: data.branches.find(b => b.brand)?.brand || 'Xiaomi',
        type: data.type || 'phone',
        supports: data.supports || [],
        branches: data.branches
      };

      state.cache[code] = devItem;

      if (!seenCodes.has(code)) {
        seenCodes.add(code);
        state.byBrand.all.push(devItem);
      }

      brands.forEach(b => {
        const target = b === 'mi' ? 'xiaomi' : b;
        if (state.byBrand[target]) {
          state.byBrand[target].push(devItem);
        }
      });
    }

    // Sort alphabetically
    Object.values(state.byBrand).forEach(list => {
      list.sort((a, b) => {
        const nameA = (a.name.en || a.code).toLowerCase();
        const nameB = (b.name.en || b.code).toLowerCase();
        return nameA.localeCompare(nameB);
      });
    });

    state.devices = state.byBrand.all;

    // Update count badges
    updateCounters();
    renderGrid();
  }

  /**
   * Update count badges in brand tabs
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
   * Extract ROM versions from branches
   */
  function getRomVersions(device) {
    if (!device.branches || device.branches.length === 0) return [];
    const supportedOs = Array.isArray(device.supports) ? device.supports : null;
    const branches = [];

    for (const branch of device.branches) {
      if (!branch.roms || Object.keys(branch.roms).length === 0) continue;

      const osVersions = [];
      for (const [osKey, rom] of Object.entries(branch.roms)) {
        const hasDownload = !!rom.download;
        const isSupported = supportedOs === null ? true : supportedOs.includes(osKey);

        if (!hasDownload && !isSupported) continue;

        osVersions.push({
          key: osKey,
          os: rom.os || osKey,
          android: rom.android || '',
          download: rom.download || '',
          hasDownload: hasDownload
        });
      }

      if (osVersions.length > 0) {
        branches.push({
          branchName: branch.name?.en || branch.name?.zh || branch.branchCode,
          region: branch.region || 'cn',
          osVersions: osVersions.sort((a, b) => {
            const aMatch = a.key.match(/^OS(\d+)\.(\d+)/);
            const bMatch = b.key.match(/^OS(\d+)\.(\d+)/);
            if (!aMatch || !bMatch) return 0;
            const aMajor = parseInt(aMatch[1]);
            const bMajor = parseInt(bMatch[1]);
            if (aMajor !== bMajor) return bMajor - aMajor;
            return parseInt(bMatch[2]) - parseInt(aMatch[2]);
          })
        });
      }
    }

    return branches;
  }

  /**
   * Render device cards into #devices-grid
   */
  function renderGrid() {
    if (!gridEl) return;

    const currentList = state.byBrand[state.activeBrand] || state.byBrand.all;
    const q = state.searchQuery.toLowerCase().trim();

    const filtered = currentList.filter(d => {
      if (!q) return true;
      const nameEn = (d.name.en || '').toLowerCase();
      const nameZh = (d.name.zh || '').toLowerCase();
      const code = d.code.toLowerCase();
      return nameEn.includes(q) || nameZh.includes(q) || code.includes(q);
    });

    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <div class="no-results-box">
          <span class="no-results-icon">🔍</span>
          <h3 style="color: var(--text-strong); margin-bottom: 0.5rem;">Không tìm thấy thiết bị phù hợp</h3>
          <p style="color: var(--muted); font-size: 0.95rem;">
            Vui lòng thử tìm với từ khóa tên máy khác (ví dụ: K70, 14, F5) hoặc tên mã (houji, garnet).
          </p>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = filtered.map(dev => {
      const devName = dev.name.vi || dev.name.en || dev.code;
      const altName = dev.name.zh && dev.name.zh !== devName ? dev.name.zh : dev.brand;
      const branches = getRomVersions(dev);
      const availableCount = branches.reduce((sum, b) => sum + b.osVersions.filter(o => o.hasDownload).length, 0);
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
            <div class="device-subtitle">${altName}</div>

            <div class="device-os-chips">
              ${supportedOsList.slice(0, 3).map(osKey => {
                const isAvail = branches.some(b => b.osVersions.some(o => o.key === osKey && o.hasDownload));
                return `
                  <span class="os-chip ${isAvail ? 'available' : 'coming'}">
                    ${osKey}
                  </span>
                `;
              }).join('')}
            </div>

            <div class="device-action-wrapper">
              ${branches.length > 0 ? `
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
   * Open ROM download modal using HTML5 <dialog>
   */
  function openRomModal(code) {
    const dev = state.cache[code];
    if (!dev || !romDialog) return;

    const devName = dev.name.vi || dev.name.en || dev.code;
    dialogName.textContent = devName;
    dialogCode.textContent = dev.code;

    const branches = getRomVersions(dev);

    if (branches.length === 0) {
      dialogContent.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--muted); font-style: italic;">
          Chưa có bản cập nhật ROM cho thiết bị này.
        </div>
      `;
    } else {
      dialogContent.innerHTML = branches.map(branch => {
        const regionLabel = REGION_LABELS[branch.region] || branch.region.toUpperCase();

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
                </div>
                <div class="popup-os-version-text">${os.os}</div>
              </div>
              <div class="popup-os-actions">
                <button 
                  class="btn-icon copy-link-btn" 
                  style="width: 34px; height: 34px; border-radius: 8px;"
                  data-url="${os.download}"
                  title="Sao chép link tải"
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
   * Close ROM Dialog
   */
  function closeRomModal() {
    if (!romDialog) return;
    if (typeof romDialog.close === 'function') {
      romDialog.close();
    } else {
      romDialog.removeAttribute('open');
    }
  }

  // Event Listeners for Devices
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

  // Copy link handler inside dialog
  if (dialogContent) {
    dialogContent.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.copy-link-btn[data-url]');
      if (copyBtn) {
        const url = copyBtn.getAttribute('data-url');
        navigator.clipboard.writeText(url).then(() => {
          alert('Đã sao chép link tải ROM vào bộ nhớ tạm!');
        }).catch(() => {
          prompt('Link tải ROM:', url);
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

  // Search input handler
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

  // Brand tabs handler
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

  // Light/Dark Theme toggle helper (minimal 6 lines)
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

  // Start loading devices immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDevices);
  } else {
    loadDevices();
  }
})();
