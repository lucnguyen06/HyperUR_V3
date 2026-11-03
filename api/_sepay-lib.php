<?php
/**
 * ============================================================
 *  HyperUR V3 - SePay helper library
 * ============================================================
 *  Chứa các hàm thuần (không side-effect, không output) dùng cho
 *  webhook thanh toán:
 *    - Chuẩn hoá chuỗi tiếng Việt / có dấu -> A-Z0-9
 *    - Tách token
 *    - Bóc tách SERIAL từ nội dung chuyển khoản (có chấm điểm)
 *    - Đọc hằng số cấu hình an toàn
 *    - Cắt chuỗi an toàn khi thiếu mbstring
 *    - Gửi thông báo Telegram
 *
 *  File này KHÔNG phải endpoint (bị chặn trong api/.htaccess).
 * ============================================================
 */

if (!function_exists('sepay_normalize')) {
    /**
     * Bỏ dấu tiếng Việt và chuyển sang CHỮ HOA.
     * Ngân hàng thường xoá dấu / viết hoa nội dung CK,
     * nên phải chuẩn hoá trước khi so khớp.
     */
    function sepay_normalize($text)
    {
        $text = (string)$text;
        if ($text === '') {
            return '';
        }

        $map = [
            'a' => 'á|à|ả|ã|ạ|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ|ä|å',
            'd' => 'đ',
            'e' => 'é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ|ë',
            'i' => 'í|ì|ỉ|ĩ|ị|î',
            'o' => 'ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ|ö',
            'u' => 'ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự|û',
            'y' => 'ý|ỳ|ỷ|ỹ|ỵ',
            'c' => 'ç',
        ];

        $text = function_exists('mb_strtolower') ? mb_strtolower($text, 'UTF-8') : strtolower($text);
        foreach ($map as $ascii => $chars) {
            $text = preg_replace('/(' . $chars . ')/u', $ascii, $text);
        }

        return function_exists('mb_strtoupper') ? mb_strtoupper($text, 'UTF-8') : strtoupper($text);
    }
}

if (!function_exists('sepay_tokens')) {
    /**
     * Tách nội dung thành các token chữ-số.
     * "UR alioth a1b2c3d4 user@gmail.com"
     *   => ['UR','ALIOTH','A1B2C3D4','USER','GMAIL','COM']
     */
    function sepay_tokens($text)
    {
        $tokens = preg_split('/[^A-Z0-9]+/', sepay_normalize($text), -1, PREG_SPLIT_NO_EMPTY);
        return is_array($tokens) ? $tokens : [];
    }
}

if (!function_exists('sepay_cfg')) {
    /** Đọc hằng số cấu hình, trả về $default nếu chưa khai báo */
    function sepay_cfg($name, $default = null)
    {
        return defined($name) ? constant($name) : $default;
    }
}

if (!function_exists('sepay_cut')) {
    /** mb_substr an toàn khi server thiếu mbstring */
    function sepay_cut($text, $max)
    {
        $text = (string)$text;
        if (function_exists('mb_substr')) {
            return mb_substr($text, 0, $max, 'UTF-8');
        }
        return substr($text, 0, $max);
    }
}

if (!function_exists('sepay_is_serial')) {
    /**
     * Token có đúng chuẩn serial không.
     * Giữ đồng bộ với regex trong api/serial-register.php: 4-32 ký tự A-Z0-9.
     */
    function sepay_is_serial($token)
    {
        return (bool)preg_match('/^[A-Z0-9]{4,32}$/', (string)$token);
    }
}

