<?php
/**
 * Test hồi quy: thanh toán LẦN 2 cho cùng một serial.
 * Chạy: php scripts/sepay-e2e/client-dup.php [url]
 *
 * Kịch bản thực tế:
 *   - Serial đã được kích hoạt lần 1 (có trong registrations Active
 *     VÀ có trong bảng serial).
 *   - User chuyển khoản lần 2 (SePay sinh id giao dịch MỚI).
 *   => Bảng `serial` KHÔNG được có bản ghi thứ 2 (bảng này không có
 *      UNIQUE trên cột Serial nên DB không tự chặn).
 */

$BASE_URL = $argv[1] ?? 'http://127.0.0.1:8899/payment-webhook.php';
$SECRET   = 'test_secret_key_1234567890';

$dbHost = '127.0.0.1';
$dbUser = 'root';
$dbPass = '';
$dbName = 'hyperur_sepay_test';

$fail = 0;
$pass = 0;

function ok($cond, $label, $detail = '')
{
    global $fail, $pass;
    if ($cond) {
        $pass++;
        echo "PASS  {$label}\n";
    } else {
        $fail++;
        echo "FAIL  {$label}" . ($detail !== '' ? "  -> {$detail}" : '') . "\n";
    }
}

function send_webhook($url, $secret, $payload)
{
    $body = json_encode($payload);
    $timestamp = time();
    $signature = 'sha256=' . hash_hmac('sha256', $timestamp . '.' . $body, $secret);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-SePay-Signature: ' . $signature,
            'X-SePay-Timestamp: ' . $timestamp,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['http' => $code, 'json' => json_decode((string)$res, true), 'raw' => $res];
}

mysqli_report(MYSQLI_REPORT_OFF);
$db = new mysqli($dbHost, $dbUser, $dbPass, $dbName);
if ($db->connect_error) {
    fwrite(STDERR, "Không kết nối được DB test: {$db->connect_error}\n");
    exit(1);
}
$db->set_charset('utf8mb4');

function q1($db, $sql)
{
    $rs = $db->query($sql);
    return $rs ? $rs->fetch_assoc() : null;
}

$SERIAL = 'DUPSERIAL1';

// ---- Dọn dữ liệu ----
$db->query("DELETE FROM payment_transactions");
$db->query("DELETE FROM registrations WHERE serial='{$SERIAL}'");
$db->query("DELETE FROM serial WHERE UPPER(Serial)='{$SERIAL}'");

// ---- Trạng thái sau lần kích hoạt 1: có ở CẢ 2 bảng ----
$db->query("
    INSERT INTO registrations
        (serial, codename, plan, payment_method, sender_email, transaction_code,
         status, activated_at, expired_at)
    VALUES
        ('{$SERIAL}', 'alioth', 'Đăng kí có Ủng hộ (Vĩnh viễn)', 'SePay (Chuyển khoản tự động)',
         'buyer@test.com', 'SEPAY-11111', 'Active', NOW(), NULL)
");
$db->query("
    INSERT INTO serial (STT, Device, Serial, Gmail, Time)
    VALUES (999101, 'alioth', '{$SERIAL}', 'buyer@test.com', 'unlimited')
");

$before = q1($db, "SELECT COUNT(*) AS c FROM serial WHERE UPPER(Serial)='{$SERIAL}'");
ok((int)$before['c'] === 1, 'Chuẩn bị: serial đã có 1 bản ghi', 'count=' . $before['c']);

echo "\n--- Thanh toán LẦN 2 (cùng serial, id giao dịch mới) ---\n";

$r = send_webhook($BASE_URL, $SECRET, [
    'id'             => 77777,
    'gateway'        => 'MBBank',
    'content'        => 'UR alioth ' . $SERIAL . ' buyer@test.com',
    'transferType'   => 'in',
    'transferAmount' => 50000,
]);

ok($r['http'] === 200, 'HTTP 200', 'http=' . $r['http']);
ok(($r['json']['success'] ?? false) === true, 'success=true', json_encode($r['json']));

$after = q1($db, "SELECT COUNT(*) AS c FROM serial WHERE UPPER(Serial)='{$SERIAL}'");
ok(
    (int)$after['c'] === 1,
    'KHÔNG tạo bản ghi serial trùng',
    "count={$after['c']} (mong đợi 1) — DB: " . json_encode($db->query("SELECT STT, Serial, Time FROM serial WHERE UPPER(Serial)='{$SERIAL}'")->fetch_all(MYSQLI_ASSOC), JSON_UNESCAPED_UNICODE)
);

$tx = q1($db, "SELECT status, matched_serial, note FROM payment_transactions WHERE sepay_id=77777");
ok($tx !== null, 'Có ghi nhận giao dịch lần 2 vào sổ nhận tiền');
echo '     status=' . ($tx['status'] ?? '-') . ' | note=' . ($tx['note'] ?? '-') . "\n";

$db->close();

echo "\n==============================================\n";
echo "PASS: {$pass}   FAIL: {$fail}\n";
echo "==============================================\n";
exit($fail === 0 ? 0 : 1);
