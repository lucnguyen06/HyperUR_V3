/* ==========================================================================
   HyperUR Admin Panel - Client-side Logic
   - Đăng nhập / đăng xuất (admin_users)
   - CRUD bảng `serial` qua api/admin-serials.php
   - Xem audit log qua api/admin-logs.php
   - Đổi mật khẩu
   ========================================================================== */
(function () {
    'use strict';

    const API = {
        auth:   '../api/admin-auth.php',
        serials:'../api/admin-serials.php',
        logs:   '../api/admin-logs.php'
    };

    const $  = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    // ===========================================================
    //  STATE
    // ===========================================================
    const state = {
        user: null,
        serials: {
            page: 1,
            perPage: 50,
            search: '',
            device: '',
            status: '',
            sortBy: 'STT',
            sortDir: 'DESC',
            total: 0,
            totalPages: 1,
            rows: [],
            loading: false
        },
        logs: {
            page: 1,
            perPage: 30,
            search: '',
            username: '',
            action: '',
            from: '',
            to: '',
            total: 0,
            totalPages: 1,
            rows: [],
            facets: null,
            loading: false
        },
        devices: [],
        selected: new Set()
    };

    // ===========================================================
    //  UTILITIES
    // ===========================================================
    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, m => ({
            '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
        }[m]));
    }

    function fmtTimeDisplay(value) {
        // Chuẩn hoá hiển thị: unlimited, dd/mm/yyyy, hoặc nguyên bản
        const v = (value ?? '').toString().trim();
        if (!v) return '—';
        if (/^unlimited$/i.test(v)) return 'unlimited';
        if (/^(\d{4})-(\d{2})-(\d{2})$/.test(v)) {
            const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            return `${m[3]}/${m[2]}/${m[1]}`;
        }
        if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(v)) return v;
        if (/^(\d{2})(\d{2})(\d{4})$/.test(v)) {
            const m = v.match(/^(\d{2})(\d{2})(\d{4})$/);
            return `${m[1]}/${m[2]}/${m[3]}`;
        }
        return v;
    }

    function parseDateFromTimeField(value) {
        const v = (value ?? '').toString().trim();
        if (!v) return null;
        if (/^unlimited$/i.test(v)) return null;
        let m;
        if ((m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
        if ((m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
        if ((m = v.match(/^(\d{2})(\d{2})(\d{4})$/))) return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
        const t = Date.parse(v);
        return isNaN(t) ? null : new Date(t);
    }

    function statusFromTimeValue(value) {
        if (!value) return 'expired';
        if (/^unlimited$/i.test(value)) return 'unlimited';
        if (/^pending$/i.test(value)) return 'pending';
        const d = parseDateFromTimeField(value);
        if (!d) return 'expired';
        const today = new Date();
        today.setHours(0,0,0,0);
        return d >= today ? 'active' : 'expired';
    }

    function fmtDateTime(s) {
        if (!s) return '';
        try {
            const d = new Date(s);
            if (isNaN(d)) return s;
            const pad = n => String(n).padStart(2, '0');
            return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch (e) { return s; }
    }

    function debounce(fn, wait) {
        let t;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    // ===========================================================
    //  HTTP
    // ===========================================================
    async function apiFetch(url, options = {}) {
        const opts = Object.assign({
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }, options);

        if (opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(opts.body);
        }

        let res;
        try {
            res = await fetch(url, opts);
        } catch (err) {
            throw new Error('Không thể kết nối đến máy chủ: ' + err.message);
        }

        let json = null;
        try { json = await res.json(); } catch (e) {
            throw new Error('Phản hồi không hợp lệ từ máy chủ (HTTP ' + res.status + ')');
        }

        if (!res.ok || !json.success) {
            throw new Error(json.message || ('HTTP ' + res.status));
        }

        return json;
    }

    function apiAuth(action, body = null) {
        const url = API.auth + '?action=' + action;
        return apiFetch(url, body ? { method: 'POST', body } : null);
    }

    function apiSerials(action, body = null, queryParams = '') {
        const url = API.serials + '?action=' + action + (queryParams ? '&' + queryParams : '');
        return apiFetch(url, body ? { method: 'POST', body } : null);
    }

    function apiLogs(action, body = null, queryParams = '') {
        const url = API.logs + '?action=' + action + (queryParams ? '&' + queryParams : '');
        return apiFetch(url, body ? { method: 'POST', body } : null);
    }

    // ===========================================================
    //  TOAST
    // ===========================================================
    function toast(message, type = 'success', timeout = 3500) {
        const stack = $('#toast-stack');
        if (!stack) return;
        const el = document.createElement('div');
        el.className = 'admin-toast ' + type;
        const icons = {
            success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
            error:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warn:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        };
        el.innerHTML = (icons[type] || icons.success) + '<span>' + escapeHtml(message) + '</span>';
        stack.appendChild(el);
        setTimeout(() => {
            el.style.transition = 'opacity 0.2s, transform 0.2s';
            el.style.opacity = '0';
            el.style.transform = 'translateX(20px)';
            setTimeout(() => el.remove(), 220);
        }, timeout);
    }

    // ===========================================================
    //  MODAL helpers
    // ===========================================================
    function openModal(id) {
        const m = document.getElementById(id);
        if (!m) return;
        m.classList.add('open');
        m.setAttribute('aria-hidden', 'false');
    }
    function closeModal(id) {
        const m = id ? document.getElementById(id) : document.querySelector('.admin-modal-backdrop.open');
        if (!m) return;
        m.classList.remove('open');
        m.setAttribute('aria-hidden', 'true');
    }
    document.addEventListener('click', e => {
        if (e.target.matches('[data-close-modal]')) closeModal();
        const backdrop = e.target.closest('.admin-modal-backdrop');
        if (backdrop && e.target === backdrop) closeModal();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
    });

    // ===========================================================
    //  CONFIRM dialog
    // ===========================================================
    let confirmHandler = null;
    function confirmDialog(title, message, onYes) {
        $('#confirm-title').textContent = title;
        $('#confirm-message').textContent = message;
        confirmHandler = onYes;
        openModal('modal-confirm');
    }
    $('#btn-confirm-yes').addEventListener('click', () => {
        if (typeof confirmHandler === 'function') confirmHandler();
        closeModal();
        confirmHandler = null;
    });

    // ===========================================================
    //  LOGIN FLOW
    // ===========================================================
    const loginForm = $('#login-form');
    const loginBtn = $('#login-btn');
    const loginBtnText = $('#login-btn-text');
    const loginError = $('#login-error');
    const loginErrorText = $('#login-error-text');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = $('#login-username').value.trim();
        const password = $('#login-password').value;

        if (!username || !password) {
            loginError.style.display = 'flex';
            loginErrorText.textContent = 'Vui lòng nhập tài khoản và mật khẩu';
            return;
        }

        loginError.style.display = 'none';
        loginBtn.disabled = true;
        const originalText = loginBtnText.textContent;
        loginBtnText.textContent = 'Đang đăng nhập...';

        try {
            const res = await apiAuth('login', { username, password });
            state.user = res.data;
            onAuthenticated();
            toast('Xin chào ' + (res.data.full_name || res.data.username) + '!', 'success');
        } catch (err) {
            loginError.style.display = 'flex';
            loginErrorText.textContent = err.message;
            loginBtn.disabled = false;
            loginBtnText.textContent = originalText;
        }
    });

    async function tryAutoLogin() {
        try {
            const res = await apiAuth('check');
            if (res.success) {
                state.user = res.data;
                onAuthenticated();
                return true;
            }
        } catch (e) {}
        return false;
    }

    async function logout() {
        try {
            await apiAuth('logout');
        } catch (e) {}
        state.user = null;
        $('#admin-screen').style.display = 'none';
        $('#auth-screen').style.display = 'flex';
        $('#login-password').value = '';
        loginBtn.disabled = false;
        loginBtnText.textContent = 'Đăng Nhập';
        toast('Đã đăng xuất', 'success', 2000);
    }

    function onAuthenticated() {
        $('#auth-screen').style.display = 'none';
        $('#admin-screen').style.display = 'block';

        const u = state.user;
        $('#admin-name').textContent = u.full_name || u.username;
        const rolePill = $('#admin-role-pill');
        rolePill.textContent = (u.role || 'admin').toUpperCase();
        rolePill.classList.toggle('role-superadmin', u.role === 'superadmin');

        // Chỉ hiển thị nút Quản Lý Admin cho tài khoản superadmin
        const btnManageAdmins = $('#btn-manage-admins');
        if (btnManageAdmins) {
            btnManageAdmins.style.display = (u.role === 'superadmin') ? 'inline-flex' : 'none';
        }

        const d = new Date();
        $('#admin-login-at').textContent =
            String(d.getHours()).padStart(2,'0') + ':' +
            String(d.getMinutes()).padStart(2,'0') + ' • ' +
            String(d.getDate()).padStart(2,'0') + '/' +
            String(d.getMonth()+1).padStart(2,'0') + '/' +
            d.getFullYear();

        // Init data
        loadStats();
        loadDevices();
        loadSerials();
    }

    // ===========================================================
    //  SERIALS - LIST
    // ===========================================================
    async function loadStats() {
        try {
            const res = await apiSerials('stats');
            const s = res.data;
            $('#stat-total').textContent     = s.total.toLocaleString('vi-VN');
            $('#stat-unlimited').textContent = s.unlimited.toLocaleString('vi-VN');
            $('#stat-active').textContent    = s.active.toLocaleString('vi-VN');
            $('#stat-expired').textContent   = s.expired.toLocaleString('vi-VN');
            $('#stat-devices').textContent   = s.devices.toLocaleString('vi-VN');
            if ($('#stat-pending')) {
                $('#stat-pending').textContent = (s.pending || 0).toLocaleString('vi-VN');
            }
        } catch (err) {
            toast('Không thể tải thống kê: ' + err.message, 'error');
        }
    }

    async function loadDevices() {
        try {
            const res = await apiSerials('devices');
            state.devices = res.data;
            const sel = $('#filter-device');
            const current = sel.value;
            sel.innerHTML = '<option value="">— Tất cả —</option>' +
                state.devices.map(d => `<option value="${escapeHtml(d.device)}">${escapeHtml(d.device)} (${d.count})</option>`).join('');
            sel.value = current;

            const datalist = $('#device-suggest-list');
            datalist.innerHTML = state.devices.map(d => `<option value="${escapeHtml(d.device)}"></option>`).join('');
        } catch (e) {}
    }

    async function loadSerials() {
        const s = state.serials;
        s.loading = true;
        renderSerialsLoading();

        const params = new URLSearchParams({
            page: s.page,
            per_page: s.perPage,
            search: s.search,
            device: s.device,
            status: s.status,
            sort_by: s.sortBy,
            sort_dir: s.sortDir
        });

        try {
            const res = await apiSerials('list', null, params.toString());
            s.rows = res.data.rows;
            s.total = res.data.total;
            s.totalPages = res.data.total_pages;
            renderSerials();
        } catch (err) {
            s.rows = [];
            renderSerialsError(err.message);
            toast('Lỗi tải danh sách: ' + err.message, 'error');
        } finally {
            s.loading = false;
        }
    }

    function renderSerialsLoading() {
        $('#serials-tbody').innerHTML = `
            <tr><td colspan="7">
                <div class="admin-loading">
                    <div class="admin-spinner"></div>
                    <div>Đang tải dữ liệu...</div>
                </div>
            </td></tr>`;
    }

    function renderSerialsError(msg) {
        $('#serials-tbody').innerHTML = `
            <tr><td colspan="7">
                <div class="admin-empty">
                    <div class="admin-empty-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                    </div>
                    <h3 class="admin-empty-title">Không thể tải dữ liệu</h3>
                    <p class="admin-empty-desc">${escapeHtml(msg)}</p>
                </div>
            </td></tr>`;
        $('#pagination').innerHTML = '';
    }

    function statusBadge(timeStatus) {
        if (timeStatus === 'unlimited') return `<span class="status-badge unlimited"><span class="dot"></span> Unlimited</span>`;
        if (timeStatus === 'active')    return `<span class="status-badge active"><span class="dot"></span> Active</span>`;
        if (timeStatus === 'pending')   return `<span class="status-badge pending"><span class="dot"></span> Chờ Bank</span>`;
        return `<span class="status-badge expired"><span class="dot"></span> Expired</span>`;
    }

    function renderSerials() {
        const s = state.serials;
        const tbody = $('#serials-tbody');
        if (!s.rows || s.rows.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="7">
                    <div class="admin-empty">
                        <div class="admin-empty-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </div>
                        <h3 class="admin-empty-title">Không có serial nào</h3>
                        <p class="admin-empty-desc">Không tìm thấy serial khớp với điều kiện lọc. Thử bỏ bớt bộ lọc hoặc nhấn "Thêm Serial" để tạo mới.</p>
                    </div>
                </td></tr>`;
            $('#pagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = s.rows.map(r => {
            const checked = state.selected.has(r.STT) ? 'checked' : '';
            return `
                <tr data-stt="${escapeHtml(r.STT)}" class="${checked ? 'selected' : ''}">
                    <td><input type="checkbox" class="row-check" data-stt="${escapeHtml(r.STT)}" ${checked} aria-label="Chọn STT ${escapeHtml(r.STT)}"></td>
                    <td class="cell-stt">#${escapeHtml(r.STT)}</td>
                    <td class="cell-device">${escapeHtml(r.Device || '—')}</td>
                    <td>
                        <span class="cell-serial copyable" data-serial="${escapeHtml(r.Serial)}" title="Nhấn để sao chép">${escapeHtml(r.Serial)}</span>
                    </td>
                    <td class="cell-email">${escapeHtml(r.Gmail || '—')}</td>
                    <td>
                        <div style="display:flex; flex-direction:column; gap: 0.3rem; align-items: flex-start;">
                            ${statusBadge(r.TimeStatus)}
                            <span class="cell-time">${escapeHtml(fmtTimeDisplay(r.Time))}</span>
                        </div>
                    </td>
                    <td>
                        <div class="cell-actions">
                            <button type="button" class="icon-renew" data-action="renew" data-stt="${escapeHtml(r.STT)}" data-serial="${escapeHtml(r.Serial)}" data-time="${escapeHtml(r.Time)}" title="Gia hạn / Unlimited">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                            </button>
                            <button type="button" class="icon-edit" data-action="edit" data-stt="${escapeHtml(r.STT)}" title="Sửa">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                                    <path d="M12 20h9"></path>
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                </svg>
                            </button>
                            <button type="button" class="icon-delete" data-action="delete" data-stt="${escapeHtml(r.STT)}" data-serial="${escapeHtml(r.Serial)}" title="Xóa">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path>
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        renderPagination();
        renderBulkBar();
    }

    function renderPagination() {
        const s = state.serials;
        const p = $('#pagination');
        if (s.total <= s.perPage && s.totalPages <= 1) {
            p.innerHTML = `<div class="admin-pagination-info">Tổng <strong>${s.total.toLocaleString('vi-VN')}</strong> serial</div>`;
            return;
        }
        const buttons_arr = [];
        const cur = s.page;
        const total = s.totalPages;

        buttons_arr.push(`<button ${cur === 1 ? 'disabled' : ''} data-page="${cur - 1}">‹ Trước</button>`);

        const window = 5;
        let start = Math.max(1, cur - Math.floor(window / 2));
        let end = Math.min(total, start + window - 1);
        if (end - start + 1 < window) start = Math.max(1, end - window + 1);

        if (start > 1) {
            buttons_arr.push(`<button data-page="1">1</button>`);
            if (start > 2) buttons_arr.push(`<button disabled>…</button>`);
        }
        for (let i = start; i <= end; i++) {
            buttons_arr.push(`<button class="${i === cur ? 'active' : ''}" data-page="${i}">${i}</button>`);
        }
        if (end < total) {
            if (end < total - 1) buttons_arr.push(`<button disabled>…</button>`);
            buttons_arr.push(`<button data-page="${total}">${total}</button>`);
        }
        buttons_arr.push(`<button ${cur === total ? 'disabled' : ''} data-page="${cur + 1}">Sau ›</button>`);

        p.innerHTML = `
            <div class="admin-pagination-info">
                Hiển thị <strong>${((cur - 1) * s.perPage + 1).toLocaleString('vi-VN')}</strong> –
                <strong>${Math.min(cur * s.perPage, s.total).toLocaleString('vi-VN')}</strong>
                / <strong>${s.total.toLocaleString('vi-VN')}</strong> serial
            </div>
            <div class="admin-pagination-controls">${buttons_arr.join('')}</div>
        `;

        $$('#pagination button[data-page]').forEach(btn => {
            if (btn.disabled) return;
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page, 10);
                if (page >= 1 && page <= s.totalPages && page !== s.page) {
                    state.serials.page = page;
                    loadSerials();
                    $('html,body').scrollTo?.(0, 0);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    function renderBulkBar() {
        const bar = $('#bulk-bar');
        $('#bulk-count').textContent = state.selected.size;
        if (state.selected.size > 0) bar.classList.add('open');
        else bar.classList.remove('open');
    }

    // Filter wiring
    const debouncedSearch = debounce(() => {
        state.serials.search = $('#filter-search').value.trim();
        state.serials.page = 1;
        loadSerials();
    }, 350);

    $('#filter-search').addEventListener('input', debouncedSearch);
    $('#filter-device').addEventListener('change', e => {
        state.serials.device = e.target.value;
        state.serials.page = 1;
        loadSerials();
    });
    $('#filter-status').addEventListener('change', e => {
        state.serials.status = e.target.value;
        state.serials.page = 1;
        loadSerials();
    });

    // Sort headers
    $$('#serials-table thead th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const sortBy = th.dataset.sort;
            if (state.serials.sortBy === sortBy) {
                state.serials.sortDir = state.serials.sortDir === 'ASC' ? 'DESC' : 'ASC';
            } else {
                state.serials.sortBy = sortBy;
                state.serials.sortDir = 'ASC';
            }
            $$('#serials-table thead th.sortable').forEach(t => t.classList.remove('sorted'));
            th.classList.add('sorted');
            th.querySelector('.sort-icon').textContent = state.serials.sortDir === 'ASC' ? '▲' : '▼';
            loadSerials();
        });
    });

    // Table interaction (checkbox, action buttons, copy)
    $('#serials-tbody').addEventListener('click', e => {
        const copyTarget = e.target.closest('.cell-serial.copyable');
        if (copyTarget) {
            const sn = copyTarget.dataset.serial;
            navigator.clipboard?.writeText(sn).then(
                () => toast('Đã sao chép serial: ' + sn, 'success', 1500),
                () => toast('Không thể sao chép', 'error')
            );
            return;
        }

        const btn = e.target.closest('[data-action]');
        if (btn) {
            const action = btn.dataset.action;
            const stt = parseInt(btn.dataset.stt, 10);
            if (action === 'edit') openEditModal(stt);
            else if (action === 'delete') confirmDeleteSerial(stt, btn.dataset.serial);
            else if (action === 'renew') openRenewModal(stt, btn.dataset.serial, btn.dataset.time);
            return;
        }
    });

    // Checkbox select
    $('#serials-tbody').addEventListener('change', e => {
        if (!e.target.matches('.row-check')) return;
        const stt = parseInt(e.target.dataset.stt, 10);
        if (e.target.checked) state.selected.add(stt);
        else state.selected.delete(stt);
        e.target.closest('tr').classList.toggle('selected', e.target.checked);
        renderBulkBar();
    });

    $('#check-all').addEventListener('change', e => {
        const checked = e.target.checked;
        $$('#serials-tbody .row-check').forEach(cb => {
            cb.checked = checked;
            const stt = parseInt(cb.dataset.stt, 10);
            if (checked) state.selected.add(stt);
            else state.selected.delete(stt);
            cb.closest('tr').classList.toggle('selected', checked);
        });
        renderBulkBar();
    });

    $('#btn-bulk-cancel').addEventListener('click', () => {
        state.selected.clear();
        $$('#serials-tbody .row-check').forEach(cb => {
            cb.checked = false;
            cb.closest('tr').classList.remove('selected');
        });
        $('#check-all').checked = false;
        renderBulkBar();
    });

    $('#btn-bulk-delete').addEventListener('click', () => {
        if (state.selected.size === 0) return;
        const list = Array.from(state.selected);
        confirmDialog(
            'Xóa hàng loạt',
            `Bạn sắp xóa ${list.length} serial đã chọn. Hành động này sẽ được ghi lại trong admin_logs và KHÔNG thể hoàn tác.`,
            async () => {
                try {
                    const res = await apiSerials('bulk_delete', { stts: list });
                    toast(res.message || 'Đã xóa ' + list.length + ' serial', 'success');
                    state.selected.clear();
                    await loadStats();
                    await loadSerials();
                } catch (err) {
                    toast('Lỗi: ' + err.message, 'error');
                }
            }
        );
    });

    $('#btn-bulk-unlimited').addEventListener('click', () => {
        if (state.selected.size === 0) return;
        const list = Array.from(state.selected);
        confirmDialog(
            'Set Unlimited hàng loạt',
            `Bạn sắp set Time = "unlimited" cho ${list.length} serial đã chọn.`,
            async () => {
                try {
                    const res = await apiSerials('bulk_unlimited', { stts: list });
                    toast(res.message || 'Đã cập nhật ' + list.length + ' serial', 'success');
                    state.selected.clear();
                    await loadStats();
                    await loadSerials();
                } catch (err) {
                    toast('Lỗi: ' + err.message, 'error');
                }
            }
        );
    });

    // Refresh
    $('#btn-refresh').addEventListener('click', () => {
        loadStats();
        loadDevices();
        loadSerials();
        if ($('#panel-logs').style.display !== 'none') loadLogs();
    });

    // Logout
    $('#btn-logout').addEventListener('click', () => {
        confirmDialog('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi bảng quản trị?', logout);
    });

    // ===========================================================
    //  SERIALS - ADD / EDIT
    // ===========================================================
    const modalSerial = $('#modal-serial');

    function resetSerialForm() {
        $('#serial-stt').value = '';
        $('#serial-device').value = '';
        $('#serial-serial').value = '';
        $('#serial-gmail').value = '';
        $('#serial-time').value = 'unlimited';
        $('#form-error').style.display = 'none';
        $('#form-error-text').textContent = '';
        $('#serial-serial').readOnly = false;
    }

    $('#btn-add').addEventListener('click', () => {
        resetSerialForm();
        $('#modal-serial-heading').textContent = 'Thêm Serial Mới';
        $('#btn-save-text').textContent = 'Lưu Serial';
        $('#serial-serial').readOnly = false;
        openModal('modal-serial');
        setTimeout(() => $('#serial-device').focus(), 100);
    });

    async function openEditModal(stt) {
        try {
            const res = await apiSerials('get', null, 'stt=' + stt);
            const r = res.data;
            resetSerialForm();
            $('#serial-stt').value = r.STT;
            $('#serial-device').value = r.Device || '';
            $('#serial-serial').value = r.Serial || '';
            $('#serial-gmail').value = r.Gmail || '';
            $('#serial-time').value = r.Time || 'unlimited';
            // Serial is read-only in edit mode (changing serial may break uniqueness / customer device linkage)
            $('#serial-serial').readOnly = true;
            $('#modal-serial-heading').textContent = 'Cập nhật Serial #' + r.STT;
            $('#btn-save-text').textContent = 'Cập nhật';
            openModal('modal-serial');
        } catch (err) {
            toast('Không thể tải serial: ' + err.message, 'error');
        }
    }

    $('#btn-save-serial').addEventListener('click', async () => {
        const stt = $('#serial-stt').value;
        const data = {
            device: $('#serial-device').value.trim(),
            serial: $('#serial-serial').value.trim(),
            gmail:  $('#serial-gmail').value.trim(),
            time:   $('#serial-time').value.trim()
        };

        if (!data.device) return showFormError('Vui lòng nhập tên thiết bị');
        if (!data.serial) return showFormError('Vui lòng nhập serial');
        if (!data.gmail)  return showFormError('Vui lòng nhập email');
        if (!data.time)   return showFormError('Vui lòng nhập thời hạn (unlimited hoặc ngày)');

        const btn = $('#btn-save-serial');
        btn.disabled = true;
        const orig = btn.innerHTML;
        btn.innerHTML = '<span>Đang lưu...</span>';
        try {
            if (stt) {
                data.stt = parseInt(stt, 10);
                const res = await apiSerials('update', data);
                toast(res.message || 'Đã cập nhật', 'success');
            } else {
                const res = await apiSerials('add', data);
                toast(res.message || 'Đã thêm serial', 'success');
            }
            closeModal('modal-serial');
            await loadStats();
            await loadDevices();
            await loadSerials();
        } catch (err) {
            showFormError(err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    });

    function showFormError(msg) {
        $('#form-error').style.display = 'flex';
        $('#form-error-text').textContent = msg;
    }

    // ===========================================================
    //  SERIALS - DELETE / RENEW
    // ===========================================================
    function confirmDeleteSerial(stt, serial) {
        confirmDialog(
            'Xóa serial',
            `Bạn có chắc muốn xóa serial "${serial}" (STT=${stt})? Hành động này sẽ được ghi vào admin_logs.`,
            async () => {
                try {
                    const res = await apiSerials('delete', { stt });
                    toast(res.message || 'Đã xóa', 'success');
                    state.selected.delete(stt);
                    await loadStats();
                    await loadDevices();
                    await loadSerials();
                } catch (err) {
                    toast('Lỗi: ' + err.message, 'error');
                }
            }
        );
    }

    // Renew modal
    let renewStt = null;
    let renewSerial = null;
    function openRenewModal(stt, serial, currentTime) {
        renewStt = stt;
        renewSerial = serial;
        $('#render-target').textContent = serial;
        $('#render-current').textContent = fmtTimeDisplay(currentTime);
        $('#renew-days').value = 30;
        openModal('modal-renew');
    }

    $$('#modal-renew [data-days]').forEach(btn => {
        btn.addEventListener('click', () => {
            $('#renew-days').value = btn.dataset.days;
        });
    });

    $('#btn-confirm-renew').addEventListener('click', async () => {
        if (!renewStt) return;
        const days = parseInt($('#renew-days').value, 10);
        if (isNaN(days)) {
            toast('Số ngày không hợp lệ', 'error');
            return;
        }
        try {
            const res = await apiSerials('renew', { stt: renewStt, days });
            toast(res.message || 'Gia hạn thành công', 'success');
            closeModal('modal-renew');
            await loadStats();
            await loadSerials();
        } catch (err) {
            toast('Lỗi: ' + err.message, 'error');
        }
    });

    // ===========================================================
    //  LOGS
    // ===========================================================
    async function loadLogsFacets() {
        try {
            const res = await apiLogs('facets');
            state.logs.facets = res.data;
            const sel = $('#log-username');
            sel.innerHTML = '<option value="">— Tất cả —</option>' +
                res.data.usernames.map(u => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('');
        } catch (e) {}
    }

    async function loadLogs() {
        const l = state.logs;
        l.loading = true;
        const params = new URLSearchParams({
            page: l.page,
            per_page: l.perPage,
            search: l.search,
            username: l.username,
            log_action: l.action,
            from: l.from,
            to: l.to
        });
        try {
            const res = await apiLogs('list', null, params.toString());
            l.rows = res.data.rows;
            l.total = res.data.total;
            l.totalPages = res.data.total_pages;
            renderLogs();
        } catch (err) {
            $('#logs-tbody').innerHTML = `
                <tr><td colspan="6">
                    <div class="admin-empty">
                        <div class="admin-empty-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        </div>
                        <h3 class="admin-empty-title">Không thể tải nhật ký</h3>
                        <p class="admin-empty-desc">${escapeHtml(err.message)}</p>
                    </div>
                </td></tr>`;
            $('#logs-pagination').innerHTML = '';
        } finally {
            l.loading = false;
        }
    }

    function renderLogs() {
        const l = state.logs;
        const tbody = $('#logs-tbody');
        if (!l.rows || l.rows.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="6">
                    <div class="admin-empty">
                        <div class="admin-empty-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </div>
                        <h3 class="admin-empty-title">Chưa có nhật ký</h3>
                        <p class="admin-empty-desc">Bộ lọc hiện tại không trả về kết quả. Thử bỏ bớt điều kiện hoặc thực hiện vài thao tác trước.</p>
                    </div>
                </td></tr>`;
            $('#logs-pagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = l.rows.map(r => {
            let detailHtml = '';
            const hasOld = r.old_data && r.old_data !== 'null' && r.old_data !== '';
            const hasNew = r.new_data && r.new_data !== 'null' && r.new_data !== '';

            if (hasOld || hasNew) {
                detailHtml = `<details style="margin-top:0.3rem;"><summary>Xem chi tiết</summary><pre>`;
                if (hasOld) detailHtml += `OLD: ${escapeHtml(r.old_data)}\n\n`;
                if (hasNew) detailHtml += `NEW: ${escapeHtml(r.new_data)}`;
                detailHtml += `</pre></details>`;
            }

            return `
                <tr>
                    <td class="cell-stt">#${r.id}</td>
                    <td class="log-meta">${escapeHtml(fmtDateTime(r.created_at))}</td>
                    <td>
                        <strong style="color: var(--text-strong, #fff);">${escapeHtml(r.username || '—')}</strong>
                        <span style="font-size: 0.75rem; color: var(--muted);">#${r.admin_id}</span>
                    </td>
                    <td><span class="log-action ${escapeHtml(r.action)}">${escapeHtml(r.action)}</span></td>
                    <td>
                        <div style="color: var(--text-soft, #cbd5e1);">${escapeHtml(r.description || '')}</div>
                        ${detailHtml}
                    </td>
                    <td class="log-meta">${escapeHtml(r.ip_address || '')}</td>
                </tr>
            `;
        }).join('');

        renderLogsPagination();
    }

    function renderLogsPagination() {
        const l = state.logs;
        const p = $('#logs-pagination');
        if (l.total <= l.perPage && l.totalPages <= 1) {
            p.innerHTML = `<div class="admin-pagination-info">Tổng <strong>${l.total.toLocaleString('vi-VN')}</strong> log</div>`;
            return;
        }
        const cur = l.page;
        const total = l.totalPages;
        const btns = [];
        btns.push(`<button ${cur === 1 ? 'disabled' : ''} data-page="${cur - 1}">‹ Trước</button>`);
        const window = 5;
        let start = Math.max(1, cur - Math.floor(window / 2));
        let end = Math.min(total, start + window - 1);
        if (end - start + 1 < window) start = Math.max(1, end - window + 1);
        if (start > 1) {
            btns.push(`<button data-page="1">1</button>`);
            if (start > 2) btns.push(`<button disabled>…</button>`);
        }
        for (let i = start; i <= end; i++) {
            btns.push(`<button class="${i === cur ? 'active' : ''}" data-page="${i}">${i}</button>`);
        }
        if (end < total) {
            if (end < total - 1) btns.push(`<button disabled>…</button>`);
            btns.push(`<button data-page="${total}">${total}</button>`);
        }
        btns.push(`<button ${cur === total ? 'disabled' : ''} data-page="${cur + 1}">Sau ›</button>`);

        p.innerHTML = `
            <div class="admin-pagination-info">
                Trang <strong>${cur}</strong> / <strong>${total}</strong> • <strong>${l.total.toLocaleString('vi-VN')}</strong> log
            </div>
            <div class="admin-pagination-controls">${btns.join('')}</div>
        `;
        $$('#logs-pagination button[data-page]').forEach(btn => {
            if (btn.disabled) return;
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page, 10);
                if (page >= 1 && page <= l.totalPages && page !== l.page) {
                    state.logs.page = page;
                    loadLogs();
                }
            });
        });
    }

    // Tabs
    $$('.admin-tab').forEach(t => {
        t.addEventListener('click', () => {
            $$('.admin-tab').forEach(x => {
                x.classList.remove('active');
                x.setAttribute('aria-selected', 'false');
            });
            t.classList.add('active');
            t.setAttribute('aria-selected', 'true');
            const target = t.dataset.tab;
            $('#panel-serials').style.display = target === 'serials' ? 'block' : 'none';
            $('#panel-logs').style.display = target === 'logs' ? 'block' : 'none';
            if (target === 'logs') {
                if (!state.logs.facets) loadLogsFacets();
                loadLogs();
            }
        });
    });

    // Log filter
    const debouncedLogSearch = debounce(() => {
        state.logs.search = $('#log-search').value.trim();
        state.logs.page = 1;
        loadLogs();
    }, 350);
    $('#log-search').addEventListener('input', debouncedLogSearch);
    $('#log-username').addEventListener('change', e => {
        state.logs.username = e.target.value;
        state.logs.page = 1;
        loadLogs();
    });
    $('#log-action').addEventListener('change', e => {
        state.logs.action = e.target.value;
        state.logs.page = 1;
        loadLogs();
    });
    $('#log-from').addEventListener('change', e => {
        state.logs.from = e.target.value;
        state.logs.page = 1;
        loadLogs();
    });
    $('#log-to').addEventListener('change', e => {
        state.logs.to = e.target.value;
        state.logs.page = 1;
        loadLogs();
    });

    // ===========================================================
    //  CHANGE PASSWORD
    // ===========================================================
    $('#btn-change-pass').addEventListener('click', () => {
        $('#cp-old').value = '';
        $('#cp-new').value = '';
        $('#cp-new2').value = '';
        $('#cp-error').style.display = 'none';
        openModal('modal-changepass');
    });

    $('#btn-confirm-changepass').addEventListener('click', async () => {
        const oldp = $('#cp-old').value;
        const newp = $('#cp-new').value;
        const newp2 = $('#cp-new2').value;

        if (!oldp || !newp || !newp2) {
            $('#cp-error').style.display = 'flex';
            $('#cp-error-text').textContent = 'Vui lòng điền đầy đủ các trường';
            return;
        }
        if (newp.length < 6) {
            $('#cp-error').style.display = 'flex';
            $('#cp-error-text').textContent = 'Mật khẩu mới phải có ít nhất 6 ký tự';
            return;
        }
        if (newp !== newp2) {
            $('#cp-error').style.display = 'flex';
            $('#cp-error-text').textContent = 'Mật khẩu nhập lại không khớp';
            return;
        }

        try {
            const res = await apiAuth('change_password', { old_password: oldp, new_password: newp });
            toast(res.message || 'Đổi mật khẩu thành công', 'success');
            closeModal('modal-changepass');
        } catch (err) {
            $('#cp-error').style.display = 'flex';
            $('#cp-error-text').textContent = err.message;
        }
    });

    // ===========================================================
    //  EXPORT CSV
    // ===========================================================
    $('#btn-export').addEventListener('click', () => {
        const params = new URLSearchParams({
            action: 'export',
            search: state.serials.search,
            device: state.serials.device
        });
        const url = API.serials + '?' + params.toString();
        window.open(url, '_blank');
    });

    // ===========================================================
    //  THEME TOGGLE (đồng bộ với site)
    // ===========================================================
    const themeBtn = $('#theme-btn');
    function applyTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('hyperur-theme', t);
        const moon = document.querySelector('.icon-moon');
        const sun = document.querySelector('.icon-sun');
        if (moon && sun) {
            moon.style.display = t === 'light' ? 'none' : 'block';
            sun.style.display = t === 'light' ? 'block' : 'none';
        }
    }
    if (themeBtn) {
        applyTheme(localStorage.getItem('hyperur-theme') || 'dark');
        themeBtn.addEventListener('click', () => {
            const cur = document.documentElement.getAttribute('data-theme') || 'dark';
            applyTheme(cur === 'dark' ? 'light' : 'dark');
        });
    }

    // ===========================================================
    //  INIT
    // ===========================================================
    tryAutoLogin();
})();