if (!function_exists('sepay_serial_candidates')) {
    /**
     * Bóc tách các SERIAL tiềm năng từ nội dung chuyển khoản,
     * trả về mảng đã sắp xếp theo ĐỘ TIN CẬY GIẢM DẦN.
     *
     * Cú pháp website sinh ra:  "UR <codename> <serial> <email>"
     *
     * Vì sao phải chấm điểm thay vì lấy cứng vị trí thứ 2 sau "UR":
     *   - User có thể không nhập codename  -> "UR A1B2C3D4 user@gmail.com"
     *     (lúc đó vị trí thứ 2 là email, không phải serial)
     *   - Codename / email / chữ rác cũng là token A-Z0-9 nên đều "hợp lệ"
     *     về mặt regex, nếu thử sai thứ tự có thể kích hoạt nhầm serial.
     *
     * Cách chấm điểm:
     *   +100  nằm đúng vị trí serial (ngay sau codename) và đủ dài
     *   + 50  nằm sau chữ "UR"
     *   + độ dài token  (serial thường 8+ ký tự, số tiền thì ngắn)
     *   + 20  có cả chữ và số (đặc trưng của serial)
     *   - 40  toàn số và ngắn (dễ là số tiền)
     *
     * @return string[]
     */
    function sepay_serial_candidates($content, $limit = 10)
    {
        $tokens = sepay_tokens($content);
        if (count($tokens) === 0) {
            return [];
        }

        $urIndex = array_search('UR', $tokens, true);
        $scored  = [];
        $seen    = [];

        foreach ($tokens as $i => $token) {
            if ($token === 'UR' || !sepay_is_serial($token)) {
                continue;
            }
            if (isset($seen[$token])) {
                continue;
            }
            $seen[$token] = true;

            $len   = strlen($token);
            $score = $len;
            $hasAlpha = (bool)preg_match('/[A-Z]/', $token);
            $hasDigit = (bool)preg_match('/[0-9]/', $token);

            if ($urIndex !== false && $i > $urIndex) {
                $score += 50;
                // Vị trí serial kỳ vọng: UR + codename + serial
                if ($i === $urIndex + 2 && $len >= 6) {
                    $score += 100;
                }
            }

            if ($hasAlpha && $hasDigit) {
                $score += 20;
            }

            // Toàn số + ngắn => rất dễ là số tiền
            if (!$hasAlpha && $len <= 8) {
                $score -= 40;
            }

            $scored[] = ['token' => $token, 'score' => $score, 'pos' => $i];
        }

        usort($scored, function ($a, $b) {
            if ($a['score'] === $b['score']) {
                return $a['pos'] <=> $b['pos'];
            }
            return $b['score'] <=> $a['score'];
        });

        $out = [];
        foreach (array_slice($scored, 0, $limit) as $item) {
            $out[] = $item['token'];
        }
        return $out;
    }
}

if (!function_exists('sepay_notify_telegram')) {
    /**
     * Gửi thông báo Telegram cho admin (bỏ qua nếu chưa cấu hình).
     * Không bao giờ throw để không làm hỏng luồng webhook.
     *
     * Cần khai báo TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID trong config.php
     */
    function sepay_notify_telegram($text)
    {
        $token  = trim((string)sepay_cfg('TELEGRAM_BOT_TOKEN', ''));
        $chatId = trim((string)sepay_cfg('TELEGRAM_ADMIN_CHAT_ID', ''));

        if ($token === '' || $chatId === '') {
            return false;
        }

        $url  = 'https://api.telegram.org/bot' . $token . '/sendMessage';
        $body = http_build_query([
            'chat_id'                  => $chatId,
            'text'                     => $text,
            'disable_web_page_preview' => 'true',
        ]);

        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $body,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 8,
                CURLOPT_CONNECTTIMEOUT => 5,
            ]);
            $res = curl_exec($ch);
            $err = curl_error($ch);
            curl_close($ch);
            if ($res === false) {
                error_log('[sepay] Telegram curl error: ' . $err);
                return false;
            }
            return true;
        }

        $ctx = stream_context_create([
            'http' => [
                'method'        => 'POST',
                'header'        => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content'       => $body,
                'timeout'       => 8,
                'ignore_errors' => true,
            ],
        ]);
        if (@file_get_contents($url, false, $ctx) === false) {
            error_log('[sepay] Telegram stream error');
            return false;
        }
        return true;
    }
}
