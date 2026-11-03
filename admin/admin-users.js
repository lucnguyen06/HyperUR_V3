/* ==========================================================================
   HyperUR Admin Users Management - Client-side Logic
   - Chỉ Super Admin mới có quyền truy cập (check phía server)
   - CRUD tài khoản admin_users qua api/admin-users.php
   - Reset password, khoá / mở khoá, xoá
   ========================================================================== */
(function () {
    'use strict';

    const API = {
        auth: '../api/admin-auth.php',
        users: '../api/admin-users.php'
    };

    const $  = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    // ===========================================================
    //  STATE
    // ===========================================================
    const state = {
        user: null,
        list: {
            page: 1,
            perPage: 25,
            search: '',
            role: '',
            active: '',
            total: 0,
            totalPages: 1,
            rows: [],
            loading: false
        },
        activity: {
            rows: [],
            userId: null
        }
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

    function fmtDateTime(s) {
        if (!s) return '';
        try {
            const d = new Date(s.replace(' ', 'T'));
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

    function apiUsers(action, body = null, queryParams = '') {
        const url = API.users + '?action=' + action + (queryParams ? '&' + queryParams : '');
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
            handleAuthenticated();
            if (state.user.role === 'superadmin') {
                toast('Xin chào Super Admin ' + (res.data.full_name || res.data.username) + '!', 'success');
            }
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
                handleAuthenticated();
                return true;
            }
        } catch (e) {}
        return false;
    }

    async function logout() {
        try { await apiAuth('logout'); } catch (e) {}
        state.user = null;
        $('#admin-screen').style.display = 'none';
        $('#denied-screen').style.display = 'none';
        $('#auth-screen').style.display = 'flex';
        $('#login-password').value = '';
        loginBtn.disabled = false;
        loginBtnText.textContent = 'Đăng Nhập';
        toast('Đã đăng xuất', 'success', 2000);
    }

    function handleAuthenticated() {
        const u = state.user;

        // Phân luồng theo role
        if (u.role === 'superadmin') {
            $('#auth-screen').style.display = 'none';
            $('#denied-screen').style.display = 'none';
            $('#admin-screen').style.display = 'block';

            $('#admin-name').textContent = u.full_name || u.username;
            const rolePill = $('#admin-role-pill');
            rolePill.textContent = 'SUPERADMIN';
            rolePill.classList.add('role-superadmin');

            const d = new Date();
            $('#admin-login-at').textContent =
                String(d.getHours()).padStart(2,'0') + ':' +
                String(d.getMinutes()).padStart(2,'0') + ' • ' +
                String(d.getDate()).padStart(2,'0') + '/' +
                String(d.getMonth()+1).padStart(2,'0') + '/' +
                d.getFullYear();

            // Init data
            loadStats();
            loadUsers();
            populateActivitySelect();
        } else {
            // Không phải superadmin → Access Denied
            $('#auth-screen').style.display = 'none';
            $('#admin-screen').style.display = 'none';
            $('#denied-screen').style.display = 'block';
            $('#denied-username').textContent = u.username;
        }
    }

    $('#btn-denied-logout').addEventListener('click', () => {
        confirmDialog('Đăng xuất', 'Bạn sẽ bị đăng xuất khỏi phiên hiện tại.', logout);
    });

    // ===========================================================
    //  STATS
    // ===========================================================
    async function loadStats() {
        try {
            const res = await apiUsers('stats');
            const s = res.data;
            $('#stat-total').textContent    = s.total.toLocaleString('vi-VN');
            $('#stat-super').textContent    = s.superadmin.toLocaleString('vi-VN');
            $('#stat-admin').textContent    = s.admin.toLocaleString('vi-VN');
            $('#stat-active').textContent   = s.active.toLocaleString('vi-VN');
            $('#stat-inactive').textContent = s.inactive.toLocaleString('vi-VN');
            $('#stat-online').textContent   = s.online_today.toLocaleString('vi-VN');
        } catch (err) {
            toast('Không thể tải thống kê: ' + err.message, 'error');
        }
    }

    // ===========================================================
    //  LIST
    // ===========================================================
    async function loadUsers() {
        const s = state.list;
        s.loading = true;
        renderUsersLoading();

        const params = new URLSearchParams({
            page: s.page,
            per_page: s.perPage,
            search: s.search,
            role: s.role,
            active: s.active
        });

        try {
            const res = await apiUsers('list', null, params.toString());
            s.rows = res.data.rows;
            s.total = res.data.total;
            s.totalPages = res.data.total_pages;
            renderUsers();
        } catch (err) {
            renderUsersError(err.message);
            toast('Lỗi tải danh sách: ' + err.message, 'error');
        } finally {
            s.loading = false;
        }
    }

    function renderUsersLoading() {
        $('#users-tbody').innerHTML = `
            <tr><td colspan="7">
                <div class="admin-loading">
                    <div class="admin-spinner"></div>
                    <div>Đang tải dữ liệu...</div>
                </div>
            </td></tr>`;
    }

    function renderUsersError(msg) {
        $('#users-tbody').innerHTML = `
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

    function statusBadge(active) {
        if (Number(active) === 1) {
            return `<span class="status-badge active"><span class="dot"></span> Hoạt động</span>`;
        }
        return `<span class="status-badge expired"><span class="dot"></span> Bị khoá</span>`;
    }

    function roleBadge(role) {
        if (role === 'superadmin') {
            return `<span class="role-badge superadmin"><span class="dot"></span> Super Admin</span>`;
        }
        return `<span class="role-badge admin"><span class="dot"></span> Admin</span>`;
    }

    function renderUsers() {
        const s = state.list;
        const tbody = $('#users-tbody');
        if (!s.rows || s.rows.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="7">
                    <div class="admin-empty">
                        <div class="admin-empty-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                            </svg>
                        </div>
                        <h3 class="admin-empty-title">Không có admin nào</h3>
                        <p class="admin-empty-desc">Không tìm thấy tài khoản khớp với điều kiện lọc. Thử bỏ bớt bộ lọc hoặc nhấn "Thêm Admin" để tạo mới.</p>
                    </div>
                </td></tr>`;
            $('#pagination').innerHTML = '';
            return;
        }

        const selfId = state.user ? state.user.id : null;

        tbody.innerHTML = s.rows.map(r => {
            const isSelf = Number(r.id) === Number(selfId);
            const isActive = Number(r.active) === 1;
            const isSuper = r.role === 'superadmin';
            const lastLogin = r.last_login
                ? fmtDateTime(r.last_login)
                : '<span class="cell-last-login never">Chưa từng</span>';

            // Một số nút bị disable với self
            const toggleTitle = isActive ? 'Khoá tài khoản' : 'Mở khoá';
            const deleteTitle = isSelf ? 'Không thể xoá chính mình' : 'Xoá tài khoản';
            const roleChangeBlocked = isSuper; // role hạ từ superadmin chỉ cho phép qua update modal; xử lý ở server

            return `
                <tr data-id="${escapeHtml(r.id)}" class="${isSelf ? 'selected' : ''}">
                        <td class="cell-stt">#${escapeHtml(r.id)}</td>
                        <td>
                            <span class="cell-username" data-username="${escapeHtml(r.username)}" title="Nhấn để sao chép">
                                ${escapeHtml(r.username)}
                                ${isSelf ? '<span class="self-tag">Bạn</span>' : ''}
                            </span>
                        </td>
                        <td class="cell-fullname">${escapeHtml(r.full_name || '—')}</td>
                        <td>${roleBadge(r.role)}</td>
                        <td>${statusBadge(r.active)}</td>
                        <td class="cell-last-login ${r.last_login ? '' : 'never'}">${lastLogin}</td>
                        <td>
                            <div class="cell-actions">
                                <button type="button" class="icon-activity" data-action="activity" data-id="${escapeHtml(r.id)}" data-username="${escapeHtml(r.username)}" title="Xem hoạt động">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12 6 12 12 16 14"></polyline>
                                    </svg>
                                </button>
                                <button type="button" class="icon-edit" data-action="edit" data-id="${escapeHtml(r.id)}" title="Sửa thông tin">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                                        <path d="M12 20h9"></path>
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                    </svg>
                                </button>
                                <button type="button" class="icon-key" data-action="reset" data-id="${escapeHtml(r.id)}" data-username="${escapeHtml(r.username)}" title="Reset mật khẩu">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                                    </svg>
                                </button>
                                <button type="button" class="${isActive ? 'icon-lock' : 'icon-unlock'}"
                                        data-action="toggle" data-id="${escapeHtml(r.id)}"
                                        data-active="${isActive ? '1' : '0'}"
                                        title="${toggleTitle}">
                                    ${isActive
                                        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                            </svg>`
                                        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                                            </svg>`
                                    }
                                </button>
                                <button type="button" class="icon-delete" data-action="delete" data-id="${escapeHtml(r.id)}" data-username="${escapeHtml(r.username)}" title="${deleteTitle}" ${isSelf ? 'disabled' : ''}>
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
    }

    function renderPagination() {
        const s = state.list;
        const p = $('#pagination');
        if (s.total <= s.perPage && s.totalPages <= 1) {
            p.innerHTML = `<div class="admin-pagination-info">Tổng <strong>${s.total.toLocaleString('vi-VN')}</strong> tài khoản</div>`;
            return;
        }
        const btns = [];
        const cur = s.page;
        const total = s.totalPages;

        btns.push(`<button ${cur === 1 ? 'disabled' : ''} data-page="${cur - 1}">‹ Trước</button>`);

        const win = 5;
        let start = Math.max(1, cur - Math.floor(win / 2));
        let end = Math.min(total, start + win - 1);
        if (end - start + 1 < win) start = Math.max(1, end - win + 1);

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
                Hiển thị <strong>${((cur - 1) * s.perPage + 1).toLocaleString('vi-VN')}</strong> –
                <strong>${Math.min(cur * s.perPage, s.total).toLocaleString('vi-VN')}</strong>
                / <strong>${s.total.toLocaleString('vi-VN')}</strong> tài khoản
            </div>
            <div class="admin-pagination-controls">${btns.join('')}</div>
        `;

        $$('#pagination button[data-page]').forEach(btn => {
            if (btn.disabled) return;
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page, 10);
                if (page >= 1 && page <= s.totalPages && page !== s.page) {
                    state.list.page = page;
                    loadUsers();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    // Filter wiring
    const debouncedSearch = debounce(() => {
        state.list.search = $('#filter-search').value.trim();
        state.list.page = 1;
        loadUsers();
    }, 350);

    $('#filter-search').addEventListener('input', debouncedSearch);
    $('#filter-role').addEventListener('change', e => {
        state.list.role = e.target.value;
        state.list.page = 1;
        loadUsers();
    });
    $('#filter-active').addEventListener('change', e => {
        state.list.active = e.target.value;
        state.list.page = 1;
        loadUsers();
    });

    // ===========================================================
    //  TABLE ACTIONS
    // ===========================================================
    $('#users-tbody').addEventListener('click', e => {
        const copyTarget = e.target.closest('.cell-username');
        if (copyTarget && !e.target.closest('.self-tag')) {
            const u = copyTarget.dataset.username;
            navigator.clipboard?.writeText(u).then(
                () => toast('Đã sao chép username: ' + u, 'success', 1500),
                () => toast('Không thể sao chép', 'error')
            );
            return;
        }

        const btn = e.target.closest('[data-action]');
        if (!btn || btn.disabled) return;
        const action = btn.dataset.action;
        const id = parseInt(btn.dataset.id, 10);

        if (action === 'edit')   openEditModal(id);
        else if (action === 'delete') confirmDeleteUser(id, btn.dataset.username);
        else if (action === 'reset') openResetPasswordModal(id, btn.dataset.username);
        else if (action === 'toggle') confirmToggleUser(id, btn.dataset.active, btn.dataset.username);
        else if (action === 'activity') viewActivity(id, btn.dataset.username);
    });

    // ===========================================================
    //  ADD / EDIT
    // ===========================================================
    function resetUserForm() {
        $('#user-id').value = '';
        $('#user-username').value = '';
        $('#user-password').value = '';
        $('#user-fullname').value = '';
        $('#user-role').value = 'admin';
        $('#form-password-group').style.display = '';
        $('#user-username').readOnly = false;
        $('#user-password').required = true;
        $('#form-error').style.display = 'none';
        $('#form-error-text').textContent = '';
    }

    $('#btn-add').addEventListener('click', () => {
        resetUserForm();
        $('#modal-user-heading').textContent = 'Thêm Admin Mới';
        $('#btn-save-text').textContent = 'Tạo tài khoản';
        openModal('modal-user');
        setTimeout(() => $('#user-username').focus(), 100);
    });

    async function openEditModal(id) {
        try {
            const res = await apiUsers('get', null, 'id=' + id);
            const r = res.data;
            resetUserForm();
            $('#user-id').value = r.id;
            $('#user-username').value = r.username || '';
            $('#user-fullname').value = r.full_name || '';
            $('#user-role').value = r.role || 'admin';

            // Ẩn password, không cho đổi username (tránh phá vỡ các tham chiếu trong admin_logs)
            $('#form-password-group').style.display = 'none';
            $('#user-username').readOnly = true;
            $('#user-password').required = false;

            $('#modal-user-heading').textContent = 'Cập nhật #' + r.id + ' · ' + r.username;
            $('#btn-save-text').textContent = 'Cập nhật';
            openModal('modal-user');
        } catch (err) {
            toast('Không thể tải thông tin: ' + err.message, 'error');
        }
    }

    $('#btn-save-user').addEventListener('click', async () => {
        const id = $('#user-id').value;
        const data = {
            username:  $('#user-username').value.trim(),
            full_name: $('#user-fullname').value.trim(),
            role:      $('#user-role').value
        };

        if (!data.username) return showFormError('Vui lòng nhập username');
        if (!isValidRole(data.role)) return showFormError('Role không hợp lệ');

        if (!id) {
            // Add → bắt buộc có password
            data.password = $('#user-password').value;
            if (!data.password || data.password.length < 6) {
                return showFormError('Mật khẩu phải có ít nhất 6 ký tự');
            }
        }

        const btn = $('#btn-save-user');
        btn.disabled = true;
        const orig = btn.innerHTML;
        btn.innerHTML = '<span>Đang lưu...</span>';
        try {
            if (id) {
                const res = await apiUsers('update', data);
                toast(res.message || 'Đã cập nhật', 'success');
            } else {
                const res = await apiUsers('add', data);
                toast(res.message || 'Đã tạo tài khoản', 'success');
            }
            closeModal('modal-user');
            await loadStats();
            await loadUsers();
            populateActivitySelect();
        } catch (err) {
            showFormError(err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    });

    function isValidRole(r) {
        return r === 'admin' || r === 'superadmin';
    }

    function showFormError(msg) {
        $('#form-error').style.display = 'flex';
        $('#form-error-text').textContent = msg;
    }

    // ===========================================================
    //  DELETE / TOGGLE
    // ===========================================================
    function confirmDeleteUser(id, username) {
        if (state.user && Number(id) === Number(state.user.id)) {
            toast('Không thể xoá chính tài khoản đang đăng nhập', 'error');
            return;
        }
        confirmDialog(
            'Xoá tài khoản admin',
            `Bạn có chắc muốn xoá vĩnh viễn tài khoản "${username}"? Hành động này sẽ được ghi vào admin_logs và KHÔNG thể hoàn tác.`,
            async () => {
                try {
                    const res = await apiUsers('delete', { id });
                    toast(res.message || 'Đã xoá tài khoản', 'success');
                    await loadStats();
                    await loadUsers();
                    populateActivitySelect();
                } catch (err) {
                    toast('Lỗi: ' + err.message, 'error');
                }
            }
        );
    }

    function confirmToggleUser(id, activeVal, username) {
        const isActive = activeVal === '1';
        confirmDialog(
            isActive ? 'Khoá tài khoản' : 'Mở khoá tài khoản',
            `Bạn có chắc muốn ${isActive ? 'khoá' : 'mở khoá'} tài khoản "${username}"?`,
            async () => {
                try {
                    const res = await apiUsers('toggle_active', { id });
                    toast(res.message || 'Đã cập nhật', 'success');
                    await loadStats();
                    await loadUsers();
                    populateActivitySelect();
                } catch (err) {
                    toast('Lỗi: ' + err.message, 'error');
                }
            }
        );
    }

    // ===========================================================
    //  RESET PASSWORD
    // ===========================================================
    let resetUserId = null;
    function openResetPasswordModal(id, username) {
        resetUserId = id;
        $('#reset-target').textContent = username;
        $('#reset-new').value = '';
        $('#reset-new2').value = '';
        $('#reset-error').style.display = 'none';
        openModal('modal-resetpass');
        setTimeout(() => $('#reset-new').focus(), 100);
    }

    $('#btn-confirm-reset').addEventListener('click', async () => {
        if (!resetUserId) return;
        const pw = $('#reset-new').value;
        const pw2 = $('#reset-new2').value;

        if (!pw || !pw2) {
            $('#reset-error').style.display = 'flex';
            $('#reset-error-text').textContent = 'Vui lòng nhập đầy đủ các trường';
            return;
        }
        if (pw.length < 6) {
            $('#reset-error').style.display = 'flex';
            $('#reset-error-text').textContent = 'Mật khẩu phải có ít nhất 6 ký tự';
            return;
        }
        if (pw !== pw2) {
            $('#reset-error').style.display = 'flex';
            $('#reset-error-text').textContent = 'Mật khẩu nhập lại không khớp';
            return;
        }

        const btn = $('#btn-confirm-reset');
        btn.disabled = true;
        const orig = btn.innerHTML;
        btn.innerHTML = '<span>Đang đặt lại...</span>';
        try {
            const res = await apiUsers('reset_password', { id: resetUserId, new_password: pw });
            toast(res.message || 'Đã đặt lại mật khẩu', 'success');
            closeModal('modal-resetpass');
            resetUserId = null;
        } catch (err) {
            $('#reset-error').style.display = 'flex';
            $('#reset-error-text').textContent = err.message;
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    });

    // ===========================================================
    //  ACTIVITY (recent logs per admin)
    // ===========================================================
    function populateActivitySelect() {
        // Build option list từ state.list.rows hiện tại (đã có username)
        const sel = $('#activity-user');
        const current = sel.value;
        sel.innerHTML = '<option value="">— Chọn tài khoản —</option>' +
            state.list.rows.map(r =>
                `<option value="${escapeHtml(r.id)}">#${escapeHtml(r.id)} · ${escapeHtml(r.username)} (${escapeHtml(r.full_name || '—')})</option>`
            ).join('');
        sel.value = current;
    }

    async function loadActivity(userId) {
        const tbody = $('#activity-tbody');
        if (!userId) {
            tbody.innerHTML = `
                <tr><td colspan="5">
                    <div class="admin-empty">
                        <div class="admin-empty-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </div>
                        <h3 class="admin-empty-title">Chọn một tài khoản để xem hoạt động</h3>
                        <p class="admin-empty-desc">Dùng dropdown phía trên để chọn admin cần xem log gần đây.</p>
                    </div>
                </td></tr>`;
            return;
        }

        tbody.innerHTML = `
            <tr><td colspan="5">
                <div class="admin-loading">
                    <div class="admin-spinner"></div>
                    <div>Đang tải nhật ký...</div>
                </div>
            </td></tr>`;

        try {
            const res = await apiUsers('activity', null, 'id=' + userId + '&limit=30');
            const rows = res.data.rows;

            if (!rows || rows.length === 0) {
                tbody.innerHTML = `
                    <tr><td colspan="5">
                        <div class="admin-empty">
                            <div class="admin-empty-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                            </div>
                            <h3 class="admin-empty-title">Chưa có hoạt động nào</h3>
                            <p class="admin-empty-desc">Tài khoản này chưa từng thực hiện thao tác quản trị nào.</p>
                        </div>
                    </td></tr>`;
                return;
            }

            tbody.innerHTML = rows.map(r => {
                return `
                    <tr>
                        <td class="cell-stt">#${escapeHtml(r.id)}</td>
                        <td class="log-meta">${escapeHtml(fmtDateTime(r.created_at))}</td>
                        <td><span class="log-action ${escapeHtml(r.action)}">${escapeHtml(r.action)}</span></td>
                        <td>
                            <div style="color: var(--text-soft, #cbd5e1);">${escapeHtml(r.description || '')}</div>
                        </td>
                        <td class="log-meta">${escapeHtml(r.ip_address || '')}</td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            tbody.innerHTML = `
                <tr><td colspan="5">
                    <div class="admin-empty">
                        <div class="admin-empty-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                        </div>
                        <h3 class="admin-empty-title">Không thể tải hoạt động</h3>
                        <p class="admin-empty-desc">${escapeHtml(err.message)}</p>
                    </div>
                </td></tr>`;
            toast('Lỗi: ' + err.message, 'error');
        }
    }

    function viewActivity(userId, username) {
        // Switch to activity tab
        $$('.admin-tab').forEach(x => {
            x.classList.remove('active');
            x.setAttribute('aria-selected', 'false');
        });
        const tabBtn = $$('.admin-tab').find(t => t.dataset.tab === 'activity');
        if (tabBtn) {
            tabBtn.classList.add('active');
            tabBtn.setAttribute('aria-selected', 'true');
        }
        $('#panel-list').style.display = 'none';
        $('#panel-activity').style.display = 'block';

        const sel = $('#activity-user');
        // Nếu admin này không có trong dropdown (do filter), thêm option tạm
        if (!Array.from(sel.options).some(o => o.value === String(userId))) {
            const opt = document.createElement('option');
            opt.value = String(userId);
            opt.textContent = `#${userId} · ${username}`;
            sel.appendChild(opt);
        }
        sel.value = String(userId);
        loadActivity(userId);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    $('#activity-user').addEventListener('change', e => {
        loadActivity(e.target.value);
    });

    $('#btn-activity-refresh').addEventListener('click', () => {
        loadActivity($('#activity-user').value);
    });

    // ===========================================================
    //  TABS
    // ===========================================================
    $$('.admin-tab').forEach(t => {
        t.addEventListener('click', () => {
            $$('.admin-tab').forEach(x => {
                x.classList.remove('active');
                x.setAttribute('aria-selected', 'false');
            });
            t.classList.add('active');
            t.setAttribute('aria-selected', 'true');
            const target = t.dataset.tab;
            $('#panel-list').style.display    = target === 'list' ? 'block' : 'none';
            $('#panel-activity').style.display = target === 'activity' ? 'block' : 'none';
        });
    });

    // ===========================================================
    //  REFRESH / LOGOUT
    // ===========================================================
    $('#btn-refresh').addEventListener('click', () => {
        loadStats();
        loadUsers();
    });

    $('#btn-logout').addEventListener('click', () => {
        confirmDialog('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi bảng quản trị?', logout);
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