<?php
/**
 * HyperUR V3 - API Bootstrap (dùng chung cho các endpoint admin)
 *
 * Chịu trách nhiệm:
 *   - Header JSON
 *   - CORS an toàn (chỉ same-origin, KHÔNG dùng "*" kèm credentials)
 *   - Cấu hình session cookie an toàn (HttpOnly, SameSite, Secure khi HTTPS)
 *   - Khởi động session
 *
 * Dùng:
 *   require_once __DIR__ . '/_bootstrap.php';
 */

// ------------------------------------------------------------
// 1. Header JSON
// ------------------------------------------------------------
if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('Cache-Control: no-store, max-age=0');

    // --------------------------------------------------------
    // 2. CORS: KHÔNG dùng "*" vì endpoint có dùng cookie session.
    //    Chỉ cho phép origin trùng với host đang chạy (same-origin)
    //    hoặc origin khai báo trong ADMIN_ALLOWED_ORIGINS của config.php.
    // --------------------------------------------------------
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $host        = $_SERVER['HTTP_HOST'] ?? '';
        $sameOrigin  = ($host !== '' && preg_match('#^https?://' . preg_quote($host, '#') . '$#i', $origin));
        $allowedList = [];

        if (defined('ADMIN_ALLOWED_ORIGINS') && is_string(ADMIN_ALLOWED_ORIGINS) && ADMIN_ALLOWED_ORIGINS !== '') {
            $allowedList = array_filter(array_map('trim', explode(',', ADMIN_ALLOWED_ORIGINS)));
        }

        if ($sameOrigin || in_array($origin, $allowedList, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
            header('Access-Control-Allow-Credentials: true');
        }
        // Nếu origin không được phép -> không trả ACAO, trình duyệt tự chặn.
    }

    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

// ------------------------------------------------------------
// 3. Preflight
// ------------------------------------------------------------
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ------------------------------------------------------------
// 4. Session cookie an toàn
// ------------------------------------------------------------
if (session_status() === PHP_SESSION_NONE) {
    $isHttps = (
        (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443')
    );

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_samesite', 'Lax');
    // Lưu ý: KHÔNG set session.sid_length / sid_bits_per_character
    // (bị deprecated từ PHP 8.4 và làm hỏng JSON response)

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    session_name('HYPERUR_ADMIN_SESSID');
    session_start();
}

// ------------------------------------------------------------
// 5. Timeout phiên đăng nhập (mặc định 8 giờ, đổi qua SESSION_TTL)
// ------------------------------------------------------------
if (isset($_SESSION['admin_login_at'])) {
    $ttl = defined('SESSION_TTL') ? (int)SESSION_TTL : 8 * 3600;
    if ($ttl > 0 && (time() - (int)$_SESSION['admin_login_at']) > $ttl) {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
        session_start();
    }
}
