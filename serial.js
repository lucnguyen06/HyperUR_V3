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
    const REG_STORAGE_KEY = 'hyperur_serial_regs';
    const LOOKUP_HISTORY_KEY = 'hyperur_lookup_history';

    // Dữ liệu mẫu khởi đầu (đồng bộ theo md/EMAIL_PRICING_GUIDE.md)
    let emailDataStore = {
        'test@gmail.com': { count: 5, lastUpdated: new Date().toISOString() },
        'tho@gmail.com': { count: 18, lastUpdated: new Date().toISOString() },
        'sop@gmail.com': { count: 35, lastUpdated: new Date().toISOString() }
    };

    let currentSelectedPlan = 'vip'; // 'vip' hoặc 'free'
    let currentCalculatedPrice = 50000;
    let devicesMap = {};
    let emailCheckTimeout = null;

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

        // 2. Hợp nhất với localStorage (để lưu giữ lịch sử người dùng đã đăng ký thành công trên máy này)
        try {
            const localRaw = localStorage.getItem(EMAIL_STORAGE_KEY);
            if (localRaw) {
                const localData = JSON.parse(localRaw);
                if (localData && typeof localData === 'object') {
                    emailDataStore = Object.assign({}, emailDataStore, localData);
                }
            }
        } catch (e) {
            console.warn('Lỗi đọc localStorage email registrations:', e);
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
            localStorage.setItem(EMAIL_STORAGE_KEY, JSON.stringify(emailDataStore));
        } catch (e) {
            console.error('Không thể lưu email registration vào localStorage:', e);
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
     * - 0 - 14 thiết bị:  50.000đ (Cơ bản)
     * - 15 - 29 thiết bị: 40.000đ (Ưu đãi giảm 10k)
     * - 30+ thiết bị:     35.000đ (Ưu đãi VIP giảm 15k)
     */
    function calculatePrice(deviceCount) {
        if (deviceCount >= 30) {
            return {
                price: 35000,
                priceText: '35.000đ',
                tierKey: 'tier30',
                tierLabel: 'Tích >30 con: 35k',
                badge: '🎉 Ưu đãi VIP: Giảm 15k/thiết bị',
                badgeColor: '#10b981'
            };
        } else if (deviceCount >= 15) {
            return {
                price: 40000,
                priceText: '40.000đ',
                tierKey: 'tier15',
                tierLabel: 'Tích >15 con: 40k',
                badge: '🎁 Ưu đãi: Giảm 10k/thiết bị',
                badgeColor: '#3b82f6'
            };
        } else {
            return {
                price: 50000,
                priceText: '50.000đ',
                tierKey: 'base',
                tierLabel: 'Cơ bản: 50k',
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
    const tabRegisterBtn = document.getElementById('tab-register-btn');
    const tabLookupBtn = document.getElementById('tab-lookup-btn');
    const panelRegister = document.getElementById('panel-register');
    const panelLookup = document.getElementById('panel-lookup');
    const tabSlider = document.getElementById('serial-tab-slider');

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
    const planCardFree = document.getElementById('plan-card-free');
    const statusVip = document.getElementById('status-vip');
    const statusFree = document.getElementById('status-free');
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

    // Buttons & History
    const submitBtn = document.getElementById('btn-submit-form');
    const btnQuickLookupTab = document.getElementById('btn-quick-lookup-tab');
    const historyCard = document.getElementById('reg-history-card');
    const historyList = document.getElementById('reg-history-list');
    const btnClearHistory = document.getElementById('btn-clear-history');
    const toast = document.getElementById('reg-toast');
    const toastText = document.getElementById('toast-text');

    // Dialog Modal
    const successDialog = document.getElementById('success-dialog');
    const modalSerial = document.getElementById('modal-serial-val');
    const modalCodename = document.getElementById('modal-codename-val');
    const modalPlan = document.getElementById('modal-plan-val');
    const modalEmailVal = document.getElementById('modal-email-val');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalLookupLink = document.getElementById('modal-lookup-link');
    const modalQrBox = document.getElementById('modal-payment-qr-box');
    const modalQrSyntax = document.getElementById('modal-qr-syntax');
    const modalDesc = document.getElementById('modal-desc-text');

    // Lookup Tab Elements
    const lookupForm = document.getElementById('lookup-form');
    const lookupSerialInput = document.getElementById('lookup-serial-input');
    const lookupClearBtn = document.getElementById('lookup-clear-btn');
    const lookupSubmitBtn = document.getElementById('lookup-submit-btn');
    const lookupResultContainer = document.getElementById('lookup-result-container');
    const pasteLastBtn = document.getElementById('btn-paste-last-registered');
    const lookupHistoryWrapper = document.getElementById('lookup-history-wrapper');
    const lookupHistoryGrid = document.getElementById('lookup-history-grid');
    const clearLookupHistoryBtn = document.getElementById('btn-clear-lookup-history');

    // =========================================================
    // 3. TOAST & CLIPBOARD HELPER
    // =========================================================
    function showToast(msg) {
        if (!toast || !toastText) return;
        toastText.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
    }

    document.querySelectorAll('[data-copy]').forEach(btn => {
        btn.addEventListener('click', function () {
            const text = this.getAttribute('data-copy');
            if (text && navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => {
                    showToast(`Đã sao chép: ${text}`);
                });
            }
        });
    });

    if (btnCopySyntaxQuick) {
        btnCopySyntaxQuick.addEventListener('click', function () {
            const text = suggestedSyntax ? suggestedSyntax.textContent.trim() : 'UR';
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => {
                    const span = document.getElementById('btn-copy-syntax-text');
                    if (span) span.textContent = '✓ Đã chép';
                    showToast(`Đã sao chép cú pháp: ${text}`);
                    setTimeout(() => { if (span) span.textContent = 'Chép'; }, 2000);
                });
            }
        });
    }

    // =========================================================
    // 4. TAB SWITCHING (ĐĂNG KÝ <-> TRA CỨU)
    // =========================================================
    function activateTab(tabName, updateUrl) {
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
            }
            if (panelLookup) {
                panelLookup.hidden = false;
                panelLookup.style.display = '';
            }
            if (tabSlider) tabSlider.style.transform = 'translateX(100%)';
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
            }
            if (panelRegister) {
                panelRegister.hidden = false;
                panelRegister.style.display = '';
            }
            if (tabSlider) tabSlider.style.transform = 'translateX(0%)';
        }

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
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
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
    // 5. PLAN SELECTION (VIP vs ACTIVE FREE)
    // =========================================================
    function selectPlan(planKey) {
        currentSelectedPlan = planKey;
        if (planKey === 'free') {
            if (planCardVip) {
                planCardVip.classList.remove('active');
                planCardVip.setAttribute('aria-checked', 'false');
            }
            if (planCardFree) {
                planCardFree.classList.add('active');
                planCardFree.setAttribute('aria-checked', 'true');
            }
            if (statusVip) statusVip.textContent = 'Nhấn để chọn gói này';
            if (statusFree) statusFree.textContent = '✓ Đang chọn gói này (Trải nghiệm 36 ngày)';
            if (regTypeValue) regTypeValue.value = 'Active Free (36 Ngày Trải Nghiệm)';

            if (submitBtn) {
                const btnSpan = document.getElementById('btn-submit-text') || submitBtn.querySelector('span');
                if (btnSpan) btnSpan.textContent = 'Xác Nhận & Gửi Serial Active Free (36 Ngày)';
            }
            if (paymentSection) paymentSection.style.display = 'none';
            const freeSummaryBox = document.getElementById('free-plan-summary-box');
            if (freeSummaryBox) freeSummaryBox.style.display = 'block';
        } else {
            if (planCardFree) {
                planCardFree.classList.remove('active');
                planCardFree.setAttribute('aria-checked', 'false');
            }
            if (planCardVip) {
                planCardVip.classList.add('active');
                planCardVip.setAttribute('aria-checked', 'true');
            }
            if (statusFree) statusFree.textContent = 'Nhấn để chọn gói này';
            if (statusVip) statusVip.textContent = '✓ Đang chọn gói này (Mặc định)';
            if (regTypeValue) regTypeValue.value = 'Đăng kí có Ủng hộ (Vĩnh viễn)';

            if (submitBtn) {
                const btnSpan = document.getElementById('btn-submit-text') || submitBtn.querySelector('span');
                if (btnSpan) btnSpan.textContent = 'Xác Nhận & Gửi Serial Lên Hệ Thống';
            }
            if (paymentSection) paymentSection.style.display = 'block';
            const freeSummaryBox = document.getElementById('free-plan-summary-box');
            if (freeSummaryBox) freeSummaryBox.style.display = 'none';
        }
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

    if (planCardFree) {
        planCardFree.addEventListener('click', () => selectPlan('free'));
        planCardFree.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectPlan('free');
            }
        });
    }

    // =========================================================
    // 6. CATALOG THIẾT BỊ (json/devices_catalog.json)
    // =========================================================
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
            return;
        }

        if (devicesMap[val]) {
            const dev = devicesMap[val];
            const devName = dev.name && dev.name.en ? dev.name.en : val;
            previewText.innerHTML = `Thiết bị: <strong>${devName}</strong> (${dev.brand || 'Xiaomi'}) • Codename: <code>${val}</code>`;
            previewBox.classList.add('show');
        } else {
            previewText.innerHTML = `Mã thiết bị nhập tay: <code>${val}</code>`;
            previewBox.classList.add('show');
        }
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
        return clean;
    }

    function updatePaymentQr(price, serial) {
        if (!paymentQrImg) return;
        if (currentPaymentMethod !== 'mbbank') return;
        const base = 'https://vietqr.app/img?bank=MBBank&acc=VQRQAMNWP9901&template=&showinfo=false&holder=NGUYEN%20TAN%20LUC&store=HyperUR';
        const amountPart = price ? `&amount=${price}` : '';
        const desPart = serial ? `&des=${encodeURIComponent('UR ' + serial)}` : '';
        paymentQrImg.src = `${base}${amountPart}${desPart}`;
    }

    function selectIntlSub(subKey) {
        currentIntlSub = subKey;
        if (subTabBinance) subTabBinance.classList.toggle('active', subKey === 'binance');
        if (subTabPaypal) subTabPaypal.classList.toggle('active', subKey === 'paypal');

        if (subKey === 'binance') {
            if (paymentQrImg) paymentQrImg.src = 'images/QR_BINANCE_DNT_HYPERUR.jpg';
            if (paymentQrBadgeText) paymentQrBadgeText.textContent = 'Binance Pay (5 USDT)';
            if (paymentQrCaptionText) paymentQrCaptionText.textContent = 'Quét mã bằng app Binance (5 USDT)';
            if (binanceDetailsGroup) binanceDetailsGroup.style.display = 'block';
            if (paypalDetailsGroup) paypalDetailsGroup.style.display = 'none';
            if (donationAmountVal) donationAmountVal.textContent = '5 USDT (Only 5$)';
        } else {
            if (paymentQrImg) paymentQrImg.src = 'images/QR_PAYPAL_DNT_HYPERUR.jpg';
            if (paymentQrBadgeText) paymentQrBadgeText.textContent = 'PayPal (5 USD)';
            if (paymentQrCaptionText) paymentQrCaptionText.textContent = 'Quét mã hoặc mở PayPal gửi 5$';
            if (binanceDetailsGroup) binanceDetailsGroup.style.display = 'none';
            if (paypalDetailsGroup) paypalDetailsGroup.style.display = 'block';
            if (donationAmountVal) donationAmountVal.textContent = '5 USD (Only 5$)';
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
        const cards = document.querySelectorAll('.payment-method-card');
        cards.forEach(card => {
            const isMatch = card.getAttribute('data-method') === methodKey;
            card.classList.toggle('active', isMatch);
            card.setAttribute('aria-checked', isMatch ? 'true' : 'false');
        });

        const currentSerial = serialInput ? sanitizeSerial(serialInput.value).toUpperCase() : '';

        if (methodKey === 'crypto_intl') {
            if (paymentMethodVal) paymentMethodVal.value = 'Quốc Tế & Crypto (Binance Pay / PayPal - Only 5$)';
            if (bankNameRow) bankNameRow.style.display = 'none';
            if (bankOwnerRow) bankOwnerRow.style.display = 'none';
            if (bankAccRow) bankAccRow.style.display = 'none';
            if (qrIntlSwitcher) qrIntlSwitcher.style.display = 'flex';

            if (paymentTierPill) {
                paymentTierPill.textContent = 'Only 5$ • Giá cố định';
                paymentTierPill.className = 'tier-pill tier-intl-fixed current-active';
            }
            if (paymentTierHint) {
                paymentTierHint.style.display = 'none';
            }

            selectIntlSub(currentIntlSub || 'binance');
        } else {
            // MBBank (Mặc định)
            if (paymentMethodVal) paymentMethodVal.value = 'Chuyển Khoản MBBank (VietQR 24/7)';
            if (paymentQrBadgeText) paymentQrBadgeText.textContent = 'MBBank VietQR 24/7';
            if (paymentQrCaptionText) paymentQrCaptionText.textContent = 'Quét bằng mọi ứng dụng ngân hàng';
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

            if (donationAmountVal) {
                donationAmountVal.textContent = priceInfo.priceText;
            }
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

    document.querySelectorAll('.payment-method-card').forEach(card => {
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

    function handleSerialInput() {
        if (!serialInput) return;
        const rawVal = serialInput.value;
        const sanitized = sanitizeSerial(rawVal);

        if (rawVal !== sanitized) {
            serialInput.value = sanitized;
        }

        const len = sanitized.length;
        const upperSerial = sanitized.toUpperCase();

        if (serialCleanBtn) serialCleanBtn.style.display = len > 0 ? 'block' : 'none';

        if (serialCleanPreview && serialValidTag) {
            if (len >= 6) {
                serialCleanPreview.innerHTML = `Serial hợp lệ: <strong>${upperSerial}</strong>`;
                serialValidTag.style.display = 'inline-flex';
            } else if (len > 0) {
                serialCleanPreview.innerHTML = `Đang nhập (${len}/8 ký tự)...`;
                serialValidTag.style.display = 'none';
            } else {
                serialCleanPreview.textContent = 'Đang chờ nhập serial hợp lệ...';
                serialValidTag.style.display = 'none';
            }
        }

        // Cập nhật gợi ý cú pháp chuyển khoản
        if (suggestedSyntax) {
            suggestedSyntax.textContent = len > 0 ? `UR ${upperSerial}` : 'UR [SERIAL]';
        }
        if (tipSyntaxExample) {
            tipSyntaxExample.textContent = len > 0 ? `UR ${upperSerial}` : 'UR A1B2C3D4';
        }

        // Cập nhật QR code với serial mới
        updatePaymentQr(currentCalculatedPrice, len > 0 ? upperSerial : '');
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
            emailDevicesCount.textContent = `${deviceCount} thiết bị`;
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

        // 4. Mức Ủng Hộ Áp Dụng ở khung thanh toán
        if (currentPaymentMethod === 'crypto_intl') {
            if (donationAmountVal) {
                donationAmountVal.textContent = currentIntlSub === 'paypal' ? '5 USD (Only 5$)' : '5 USDT (Only 5$)';
            }
            if (paymentTierPill) {
                paymentTierPill.textContent = 'Only 5$ • Giá cố định';
                paymentTierPill.className = 'tier-pill tier-intl-fixed current-active';
            }
            if (paymentTierHint) {
                paymentTierHint.style.display = 'none';
            }
        } else {
            if (donationAmountVal) {
                donationAmountVal.textContent = priceInfo.priceText;
            }
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
            const currentSerial = serialInput ? sanitizeSerial(serialInput.value).toUpperCase() : '';
            updatePaymentQr(priceInfo.price, currentSerial);
        }
    }

    async function checkEmailAndUpdatePrice(email) {
        if (!EMAIL_REGEX.test(email)) return;

        // Hiển thị trạng thái đang kiểm tra
        if (emailCheckLoader) emailCheckLoader.style.display = 'flex';
        if (emailStateMsg) emailStateMsg.style.display = 'none';
        if (emailRegStats) emailRegStats.style.display = 'none';

        // Đợi 250ms mô phỏng kiểm tra dữ liệu mượt mà
        await new Promise(resolve => setTimeout(resolve, 250));

        // Tra cứu số lượng thiết bị trong kho dữ liệu
        const deviceCount = getDeviceCountForEmail(email);

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
            emailStateText.textContent = '✓ Email hợp lệ';
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
                emailStateText.textContent = '⚠️ Email chưa đúng định dạng (VD: ten@gmail.com)';
            }
            if (emailRegStats) emailRegStats.style.display = 'none';
            if (emailCheckLoader) emailCheckLoader.style.display = 'none';
            return false;
        }

        // Định dạng đúng: debounce kiểm tra sau 500ms
        emailCheckTimeout = setTimeout(() => {
            checkEmailAndUpdatePrice(email);
        }, 500);

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
    // 9. LỊCH SỬ ĐĂNG KÝ CỤC BỘ (REGISTER HISTORY)
    // =========================================================
    function getRegistrationHistory() {
        try {
            return JSON.parse(localStorage.getItem(REG_STORAGE_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveRegistrationHistory(item) {
        const list = getRegistrationHistory();
        list.unshift(item);
        if (list.length > 10) list.pop();
        try {
            localStorage.setItem(REG_STORAGE_KEY, JSON.stringify(list));
        } catch (e) { }
        renderRegistrationHistory();
    }

    function renderRegistrationHistory() {
        if (!historyCard || !historyList) return;
        const list = getRegistrationHistory();
        if (!list || list.length === 0) {
            historyCard.style.display = 'none';
            return;
        }
        historyCard.style.display = 'block';
        historyList.innerHTML = '';

        list.forEach(item => {
            const row = document.createElement('div');
            row.className = 'reg-history-item';
            row.innerHTML = `
                <div class="reg-history-meta">
                    <span class="reg-history-serial">Serial: ${item.serial} • Mã máy: ${item.codename}</span>
                    <span class="reg-history-sub">${item.plan} | ${item.email || ''} | ${item.time}</span>
                </div>
                <button type="button" class="btn-copy-mini" data-copy-serial="${item.serial}">Chép Serial</button>
            `;
            historyList.appendChild(row);
        });

        historyList.querySelectorAll('[data-copy-serial]').forEach(b => {
            b.addEventListener('click', function () {
                const s = this.getAttribute('data-copy-serial');
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(s).then(() => showToast(`Đã chép: ${s}`));
                }
            });
        });
    }

    if (btnClearHistory) {
        btnClearHistory.addEventListener('click', function () {
            localStorage.removeItem(REG_STORAGE_KEY);
            renderRegistrationHistory();
            showToast('Đã xóa lịch sử đăng ký.');
        });
    }

    // =========================================================
    // 10. SUBMIT FORM ĐĂNG KÝ
    // =========================================================
    if (regForm) {
        regForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const serial = serialInput ? sanitizeSerial(serialInput.value).toUpperCase() : '';
            const code = codenameInput ? codenameInput.value.trim().toLowerCase() : '';
            const plan = (regTypeValue ? regTypeValue.value : '') || 'Đăng kí có Ủng hộ (Vĩnh viễn)';
            const isFree = plan.includes('Active Free') || plan.includes('36');
            const emailRaw = senderEmailInput ? senderEmailInput.value.trim() : '';
            const email = emailRaw ? emailRaw.toLowerCase() : '';

            if (!serial || serial.length < 4) {
                showToast('⚠️ Vui lòng nhập số Serial hợp lệ (tối thiểu 4 ký tự)');
                if (serialInput) serialInput.focus();
                return;
            }

            if (!code) {
                showToast('⚠️ Vui lòng nhập mã thiết bị (codename)');
                if (codenameInput) codenameInput.focus();
                return;
            }

            if (!email) {
                showToast('⚠️ Vui lòng nhập Email liên hệ.');
                if (senderEmailInput) senderEmailInput.focus();
                return;
            }

            if (!EMAIL_REGEX.test(email)) {
                showToast('⚠️ Email chưa đúng định dạng. Vui lòng kiểm tra lại.');
                if (senderEmailInput) senderEmailInput.focus();
                return;
            }

            const senderNameVal = document.getElementById('sender-name-input')?.value.trim() || '';
            const transCodeVal = document.getElementById('transaction-input')?.value.trim() || '';
            const methodVal = paymentMethodVal ? paymentMethodVal.value : 'Chuyển Khoản MBBank (VietQR 24/7)';

            const isCryptoIntl = currentPaymentMethod === 'crypto_intl';
            const payload = {
                serial: serial,
                codename: code,
                plan: plan,
                senderEmail: email,
                paymentMethod: methodVal,
                senderName: senderNameVal,
                transactionCode: transCodeVal,
                amount: isFree ? 0 : (isCryptoIntl ? '5$' : currentCalculatedPrice),
                timestamp: new Date().toISOString()
            };

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin">
                        <circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="10"></circle>
                    </svg>
                    <span>Đang gửi Serial lên hệ thống để xác nhận...</span>
                `;
            }

            // Gửi dữ liệu lên Google Apps Script Web App API
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

            // Cập nhật số lượng thiết bị của email (+1) vào data store
            const currentEmailCount = getDeviceCountForEmail(email);
            saveEmailRegistration(email, currentEmailCount + 1);

            // Lưu lịch sử đăng ký cục bộ
            saveRegistrationHistory({
                serial: serial,
                codename: code,
                plan: plan,
                email: email,
                time: new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            });

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <span>${isFree ? 'Xác Nhận & Gửi Serial Active Free (36 Ngày)' : 'Xác Nhận & Gửi Serial Lên Hệ Thống'}</span>
                `;
            }

            // Điền modal thông tin
            if (modalSerial) modalSerial.textContent = serial;
            if (modalCodename) modalCodename.textContent = code;
            if (modalPlan) modalPlan.textContent = plan;
            if (modalEmailVal) modalEmailVal.textContent = email;
            const modalAmountVal = document.getElementById('modal-amount-val');
            if (modalAmountVal) {
                if (isFree) {
                    modalAmountVal.textContent = '0đ (Active Free 36 Ngày)';
                } else if (isCryptoIntl) {
                    modalAmountVal.textContent = '5$ (5 USDT / 5 USD)';
                } else {
                    modalAmountVal.textContent = formatCurrency(currentCalculatedPrice);
                }
            }
            const modalSenderVal = document.getElementById('modal-sender-val');
            if (modalSenderVal) {
                modalSenderVal.textContent = senderNameVal || 'Chưa cung cấp';
            }

            if (modalDesc) {
                modalDesc.textContent = isFree
                    ? `Số Serial ${serial} đã được gửi lên hệ thống máy chủ để xác nhận kích hoạt gói Active Free (36 ngày). Bạn có thể kiểm tra trạng thái kích hoạt ngay bên dưới.`
                    : `Số Serial ${serial} đã được gửi lên hệ thống máy chủ để xác nhận kích hoạt bản quyền. Bạn có thể kiểm tra trạng thái kích hoạt ngay bên dưới.`;
            }

            if (modalQrBox) modalQrBox.style.display = isFree ? 'none' : 'block';
            if (modalQrSyntax) modalQrSyntax.textContent = `UR ${serial}`;

            showToast('✅ Đã gửi Serial lên hệ thống để xác nhận!');

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
                alert(`Đã gửi số Serial ${serial} lên hệ thống thành công! Bạn có thể chuyển sang tab Tra Cứu để kiểm tra trạng thái kích hoạt.`);
            }
        });
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', function () {
            if (successDialog) successDialog.close();
        });
    }

    if (successDialog) {
        successDialog.addEventListener('click', function (e) {
            const rect = successDialog.getBoundingClientRect();
            const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height
                && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
            if (!isInDialog) {
                successDialog.close();
            }
        });
    }

    // =========================================================
    // 11. TRA CỨU SERIAL LOGIC (LOOKUP)
    // =========================================================
    function cleanSerialString(val, toUpper = false) {
        if (!val) return '';
        let s = val.trim();
        s = s.replace(/^(SN|SERIAL|S\/N|S\/NO|NO)[\s:=-]*/i, '');
        s = s.replace(/[^A-Za-z0-9_-]/g, '');
        return toUpper ? s.toUpperCase() : s;
    }

    function updateLookupCounter() {
        if (!lookupSerialInput || !lookupClearBtn) return;
        const len = lookupSerialInput.value.length;
        lookupClearBtn.style.display = len > 0 ? 'flex' : 'none';
    }

    if (lookupSerialInput) {
        lookupSerialInput.addEventListener('input', function () {
            const cleaned = cleanSerialString(this.value);
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

    // Lịch sử đăng ký cục bộ -> nút Dán Serial vừa đăng ký
    try {
        const regHistRaw = localStorage.getItem(REG_STORAGE_KEY);
        if (regHistRaw) {
            const regHist = JSON.parse(regHistRaw);
            if (Array.isArray(regHist) && regHist.length > 0 && regHist[0].serial) {
                const lastSerial = regHist[0].serial;
                const chipsWrapper = document.getElementById('lookup-quick-chips');
                if (chipsWrapper) chipsWrapper.style.display = 'flex';
                if (pasteLastBtn) {
                    pasteLastBtn.style.display = 'inline-flex';
                    pasteLastBtn.title = 'Tra cứu Serial: ' + lastSerial;
                    pasteLastBtn.addEventListener('click', function () {
                        if (lookupSerialInput) {
                            lookupSerialInput.value = lastSerial;
                            updateLookupCounter();
                            performLookup(lastSerial);
                        }
                    });
                }
            }
        }
    } catch (e) { }

    async function performLookup(serial) {
        const cleanSerial = cleanSerialString(serial, true);
        if (!cleanSerial) {
            alert('Vui lòng nhập số Serial cần tra cứu!');
            if (lookupSerialInput) lookupSerialInput.focus();
            return;
        }

        if (lookupSubmitBtn) {
            lookupSubmitBtn.disabled = true;
            lookupSubmitBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin">
                    <circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="10"></circle>
                </svg>
                <span>Đang Tra Cứu...</span>
            `;
        }

        if (lookupResultContainer) {
            lookupResultContainer.innerHTML = `
                <div class="lookup-empty-state">
                    <div class="lookup-empty-icon spin" style="color: var(--accent-primary); border-color: var(--accent-primary);">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle>
                        </svg>
                    </div>
                    <h3 class="lookup-empty-title">Đang Kết Nối Máy Chủ Xác Thực...</h3>
                    <p class="lookup-empty-desc">Đang đối soát số Serial <strong>${cleanSerial}</strong> với cơ sở dữ liệu bản quyền HyperUR thời gian thực.</p>
                </div>
            `;
        }

        let resultData = null;

        if (LOOKUP_API_URL && LOOKUP_API_URL.trim() !== '') {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const fetchUrl = LOOKUP_API_URL + (LOOKUP_API_URL.includes('?') ? '&' : '?')
                    + 'action=check_serial&serial=' + encodeURIComponent(cleanSerial)
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
                serial: cleanSerial,
                message: 'Không tìm thấy số Serial ' + cleanSerial + ' trong cơ sở dữ liệu bản quyền HyperUR.'
            };
        }

        if (lookupSubmitBtn) {
            lookupSubmitBtn.disabled = false;
            lookupSubmitBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <span>Tra Cứu Ngay</span>
            `;
        }

        renderLookupResultCard(resultData, cleanSerial);
        saveToLookupHistory(cleanSerial, resultData);
    }

    function renderLookupResultCard(res, serial) {
        if (!lookupResultContainer) return;

        if (res && res.found && res.data) {
            const d = res.data;
            const isActive = d.statusCode === 'active';
            const stateClass = isActive ? 'state-active' : 'state-pending';

            const statusTitle = isActive
                ? 'Bản Quyền Đã Kích Hoạt'
                : 'Đang Chờ Đối Soát & Kích Hoạt';

            const codenameDisplay = d.codename ? d.codename.toUpperCase() : 'KHÔNG XÁC ĐỊNH';
            const deviceNameDisplay = d.deviceName ? d.deviceName : (d.codename ? 'Thiết bị ' + d.codename : 'Chưa cập nhật');

            const featuresListHtml = (d.features && d.features.length > 0)
                ? d.features.map(f => `
                    <li>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>${f}</span>
                    </li>
                `).join('')
                : '';

            const telegramSyntax = encodeURIComponent(
                `Chào Admin @lcnguy06, tôi cần hỗ trợ kiểm tra kích hoạt Serial HyperUR:\n` +
                `- Số Serial: ${serial}\n` +
                `- Mã máy: ${d.codename || 'chưa rõ'}\n` +
                `- Gói: ${d.plan || 'Vĩnh viễn'}`
            );

            lookupResultContainer.innerHTML = `
                <div class="lookup-result-card ${stateClass}">
                    <div class="lookup-result-header">
                        <div class="lookup-header-left">
                            <div class="lookup-status-icon-box">
                                ${isActive ? `
                                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                    </svg>
                                ` : `
                                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="8" x2="12" y2="12"></line>
                                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                    </svg>
                                `}
                            </div>
                            <div class="lookup-title-area">
                                <h2 class="lookup-result-title">${statusTitle}</h2>
                                <div class="lookup-result-serial">
                                    <span>SN:</span>
                                    <span>${serial}</span>
                                </div>
                            </div>
                        </div>
                        <div class="lookup-status-pill">
                            <span class="lookup-pulse-dot"></span>
                            <span>${d.statusText || 'Trạng Thái'}</span>
                        </div>
                    </div>

                    <div class="lookup-info-grid">
                        <div class="lookup-info-card">
                            <span class="lookup-info-label">Thiết Bị / Mã Máy</span>
                            <span class="lookup-info-val val-cyan">${deviceNameDisplay} (${codenameDisplay})</span>
                        </div>
                        <div class="lookup-info-card">
                            <span class="lookup-info-label">Gói Bản Quyền</span>
                            <span class="lookup-info-val val-accent">${d.plan || 'Vĩnh Viễn'}</span>
                        </div>
                        <div class="lookup-info-card">
                            <span class="lookup-info-label">Ngày Đăng Ký / Cập Nhật</span>
                            <span class="lookup-info-val">${d.registeredDate || 'Hôm nay'}</span>
                        </div>
                        <div class="lookup-info-card">
                            <span class="lookup-info-label">Tính Năng Bản Quyền</span>
                            <span class="lookup-info-val" style="color: var(--accent-emerald);">Mở Khóa Toàn Diện</span>
                        </div>
                    </div>

                    <div class="lookup-perks-box">
                        <div class="lookup-perks-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                            <span>Quyền Lợi Giấy Phép ROM HyperUR Đi Kèm:</span>
                        </div>
                        <ul class="lookup-perks-list">
                            ${featuresListHtml}
                        </ul>
                    </div>

                    <div class="lookup-actions">
                        <a href="download.html" class="lookup-btn-main">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>Đến Kho Tải ROM HyperUR</span>
                        </a>
                        <a href="https://t.me/lcnguy06?text=${telegramSyntax}" target="_blank" rel="noopener noreferrer" class="lookup-btn-telegram">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                            </svg>
                            <span>${isActive ? 'Hỗ Trợ Kỹ Thuật Admin' : 'Nhắn Admin Kích Hoạt Nhanh'}</span>
                        </a>
                        <a href="guide.html" class="lookup-btn-outline">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            <span>Xem Hướng Dẫn Flash ROM</span>
                        </a>
                    </div>
                </div>
            `;
        } else {
            const notFoundText = encodeURIComponent(
                `Chào Admin @lcnguy06, tôi vừa tra cứu số Serial: ${serial} nhưng chưa thấy trên hệ thống. Nhờ Admin kiểm tra giúp tôi.`
            );

            lookupResultContainer.innerHTML = `
                <div class="lookup-result-card state-not-found">
                    <div class="lookup-result-header">
                        <div class="lookup-header-left">
                            <div class="lookup-status-icon-box">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="15" y1="9" x2="9" y2="15"></line>
                                    <line x1="9" y1="9" x2="15" y2="15"></line>
                                </svg>
                            </div>
                            <div class="lookup-title-area">
                                <h2 class="lookup-result-title">Chưa Tìm Thấy Bản Quyền Serial</h2>
                                <div class="lookup-result-serial">
                                    <span>SN:</span>
                                    <span>${serial}</span>
                                </div>
                            </div>
                        </div>
                        <div class="lookup-status-pill">
                            <span class="lookup-pulse-dot"></span>
                            <span>Chưa Kích Hoạt</span>
                        </div>
                    </div>

                    <p style="color: var(--text-soft); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.75rem;">
                        Số Serial <strong>${serial}</strong> hiện chưa có trên hệ thống bản quyền chính thức HyperUR hoặc vừa được chuyển khoản và đang trong quá trình ghi nhận.
                    </p>

                    <div class="lookup-info-grid">
                        <div class="lookup-info-card">
                            <span class="lookup-info-label">Nguyên Nhân Có Thể 1</span>
                            <span class="lookup-info-val" style="font-size: 0.9rem; font-weight: 500;">Bạn chưa gửi đơn đăng ký kích hoạt bản quyền</span>
                        </div>
                        <div class="lookup-info-card">
                            <span class="lookup-info-label">Nguyên Nhân Có Thể 2</span>
                            <span class="lookup-info-val" style="font-size: 0.9rem; font-weight: 500;">Số Serial nhập bị nhầm lẫn ký tự (O với 0, I với 1)</span>
                        </div>
                    </div>

                    <div class="lookup-actions">
                        <button type="button" class="lookup-btn-main" data-jump-to-register="${encodeURIComponent(serial)}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="8" x2="20" y2="14"></line>
                                <line x1="23" y1="11" x2="17" y2="11"></line>
                            </svg>
                            <span>Đăng Ký Bản Quyền Serial Này Ngay</span>
                        </button>
                        <a href="https://t.me/lcnguy06?text=${notFoundText}" target="_blank" rel="noopener noreferrer" class="lookup-btn-telegram">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                            </svg>
                            <span>Hỏi Admin Qua Telegram</span>
                        </a>
                    </div>
                </div>
            `;

            const jumpBtn = lookupResultContainer.querySelector('[data-jump-to-register]');
            if (jumpBtn) {
                jumpBtn.addEventListener('click', function () {
                    const sn = decodeURIComponent(this.getAttribute('data-jump-to-register'));
                    activateTab('register', true);
                    setTimeout(function () {
                        if (serialInput) {
                            serialInput.value = sn;
                            handleSerialInput();
                            serialInput.focus();
                        }
                    }, 100);
                });
            }
        }

        lookupResultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function saveToLookupHistory(serial, result) {
        try {
            let history = [];
            const raw = localStorage.getItem(LOOKUP_HISTORY_KEY);
            if (raw) history = JSON.parse(raw);

            history = history.filter(h => h.serial !== serial);

            const status = (result && result.found && result.data)
                ? result.data.statusText || 'Đã tìm thấy'
                : 'Chưa kích hoạt';

            history.unshift({
                serial: serial,
                status: status,
                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN')
            });

            history = history.slice(0, 6);
            localStorage.setItem(LOOKUP_HISTORY_KEY, JSON.stringify(history));
            renderLookupHistory();
        } catch (e) { }
    }

    function renderLookupHistory() {
        if (!lookupHistoryWrapper || !lookupHistoryGrid) return;
        try {
            const raw = localStorage.getItem(LOOKUP_HISTORY_KEY);
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
                localStorage.setItem(LOOKUP_HISTORY_KEY, JSON.stringify(list));
            }

            if (list.length === 0) {
                lookupHistoryWrapper.style.display = 'none';
                return;
            }

            lookupHistoryWrapper.style.display = 'block';
            lookupHistoryGrid.innerHTML = list.map(item => `
                <div class="lookup-history-item" data-serial="${item.serial}">
                    <div class="lookup-history-info">
                        <span class="lookup-hist-serial">${item.serial}</span>
                        <span class="lookup-hist-sub">${item.status} • ${item.time}</span>
                    </div>
                    <span class="lookup-hist-arrow">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </span>
                </div>
            `).join('');

            lookupHistoryGrid.querySelectorAll('.lookup-history-item').forEach(el => {
                el.addEventListener('click', function () {
                    const sn = this.getAttribute('data-serial');
                    if (lookupSerialInput) {
                        lookupSerialInput.value = sn;
                        updateLookupCounter();
                        performLookup(sn);
                    }
                });
            });
        } catch (e) { }
    }

    if (clearLookupHistoryBtn) {
        clearLookupHistoryBtn.addEventListener('click', function () {
            localStorage.removeItem(LOOKUP_HISTORY_KEY);
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

    function openQrLightbox() {
        if (!qrLightboxModal || !qrLightboxImg || !paymentQrImg) return;
        qrLightboxImg.src = paymentQrImg.src;

        if (currentPaymentMethod === 'crypto_intl') {
            if (currentIntlSub === 'paypal') {
                if (qrLightboxBadge) qrLightboxBadge.textContent = 'PAYPAL (5 USD)';
                if (qrLightboxTitle) qrLightboxTitle.textContent = '🅿️ PayPal QR Thanh Toán';
                if (qrLightboxSubtitle) qrLightboxSubtitle.textContent = 'Quét mã QR bằng ứng dụng PayPal hoặc camera điện thoại';
            } else {
                if (qrLightboxBadge) qrLightboxBadge.textContent = 'BINANCE PAY (5 USDT)';
                if (qrLightboxTitle) qrLightboxTitle.textContent = '⚡ Binance Pay QR Thanh Toán';
                if (qrLightboxSubtitle) qrLightboxSubtitle.textContent = 'Mở ứng dụng Binance và quét mã QR để gửi 5 USDT';
            }
        } else {
            if (qrLightboxBadge) qrLightboxBadge.textContent = 'VIETQR MBBANK 24/7';
            if (qrLightboxTitle) qrLightboxTitle.textContent = 'MBBank VietQR Chính Thức';
            if (qrLightboxSubtitle) qrLightboxSubtitle.textContent = 'Quét mã bằng ứng dụng ngân hàng bất kỳ để tự động điền tiền và nội dung';
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
    }

    if (paymentQrImg) {
        paymentQrImg.addEventListener('click', openQrLightbox);
    }
    const paymentQrWrap = document.getElementById('payment-qr-wrap');
    if (paymentQrWrap) {
        paymentQrWrap.addEventListener('click', function (e) {
            if (e.target.tagName !== 'BUTTON') {
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
        // Tải dữ liệu email đã đăng ký từ data / localStorage
        await loadEmailRegistrationsData();

        // Khởi tạo hiển thị giá ban đầu (mặc định 50k)
        applyPriceUI(calculatePrice(0), 0);

        // Render lịch sử
        renderRegistrationHistory();
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
                    serialInput.value = prefillSerial.trim().toUpperCase();
                    handleSerialInput();
                }
            }
        } catch (e) { }
    }

    // Chạy khởi tạo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
