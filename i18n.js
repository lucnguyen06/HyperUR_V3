/**
 * HyperUR i18n - Internationalization System
 * Supports: Vietnamese (vi), English (en)
 */

const I18n = {
    currentLang: 'vi',
    supportedLangs: ['vi', 'en'],
    storageKey: 'hyperur_lang',

    translations: {
        vi: {
            // Meta
            'meta.description': 'HyperUR - Kho ROM Custom Stock-based tối ưu hóa cho Xiaomi, Redmi. Hỗ trợ 121 thiết bị HyperOS 1.0, 2.0, 3.0 với độ mượt tuyệt đỉnh, bypass app ngân hàng và mở khóa FPS.',
            'meta.title': 'HyperUR - HyperOS Custom ROM Portal',

            // Navigation
            'nav.home': 'Trang Chủ',
            'nav.download': 'Tải ROM',
            'nav.firmware': 'Thông Tin FW',
            'nav.guide': 'Hướng Dẫn',
            'nav.serial': 'Đăng Ký & Tra Cứu Serial',
            'nav.telegram': 'Kênh Telegram',
            'nav.menu': 'Menu',
            'nav.toggleTheme': 'Chuyển chế độ sáng/tối',

            // Splash
            'splash.tagline': 'HYPEROS OPTIMIZATION ECOSYSTEM',
            'splash.welcome': 'WELCOME',
            'splash.to': 'TO',
            'splash.subtext': 'Khai phóng tiềm năng • Mượt mà tuyệt đỉnh',
            'splash.skip': 'Bỏ qua',
            'splash.skipAria': 'Bỏ qua màn hình chào',

            // Hero
            'hero.title': 'Tối ưu hiệu năng.',
            'hero.titleAccent': 'Khai phóng tiềm năng.',
            'hero.desc': 'Mượt mà tuyệt đỉnh, mở khóa tối đa FPS gaming, giữ nguyên thuật toán Camera Leica và hoạt động 100% ứng dụng ngân hàng. Chào mừng bạn đến với HyperUR.',
            'hero.ctaExplore': 'Khám Phá Thiết Bị',
            'hero.ctaGuide': 'Hướng Dẫn Flash',
            'hero.welcomePrefix': 'WELCOME TO',
            'hero.brandName': 'HYPERUR',
            'hero.statusText': 'STOCK-BASED CUSTOM ROM • XIAOMI / REDMI',

            // Stats
            'stats.devices': 'Thiết Bị Hỗ Trợ',
            'stats.os': 'HyperOS 1.0 - 3.0',
            'stats.fps': 'Mở Khóa Gaming',
            'stats.devicesValue': '121+',
            'stats.osValue': 'OS 3.0',
            'stats.fpsValue': '120 FPS',

            // Mockup
            'mockup.status': 'HyperUR V3.0 Stable • Online',
            'mockup.bankingTitle': 'Bảo Mật Ngân Hàng',
            'mockup.bankingDesc': 'Ẩn Bootloader mặc định, sẵn sàng app ngân hàng và sinh trắc eKYC',
            'mockup.fpsTitle': 'Tối Ưu Cảm Ứng & FPS',
            'mockup.fpsDesc': 'Mở khóa 90/120 FPS, tối ưu touch sampling rate cho game thủ',

            // Section Headers
            'section.exploreKicker': 'KHÁM PHÁ HỆ SINH THÁI',
            'section.exploreTitle': 'Mọi Thứ Bạn Cần Cho Chiếc Điện Thoại',
            'section.exploreDesc': 'Khám phá kho bản build, tìm hiểu các giải pháp tối ưu hệ thống hoặc bắt đầu cài đặt với cẩm nang chi tiết.',

            // Highlights
            'highlight.romTitle': 'Kho ROM 121 Thiết Bị',
            'highlight.romDesc': 'Tra cứu nhanh chóng theo tên máy hoặc mã thiết bị (codename). Tải trực tiếp các bản build HyperOS 1.0, 2.0 và 3.0 mới nhất được cập nhật liên tục.',
            'highlight.romLink': 'Truy Cập Kho ROM',
            'highlight.fwTitle': 'Thông Tin Firmware',
            'highlight.fwDesc': 'Khám phá ảnh chụp màn hình thực tế trên máy, bảng thông số kỹ thuật chuyên sâu và các tính năng, tinh chỉnh có sẵn trên bản ROM HyperUR.',
            'highlight.fwLink': 'Xem Thông Tin FW',
            'highlight.guideTitle': 'Hướng Dẫn Cài Đặt',
            'highlight.guideDesc': 'Quy trình 3 bước nhanh chóng từ tải ROM, cài đặt driver đến flash qua công cụ Flashing Tool Windows tự động và thiết lập máy.',
            'highlight.guideLink': 'Xem Quy Trình Flash',

            // Team Section
            'team.kicker': 'ĐỘI NGŨ & CỘNG ĐỒNG',
            'team.title': 'Hyper Ultra Rate',
            'team.desc': 'Dự án được khởi xướng, phát triển và hỗ trợ liên tục bởi đội ngũ nòng cốt cùng cộng đồng người dùng đam mê HyperOS.',
            'team.devTitle': 'Đội Ngũ Phát Triển',
            'team.devSub': 'Core Developers & Project Leads',
            'team.roleLead': 'Project Lead & Developer',
            'team.message': 'Nhắn tin',
            'team.commTitle': 'Hyper Ultra Rate',
            'team.commSub': 'Kênh Thông Báo & Nhóm Thảo Luận',
            'team.channelOfficial': 'Channel Chính Thức',
            'team.channelName': 'Channel Huper Ultra Rate',
            'team.join': 'Tham gia',
            'team.chatGroup': 'Nhóm Chat Thảo Luận',
            'team.chatName': 'Chat Huper Ultra Rate',
            'team.enterGroup': 'Vào nhóm',

            // Footer
            'footer.version': 'V3.0',
            'footer.desc': 'Dự án ROM Custom Stock-based hàng đầu cho hệ sinh thái thiết bị Xiaomi tại Việt Nam. Tinh chỉnh hiệu năng mượt mà, tối ưu pin và an toàn tuyệt đối.',
            'footer.status': 'Hỗ trợ 121 thiết bị Xiaomi / Redmi / POCO',
            'footer.devTeam': 'Đội Ngũ Phát Triển',
            'footer.community': 'Hyper Ultra Rate',
            'footer.leadDev': 'Lead & Dev',
            'footer.updateChannel': 'Kênh Cập Nhật ROM',
            'footer.discussGroup': 'Nhóm Thảo Luận 24/7',
            'footer.copyright': '© 2026 HYPERUR TEAM. BẢO LƯU MỌI QUYỀN.',
            'footer.scrollTop': 'Lên đầu trang',

            // Language
            'lang.switch': 'Chuyển ngôn ngữ',
            'lang.vi': 'Tiếng Việt',
            'lang.en': 'English'
        },
        en: {
            // Meta
            'meta.description': 'HyperUR - Stock-based Custom ROM optimized for Xiaomi, Redmi. Support for 121 devices on HyperOS 1.0, 2.0, 3.0 with ultimate smoothness, banking app bypass and FPS unlock.',
            'meta.title': 'HyperUR - HyperOS Custom ROM Portal',

            // Navigation
            'nav.home': 'Home',
            'nav.download': 'Download ROM',
            'nav.firmware': 'Firmware Info',
            'nav.guide': 'Guide',
            'nav.serial': 'Register & Serial Lookup',
            'nav.telegram': 'Telegram Channel',
            'nav.menu': 'Menu',
            'nav.toggleTheme': 'Toggle Light/Dark Mode',

            // Splash
            'splash.tagline': 'HYPEROS OPTIMIZATION ECOSYSTEM',
            'splash.welcome': 'WELCOME',
            'splash.to': 'TO',
            'splash.subtext': 'Unlock Potential • Ultimate Smoothness',
            'splash.skip': 'Skip',
            'splash.skipAria': 'Skip welcome screen',

            // Hero
            'hero.title': 'Optimize Performance.',
            'hero.titleAccent': 'Unlock Potential.',
            'hero.desc': 'Ultimate smoothness, maximum FPS gaming unlock, preserve Leica Camera algorithms and 100% banking app compatibility. Welcome to HyperUR.',
            'hero.ctaExplore': 'Explore Devices',
            'hero.ctaGuide': 'Flash Guide',
            'hero.welcomePrefix': 'WELCOME TO',
            'hero.brandName': 'HYPERUR',
            'hero.statusText': 'STOCK-BASED CUSTOM ROM • XIAOMI / REDMI',

            // Stats
            'stats.devices': 'Supported Devices',
            'stats.os': 'HyperOS 1.0 - 3.0',
            'stats.fps': 'Gaming Unlock',
            'stats.devicesValue': '121+',
            'stats.osValue': 'OS 3.0',
            'stats.fpsValue': '120 FPS',

            // Mockup
            'mockup.status': 'HyperUR V3.0 Stable • Online',
            'mockup.bankingTitle': 'Banking Security',
            'mockup.bankingDesc': 'Hide bootloader by default, ready for banking apps and eKYC biometric',
            'mockup.fpsTitle': 'Touch & FPS Optimization',
            'mockup.fpsDesc': 'Unlock 90/120 FPS, optimize touch sampling rate for gamers',

            // Section Headers
            'section.exploreKicker': 'EXPLORE THE ECOSYSTEM',
            'section.exploreTitle': 'Everything You Need For Your Phone',
            'section.exploreDesc': 'Explore the build repository, learn about system optimization solutions or start installation with detailed guides.',

            // Highlights
            'highlight.romTitle': 'ROM Repository - 121 Devices',
            'highlight.romDesc': 'Quick lookup by device name or codename. Download latest HyperOS 1.0, 2.0 and 3.0 builds updated continuously.',
            'highlight.romLink': 'Access ROM Repository',
            'highlight.fwTitle': 'Firmware Information',
            'highlight.fwDesc': 'Explore real device screenshots, deep-dive technical specs and features available on HyperUR ROM.',
            'highlight.fwLink': 'View Firmware Info',
            'highlight.guideTitle': 'Installation Guide',
            'highlight.guideDesc': 'Quick 3-step process from downloading ROM, installing drivers to flashing via automatic Windows Flashing Tool and setup.',
            'highlight.guideLink': 'View Flash Process',

            // Team Section
            'team.kicker': 'TEAM & COMMUNITY',
            'team.title': 'Hyper Ultra Rate',
            'team.desc': 'Project initiated, developed and continuously supported by core team and passionate HyperOS community.',
            'team.devTitle': 'Development Team',
            'team.devSub': 'Core Developers & Project Leads',
            'team.roleLead': 'Project Lead & Developer',
            'team.message': 'Message',
            'team.commTitle': 'Hyper Ultra Rate',
            'team.commSub': 'Notification Channels & Discussion Groups',
            'team.channelOfficial': 'Official Channel',
            'team.channelName': 'Hyper Ultra Rate Channel',
            'team.join': 'Join',
            'team.chatGroup': 'Discussion Chat Group',
            'team.chatName': 'Hyper Ultra Rate Chat',
            'team.enterGroup': 'Join Group',

            // Footer
            'footer.version': 'V3.0',
            'footer.desc': 'Leading Stock-based Custom ROM project for Xiaomi device ecosystem in Vietnam. Smooth performance tuning, battery optimization and absolute safety.',
            'footer.status': 'Supports 121 Xiaomi / Redmi / POCO devices',
            'footer.devTeam': 'Development Team',
            'footer.community': 'Hyper Ultra Rate',
            'footer.leadDev': 'Lead & Dev',
            'footer.updateChannel': 'ROM Update Channel',
            'footer.discussGroup': '24/7 Discussion Group',
            'footer.copyright': '© 2026 HYPERUR TEAM. ALL RIGHTS RESERVED.',
            'footer.scrollTop': 'Back to top',

            // Language
            'lang.switch': 'Switch language',
            'lang.vi': 'Tiếng Việt',
            'lang.en': 'English'
        }
    },

    init() {
        const savedLang = localStorage.getItem(this.storageKey);
        if (savedLang && this.supportedLangs.includes(savedLang)) {
            this.currentLang = savedLang;
        }
        this.applyTranslations();
        this.updateHtmlLang();
    },

    setLang(lang) {
        if (!this.supportedLangs.includes(lang)) return;
        this.currentLang = lang;
        localStorage.setItem(this.storageKey, lang);
        this.applyTranslations();
        this.updateHtmlLang();
        this.updateMetaDescription();
    },

    toggleLang() {
        const newLang = this.currentLang === 'vi' ? 'en' : 'vi';
        this.setLang(newLang);
    },

    t(key) {
        return this.translations[this.currentLang][key] || this.translations['vi'][key] || key;
    },

    applyTranslations() {
        // Update elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = this.t(key);
        });

        // Update elements with data-i18n-placeholder attribute
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });

        // Update elements with data-i18n-aria-label attribute
        document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria-label');
            el.setAttribute('aria-label', this.t(key));
        });

        // Update title
        document.title = this.t('meta.title');
    },

    updateHtmlLang() {
        document.documentElement.lang = this.currentLang;
    },

    updateMetaDescription() {
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', this.t('meta.description'));
        }
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    I18n.init();
});
