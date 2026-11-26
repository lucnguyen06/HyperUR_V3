/**
 * HyperUR V3 - Serial Hub (serial.js)
 * Xử lý toàn bộ logic Đăng ký, Tra cứu Serial, và Tính giá động theo số lượng thiết bị của Email.
 * Độc lập, không phụ thuộc hay chỉnh sửa json/config.js.
 */

(function () {
    'use strict';

    // =========================================================
    // 0. CẤU HÌNH API & HẰNG SỐ (Tự túc, an toàn nếu không có config.js)
    // =========================================================
    const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbx1RfaT5NevKzW1A2F3oZUcODX5qSVSoumLEKMya1753zNlb9OU4zT4pMElWph6jKmRLg/exec';
    const cfg = window.HYPERUR_CONFIG || {};
    const REGISTER_API_URL = cfg.SERIAL_REGISTER_API_URL || DEFAULT_GAS_URL;
    const LOOKUP_API_URL = cfg.SERIAL_LOOKUP_API_URL || cfg.SERIAL_REGISTER_API_URL || DEFAULT_GAS_URL;

    const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    const EMAIL_STORAGE_KEY = 'hyperur_email_registrations';
    const LOOKUP_HISTORY_KEY = 'hyperur_lookup_history';
    const SERIAL_RECIPIENTS_KEY = 'hyperur_serial_recipients';

    // Dữ liệu mẫu khởi đầu (đồng bộ theo json/email_registrations.json)
    let emailDataStore = {};

    let currentSelectedPlan = 'vip';
    let currentCalculatedPrice = 50000;
    let devicesMap = {};
    let emailCheckTimeout = null;
    let lastLookupResult = null;
    let lastLookupQuery = '';
    let activeTabState = null;

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

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // =========================================================
    // 1. DATA LOAD & EMAIL REGISTRATION STORAGE
    // =========================================================
    async function loadEmailRegistrationsData() {
        // 1. Thử tải dữ liệu từ json/email_registrations.json nếu có
        try {
            const res = await fetch('./json/email_registrations.json', { cache: 'no-cache' });
            if (res.ok) {
                const json = await res.json();
                if (json && typeof json === 'object') {
                    emailDataStore = Object.assign({}, emailDataStore, json);
                }
            }
        } catch (err) {
            // Chạy file:// hoặc mạng offline thì dùng fallback bộ nhớ cục bộ
        }

        // Dọn cache cũ trong localStorage nếu còn sót từ phiên bản trước
        try {
            localStorage.removeItem(EMAIL_STORAGE_KEY);
            localStorage.removeItem('qr_current_index');
            localStorage.removeItem('qr_payment_count');
            localStorage.removeItem(LOOKUP_HISTORY_KEY);
        } catch (_) {}

        // 2. Hợp nhất với sessionStorage (cache tự xóa hoàn toàn khi đóng tab / thoát web)
        try {
            const sessionRaw = sessionStorage.getItem(EMAIL_STORAGE_KEY);
            if (sessionRaw) {
                const sessionData = JSON.parse(sessionRaw);
                if (sessionData && typeof sessionData === 'object') {
                    emailDataStore = Object.assign({}, emailDataStore, sessionData);
                }
            }
        } catch (e) {
            console.warn('Lỗi đọc sessionStorage email registrations:', e);
        }
    }

    function saveEmailRegistration(email, newCount) {
        if (!email) return;
        const key = email.trim().toLowerCase();
        emailDataStore[key] = {
            count: newCount,
            lastUpdated: new Date().toISOString()
        };
        try {
            sessionStorage.setItem(EMAIL_STORAGE_KEY, JSON.stringify(emailDataStore));
        } catch (e) {
            console.error('Không thể lưu email registration vào sessionStorage:', e);
        }
    }

    function getDeviceCountForEmail(email) {
        if (!email) return 0;
        const key = email.trim().toLowerCase();
        if (emailDataStore[key] && typeof emailDataStore[key].count === 'number') {
            return emailDataStore[key].count;
        }
        return 0;
    }

    /**
     * Bảng giá bậc thang theo số lượng thiết bị:
     * - 1 - 30 thiết bị:  50.000đ (Cơ bản)
     * - 31+ thiết bị:     40.000đ (Ưu đãi giảm 10k)
     */
    function calculatePrice(deviceCount) {
        if (deviceCount >= 31) {
            return {
                price: 40000,
                priceText: '40.000đ',
                tierKey: 'tier31',
                tierLabel: tr('serial.tier31', 'Tích ≥31 máy: 40k'),
                badge: tr('serial.tierBadgeDiscount', '🎁 Ưu đãi: Giảm 10k/thiết bị'),
                badgeColor: '#3b82f6'
            };
        } else {
            return {
                price: 50000,
                priceText: '50.000đ',
                tierKey: 'base',
                tierLabel: tr('serial.tierBase', 'Cơ bản: 50k'),
                badge: null,
                badgeColor: null
            };
        }
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
    }

    // =========================================================
    // 2. DOM ELEMENTS
    // =========================================================
    // Tab switching
    const tabsWrap = document.getElementById('serial-tabs-wrap');
    const tabRegisterBtn = document.getElementById('tab-register-btn');
    const tabLookupBtn = document.getElementById('tab-lookup-btn');
    const panelRegister = document.getElementById('panel-register');
    const panelLookup = document.getElementById('panel-lookup');
    const tabSlider = document.getElementById('serial-tab-slider');
    const summaryDeviceEl = document.getElementById('sr-summary-device');
    const summarySerialEl = document.getElementById('sr-summary-serial');
    const radioVndPriceEl = document.getElementById('sr-radio-vnd-price');
    const srLiveStatus = document.getElementById('sr-live-status');

    // Register Form Elements
    const regForm = document.getElementById('serial-register-form');
    const serialInput = document.getElementById('serial-input');
    const serialCleanBtn = document.getElementById('serial-clean-btn');
    const serialCleanPreview = document.getElementById('serial-clean-preview');
    const serialValidTag = document.getElementById('serial-valid-tag');

    const codenameInput = document.getElementById('codename-input');
    const datalist = document.getElementById('devices-datalist');
    const previewBox = document.getElementById('device-preview-box');
    const previewText = document.getElementById('device-preview-text');

    const senderEmailInput = document.getElementById('sender-email-input');
    const emailStateMsg = document.getElementById('email-state-msg');
    const emailStateText = document.getElementById('email-state-text');
    const emailCheckLoader = document.getElementById('email-check-loader');
    const emailRegStats = document.getElementById('email-reg-stats');
    const emailDevicesCount = document.getElementById('email-devices-count');
    const emailNextPrice = document.getElementById('email-next-price');
    const emailPriceBadge = document.getElementById('email-price-badge');
    const emailPriceCard = document.getElementById('email-price-card');

    // Plan Cards
    const planCardVip = document.getElementById('plan-card-vip');
    const statusVip = document.getElementById('status-vip');
    const regTypeValue = document.getElementById('reg-type-value');
    const planPriceVal = document.querySelector('#plan-card-vip .reg-plan-price-val');
    const pillBase = document.getElementById('tier-pill-base');
    const pill15 = document.getElementById('tier-pill-15');
    const pill30 = document.getElementById('tier-pill-30');

    // Payment Section
    const paymentSection = document.getElementById('payment-reg-section');
    const donationAmountVal = document.getElementById('donation-amount-val');
    const paymentTierPill = document.getElementById('payment-tier-pill');
    const suggestedSyntax = document.getElementById('suggested-syntax');
    const tipSyntaxExample = document.getElementById('tip-syntax-example');
    const paymentQrImg = document.getElementById('payment-qr-img');
    const btnCopySyntaxQuick = document.getElementById('btn-copy-syntax-quick');
    const paymentMethodVal = document.getElementById('payment-method-value');
    const bankNameRow = document.getElementById('bank-name-row');
    const bankOwnerRow = document.getElementById('bank-owner-row');
    const bankAccRow = document.getElementById('bank-acc-row');
    const paymentTierHint = document.getElementById('payment-tier-hint');
    const binanceDetailsGroup = document.getElementById('binance-details-group');
    const paypalDetailsGroup = document.getElementById('paypal-details-group');
    const qrIntlSwitcher = document.getElementById('qr-intl-switcher');
    const subTabBinance = document.getElementById('sub-tab-binance');
    const subTabPaypal = document.getElementById('sub-tab-paypal');
    const paymentQrBadgeText = document.getElementById('payment-qr-badge-text');
    const paymentQrCaptionText = document.getElementById('payment-qr-caption-text');
    let currentPaymentMethod = 'mbbank';
    let currentIntlSub = 'binance'; // 'binance' hoặc 'paypal'

    // Hệ thống QR VietQR SePay chính thức (Tài khoản ảo VA MBBank) & Admin Telegram tương ứng
    const qrAccounts = [
        {
            name: 'NGUYEN TAN LUC',
            displayName: 'Nguyễn Tấn Lực',
            acc: 'VQRQAMNWP9901',
            telegram: 'lcnguy06',
            url: 'https://qr.sepay.vn/img?bank=MBBank&acc=VQRQAMNWP9901&template=compact'
        },
        {
            name: 'NGUYEN VAN TUC',
            displayName: 'Nguyễn Văn Túc',
            acc: 'VQRQANJTA5424',
            telegram: 'Usagi79',
            url: 'https://qr.sepay.vn/img?bank=MBBank&acc=VQRQANJTA5424&template=compact'
        }
    ];
    let currentQrIndex = 0; // Index QR hiện tại
    let qrPaymentCount = 0; // Số lần đã nhận chuyển khoản trên QR này
    const QR_ROTATE_THRESHOLD = 5; // Xoay QR sau 5 lần chuyển khoản

    function matchQrAccount(acc, name) {
        const cleanAcc = String(acc || '').trim().toUpperCase();
        const cleanName = String(name || '').trim().toUpperCase();
        if (cleanAcc === 'VQRQANJTA5424' || cleanName === 'NGUYEN VAN TUC') {
            return qrAccounts[1];
        }
        if (cleanAcc === 'VQRQAMNWP9901' || cleanName === 'NGUYEN TAN LUC') {
            return qrAccounts[0];
        }
        return null;
    }

    function saveSerialRecipient(serial, qrAccObj) {
        if (!serial || !qrAccObj) return;
        try {
            const raw = sessionStorage.getItem(SERIAL_RECIPIENTS_KEY);
            const store = raw ? JSON.parse(raw) : {};
            if (store && typeof store === 'object') {
                store[String(serial).trim().toLowerCase()] = {
                    acc: qrAccObj.acc,
                    name: qrAccObj.name
                };
                sessionStorage.setItem(SERIAL_RECIPIENTS_KEY, JSON.stringify(store));
            }
        } catch (_) {}
    }

    function getSavedSerialRecipient(serial) {
        if (!serial) return null;
        try {
            const raw = sessionStorage.getItem(SERIAL_RECIPIENTS_KEY);
            if (!raw) return null;
            const store = JSON.parse(raw);
            const entry = store && store[String(serial).trim().toLowerCase()];
            if (entry) {
                return matchQrAccount(entry.acc, entry.name);
            }
        } catch (_) {}
        return null;
    }

    function resolveAdminForLookup(dataObj, query) {
        if (dataObj) {
            const byApi = matchQrAccount(dataObj.recipientAcc, dataObj.recipientName);
            if (byApi) return byApi;
            const bySn = getSavedSerialRecipient(dataObj.serial || query);
            if (bySn) return bySn;
        }
        return getSavedSerialRecipient(query);
    }

    function buildTelegramUrl(adminObj, mode, vars) {
        const targetAdmin = adminObj || qrAccounts[0];
        const adminHandle = targetAdmin.telegram;
        const recipientText = `${targetAdmin.displayName} (${targetAdmin.acc})`;
        let msg = '';
        if (mode === 'notfound') {
            msg = tr(
                'serial.tgNotFoundMsg',
                'Chào Admin @{admin}, tôi vừa tra cứu: {query} nhưng chưa thấy trên hệ thống (đã chuyển khoản cho: {recipient}). Nhờ Admin kiểm tra giúp tôi.',
                {
                    admin: adminHandle,
                    query: (vars && vars.query) || '',
                    recipient: recipientText
                }
            );
        } else {
            msg = tr(
                'serial.tgSupportMsg',
                'Chào Admin @{admin}, tôi cần hỗ trợ kiểm tra kích hoạt Serial HyperUR:\n- Số Serial: {sn}\n- Mã máy: {code}\n- Gói: {plan}\n- Tài khoản nhận CK: {recipient}',
                {
                    admin: adminHandle,
                    sn: (vars && vars.sn) || '',
                    code: (vars && vars.code) || tr('serial.unknownValue', 'chưa rõ'),
                    plan: (vars && vars.plan) || tr('serial.expiryLifetimeFallback', 'Vĩnh viễn'),
                    recipient: recipientText
                }
            );
        }
        return `https://t.me/${encodeURIComponent(adminHandle)}?text=${encodeURIComponent(msg)}`;
    }

    function renderAdminPickerHtml(mode, vars, highlightAcc) {
        return `
            <div class="sr-admin-picker" id="sr-admin-picker-panel">
                <div class="sr-admin-picker-inner">
                    <div class="sr-admin-picker-box">
                        <div class="sr-admin-picker-title">${escapeHtml(tr('serial.adminPickerTitle', 'Chọn chủ tài khoản bạn đã chuyển khoản để gặp đúng Admin:'))}</div>
                        <div class="sr-admin-choice-grid">
                            ${qrAccounts.map(acc => {
                                const subText = acc.acc === 'VQRQAMNWP9901'
                                    ? tr('serial.adminLucChannels', 'VQRQAMNWP9901 · MBBank / Quốc tế')
                                    : tr('serial.adminTucChannels', 'VQRQANJTA5424 · MBBank');
                                const isHighlighted = Boolean(highlightAcc && acc.acc === highlightAcc);
                                return `
                                    <a href="${buildTelegramUrl(acc, mode, vars)}" target="_blank" rel="noopener noreferrer" class="sr-admin-choice${isHighlighted ? ' is-recommended' : ''}">
                                        <span class="sr-admin-choice-info">
                                            <span class="sr-admin-choice-name-row">
                                                <strong class="sr-admin-choice-name">${escapeHtml(acc.displayName)}</strong>
                                                ${isHighlighted ? `<span class="sr-admin-rec-tag">${escapeHtml(tr('serial.adminQrMatchTag', 'Theo mã QR'))}</span>` : ''}
                                            </span>
                                            <span class="sr-admin-choice-sub is-mono">${escapeHtml(subText)}</span>
                                        </span>
                                        <span class="sr-admin-choice-handle is-mono">@${escapeHtml(acc.telegram)}</span>
                                    </a>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Buttons
    const submitBtn = document.getElementById('btn-submit-form');
    const btnQuickLookupTab = document.getElementById('btn-quick-lookup-tab');
    const toast = document.getElementById('reg-toast');
    const toastText = document.getElementById('toast-text');

    // Dialog Modal
    const successDialog = document.getElementById('success-dialog');
    const modalSerial = document.getElementById('modal-serial-val');
    const modalCodename = document.getElementById('modal-codename-val');
    const modalPlan = document.getElementById('modal-plan-val');
    const modalEmailVal = document.getElementById('modal-email-val');
    const modalAmountVal = document.getElementById('modal-amount-val');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalCloseX = document.getElementById('modal-close-x');
    const modalLookupLink = document.getElementById('modal-lookup-link');
    const modalQrBox = document.getElementById('modal-payment-qr-box');
    const modalQrFrame = document.getElementById('modal-qr-frame');
    const modalQrImg = document.getElementById('modal-qr-img');
    const modalQrSyntax = document.getElementById('modal-qr-syntax');
    const modalDesc = document.getElementById('modal-desc-text');
    const modalTitleEl = document.getElementById('modal-title-text');
    const modalIntlSwitcher = document.getElementById('modal-intl-switcher');
    const modalSubBinance = document.getElementById('modal-sub-binance');
    const modalSubPaypal = document.getElementById('modal-sub-paypal');
    const modalQrBadgeText = document.getElementById('modal-qr-badge-text');
    const modalQrFooterText = document.getElementById('modal-qr-footer-text');
    const modalTierTag = document.getElementById('modal-tier-tag');
    const modalBankGroup = document.getElementById('modal-bank-group');
    const modalBinanceGroup = document.getElementById('modal-binance-group');
    const modalPaypalGroup = document.getElementById('modal-paypal-group');
    const modalBtnCopySyntax = document.getElementById('modal-btn-copy-syntax');
    const modalBtnCopyAcc = document.getElementById('modal-btn-copy-acc');
    const modalBtnCopyOwner = document.getElementById('modal-btn-copy-owner');
    const modalQrAccVal = document.getElementById('modal-qr-acc-val');
    const modalQrOwnerVal = document.getElementById('modal-qr-owner-val');
    const modalQrHintText = document.getElementById('modal-qr-hint-text');
    let lastModalSyntax = '';
    let lastModalPriceInfo = null;
    let reopenSuccessAfterLightbox = false;

    // Lookup Tab Elements
    const lookupForm = document.getElementById('lookup-form');
    const lookupSerialInput = document.getElementById('lookup-serial-input');
    const lookupClearBtn = document.getElementById('lookup-clear-btn');
    const lookupSubmitBtn = document.getElementById('lookup-submit-btn');
    const lookupResultContainer = document.getElementById('lookup-result-container');
    const lookupHistoryWrapper = document.getElementById('lookup-history-wrapper');
    const lookupHistoryGrid = document.getElementById('lookup-history-grid');
    const clearLookupHistoryBtn = document.getElementById('btn-clear-lookup-history');

    // =========================================================
    // 3. TOAST, LIVE REGION & ANIMATE UI CLIPBOARD HELPERS
    // =========================================================
    const COPY_ICON_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    const CHECK_DRAW_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline class="sr-draw-check" points="20 6 9 17 4 12"/></svg>';

    let toastTimer = null;
    function showToast(msg) {
        if (srLiveStatus) srLiveStatus.textContent = msg;
        if (!toast || !toastText) return;
        toastText.textContent = msg;
        toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
    }

    function copyTextToClipboard(text) {
        const fallbackCopy = () => new Promise((resolve, reject) => {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                ok ? resolve() : reject(new Error('execCommand failed'));
            } catch (err) {
                reject(err);
            }
        });

        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            return navigator.clipboard.writeText(text).catch(() => fallbackCopy());
        }
        return fallbackCopy();
    }

    function markCopyBtnCopied(btn, toastMsg) {
        if (toastMsg) showToast(toastMsg);
        if (!btn) return;

        const iconSlot = btn.querySelector('.sr-copy-icon');
        const labelSlot = btn.querySelector('.sr-copy-label');

        if (!btn.dataset.origLabel && labelSlot) {
            btn.dataset.origLabel = labelSlot.textContent.trim();
        }
        btn.classList.add('is-copied');

        if (iconSlot && labelSlot) {
            iconSlot.innerHTML = CHECK_DRAW_SVG;
            iconSlot.classList.remove('sr-swap-anim');
            void iconSlot.offsetWidth;
            iconSlot.classList.add('sr-swap-anim');

            labelSlot.textContent = tr('serial.copiedBtn', 'Đã chép');
            labelSlot.classList.remove('sr-blur-anim');
            void labelSlot.offsetWidth;
            labelSlot.classList.add('sr-blur-anim');
        } else {
            if (!btn.dataset.origHtml) btn.dataset.origHtml = btn.innerHTML;
            btn.textContent = tr('serial.copiedBtn', 'Đã chép');
        }

        if (btn._resetTimer) clearTimeout(btn._resetTimer);
        btn._resetTimer = setTimeout(() => {
            btn.classList.remove('is-copied');
            if (iconSlot && labelSlot) {
                iconSlot.innerHTML = COPY_ICON_SVG;
                labelSlot.textContent = btn.dataset.origLabel || tr('serial.copyShort', 'Chép');
            } else if (btn.dataset.origHtml) {
                btn.innerHTML = btn.dataset.origHtml;
            }
            delete btn.dataset.origLabel;
            delete btn.dataset.origHtml;
            btn._resetTimer = null;
        }, 2000);
    }

    document.querySelectorAll('[data-copy]').forEach(btn => {
        btn.addEventListener('click', function () {
            const text = this.getAttribute('data-copy');
            if (!text) return;
            copyTextToClipboard(text).then(() => {
                markCopyBtnCopied(this, tr('serial.toastCopied', 'Đã sao chép: {text}', { text }));
            }).catch(() => {});
        });
    });

    if (btnCopySyntaxQuick) {
        btnCopySyntaxQuick.addEventListener('click', function () {
            const text = suggestedSyntax ? suggestedSyntax.textContent.trim() : 'UR';
            copyTextToClipboard(text).then(() => {
                markCopyBtnCopied(this, tr('serial.toastCopiedSyntax', 'Đã sao chép cú pháp: {text}', { text }));
            }).catch(() => {});
        });
    }

    // Astryx Collapsible toggles (Fastboot / ADB guides)
    document.querySelectorAll('.sr-collapsible-trigger').forEach(trig => {
        trig.addEventListener('click', function () {
            const box = this.closest('.sr-collapsible');
            if (!box) return;
            const nextOpen = !box.classList.contains('is-open');
            box.classList.toggle('is-open', nextOpen);
            this.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        });
    });

    // =========================================================
    // 4. TAB SWITCHING (ĐĂNG KÝ <-> TRA CỨU) & GLIDING PILL
    // =========================================================
    function positionTabGlider(instant) {
        if (!tabSlider) return;
        const activeBtn = (tabLookupBtn && tabLookupBtn.classList.contains('active')) ? tabLookupBtn : tabRegisterBtn;
        if (!activeBtn) return;

        const apply = () => {
            const prevTransition = tabSlider.style.transition;
            if (instant) tabSlider.style.transition = 'none';
            tabSlider.style.width = activeBtn.offsetWidth + 'px';
            tabSlider.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
            tabSlider.style.opacity = '1';
            if (instant) {
                void tabSlider.offsetWidth;
                tabSlider.style.transition = prevTransition;
            }
        };
        requestAnimationFrame(apply);
    }

    if (tabsWrap && typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => positionTabGlider(true)).observe(tabsWrap);
    } else if (typeof window.addEventListener === 'function') {
        window.addEventListener('resize', () => positionTabGlider(true));
    }

    function activateTab(tabName, updateUrl) {
        const prevTab = activeTabState;
        const isFirstInit = (prevTab === null);
        const dirClass = tabName === 'lookup' ? 'sr-enter-right' : 'sr-enter-left';
        activeTabState = tabName;

        if (tabName === 'lookup') {
            if (tabRegisterBtn) {
                tabRegisterBtn.classList.remove('active');
                tabRegisterBtn.setAttribute('aria-selected', 'false');
            }
            if (tabLookupBtn) {
                tabLookupBtn.classList.add('active');
                tabLookupBtn.setAttribute('aria-selected', 'true');
            }
            if (panelRegister) {
                panelRegister.hidden = true;
                panelRegister.style.display = 'none';
                panelRegister.classList.remove('sr-enter-left', 'sr-enter-right');
            }
            if (panelLookup) {
                panelLookup.hidden = false;
                panelLookup.style.display = '';
                panelLookup.classList.remove('sr-enter-left', 'sr-enter-right');
                if (!isFirstInit && prevTab !== tabName) {
                    void panelLookup.offsetWidth;
                    panelLookup.classList.add(dirClass);
                }
            }
        } else {
            if (tabLookupBtn) {
                tabLookupBtn.classList.remove('active');
                tabLookupBtn.setAttribute('aria-selected', 'false');
            }
            if (tabRegisterBtn) {
                tabRegisterBtn.classList.add('active');
                tabRegisterBtn.setAttribute('aria-selected', 'true');
            }
            if (panelLookup) {
                panelLookup.hidden = true;
                panelLookup.style.display = 'none';
                panelLookup.classList.remove('sr-enter-left', 'sr-enter-right');
            }
            if (panelRegister) {
                panelRegister.hidden = false;
                panelRegister.style.display = '';
                panelRegister.classList.remove('sr-enter-left', 'sr-enter-right');
                if (!isFirstInit && prevTab !== tabName) {
                    void panelRegister.offsetWidth;
                    panelRegister.classList.add(dirClass);
                }
            }
        }

        positionTabGlider(isFirstInit);

        if (updateUrl) {
            try {
                const url = new URL(window.location.href);
                if (tabName === 'lookup') {
                    url.searchParams.set('tab', 'lookup');
                } else {
                    url.searchParams.delete('tab');
                }
                window.history.replaceState({}, '', url.toString());
            } catch (e) { }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    if (tabRegisterBtn) {
        tabRegisterBtn.addEventListener('click', () => activateTab('register', true));
    }
    if (tabLookupBtn) {
        tabLookupBtn.addEventListener('click', () => activateTab('lookup', true));
    }

    document.querySelectorAll('[data-jump-tab]').forEach(btn => {
        btn.addEventListener('click', function () {
            const target = this.getAttribute('data-jump-tab');
            if (target === 'lookup' || target === 'register') {
                activateTab(target, true);
            }
        });
    });

    if (btnQuickLookupTab) {
        btnQuickLookupTab.addEventListener('click', function () {
            activateTab('lookup', true);
            const serial = serialInput ? serialInput.value.trim() : '';
            if (serial && lookupSerialInput) {
                lookupSerialInput.value = serial;
                updateLookupCounter();
                performLookup(serial);
            }
        });
    }

    // =========================================================
    // 5. PLAN SELECTION (BẢN QUYỀN VĨNH VIỄN)
    // =========================================================
    function selectPlan(planKey) {
        currentSelectedPlan = 'vip';
        if (planCardVip) {
            planCardVip.classList.add('active');
            planCardVip.setAttribute('aria-checked', 'true');
        }
        if (statusVip) statusVip.textContent = tr('serial.planSelected', '✓ Đang chọn gói này (Mặc định)');
        if (regTypeValue) regTypeValue.value = 'Đăng kí có Ủng hộ (Vĩnh viễn)';

        if (submitBtn) {
            const btnSpan = document.getElementById('btn-submit-text') || submitBtn.querySelector('span');
            if (btnSpan) btnSpan.textContent = tr('serial.submitBtnSend', 'Xác Nhận & Gửi Serial Lên Hệ Thống');
        }
        if (paymentSection) paymentSection.style.display = 'block';
    }

    if (planCardVip) {
        planCardVip.addEventListener('click', () => selectPlan('vip'));
        planCardVip.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectPlan('vip');
            }
        });
    }

    // =========================================================
    // 6. CATALOG THIẾT BỊ (json/devices_catalog.json)
    // =========================================================
    function updateSummaryDevice(val) {
        if (!summaryDeviceEl) return;
        const clean = (val !== undefined ? val : (codenameInput ? codenameInput.value : '')).trim().toLowerCase();
        if (!clean) {
            summaryDeviceEl.textContent = tr('serial.summaryWaiting', 'Chưa nhập');
            return;
        }
        if (devicesMap[clean]) {
            const dev = devicesMap[clean];
            const lang = (typeof I18n !== 'undefined' && I18n.currentLang === 'vi') ? 'vi' : 'en';
            const devName = (dev.name && (dev.name[lang] || dev.name.en || dev.name.vi)) || clean;
            summaryDeviceEl.textContent = `${devName} (${clean})`;
        } else {
            summaryDeviceEl.textContent = clean;
        }
    }

    function updateSummarySerial(sanitizedVal) {
        if (!summarySerialEl) return;
        const clean = sanitizedVal !== undefined ? sanitizedVal : (serialInput ? sanitizeSerial(serialInput.value) : '');
        summarySerialEl.textContent = clean || '—';
    }

    function setAmountWithPulse(newText) {
        if (!donationAmountVal) return;
        const prev = donationAmountVal.textContent;
        donationAmountVal.textContent = newText;
        if (prev && prev !== newText) {
            donationAmountVal.classList.remove('sr-price-pulse');
            void donationAmountVal.offsetWidth;
            donationAmountVal.classList.add('sr-price-pulse');
        }
    }

    async function initCatalog() {
        try {
            const res = await fetch('./json/devices_catalog.json');
            if (res.ok) {
                devicesMap = await res.json();
                if (datalist) {
                    const frag = document.createDocumentFragment();
                    for (const code in devicesMap) {
                        const dev = devicesMap[code];
                        const opt = document.createElement('option');
                        const devName = dev.name && dev.name.en ? dev.name.en : code;
                        opt.value = code;
                        opt.label = `${devName} (${dev.brand || 'Xiaomi'})`;
                        frag.appendChild(opt);
                    }
                    datalist.appendChild(frag);
                }
                if (codenameInput && codenameInput.value.trim()) {
                    handleCodenameInput();
                } else {
                    updateSummaryDevice('');
                }
            }
        } catch (err) {
            console.warn('Không tải được catalog gợi ý thiết bị:', err);
        }
    }
    initCatalog();

    function handleCodenameInput() {
        if (!codenameInput || !previewBox || !previewText) return;
        const val = codenameInput.value.trim().toLowerCase();
        if (!val) {
            previewBox.classList.remove('show');
            updateSummaryDevice('');
            updatePaymentSyntax();
            return;
        }

        if (devicesMap[val]) {
            const dev = devicesMap[val];
            const lang = (typeof I18n !== 'undefined' && I18n.currentLang === 'vi') ? 'vi' : 'en';
            const devName = (dev.name && (dev.name[lang] || dev.name.en || dev.name.vi)) || val;
            previewText.innerHTML = tr('serial.previewFound', 'Thiết bị: <strong>{name}</strong> ({brand}) • Codename: <code>{code}</code>', {
                name: devName,
                brand: dev.brand || 'Xiaomi',
                code: val
            });
            previewBox.classList.add('show');
        } else {
            previewText.innerHTML = tr('serial.previewManual', 'Mã thiết bị nhập tay: <code>{code}</code>', { code: val });
            previewBox.classList.add('show');
        }

        updateSummaryDevice(val);
        updatePaymentSyntax();
    }

    if (codenameInput) {
        codenameInput.addEventListener('input', handleCodenameInput);
        codenameInput.addEventListener('change', handleCodenameInput);
    }

    // =========================================================
    // 7. SERIAL INPUT & QR CODE UPDATE
    // =========================================================
    function sanitizeSerial(raw) {
        if (!raw) return '';
        let clean = raw.replace(/^(?:sn|serial)\s*[:=\s-]*/i, '');
        clean = clean.replace(/[^a-zA-Z0-9]/g, '');
        return clean; // Giữ nguyên chữ hoa/thường như user gõ
    }

    function updatePaymentQr(price, serial) {
        if (!paymentQrImg) return;
        if (currentPaymentMethod !== 'mbbank') return;
        
        // Tổ hợp nội dung: UR + CODENAME + SERIAL + EMAIL (lọc bỏ @ và . để tương thích chuẩn VietQR)
        let description = 'UR';
        const code = codenameInput ? codenameInput.value.trim() : '';
        const email = senderEmailInput ? senderEmailInput.value.trim().replace(/[@.]/g, '') : '';
        
        if (code) description += ' ' + code;
        if (serial) description += ' ' + serial;
        if (email) description += ' ' + email;
        
        const finalPrice = price || currentCalculatedPrice || 50000;
        const activeQr = qrAccounts[currentQrIndex] || qrAccounts[0];
        const qrUrl = `${activeQr.url}&amount=${finalPrice}&des=${encodeURIComponent(description)}`;
        
        paymentQrImg.src = qrUrl;
        const modalQrImg = document.getElementById('modal-qr-img');
        if (modalQrImg) {
            modalQrImg.src = qrUrl;
        }
    }

    function selectIntlSub(subKey) {
        currentIntlSub = subKey;
        if (subTabBinance) subTabBinance.classList.toggle('active', subKey === 'binance');
        if (subTabPaypal) subTabPaypal.classList.toggle('active', subKey === 'paypal');

        if (subKey === 'binance') {
            if (paymentQrImg) paymentQrImg.src = 'images/QR_BINANCE_DNT_HYPERUR.jpg';
            if (paymentQrBadgeText) paymentQrBadgeText.textContent = 'Binance Pay (5 USDT)';
            if (paymentQrCaptionText) paymentQrCaptionText.textContent = tr('serial.qrCaptionBinance', 'Quét mã bằng app Binance (5 USDT)');
            if (binanceDetailsGroup) binanceDetailsGroup.style.display = 'block';
            if (paypalDetailsGroup) paypalDetailsGroup.style.display = 'none';
            setAmountWithPulse('5 USDT');
        } else {
            if (paymentQrImg) paymentQrImg.src = 'images/QR_PAYPAL_DNT_HYPERUR.jpg';
            if (paymentQrBadgeText) paymentQrBadgeText.textContent = 'PayPal (5 USD)';
            if (paymentQrCaptionText) paymentQrCaptionText.textContent = tr('serial.qrCaptionPaypal', 'Quét mã hoặc mở PayPal gửi 5$');
            if (binanceDetailsGroup) binanceDetailsGroup.style.display = 'none';
            if (paypalDetailsGroup) paypalDetailsGroup.style.display = 'block';
            setAmountWithPulse('5 USD');
        }
    }

    if (subTabBinance) {
        subTabBinance.addEventListener('click', () => selectIntlSub('binance'));
    }
    if (subTabPaypal) {
        subTabPaypal.addEventListener('click', () => selectIntlSub('paypal'));
    }

    function selectPaymentMethod(methodKey) {
        currentPaymentMethod = methodKey;
        const cards = document.querySelectorAll('.sr-radio-item[data-method], .payment-method-card[data-method]');
        cards.forEach(card => {
            const isMatch = card.getAttribute('data-method') === methodKey;
            card.classList.toggle('active', isMatch);
            card.setAttribute('aria-checked', isMatch ? 'true' : 'false');
        });

        const currentSerial = serialInput ? sanitizeSerial(serialInput.value) : '';

        if (methodKey === 'crypto_intl') {
            if (paymentMethodVal) paymentMethodVal.value = 'Quốc Tế & Crypto (Binance Pay / PayPal - Only 5$)';
            if (bankNameRow) bankNameRow.style.display = 'none';
            if (bankOwnerRow) bankOwnerRow.style.display = 'none';
            if (bankAccRow) bankAccRow.style.display = 'none';
            if (qrIntlSwitcher) qrIntlSwitcher.style.display = 'flex';

            if (paymentTierPill) {
                paymentTierPill.textContent = tr('serial.payIntlTag', 'Only 5$ • Giá cố định');
                paymentTierPill.className = 'tier-pill tier-intl-fixed current-active';
            }
            if (paymentTierHint) {
                paymentTierHint.style.display = 'none';
            }

            selectIntlSub(currentIntlSub || 'binance');
        } else {
            // MBBank (Mặc định)
            if (paymentMethodVal) paymentMethodVal.value = 'Chuyển Khoản VietQR (24/7)';
            if (paymentQrBadgeText) paymentQrBadgeText.textContent = 'MBBank VietQR 24/7';
            if (paymentQrCaptionText) paymentQrCaptionText.textContent = tr('serial.qrCaptionBank', 'Quét bằng mọi ứng dụng ngân hàng');
            if (bankNameRow) bankNameRow.style.display = 'flex';
            if (bankOwnerRow) bankOwnerRow.style.display = 'flex';
            if (bankAccRow) bankAccRow.style.display = 'flex';
            if (qrIntlSwitcher) qrIntlSwitcher.style.display = 'none';
            if (binanceDetailsGroup) binanceDetailsGroup.style.display = 'none';
            if (paypalDetailsGroup) paypalDetailsGroup.style.display = 'none';

            // Trả về mức giá theo email
            const email = senderEmailInput ? senderEmailInput.value.trim() : '';
            const count = getDeviceCountForEmail(email);
            const priceInfo = calculatePrice(count);

            setAmountWithPulse(priceInfo.priceText);
            if (paymentTierPill) {
                paymentTierPill.textContent = priceInfo.tierLabel;
                paymentTierPill.className = `tier-pill ${priceInfo.tierKey === 'base' ? 'tier-base' : (priceInfo.tierKey === 'tier30' ? 'tier-30' : 'tier-15')} current-active`;
            }
            if (paymentTierHint) {
                paymentTierHint.style.display = '';
            }

            updatePaymentQr(currentCalculatedPrice, currentSerial);
        }
    }

    document.querySelectorAll('.sr-radio-item[data-method], .payment-method-card[data-method]').forEach(card => {
        card.addEventListener('click', function () {
            const methodKey = this.getAttribute('data-method') || 'mbbank';
            selectPaymentMethod(methodKey);
        });
        card.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const methodKey = this.getAttribute('data-method') || 'mbbank';
                selectPaymentMethod(methodKey);
            }
        });
    });

    function updatePaymentSyntax() {
        const serial = serialInput ? serialInput.value.trim() : '';
        const code = codenameInput ? codenameInput.value.trim() : '';
        const email = senderEmailInput ? senderEmailInput.value.trim() : '';
        
        if (suggestedSyntax) {
            if (serial && code && email) {
                suggestedSyntax.textContent = `UR ${code} ${serial} ${email}`;
            } else if (serial || code || email) {
                const parts = ['UR', code, serial, email].filter(p => p);
                suggestedSyntax.textContent = parts.join(' ');
            } else {
                suggestedSyntax.textContent = 'UR [CODENAME] [SERIAL] [EMAIL]';
            }
        }
        if (tipSyntaxExample) {
            tipSyntaxExample.textContent = 'UR ABC 12345678 user@gmail.com';
        }
    }

    function handleSerialInput() {
        if (!serialInput) return;
        const rawVal = serialInput.value;
        const sanitized = sanitizeSerial(rawVal);

        if (rawVal !== sanitized) {
            serialInput.value = sanitized;
        }

        const len = sanitized.length;

        if (serialCleanBtn) serialCleanBtn.style.display = len > 0 ? 'block' : 'none';

        if (serialCleanPreview && serialValidTag) {
            if (len >= 6) {
                serialCleanPreview.innerHTML = tr('serial.snValidPreview', 'Serial hợp lệ: <strong>{sn}</strong>', { sn: sanitized });
                serialValidTag.style.display = 'inline-flex';
            } else if (len > 0) {
                serialCleanPreview.innerHTML = tr('serial.snTyping', 'Đang nhập ({len}/8 ký tự)...', { len });
                serialValidTag.style.display = 'none';
            } else {
                serialCleanPreview.textContent = tr('serial.snWaiting', 'Đang chờ nhập serial hợp lệ...');
                serialValidTag.style.display = 'none';
            }
        }

        // Cập nhật gợi ý cú pháp chuyển khoản & tóm tắt
        updateSummarySerial(sanitized);
        updatePaymentSyntax();

        // Cập nhật QR code với serial mới
        updatePaymentQr(currentCalculatedPrice, len > 0 ? sanitized : '');
    }

    if (serialInput) {
        serialInput.addEventListener('input', handleSerialInput);
    }

    if (serialCleanBtn) {
        serialCleanBtn.addEventListener('click', function () {
            if (serialInput) {
                serialInput.value = '';
                handleSerialInput();
                serialInput.focus();
            }
        });
    }

    // =========================================================
    // 8. TÍNH MỨC ỦNG HỘ ÁP DỤNG THEO SỐ THIẾT BỊ CỦA EMAIL
    // =========================================================
    function applyPriceUI(priceInfo, deviceCount) {
        currentCalculatedPrice = priceInfo.price;

        // 1. Thẻ thống kê dưới ô email
        if (emailDevicesCount) {
            emailDevicesCount.textContent = tr('serial.deviceCount', '{count} thiết bị', { count: deviceCount });
        }
        if (emailNextPrice) {
            emailNextPrice.textContent = priceInfo.priceText;
        }

        // 2. Thẻ giá gói VIP
        if (planPriceVal) {
            planPriceVal.textContent = priceInfo.priceText;
        }

        // 3. Highlight Tier Pills ở mục gói bản quyền
        if (pillBase && pill15) {
            pillBase.classList.remove('current-active');
            pill15.classList.remove('current-active');
            if (pill30) pill30.classList.remove('current-active');

            if (priceInfo.tierKey === 'tier30' && pill30) {
                pill30.classList.add('current-active');
            } else if (priceInfo.tierKey === 'tier15') {
                pill15.classList.add('current-active');
            } else {
                pillBase.classList.add('current-active');
            }
        }

        // 4. Mức Ủng Hộ Áp Dụng ở khung thanh toán & RadioList
        if (radioVndPriceEl) {
            radioVndPriceEl.textContent = priceInfo.priceText;
        }
        if (currentPaymentMethod === 'crypto_intl') {
            setAmountWithPulse(currentIntlSub === 'paypal' ? '5 USD' : '5 USDT');
            if (paymentTierPill) {
                paymentTierPill.textContent = tr('serial.payIntlTag', 'Only 5$ • Giá cố định');
                paymentTierPill.className = 'tier-pill tier-intl-fixed current-active';
            }
            if (paymentTierHint) {
                paymentTierHint.style.display = 'none';
            }
        } else {
            setAmountWithPulse(priceInfo.priceText);
            if (paymentTierPill) {
                paymentTierPill.textContent = priceInfo.tierLabel;
                paymentTierPill.className = `tier-pill ${priceInfo.tierKey === 'base' ? 'tier-base' : (priceInfo.tierKey === 'tier30' ? 'tier-30' : 'tier-15')} current-active`;
            }
            if (paymentTierHint) {
                paymentTierHint.style.display = '';
            }
        }

        // 5. Badge ưu đãi dưới ô email (nếu có)
        if (priceInfo.badge) {
            if (emailPriceBadge) {
                emailPriceBadge.textContent = priceInfo.badge;
                emailPriceBadge.style.display = 'inline-flex';
                emailPriceBadge.style.background = `${priceInfo.badgeColor}15`;
                emailPriceBadge.style.color = priceInfo.badgeColor;
                emailPriceBadge.style.border = `1px solid ${priceInfo.badgeColor}40`;
            }
            if (emailPriceCard) {
                emailPriceCard.style.background = `linear-gradient(135deg, ${priceInfo.badgeColor}08 0%, ${priceInfo.badgeColor}15 100%)`;
                emailPriceCard.style.border = `1px solid ${priceInfo.badgeColor}25`;
            }
        } else {
            if (emailPriceBadge) emailPriceBadge.style.display = 'none';
            if (emailPriceCard) {
                emailPriceCard.style.background = '';
                emailPriceCard.style.border = '';
            }
        }

        // 6. Cập nhật mã QR thanh toán với số tiền mới (chỉ với MBBank)
        if (currentPaymentMethod === 'mbbank') {
            const currentSerial = serialInput ? sanitizeSerial(serialInput.value) : '';
            updatePaymentQr(priceInfo.price, currentSerial);
        }
    }

    async function checkEmailAndUpdatePrice(email) {
        if (!EMAIL_REGEX.test(email)) return;

        // Hiển thị trạng thái đang kiểm tra
        if (emailCheckLoader) emailCheckLoader.style.display = 'flex';
        if (emailStateMsg) emailStateMsg.style.display = 'none';
        if (emailRegStats) emailRegStats.style.display = 'none';

        // 1. Lấy số lượng từ cache cục bộ trước (phản hồi nhanh)
        let deviceCount = getDeviceCountForEmail(email);

        // 2. Tra cứu số lượng thiết bị thời gian thực từ MySQL Database
        try {
            const apiRes = await fetch(`./api/serial-lookup.php?email=${encodeURIComponent(email)}`, { cache: 'no-store' });
            if (apiRes.ok) {
                const apiJson = await apiRes.json();
                if (apiJson && apiJson.success && typeof apiJson.count === 'number') {
                    deviceCount = apiJson.count;
                    saveEmailRegistration(email, deviceCount);
                }
            }
        } catch (fetchErr) {
            console.warn('Lỗi kết nối API tra cứu số thiết bị của email:', fetchErr);
        }

        // Tính mức ủng hộ áp dụng tương ứng
        const priceInfo = calculatePrice(deviceCount);

        // Ẩn loader
        if (emailCheckLoader) emailCheckLoader.style.display = 'none';

        // Hiển thị thông báo email hợp lệ
        if (emailStateMsg) {
            emailStateMsg.style.display = 'flex';
            emailStateMsg.classList.add('valid');
            emailStateMsg.classList.remove('invalid');
        }
        if (emailStateText) {
            emailStateText.textContent = tr('serial.emailValid', '✓ Email hợp lệ');
        }

        // Hiển thị thông tin thống kê số thiết bị và giá
        if (emailRegStats) emailRegStats.style.display = 'grid';

        // Áp dụng giá vào toàn bộ giao diện
        applyPriceUI(priceInfo, deviceCount);
    }

    function handleEmailInput() {
        if (!senderEmailInput) return;
        const email = senderEmailInput.value.trim();

        if (emailCheckTimeout) {
            clearTimeout(emailCheckTimeout);
        }

        if (!email) {
            // Rỗng: reset về mặc định 50k
            if (emailStateMsg) {
                emailStateMsg.style.display = 'none';
                emailStateMsg.classList.remove('valid', 'invalid');
            }
            if (emailRegStats) emailRegStats.style.display = 'none';
            if (emailCheckLoader) emailCheckLoader.style.display = 'none';

            applyPriceUI(calculatePrice(0), 0);
            updatePaymentSyntax();
            return false;
        }

        if (!EMAIL_REGEX.test(email)) {
            // Định dạng sai
            if (emailStateMsg) {
                emailStateMsg.style.display = 'flex';
                emailStateMsg.classList.add('invalid');
                emailStateMsg.classList.remove('valid');
            }
            if (emailStateText) {
                emailStateText.textContent = tr('serial.emailInvalid', '⚠️ Email chưa đúng định dạng (VD: ten@gmail.com)');
            }
            if (emailRegStats) emailRegStats.style.display = 'none';
            if (emailCheckLoader) emailCheckLoader.style.display = 'none';
            updatePaymentSyntax();
            return false;
        }

        // Định dạng đúng: debounce kiểm tra sau 500ms
        emailCheckTimeout = setTimeout(() => {
            checkEmailAndUpdatePrice(email);
        }, 500);
        
        updatePaymentSyntax();

        return true;
    }

    if (senderEmailInput) {
        senderEmailInput.addEventListener('input', handleEmailInput);
        senderEmailInput.addEventListener('blur', () => {
            const email = senderEmailInput.value.trim();
            if (email && EMAIL_REGEX.test(email)) {
                if (emailCheckTimeout) clearTimeout(emailCheckTimeout);
                checkEmailAndUpdatePrice(email);
            }
        });
    }

    // =========================================================
    // =========================================================
    // QR ACCOUNT ROTATION (Xoay vòng QR sau mỗi 5 lần CK)
    // Đồng bộ thời gian thực qua Server Database (MySQL)
    // =========================================================
    async function syncQrStateFromServer() {
        try {
            const res = await fetch('./api/qr-active.php', { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            if (data && data.success && typeof data.index === 'number') {
                currentQrIndex = data.index % qrAccounts.length;
                qrPaymentCount = data.count || 0;

                try {
                    sessionStorage.setItem('qr_current_index', currentQrIndex);
                    sessionStorage.setItem('qr_payment_count', qrPaymentCount);
                } catch (_) {}

                const activeQr = qrAccounts[currentQrIndex];
                console.log(`✅ [Server Sync] MBBank QR: ${activeQr.name} - ${activeQr.acc} (${qrPaymentCount}/${QR_ROTATE_THRESHOLD})`);

                updateBankInfoDisplay();
                updatePaymentQr(currentCalculatedPrice, serialInput ? sanitizeSerial(serialInput.value) : '');
            }
        } catch (err) {
            console.warn('Không thể đồng bộ QR từ server, dùng cache phiên hiện tại:', err);
        }
    }

    function rotateQrAccount() {
        // Bộ đếm xoay vòng QR được cập nhật phía server bởi SePay webhook sau mỗi giao dịch hợp lệ.
        // Client chỉ cần đồng bộ lại trạng thái mới nhất từ server.
        syncQrStateFromServer();
    }
    
    // Khôi phục trạng thái QR trong phiên hiện tại (sessionStorage) và đồng bộ ngay với server
    function restoreQrState() {
        let savedIndex = null;
        let savedCount = null;
        try {
            savedIndex = sessionStorage.getItem('qr_current_index');
            savedCount = sessionStorage.getItem('qr_payment_count');
        } catch (_) {}
        
        if (savedIndex !== null) {
            currentQrIndex = parseInt(savedIndex, 10) || 0;
        }
        if (savedCount !== null) {
            qrPaymentCount = parseInt(savedCount, 10) || 0;
        }
        
        // Cập nhật hiển thị giao diện và ảnh QR khớp nhau ngay lập tức
        updateBankInfoDisplay();
        updatePaymentQr(currentCalculatedPrice, serialInput ? sanitizeSerial(serialInput.value) : '');

        // Kéo dữ liệu mới nhất từ server DB
        syncQrStateFromServer();
    }
    
    function updateBankInfoDisplay() {
        const currentQr = qrAccounts[currentQrIndex] || qrAccounts[0];
        const bankNameText = document.getElementById('bank-name-val');
        const bankOwnerText = document.getElementById('bank-owner-val');
        const bankAccText = document.getElementById('bank-acc-val');
        const btnCopyOwner = document.getElementById('btn-copy-owner');
        const btnCopyAcc = document.getElementById('btn-copy-acc');
        
        if (bankNameText) bankNameText.textContent = tr('serial.bankNameVal', 'MBBank (Ngân hàng TMCP Quân Đội)');
        if (bankOwnerText) bankOwnerText.textContent = currentQr.name;
        if (bankAccText) bankAccText.textContent = currentQr.acc;
        
        // Cập nhật data-copy attribute cho buttons
        if (btnCopyOwner) btnCopyOwner.setAttribute('data-copy', currentQr.name);
        if (btnCopyAcc) btnCopyAcc.setAttribute('data-copy', currentQr.acc);

        // Cập nhật thẻ alt của ảnh QR
        if (paymentQrImg) {
            paymentQrImg.alt = tr('serial.qrAlt', 'QR thanh toán - MBBank - {acc} - {name}', { acc: currentQr.acc, name: currentQr.name });
        }

        if (lastModalSyntax && successDialog && successDialog.open) {
            syncModalPaymentView();
        }
    }

    // =========================================================
    // 10. SUBMIT FORM ĐĂNG KÝ
    // =========================================================
    if (regForm) {
        regForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const serial = serialInput ? sanitizeSerial(serialInput.value) : '';
            const code = codenameInput ? codenameInput.value.trim().toLowerCase() : '';
            const plan = (regTypeValue ? regTypeValue.value : '') || 'Đăng kí có Ủng hộ (Vĩnh viễn)';
            const emailRaw = senderEmailInput ? senderEmailInput.value.trim() : '';
            const email = emailRaw ? emailRaw.toLowerCase() : '';

            if (!serial || serial.length < 4) {
                showToast(tr('serial.errSnShort', '⚠️ Vui lòng nhập số Serial hợp lệ (tối thiểu 4 ký tự)'));
                if (serialInput) serialInput.focus();
                return;
            }

            if (!code) {
                showToast(tr('serial.errCodenameEmpty', '⚠️ Vui lòng nhập mã thiết bị (codename)'));
                if (codenameInput) codenameInput.focus();
                return;
            }

            if (!email) {
                showToast(tr('serial.errEmailEmpty', '⚠️ Vui lòng nhập Email liên hệ.'));
                if (senderEmailInput) senderEmailInput.focus();
                return;
            }

            if (!EMAIL_REGEX.test(email)) {
                showToast(tr('serial.errEmailInvalid', '⚠️ Email chưa đúng định dạng. Vui lòng kiểm tra lại.'));
                if (senderEmailInput) senderEmailInput.focus();
                return;
            }

            const senderNameVal = document.getElementById('sender-name-input')?.value.trim() || '';
            const transCodeVal = document.getElementById('transaction-input')?.value.trim() || '';
            const methodVal = paymentMethodVal ? paymentMethodVal.value : 'Chuyển Khoản VietQR (24/7)';

            const isCryptoIntl = currentPaymentMethod === 'crypto_intl';
            const chosenRecipient = isCryptoIntl ? qrAccounts[0] : (qrAccounts[currentQrIndex] || qrAccounts[0]);
            const payload = {
                serial: serial,
                codename: code,
                plan: plan,
                senderEmail: email,
                paymentMethod: methodVal,
                senderName: senderNameVal,
                transactionCode: transCodeVal,
                recipientAcc: chosenRecipient.acc,
                recipientName: chosenRecipient.name,
                amount: isCryptoIntl ? '5$' : currentCalculatedPrice,
                timestamp: new Date().toISOString()
            };

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin">
                        <circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="10"></circle>
                    </svg>
                    <span id="btn-submit-text">${tr('serial.submitSending', 'Đang gửi Serial lên hệ thống để xác nhận...')}</span>
                `;
            }

            // 1. Gửi dữ liệu lưu trực tiếp vào MySQL Database qua PHP API
            let regResult = null;
            try {
                const res = await fetch('./api/serial-register.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                regResult = await res.json();
            } catch (phpErr) {
                console.warn('Lỗi khi gửi PHP API serial-register:', phpErr);
            }

            if (regResult && regResult.success === false) {
                showToast(`❌ ${regResult.message || tr('serial.errRegFailed', 'Đăng ký không thành công')}`);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" aria-hidden="true">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <span id="btn-submit-text">${tr('serial.submitBtn', 'Xác Nhận & Lấy Mã QR Thanh Toán')}</span>
                    `;
                }
                return;
            }

            // 2. Gửi dữ liệu lên Google Apps Script Web App API (dự phòng)
            if (REGISTER_API_URL && REGISTER_API_URL.trim() !== '') {
                try {
                    await fetch(REGISTER_API_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } catch (netErr) {
                    console.warn('Lỗi khi gửi Google Apps Script:', netErr);
                }
            }


            // Cập nhật lại QR theo đúng serial và giá
            updatePaymentQr(currentCalculatedPrice, serial);

            // Hiển thị phần QR thanh toán sau khi đã lưu Serial thành công
            const paymentWrapper = document.getElementById('reg-center-payment-wrapper');
            if (paymentWrapper) {
                paymentWrapper.style.display = 'block';
                setTimeout(() => {
                    paymentWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 150);
            }

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span id="btn-submit-text">${tr('serial.qrInlineReady', 'Đã lưu Serial — Quét mã QR để kích hoạt')}</span>
                `;
            }

            // Điền thông tin modal (Concept 1A — Split Checkout Ngang)
            if (modalSerial) modalSerial.textContent = serial;
            if (modalCodename) {
                if (devicesMap[code]) {
                    const dev = devicesMap[code];
                    const lang = (typeof I18n !== 'undefined' && I18n.currentLang === 'vi') ? 'vi' : 'en';
                    const devName = (dev.name && (dev.name[lang] || dev.name.en || dev.name.vi)) || code;
                    modalCodename.textContent = `${devName} (${code})`;
                } else {
                    modalCodename.textContent = code;
                }
            }
            if (modalPlan) modalPlan.textContent = tr('serial.summaryPlanVal', 'Vĩnh viễn (1 SN / máy)');
            if (modalEmailVal) modalEmailVal.textContent = email;

            // Luôn tạo nội dung chuyển khoản đầy đủ
            const cleanCode = (code || '').trim();
            const cleanSerial = (serial || '').trim();
            const cleanEmail = (email || '').trim().replace(/[@.]/g, '');

            let fullSyntax = 'UR';
            if (cleanCode) fullSyntax += ' ' + cleanCode;
            if (cleanSerial) fullSyntax += ' ' + cleanSerial;
            if (cleanEmail) fullSyntax += ' ' + cleanEmail;

            saveSerialRecipient(serial, chosenRecipient);
            lastModalSyntax = fullSyntax;
            lastModalPriceInfo = calculatePrice(getDeviceCountForEmail(email));
            syncModalPaymentView();

            if (regResult && regResult.data && regResult.data.emailSent === false) {
                showToast(tr('serial.toastSavedNoMail', '⚠️ Đã lưu Serial, chưa gửi được email xác nhận!'));
            } else {
                showToast(tr('serial.toastSavedScanQr', '✅ Đã lưu Serial! Hãy quét mã QR để kích hoạt.'));
            }

            // Nút "Kiểm tra trạng thái" trong dialog -> chuyển tab Tra Cứu
            if (modalLookupLink) {
                modalLookupLink.onclick = function (ev) {
                    ev.preventDefault();
                    if (successDialog && typeof successDialog.close === 'function') successDialog.close();
                    activateTab('lookup', true);
                    setTimeout(function () {
                        if (lookupSerialInput) {
                            lookupSerialInput.value = serial;
                            updateLookupCounter();
                            performLookup(serial);
                        }
                    }, 100);
                };
            }

            if (successDialog && typeof successDialog.showModal === 'function') {
                successDialog.showModal();
            } else {
                alert(tr('serial.alertSubmitted', 'Đã gửi số Serial {sn} lên hệ thống thành công! Bạn có thể chuyển sang tab Tra Cứu để kiểm tra trạng thái kích hoạt.', { sn: serial }));
            }
        });
    }

    function syncModalPaymentView() {
        if (!modalQrBox) return;
        modalQrBox.style.display = '';

        if (modalTitleEl) modalTitleEl.textContent = tr('serial.modalPaidTitle', 'Quét Mã QR Để Kích Hoạt!');
        const snVal = modalSerial ? modalSerial.textContent.trim() : '';
        if (modalDesc && snVal && snVal !== '---') {
            modalDesc.innerHTML = tr('serial.modalPaidDesc', 'Đã lưu Serial <strong>{sn}</strong> lên máy chủ. Vui lòng quét mã VietQR bên dưới bằng app ngân hàng để hoàn tất kích hoạt:', { sn: escapeHtml(snVal) });
        }
        if (modalQrSyntax) modalQrSyntax.textContent = lastModalSyntax || 'UR ...';

        if (currentPaymentMethod === 'crypto_intl') {
            if (modalIntlSwitcher) modalIntlSwitcher.style.display = 'flex';
            if (modalSubBinance) modalSubBinance.classList.toggle('active', currentIntlSub === 'binance');
            if (modalSubPaypal) modalSubPaypal.classList.toggle('active', currentIntlSub === 'paypal');
            if (modalBankGroup) modalBankGroup.style.display = 'none';

            if (currentIntlSub === 'paypal') {
                if (modalQrImg) {
                    modalQrImg.src = 'images/QR_PAYPAL_DNT_HYPERUR.jpg';
                    modalQrImg.alt = 'PayPal QR - 5 USD';
                }
                if (modalQrBadgeText) modalQrBadgeText.textContent = 'PayPal (5 USD)';
                if (modalQrFooterText) modalQrFooterText.textContent = 'PayPal International';
                if (modalAmountVal) modalAmountVal.textContent = '5 USD';
                if (modalBinanceGroup) modalBinanceGroup.style.display = 'none';
                if (modalPaypalGroup) modalPaypalGroup.style.display = 'flex';
            } else {
                if (modalQrImg) {
                    modalQrImg.src = 'images/QR_BINANCE_DNT_HYPERUR.jpg';
                    modalQrImg.alt = 'Binance Pay QR - 5 USDT';
                }
                if (modalQrBadgeText) modalQrBadgeText.textContent = 'Binance Pay (5 USDT)';
                if (modalQrFooterText) modalQrFooterText.textContent = 'Binance Pay · Zero Fee';
                if (modalAmountVal) modalAmountVal.textContent = '5 USDT';
                if (modalBinanceGroup) modalBinanceGroup.style.display = 'flex';
                if (modalPaypalGroup) modalPaypalGroup.style.display = 'none';
            }

            if (modalTierTag) modalTierTag.textContent = tr('serial.payIntlTag', 'Only 5$ • Giá cố định');
            if (modalQrHintText) modalQrHintText.textContent = tr('serial.modalIntlHint', 'Gửi đúng $5 kèm ghi chú cú pháp để kích hoạt bản quyền vĩnh viễn.');
        } else {
            if (modalIntlSwitcher) modalIntlSwitcher.style.display = 'none';
            if (modalBinanceGroup) modalBinanceGroup.style.display = 'none';
            if (modalPaypalGroup) modalPaypalGroup.style.display = 'none';
            if (modalBankGroup) modalBankGroup.style.display = 'flex';

            const activeQr = qrAccounts[currentQrIndex] || qrAccounts[0];
            const email = senderEmailInput ? senderEmailInput.value.trim() : '';
            const priceInfo = lastModalPriceInfo || calculatePrice(getDeviceCountForEmail(email));
            const syntaxVal = lastModalSyntax || 'UR';
            const qrUrl = `${activeQr.url}&amount=${priceInfo.price || 50000}&des=${encodeURIComponent(syntaxVal)}`;

            if (modalQrImg) {
                modalQrImg.src = qrUrl;
                modalQrImg.alt = tr('serial.qrAlt', 'QR thanh toán - MBBank - {acc} - {name}', { acc: activeQr.acc, name: activeQr.name });
            }
            if (paymentQrImg && lastModalSyntax) paymentQrImg.src = qrUrl;
            if (modalQrBadgeText) modalQrBadgeText.textContent = 'MBBank VietQR 24/7';
            if (modalQrFooterText) modalQrFooterText.textContent = 'SePay · napas 247 · MB';
            if (modalAmountVal) modalAmountVal.textContent = priceInfo.priceText || formatCurrency(currentCalculatedPrice);
            if (modalTierTag) modalTierTag.textContent = priceInfo.tierLabel;
            if (modalQrAccVal) modalQrAccVal.textContent = activeQr.acc;
            if (modalQrOwnerVal) modalQrOwnerVal.textContent = activeQr.name;
            if (modalBtnCopyAcc) modalBtnCopyAcc.setAttribute('data-copy', activeQr.acc);
            if (modalBtnCopyOwner) modalBtnCopyOwner.setAttribute('data-copy', activeQr.name);
            if (modalQrHintText) modalQrHintText.textContent = tr('serial.modalQrHintClean', 'Chuyển đúng cú pháp để hệ thống SePay tự động duyệt trong ~10 giây.');
        }
    }

    if (modalBtnCopySyntax) {
        modalBtnCopySyntax.addEventListener('click', function () {
            const text = lastModalSyntax || (modalQrSyntax ? modalQrSyntax.textContent.trim() : '');
            if (!text) return;
            copyTextToClipboard(text).then(() => {
                markCopyBtnCopied(this, tr('serial.toastCopiedSyntax', 'Đã sao chép cú pháp: {text}', { text }));
            }).catch(() => {});
        });
    }

    if (modalSubBinance) {
        modalSubBinance.addEventListener('click', function () {
            selectIntlSub('binance');
            syncModalPaymentView();
        });
    }

    if (modalSubPaypal) {
        modalSubPaypal.addEventListener('click', function () {
            selectIntlSub('paypal');
            syncModalPaymentView();
        });
    }

    if (modalQrFrame) {
        modalQrFrame.addEventListener('click', function () {
            if (modalQrImg) openQrLightbox(modalQrImg.src);
        });
        modalQrFrame.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (modalQrImg) openQrLightbox(modalQrImg.src);
            }
        });
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', function () {
            if (successDialog) successDialog.close();
        });
    }

    if (modalCloseX) {
        modalCloseX.addEventListener('click', function () {
            if (successDialog) successDialog.close();
        });
    }

    if (successDialog) {
        successDialog.addEventListener('click', function (e) {
            if (e.target === successDialog) {
                successDialog.close();
            }
        });
    }

    // =========================================================
    // 11. TRA CỨU SERIAL HOẶC EMAIL LOGIC (LOOKUP)
    // =========================================================
    function cleanLookupInput(val) {
        if (!val) return '';
        let s = val.trim();
        if (s.includes('@')) {
            // Email: giữ lại các ký tự hợp lệ của email
            return s.replace(/[^A-Za-z0-9._%+\-@]/g, '');
        }
        // Serial: bỏ tiền tố SN/NO và ký tự đặc biệt
        s = s.replace(/^(SN|SERIAL|S\/N|S\/NO|NO)[\s:=-]*/i, '');
        return s.replace(/[^A-Za-z0-9_-]/g, '');
    }

    function cleanSerialString(val, toUpper = false) {
        return cleanLookupInput(val);
    }

    function updateLookupCounter() {
        if (!lookupSerialInput || !lookupClearBtn) return;
        const len = lookupSerialInput.value.length;
        lookupClearBtn.style.display = len > 0 ? 'flex' : 'none';
    }

    if (lookupSerialInput) {
        lookupSerialInput.addEventListener('input', function () {
            const cleaned = cleanLookupInput(this.value);
            if (this.value !== cleaned) {
                this.value = cleaned;
            }
            updateLookupCounter();
        });
    }

    if (lookupClearBtn) {
        lookupClearBtn.addEventListener('click', function () {
            if (lookupSerialInput) {
                lookupSerialInput.value = '';
                updateLookupCounter();
                lookupSerialInput.focus();
            }
        });
    }


    async function performLookup(rawInput) {
        const query = cleanLookupInput(rawInput);
        if (!query) {
            alert(tr('serial.alertEmptyLookup', 'Vui lòng nhập số Serial hoặc Email cần tra cứu!'));
            if (lookupSerialInput) lookupSerialInput.focus();
            return;
        }

        const isEmail = query.includes('@');
        const displayQuery = isEmail ? query.toLowerCase() : query;

        if (lookupSubmitBtn) {
            lookupSubmitBtn.disabled = true;
            lookupSubmitBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin">
                    <circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="10"></circle>
                </svg>
                <span>${tr('serial.lookupLoadingBtn', 'Đang Tra Cứu...')}</span>
            `;
        }

        if (lookupResultContainer) {
            lookupResultContainer.innerHTML = `
                <div class="lookup-empty-state sr-empty-state">
                    <div class="lookup-empty-icon sr-empty-icon" aria-hidden="true">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="spin">
                            <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                            <path d="M12 2 A10 10 0 0 1 22 12" stroke-linecap="round"></path>
                        </svg>
                    </div>
                    <h3 class="lookup-empty-title">${escapeHtml(tr('serial.lookupConnecting', 'Đang Kết Nối Máy Chủ Xác Thực...'))}</h3>
                    <p class="lookup-empty-desc">${tr('serial.lookupChecking', 'Đang đối soát <strong>{query}</strong> với cơ sở dữ liệu bản quyền HyperUR thời gian thực.', { query: escapeHtml(displayQuery) })}</p>
                </div>
            `;
        }

        let resultData = null;

        // 1. Ưu tiên tra cứu trực tiếp từ MySQL Database qua PHP API
        try {
            const param = isEmail ? `email=${encodeURIComponent(displayQuery)}` : `serial=${encodeURIComponent(displayQuery)}`;
            const phpRes = await fetch(`./api/serial-lookup.php?${param}`, { cache: 'no-store' });
            if (phpRes.ok) {
                const phpJson = await phpRes.json();
                if (phpJson && phpJson.success) {
                    resultData = phpJson;
                }
            }
        } catch (phpErr) {
            console.warn('Lỗi kết nối PHP API serial-lookup:', phpErr);
        }

        // 2. Dự phòng: chỉ khi MySQL API lỗi mạng/không phản hồi, thử qua Google Apps Script
        if (!resultData && !isEmail && LOOKUP_API_URL && LOOKUP_API_URL.trim() !== '') {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const fetchUrl = LOOKUP_API_URL + (LOOKUP_API_URL.includes('?') ? '&' : '?')
                    + 'action=check_serial&serial=' + encodeURIComponent(displayQuery)
                    + '&_t=' + Date.now();

                const res = await fetch(fetchUrl, {
                    signal: controller.signal,
                    cache: 'no-store'
                });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const apiJson = await res.json();
                    if (apiJson && (apiJson.found !== undefined || apiJson.success !== undefined)) {
                        resultData = apiJson;
                    }
                }
            } catch (netErr) {
                console.warn('Lỗi kết nối API Google Apps Script:', netErr);
            }
        }

        if (!resultData || !resultData.found) {
            resultData = {
                success: true,
                found: false,
                query: displayQuery,
                isEmail: isEmail,
                message: isEmail
                    ? tr('serial.notFoundEmailMsg', 'Không tìm thấy thiết bị nào gắn với email {query}.', { query: displayQuery })
                    : tr('serial.notFoundSnMsg', 'Không tìm thấy số Serial {query} trong cơ sở dữ liệu bản quyền HyperUR.', { query: displayQuery })
            };
        }

        if (lookupSubmitBtn) {
            lookupSubmitBtn.disabled = false;
            lookupSubmitBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <span data-i18n="serial.lookupBtn">${tr('serial.lookupBtn', 'Tra Cứu Ngay')}</span>
            `;
        }

        lastLookupResult = resultData;
        lastLookupQuery = displayQuery;
        renderLookupResultCard(resultData, displayQuery);
        saveToLookupHistory(displayQuery, resultData);
    }

    function renderLookupResultCard(res, query) {
        if (!lookupResultContainer) return;

        const bindJumpRegister = () => {
            lookupResultContainer.querySelectorAll('[data-jump-to-register]').forEach(jumpBtn => {
                jumpBtn.addEventListener('click', function () {
                    const val = decodeURIComponent(this.getAttribute('data-jump-to-register') || '');
                    const isEmailJump = this.getAttribute('data-jump-is-email') === '1';
                    activateTab('register', true);
                    setTimeout(function () {
                        if (isEmailJump) {
                            if (senderEmailInput) {
                                senderEmailInput.value = val;
                                handleEmailInput();
                                senderEmailInput.focus();
                            }
                        } else if (serialInput) {
                            serialInput.value = val;
                            handleSerialInput();
                            serialInput.focus();
                        }
                    }, 100);
                });
            });
        };

        const bindCopyButtons = () => {
            lookupResultContainer.querySelectorAll('[data-copy-device-sn]').forEach(b => {
                b.addEventListener('click', function (e) {
                    e.preventDefault();
                    const sn = this.getAttribute('data-copy-device-sn');
                    if (sn) {
                        copyTextToClipboard(sn).then(() => {
                            markCopyBtnCopied(this, tr('serial.toastCopiedSn', 'Đã sao chép Serial: {sn}', { sn }));
                        }).catch(() => {});
                    }
                });
            });

            lookupResultContainer.querySelectorAll('[data-copy-syntax-btn]').forEach(btn => {
                btn.addEventListener('click', function () {
                    const text = this.getAttribute('data-copy-syntax-btn');
                    if (text) {
                        copyTextToClipboard(text).then(() => {
                            markCopyBtnCopied(this, tr('serial.toastCopiedSyntax', 'Đã sao chép cú pháp: {text}', { text }));
                        }).catch(() => {});
                    }
                });
            });

            lookupResultContainer.querySelectorAll('[data-copy]').forEach(btn => {
                btn.addEventListener('click', function () {
                    const text = this.getAttribute('data-copy');
                    if (text) {
                        copyTextToClipboard(text).then(() => {
                            markCopyBtnCopied(this, tr('serial.toastCopied', 'Đã sao chép: {text}', { text }));
                        }).catch(() => {});
                    }
                });
            });
        };

        const tgSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>';

        // Trường hợp 1: Tra cứu theo Email -> Hiển thị danh sách thiết bị (Concept 2A)
        if (res && res.type === 'email' && res.found) {
            const list = res.devices || [];
            const count = res.count || list.length;
            const email = res.email || query;
            const safeEmail = escapeHtml(email);
            const lang = (typeof I18n !== 'undefined' && I18n.currentLang === 'vi') ? 'vi' : 'en';

            const devicesHtml = list.map((item, idx) => {
                const isActive = (item.status === 'Active' || item.statusCode === 'active');
                const isExp = (item.status === 'Expired' || item.statusCode === 'expired');
                const statusBadgeCls = isActive ? 'is-active' : (isExp ? 'is-expired' : 'is-pending');
                const rawCode = String(item.codename || '').trim();
                const codeKey = rawCode.toLowerCase();
                const devEntry = devicesMap[codeKey];
                const devLabel = devEntry && devEntry.name
                    ? (devEntry.name[lang] || devEntry.name.en || devEntry.name.vi || rawCode)
                    : rawCode;
                const safeSn = escapeHtml(item.serial || '');
                const safeCode = escapeHtml(rawCode);
                const safeDevLabel = escapeHtml(devLabel || rawCode);
                const safePlan = escapeHtml(item.plan || item.time || '');
                const safeStatus = escapeHtml(item.statusText || item.status || '');

                return `
                    <div class="sr-res-device-row">
                        <div class="sr-res-device-main">
                            <div class="sr-res-device-head">
                                <span class="sr-res-device-name">${idx + 1}. ${safeDevLabel}</span>
                                ${safeCode && safeDevLabel.toLowerCase() !== safeCode.toLowerCase() ? `<span class="sr-res-device-code is-mono">${safeCode}</span>` : ''}
                            </div>
                            <div class="sr-res-device-sn is-mono">
                                <span>SN: <strong>${safeSn}</strong></span>
                                <button type="button" class="sr-copy-btn" data-copy-device-sn="${safeSn}" aria-label="${escapeHtml(tr('serial.copyShort', 'Chép'))} ${safeSn}">
                                    <span class="sr-copy-icon">${COPY_ICON_SVG}</span>
                                    <span class="sr-copy-label">${escapeHtml(tr('serial.copyShort', 'Chép'))}</span>
                                </button>
                            </div>
                        </div>
                        <div class="sr-res-device-meta">
                            ${safePlan ? `<span class="sr-res-device-plan">${safePlan}</span>` : ''}
                            <span class="sr-res-device-status ${statusBadgeCls}">${safeStatus}</span>
                        </div>
                    </div>
                `;
            }).join('');

            lookupResultContainer.innerHTML = `
                <article class="sr-res-card is-email">
                    <div class="sr-res-head">
                        <div class="sr-res-head-left">
                            <div class="sr-res-icon" aria-hidden="true">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <polyline points="22,6 12,13 2,6"></polyline>
                                </svg>
                            </div>
                            <div class="sr-res-title-area">
                                <h2 class="sr-res-title">${escapeHtml(tr('serial.lookupEmailTitle', 'Danh Sách Thiết Bị Của Email'))}</h2>
                                <div class="sr-res-id-row">
                                    <span class="sr-res-id is-mono">Email: ${safeEmail}</span>
                                    <button type="button" class="sr-copy-btn" data-copy="${safeEmail}" aria-label="${escapeHtml(tr('serial.copyShort', 'Chép'))} ${safeEmail}">
                                        <span class="sr-copy-icon">${COPY_ICON_SVG}</span>
                                        <span class="sr-copy-label">${escapeHtml(tr('serial.copyShort', 'Chép'))}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <span class="sr-res-badge">
                            <span class="sr-res-dot" aria-hidden="true"></span>
                            <span>${escapeHtml(tr('serial.lookupEmailActiveCount', 'Đã Kích Hoạt: {count} Máy', { count }))}</span>
                        </span>
                    </div>

                    <div class="sr-res-device-list">
                        ${devicesHtml}
                    </div>

                    <div class="sr-res-actions">
                        <a href="download.html" class="sr-btn-primary">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" aria-hidden="true">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>${escapeHtml(tr('serial.lookupGoDownload', 'Đến Kho Tải ROM'))}</span>
                        </a>
                        <a href="guide.html" class="sr-btn-ghost">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            <span>${escapeHtml(tr('serial.lookupGoGuide', 'Xem Hướng Dẫn Flash'))}</span>
                        </a>
                    </div>
                </article>
            `;

            bindCopyButtons();
            return;
        }

        // Trường hợp 2: Tra cứu theo Serial đơn (Concept 2A)
        if (res && res.found && res.data) {
            const d = res.data;
            const serial = d.serial || query;
            const safeSerial = escapeHtml(serial);
            const isActive = d.statusCode === 'active';
            const isPending = d.statusCode === 'pending';
            const isExpired = d.statusCode === 'expired';
            const stateClass = isActive ? 'is-active' : (isExpired ? 'is-expired' : 'is-pending');
            const dotClass = isPending ? 'sr-res-pulse-dot' : 'sr-res-dot';

            const statusTitle = isActive
                ? (d.statusText === 'Đang Hiệu Lực' ? tr('serial.statusValid', 'Bản Quyền Đang Hiệu Lực') : tr('serial.statusActivated', 'Bản Quyền Đã Kích Hoạt'))
                : (isExpired ? tr('serial.statusExpired', 'Bản Quyền Đã Hết Hạn') : tr('serial.statusPending', 'Đang Chờ Đối Soát & Kích Hoạt'));

            const codenameDisplay = d.codename ? d.codename.toUpperCase() : tr('serial.unknownCode', 'KHÔNG XÁC ĐỊNH');
            const deviceNameDisplay = d.deviceName ? d.deviceName : (d.codename ? tr('serial.devicePrefix', 'Thiết bị {code}', { code: d.codename }) : tr('serial.notUpdated', 'Chưa cập nhật'));

            const featuresListHtml = (d.features && d.features.length > 0)
                ? d.features.map(f => `
                    <li>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>${escapeHtml(f)}</span>
                    </li>
                `).join('')
                : '';

            const recordedAdmin = resolveAdminForLookup(d, serial);
            const tgVars = {
                sn: serial,
                code: d.codename || tr('serial.unknownValue', 'chưa rõ'),
                plan: d.plan || tr('serial.expiryLifetimeFallback', 'Vĩnh viễn')
            };

            // Khối thanh toán tự động hiển thị ngay khi tra cứu ra trạng thái Chờ Kích Hoạt
            let paymentSectionHtml = '';
            let currentQr = recordedAdmin || qrAccounts[currentQrIndex] || qrAccounts[0];
            if (isPending) {
                const email = d.senderEmail || '';
                const count = getDeviceCountForEmail(email);
                const priceInfo = calculatePrice(count);
                const price = priceInfo.price;
                const priceText = priceInfo.priceText;

                let syntaxParts = ['UR'];
                if (d.codename) syntaxParts.push(d.codename);
                syntaxParts.push(serial);
                if (email) syntaxParts.push(email);
                const transferSyntax = syntaxParts.join(' ');
                const safeSyntax = escapeHtml(transferSyntax);
                const qrUrl = `${currentQr.url}&amount=${price}&des=${encodeURIComponent(transferSyntax)}`;
                const safeQrUrl = escapeHtml(qrUrl);
                const safeQrName = escapeHtml(currentQr.name);
                const safeQrAcc = escapeHtml(currentQr.acc);

                paymentSectionHtml = `
                    <div class="sr-res-pay-box">
                        <div class="sr-res-pay-head">
                            <div>
                                <h3 class="sr-res-pay-title">${escapeHtml(tr('serial.pendingQrTitle', 'Quét Mã QR Để Hoàn Tất Thanh Toán & Kích Hoạt Tự Động'))}</h3>
                                <p class="sr-res-pay-sub">${escapeHtml(tr('serial.pendingQrShortSub', 'SePay đối soát nội dung và kích hoạt vĩnh viễn trong ~10 giây.'))}</p>
                            </div>
                            <span class="sr-res-pay-price is-mono">${escapeHtml(priceText)}</span>
                        </div>

                        <div class="sr-res-pay-grid">
                            <div class="sr-qr-wrap sr-res-pay-qr" role="button" tabindex="0" data-lookup-qr-zoom data-lookup-qr-src="${safeQrUrl}" aria-label="${escapeHtml(tr('serial.modalZoomHint', 'Nhấn ảnh QR để phóng to'))}">
                                <div class="sr-qr-badge">
                                    <span class="sr-qr-dot" aria-hidden="true"></span>
                                    <span>MBBank VietQR 24/7</span>
                                </div>
                                <img src="${safeQrUrl}" alt="${escapeHtml(tr('serial.qrAltSn', 'QR thanh toán {sn}', { sn: serial }))}" width="168" height="168" class="sr-qr-img" loading="lazy">
                                <span class="sr-qr-caption">${escapeHtml(tr('serial.modalZoomHint', 'Nhấn ảnh QR để phóng to'))}</span>
                            </div>

                            <div class="sr-res-pay-details">
                                <div class="sr-qr-row">
                                    <span class="sr-qr-row-lbl">${escapeHtml(tr('serial.modalAccShort', 'STK MBBank'))}</span>
                                    <span class="sr-qr-row-right">
                                        <strong class="sr-qr-row-val is-mono is-accent">${safeQrAcc}</strong>
                                        <button type="button" class="sr-copy-btn" data-copy="${safeQrAcc}" aria-label="${escapeHtml(tr('serial.copyShort', 'Chép'))} ${safeQrAcc}">
                                            <span class="sr-copy-icon">${COPY_ICON_SVG}</span>
                                            <span class="sr-copy-label">${escapeHtml(tr('serial.copyShort', 'Chép'))}</span>
                                        </button>
                                    </span>
                                </div>

                                <div class="sr-qr-row">
                                    <span class="sr-qr-row-lbl">${escapeHtml(tr('serial.bankOwnerLabel', 'Chủ Tài Khoản:'))}</span>
                                    <span class="sr-qr-row-right">
                                        <strong class="sr-qr-row-val">${safeQrName}</strong>
                                        <button type="button" class="sr-copy-btn" data-copy="${safeQrName}" aria-label="${escapeHtml(tr('serial.copyShort', 'Chép'))} ${safeQrName}">
                                            <span class="sr-copy-icon">${COPY_ICON_SVG}</span>
                                            <span class="sr-copy-label">${escapeHtml(tr('serial.copyShort', 'Chép'))}</span>
                                        </button>
                                    </span>
                                </div>

                                <div class="sr-syntax-box">
                                    <div class="sr-syntax-head">
                                        <span>${escapeHtml(tr('serial.syntaxLabel', 'Nội Dung Chuyển Khoản (Bắt buộc):'))}</span>
                                        <button type="button" class="sr-copy-btn sr-copy-accent" data-copy-syntax-btn="${safeSyntax}" aria-label="${escapeHtml(tr('serial.copySyntaxShort', 'Chép cú pháp'))}">
                                            <span class="sr-copy-icon">${COPY_ICON_SVG}</span>
                                            <span class="sr-copy-label">${escapeHtml(tr('serial.copySyntaxShort', 'Chép cú pháp'))}</span>
                                        </button>
                                    </div>
                                    <code class="sr-syntax-code is-mono">${safeSyntax}</code>
                                    <p class="sr-res-pay-warn">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                                        <span>${escapeHtml(tr('serial.pendingWarningClean', 'Cần ghi đúng nội dung này để SePay tự động kích hoạt vĩnh viễn.'))}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            const expiryValClass = isActive ? 'is-success' : (isExpired ? 'is-error' : 'is-warning');
            const perksBlockHtml = (isActive && featuresListHtml) ? `
                <div class="sr-res-perks">
                    <div class="sr-res-perks-title">${escapeHtml(tr('serial.perksTitle', 'Quyền Lợi Giấy Phép ROM HyperUR Đi Kèm:'))}</div>
                    <ul class="sr-res-perks-list">
                        ${featuresListHtml}
                    </ul>
                </div>
            ` : '';
            const expiredBlockHtml = isExpired ? `
                <p class="sr-res-expired-note">${escapeHtml(tr('serial.expiredRenewNote', 'Thời hạn sử dụng của mã Serial cũ này đã kết thúc. Bạn có thể đăng ký nâng cấp lên bản quyền Vĩnh viễn.'))}</p>
            ` : '';

            const supportLabel = isActive
                ? tr('serial.btnSupportActive', 'Hỗ Trợ Kỹ Thuật Admin')
                : (isExpired
                    ? tr('serial.btnSupportExpired', 'Nhắn Admin Gia Hạn')
                    : tr('serial.btnSupportPending', 'Nhắn Admin Kích Hoạt Nhanh'));
            const chevronSvg = '<svg class="sr-admin-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';
            const telegramBtnHtml = recordedAdmin
                ? `
                    <a href="${buildTelegramUrl(recordedAdmin, 'support', tgVars)}" target="_blank" rel="noopener noreferrer" class="sr-btn-ghost">
                        ${tgSvg}
                        <span>${escapeHtml(supportLabel)} (@${escapeHtml(recordedAdmin.telegram)})</span>
                    </a>
                `
                : `
                    <button type="button" class="sr-btn-ghost sr-admin-picker-trigger" aria-expanded="false" aria-controls="sr-admin-picker-panel">
                        ${tgSvg}
                        <span>${escapeHtml(supportLabel)}</span>
                        ${chevronSvg}
                    </button>
                `;
            const adminPickerHtml = recordedAdmin
                ? ''
                : renderAdminPickerHtml('support', tgVars, isPending ? currentQr.acc : null);

            let actionsHtml = '';
            if (isPending) {
                actionsHtml = `
                    <button type="button" class="sr-btn-primary" id="btn-recheck-payment">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" aria-hidden="true">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        <span>${escapeHtml(tr('serial.pendingRecheck', 'Đã Chuyển Khoản? Kiểm Tra Lại Ngay'))}</span>
                    </button>
                    ${telegramBtnHtml}
                `;
            } else if (isExpired) {
                actionsHtml = `
                    <button type="button" class="sr-btn-primary" data-jump-to-register="${encodeURIComponent(serial)}" data-jump-is-email="0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" aria-hidden="true">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="8.5" cy="7" r="4"></circle>
                            <line x1="20" y1="8" x2="20" y2="14"></line>
                            <line x1="23" y1="11" x2="17" y2="11"></line>
                        </svg>
                        <span>${escapeHtml(tr('serial.btnUpgradeLifetime', 'Đăng ký nâng cấp Vĩnh viễn'))}</span>
                    </button>
                    ${telegramBtnHtml}
                `;
            } else {
                actionsHtml = `
                    <a href="download.html" class="sr-btn-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" aria-hidden="true">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <span>${escapeHtml(tr('serial.lookupGoDownload', 'Đến Kho Tải ROM'))}</span>
                    </a>
                    <a href="guide.html" class="sr-btn-ghost">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>${escapeHtml(tr('serial.lookupGoGuide', 'Xem Hướng Dẫn Flash'))}</span>
                    </a>
                    ${telegramBtnHtml}
                `;
            }

            const iconSvg = isActive
                ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
                : (isExpired
                    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
                    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>');

            lookupResultContainer.innerHTML = `
                <article class="sr-res-card ${stateClass}">
                    <div class="sr-res-head">
                        <div class="sr-res-head-left">
                            <div class="sr-res-icon">${iconSvg}</div>
                            <div class="sr-res-title-area">
                                <h2 class="sr-res-title">${escapeHtml(statusTitle)}</h2>
                                <div class="sr-res-id-row">
                                    <span class="sr-res-id is-mono">SN: ${safeSerial}</span>
                                    <button type="button" class="sr-copy-btn" data-copy="${safeSerial}" aria-label="${escapeHtml(tr('serial.copyShort', 'Chép'))} ${safeSerial}">
                                        <span class="sr-copy-icon">${COPY_ICON_SVG}</span>
                                        <span class="sr-copy-label">${escapeHtml(tr('serial.copyShort', 'Chép'))}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <span class="sr-res-badge">
                            <span class="${dotClass}" aria-hidden="true"></span>
                            <span>${escapeHtml(d.statusText || tr('serial.statusFallback', 'Trạng Thái'))}</span>
                        </span>
                    </div>

                    <div class="sr-res-ledger">
                        <div class="sr-res-cell">
                            <span class="sr-res-cell-lbl">${escapeHtml(tr('serial.infoDevice', 'Thiết Bị / Mã Máy'))}</span>
                            <strong class="sr-res-cell-val">${escapeHtml(deviceNameDisplay)} (${escapeHtml(codenameDisplay)})</strong>
                        </div>
                        <div class="sr-res-cell">
                            <span class="sr-res-cell-lbl">${escapeHtml(tr('serial.infoPlan', 'Gói Bản Quyền'))}</span>
                            <strong class="sr-res-cell-val">${escapeHtml(d.plan || tr('serial.planLifetimeFallback', 'Vĩnh Viễn'))}</strong>
                        </div>
                        <div class="sr-res-cell">
                            <span class="sr-res-cell-lbl">${escapeHtml(tr('serial.infoDate', 'Ngày Đăng Ký / Cập Nhật'))}</span>
                            <strong class="sr-res-cell-val is-mono">${escapeHtml(d.registeredDate || '—')}</strong>
                        </div>
                        <div class="sr-res-cell">
                            <span class="sr-res-cell-lbl">${escapeHtml(tr('serial.infoExpiry', 'Thời Hạn Sử Dụng'))}</span>
                            <strong class="sr-res-cell-val is-mono ${expiryValClass}">${escapeHtml(d.expiredDate || tr('serial.expiryLifetimeFallback', 'Vĩnh viễn'))}</strong>
                        </div>
                    </div>

                    ${paymentSectionHtml}
                    ${perksBlockHtml}
                    ${expiredBlockHtml}

                    <div class="sr-res-actions">
                        ${actionsHtml}
                    </div>
                    ${adminPickerHtml}
                </article>
            `;

            const btnRecheck = lookupResultContainer.querySelector('#btn-recheck-payment');
            if (btnRecheck) {
                btnRecheck.addEventListener('click', function () {
                    performLookup(serial);
                });
            }

            lookupResultContainer.querySelectorAll('[data-lookup-qr-zoom]').forEach(qrEl => {
                const openPendingZoom = () => {
                    const src = qrEl.getAttribute('data-lookup-qr-src');
                    if (src) {
                        openQrLightbox(src, {
                            badge: 'VIETQR MBBANK 24/7',
                            title: tr('serial.lightboxTitle', 'MBBank VietQR Chính Thức'),
                            subtitle: tr('serial.lightboxSub', 'Quét mã bằng ứng dụng ngân hàng bất kỳ để tự động điền tiền và nội dung')
                        });
                    }
                };
                qrEl.addEventListener('click', openPendingZoom);
                qrEl.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openPendingZoom();
                    }
                });
            });

            lookupResultContainer.querySelectorAll('.sr-admin-picker-trigger').forEach(trig => {
                trig.addEventListener('click', function () {
                    const panel = lookupResultContainer.querySelector('#sr-admin-picker-panel');
                    if (!panel) return;
                    const nextOpen = !panel.classList.contains('is-open');
                    panel.classList.toggle('is-open', nextOpen);
                    this.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
                });
            });

            bindCopyButtons();
            bindJumpRegister();
        } else {
            const isEmail = String(query).includes('@');
            const safeQuery = escapeHtml(query);
            const recordedAdmin = !isEmail ? resolveAdminForLookup(null, query) : null;
            const nfVars = { query };
            const askLabel = tr('serial.btnAskAdmin', 'Hỏi Admin Qua Telegram');
            const chevronSvg = '<svg class="sr-admin-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';
            const askBtnHtml = recordedAdmin
                ? `
                    <a href="${buildTelegramUrl(recordedAdmin, 'notfound', nfVars)}" target="_blank" rel="noopener noreferrer" class="sr-btn-ghost">
                        ${tgSvg}
                        <span>${escapeHtml(askLabel)} (@${escapeHtml(recordedAdmin.telegram)})</span>
                    </a>
                `
                : `
                    <button type="button" class="sr-btn-ghost sr-admin-picker-trigger" aria-expanded="false" aria-controls="sr-admin-picker-panel">
                        ${tgSvg}
                        <span>${escapeHtml(askLabel)}</span>
                        ${chevronSvg}
                    </button>
                `;
            const nfPickerHtml = recordedAdmin
                ? ''
                : renderAdminPickerHtml('notfound', nfVars, null);
            const jumpBtnText = isEmail
                ? tr('serial.btnRegisterNewLicense', 'Đăng ký bản quyền mới')
                : tr('serial.btnRegisterThisSnShort', 'Đăng ký Serial {sn} ngay', { sn: safeQuery });

            lookupResultContainer.innerHTML = `
                <article class="sr-res-card is-not-found">
                    <div class="sr-res-head">
                        <div class="sr-res-head-left">
                            <div class="sr-res-icon" aria-hidden="true">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="15" y1="9" x2="9" y2="15"></line>
                                    <line x1="9" y1="9" x2="15" y2="15"></line>
                                </svg>
                            </div>
                            <div class="sr-res-title-area">
                                <h2 class="sr-res-title">${escapeHtml(isEmail ? tr('serial.notFoundEmailTitle', 'Chưa Tìm Thấy Thiết Bị Của Email') : tr('serial.notFoundSnTitle', 'Chưa Tìm Thấy Bản Quyền Serial'))}</h2>
                                <div class="sr-res-id-row">
                                    <span class="sr-res-id is-mono">${isEmail ? 'Email:' : 'SN:'} ${safeQuery}</span>
                                    <button type="button" class="sr-copy-btn" data-copy="${safeQuery}" aria-label="${escapeHtml(tr('serial.copyShort', 'Chép'))} ${safeQuery}">
                                        <span class="sr-copy-icon">${COPY_ICON_SVG}</span>
                                        <span class="sr-copy-label">${escapeHtml(tr('serial.copyShort', 'Chép'))}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <span class="sr-res-badge">
                            <span class="sr-res-dot" aria-hidden="true"></span>
                            <span>${escapeHtml(tr('serial.statusNotFound', 'Chưa Kích Hoạt'))}</span>
                        </span>
                    </div>

                    <p class="sr-res-desc">
                        ${isEmail
                            ? tr('serial.notFoundEmailDesc', 'Email <strong>{query}</strong> hiện chưa có thiết bị nào được ghi nhận trên hệ thống bản quyền chính thức HyperUR.', { query: safeQuery })
                            : tr('serial.notFoundSnDesc', 'Số Serial <strong>{query}</strong> hiện chưa có trên hệ thống bản quyền chính thức HyperUR hoặc vừa được chuyển khoản và đang trong quá trình ghi nhận.', { query: safeQuery })
                        }
                    </p>

                    <div class="sr-res-checks-box">
                        <div class="sr-res-checks-title">${escapeHtml(tr('serial.notFoundCheckTitle', 'Kiểm tra nhanh trước khi đăng ký'))}</div>
                        <ul class="sr-res-checks-list">
                            <li>
                                <span class="sr-res-checks-bullet" aria-hidden="true"></span>
                                <span>${escapeHtml(tr('serial.reason1Text', 'Bạn chưa gửi đơn đăng ký kích hoạt bản quyền'))}</span>
                            </li>
                            <li>
                                <span class="sr-res-checks-bullet" aria-hidden="true"></span>
                                <span>${escapeHtml(tr('serial.reason2Text', 'Nhập bị nhầm ký tự hoặc chưa đúng email lúc đăng ký'))}</span>
                            </li>
                        </ul>
                    </div>

                    <div class="sr-res-actions">
                        <button type="button" class="sr-btn-primary" data-jump-to-register="${encodeURIComponent(query)}" data-jump-is-email="${isEmail ? '1' : '0'}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" aria-hidden="true">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="8" x2="20" y2="14"></line>
                                <line x1="23" y1="11" x2="17" y2="11"></line>
                            </svg>
                            <span>${jumpBtnText}</span>
                        </button>
                        ${askBtnHtml}
                    </div>
                    ${nfPickerHtml}
                </article>
            `;

            lookupResultContainer.querySelectorAll('.sr-admin-picker-trigger').forEach(trig => {
                trig.addEventListener('click', function () {
                    const panel = lookupResultContainer.querySelector('#sr-admin-picker-panel');
                    if (!panel) return;
                    const nextOpen = !panel.classList.contains('is-open');
                    panel.classList.toggle('is-open', nextOpen);
                    this.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
                });
            });

            bindCopyButtons();
            bindJumpRegister();
        }

        lookupResultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function saveToLookupHistory(serial, result) {
        try {
            let history = [];
            const raw = sessionStorage.getItem(LOOKUP_HISTORY_KEY);
            if (raw) history = JSON.parse(raw);

            history = history.filter(h => h.serial !== serial);

            let status = tr('serial.histNotActive', 'Chưa kích hoạt');
            if (result && result.found) {
                if (result.type === 'email') {
                    const cnt = result.count || (Array.isArray(result.devices) ? result.devices.length : 0);
                    status = tr('serial.lookupEmailActiveCount', 'Đã Kích Hoạt: {count} Máy', { count: cnt });
                } else if (result.data) {
                    status = result.data.statusText || tr('serial.histFound', 'Đã tìm thấy');
                }
            }

            history.unshift({
                serial: serial,
                status: status,
                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN')
            });

            history = history.slice(0, 6);
            sessionStorage.setItem(LOOKUP_HISTORY_KEY, JSON.stringify(history));
            renderLookupHistory();
        } catch (e) { }
    }

    function renderLookupHistory() {
        if (!lookupHistoryWrapper || !lookupHistoryGrid) return;
        try {
            const raw = sessionStorage.getItem(LOOKUP_HISTORY_KEY);
            if (!raw) {
                lookupHistoryWrapper.style.display = 'none';
                return;
            }
            let list = JSON.parse(raw);
            if (!Array.isArray(list)) {
                lookupHistoryWrapper.style.display = 'none';
                return;
            }

            const filtered = list.filter(item => item && item.serial && !item.serial.startsWith('DEMO_') && item.serial !== '11111111');
            if (filtered.length !== list.length) {
                list = filtered;
                sessionStorage.setItem(LOOKUP_HISTORY_KEY, JSON.stringify(list));
            }

            if (list.length === 0) {
                lookupHistoryWrapper.style.display = 'none';
                return;
            }

            lookupHistoryWrapper.style.display = 'block';
            lookupHistoryGrid.innerHTML = list.map(item => `
                <div class="lookup-history-item" data-serial="${escapeHtml(item.serial)}" role="button" tabindex="0">
                    <div class="lookup-history-info">
                        <span class="lookup-hist-serial">${escapeHtml(item.serial)}</span>
                        <span class="lookup-hist-sub">${escapeHtml(item.status)} • ${escapeHtml(item.time)}</span>
                    </div>
                    <span class="lookup-hist-arrow" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </span>
                </div>
            `).join('');

            lookupHistoryGrid.querySelectorAll('.lookup-history-item').forEach(el => {
                const triggerHistoryLookup = () => {
                    const sn = el.getAttribute('data-serial');
                    if (sn && lookupSerialInput) {
                        lookupSerialInput.value = sn;
                        updateLookupCounter();
                        performLookup(sn);
                    }
                };
                el.addEventListener('click', triggerHistoryLookup);
                el.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        triggerHistoryLookup();
                    }
                });
            });
        } catch (e) { }
    }

    if (clearLookupHistoryBtn) {
        clearLookupHistoryBtn.addEventListener('click', function () {
            sessionStorage.removeItem(LOOKUP_HISTORY_KEY);
            renderLookupHistory();
        });
    }

    if (lookupForm) {
        lookupForm.addEventListener('submit', function (e) {
            e.preventDefault();
            if (lookupSerialInput) performLookup(lookupSerialInput.value);
        });
    }

    // =========================================================
    // 12. THEME TOGGLE & MOBILE MENU
    // =========================================================
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
        const savedTheme = localStorage.getItem('hyperur-theme') || 'dark';
        if (document.documentElement) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        }
        updateThemeIcons(savedTheme);

        themeBtn.addEventListener('click', () => {
            const current = (document.documentElement && document.documentElement.getAttribute('data-theme')) || 'dark';
            const next = current === 'dark' ? 'light' : 'dark';
            if (document.documentElement) {
                document.documentElement.setAttribute('data-theme', next);
            }
            localStorage.setItem('hyperur-theme', next);
            updateThemeIcons(next);
        });
    }

    function updateThemeIcons(theme) {
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

    const menuBtn = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('nav-menu');
    const backdrop = document.getElementById('mobile-nav-backdrop');
    if (menuBtn && navMenu && backdrop) {
        function closeMenu() {
            menuBtn.classList.remove('active');
            navMenu.classList.remove('is-open');
            backdrop.classList.remove('is-open');
            menuBtn.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }
        function openMenu() {
            menuBtn.classList.add('active');
            navMenu.classList.add('is-open');
            backdrop.classList.add('is-open');
            menuBtn.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
        }
        menuBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const isOpen = navMenu.classList.contains('is-open');
            isOpen ? closeMenu() : openMenu();
        });
        backdrop.addEventListener('click', closeMenu);
        document.querySelectorAll('#nav-menu .navbar-link, #nav-menu .mobile-nav-ext-link').forEach(link => {
            link.addEventListener('click', closeMenu);
        });
        if (typeof window.addEventListener === 'function') {
            window.addEventListener('resize', function () {
                if (window.innerWidth > 768) closeMenu();
            });
        }
    }

    // =========================================================
    // 12B. QR LIGHTBOX MODAL (NHẤN VÀO ẢNH ĐỂ PHÓNG TO)
    // =========================================================
    const qrLightboxModal = document.getElementById('qr-lightbox-modal');
    const qrLightboxImg = document.getElementById('qr-lightbox-img');
    const qrLightboxTitle = document.getElementById('qr-lightbox-title');
    const qrLightboxSubtitle = document.getElementById('qr-lightbox-subtitle');
    const qrLightboxBadge = document.getElementById('qr-lightbox-badge');
    const qrLightboxClose = document.getElementById('qr-lightbox-close');
    const qrLightboxBackdrop = document.getElementById('qr-lightbox-backdrop');

    function openQrLightbox(customSrc, customMeta) {
        if (!qrLightboxModal || !qrLightboxImg) return;
        const explicitSrc = (typeof customSrc === 'string' && customSrc.trim()) ? customSrc.trim() : '';
        const targetSrc = explicitSrc || (paymentQrImg ? paymentQrImg.src : '');
        if (!targetSrc) return;

        qrLightboxImg.src = targetSrc;

        if (customMeta && typeof customMeta === 'object') {
            if (qrLightboxBadge && customMeta.badge) qrLightboxBadge.textContent = customMeta.badge;
            if (qrLightboxTitle && customMeta.title) qrLightboxTitle.textContent = customMeta.title;
            if (qrLightboxSubtitle && customMeta.subtitle) qrLightboxSubtitle.textContent = customMeta.subtitle;
        } else if (currentPaymentMethod === 'crypto_intl') {
            if (currentIntlSub === 'paypal') {
                if (qrLightboxBadge) qrLightboxBadge.textContent = 'PAYPAL (5 USD)';
                if (qrLightboxTitle) qrLightboxTitle.textContent = tr('serial.lightboxPaypalTitle', '🅿️ PayPal QR Thanh Toán');
                if (qrLightboxSubtitle) qrLightboxSubtitle.textContent = tr('serial.lightboxPaypalSub', 'Quét mã QR bằng ứng dụng PayPal hoặc camera điện thoại');
            } else {
                if (qrLightboxBadge) qrLightboxBadge.textContent = 'BINANCE PAY (5 USDT)';
                if (qrLightboxTitle) qrLightboxTitle.textContent = tr('serial.lightboxBinanceTitle', '⚡ Binance Pay QR Thanh Toán');
                if (qrLightboxSubtitle) qrLightboxSubtitle.textContent = tr('serial.lightboxBinanceSub', 'Mở ứng dụng Binance và quét mã QR để gửi 5 USDT');
            }
        } else {
            if (qrLightboxBadge) qrLightboxBadge.textContent = 'VIETQR MBBANK 24/7';
            if (qrLightboxTitle) qrLightboxTitle.textContent = tr('serial.lightboxTitle', 'MBBank VietQR Chính Thức');
            if (qrLightboxSubtitle) qrLightboxSubtitle.textContent = tr('serial.lightboxSub', 'Quét mã bằng ứng dụng ngân hàng bất kỳ để tự động điền tiền và nội dung');
        }

        if (successDialog && successDialog.open && typeof successDialog.close === 'function') {
            reopenSuccessAfterLightbox = true;
            successDialog.close();
        }

        qrLightboxModal.classList.add('active');
        qrLightboxModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeQrLightbox() {
        if (!qrLightboxModal) return;
        qrLightboxModal.classList.remove('active');
        qrLightboxModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        if (reopenSuccessAfterLightbox) {
            reopenSuccessAfterLightbox = false;
            if (successDialog && !successDialog.open && typeof successDialog.showModal === 'function') {
                successDialog.showModal();
            }
        }
    }

    if (paymentQrImg) {
        paymentQrImg.addEventListener('click', function (e) {
            e.stopPropagation();
            openQrLightbox();
        });
    }
    const paymentQrWrap = document.getElementById('payment-qr-wrap');
    if (paymentQrWrap) {
        paymentQrWrap.addEventListener('click', function (e) {
            if (e.target.tagName !== 'BUTTON') {
                openQrLightbox();
            }
        });
        paymentQrWrap.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openQrLightbox();
            }
        });
    }

    if (qrLightboxClose) qrLightboxClose.addEventListener('click', closeQrLightbox);
    if (qrLightboxBackdrop) qrLightboxBackdrop.addEventListener('click', closeQrLightbox);
    if (qrLightboxModal) {
        qrLightboxModal.addEventListener('click', function (e) {
            if (e.target === qrLightboxModal || e.target === qrLightboxBackdrop) {
                closeQrLightbox();
            }
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && qrLightboxModal && qrLightboxModal.classList.contains('active')) {
            closeQrLightbox();
        }
    });

    // =========================================================
    // 13. KHỞI TẠO BAN ĐẦU
    // =========================================================
    async function init() {
        // Tải dữ liệu email đã đăng ký từ data / sessionStorage
        await loadEmailRegistrationsData();

        // Khôi phục trạng thái QR xoay vòng
        restoreQrState();

        // Khởi tạo hiển thị giá & tóm tắt ban đầu (mặc định 50k)
        applyPriceUI(calculatePrice(0), 0);
        updateSummaryDevice('');
        updateSummarySerial('');

        renderLookupHistory();

        // Kiểm tra URL query ?tab=lookup
        try {
            const initParams = new URLSearchParams(window.location.search);
            const initTab = initParams.get('tab');
            if (initTab === 'lookup') {
                activateTab('lookup', false);
            } else {
                activateTab('register', false);
            }
        } catch (e) {
            activateTab('register', false);
        }

        // Tự động tra cứu nếu URL có ?serial=XYZ
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const querySerial = urlParams.get('serial');
            if (querySerial && querySerial.trim() !== '') {
                activateTab('lookup', false);
                if (lookupSerialInput) {
                    lookupSerialInput.value = cleanSerialString(querySerial);
                    updateLookupCounter();
                    setTimeout(function () {
                        performLookup(querySerial);
                    }, 150);
                }
            }
        } catch (e) { }

        // Tự động điền Serial vào form Đăng Ký nếu URL có ?serial_prefill=XYZ
        try {
            const urlParams2 = new URLSearchParams(window.location.search);
            const prefillSerial = urlParams2.get('serial_prefill');
            if (prefillSerial && prefillSerial.trim() !== '') {
                activateTab('register', false);
                if (serialInput) {
                    serialInput.value = prefillSerial.trim();
                    handleSerialInput();
                }
            }
        } catch (e) { }

        // Tự động kiểm tra số lượng thiết bị từ DB nếu email đã có sẵn (autofill/F5)
        if (senderEmailInput && senderEmailInput.value.trim()) {
            handleEmailInput();
        }
    }

    // Nút chuyển đổi ngôn ngữ VI / EN & tự đồng bộ UI động khi đổi ngôn ngữ
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) {
        langBtn.addEventListener('click', function () {
            if (typeof I18n !== 'undefined') I18n.toggleLang();
        });
    }

    window.addEventListener('hyperur:langchange', function () {
        positionTabGlider(true);
        const email = senderEmailInput ? senderEmailInput.value.trim() : '';
        const count = getDeviceCountForEmail(email);
        applyPriceUI(calculatePrice(count), count);
        updateBankInfoDisplay();
        if (currentPaymentMethod === 'crypto_intl') {
            selectIntlSub(currentIntlSub || 'binance');
        } else if (paymentQrCaptionText) {
            paymentQrCaptionText.textContent = tr('serial.qrCaptionBank', 'Quét bằng mọi ứng dụng ngân hàng');
        }
        if (lastModalSyntax) {
            if (modalPlan) modalPlan.textContent = tr('serial.summaryPlanVal', 'Vĩnh viễn (1 SN / máy)');
            const modalCodeVal = codenameInput ? codenameInput.value.trim().toLowerCase() : '';
            if (modalCodename && modalCodeVal && devicesMap[modalCodeVal]) {
                const dev = devicesMap[modalCodeVal];
                const lang = (typeof I18n !== 'undefined' && I18n.currentLang === 'vi') ? 'vi' : 'en';
                const devName = (dev.name && (dev.name[lang] || dev.name.en || dev.name.vi)) || modalCodeVal;
                modalCodename.textContent = `${devName} (${modalCodeVal})`;
            }
            syncModalPaymentView();
        }
        if (codenameInput && codenameInput.value.trim()) {
            handleCodenameInput();
        } else {
            updateSummaryDevice('');
        }
        if (serialInput && serialInput.value.trim()) {
            handleSerialInput();
        } else {
            updateSummarySerial('');
        }
        if (lastLookupResult && lastLookupQuery) {
            renderLookupResultCard(lastLookupResult, lastLookupQuery);
        }
    });

    // Chạy khởi tạo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
