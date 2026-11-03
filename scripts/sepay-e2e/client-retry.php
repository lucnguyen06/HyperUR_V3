<?php
/**
 * Test hồi quy: giao dịch được SePay RETRY sau khi lần xử lý trước
 * bị chết giữa chừng (đã ghi vào sổ nhận tiền nhưng chưa kích hoạt).
 *
 * Đây là kịch bản nguy hiểm nhất: nếu webhook trả success=true khi
 * status vẫn 'unmatched' thì tiền đã nhận nhưng serial KHÔNG BAO GIỜ
 * được kích hoạt, và SePay cũng không retry nữa.
 *
 * Chạy: php scripts/sepay-e2e/client-retry.php [url]
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

$SERIAL  = 'RETRYSERIAL1';
$SEPAY_ID = 88888;

// ---- Dọn dữ liệu ----
$db->query("DELETE FROM payment_transactions WHERE sepay_id={$SEPAY_ID}");
$db->query("DELETE FROM registrations WHERE serial='{$SERIAL}'");
$db->query("DELETE FROM serial WHERE UPPER(Serial)='{$SERIAL}'");

// Đơn đăng ký đang chờ (chưa thanh toán)
$db->query("
    INSERT INTO registrations (serial, codename, plan, sender_email, status)
    VALUES ('{$SERIAL}', 'alioth', 'Đăng kí có Ủng hộ (Vĩnh viễn)', 'retry@test.com', 'Pending')
");

/**
 * Mô phỏng "lần xử lý trước bị chết giữa chừng":
 * giao dịch ĐÃ được ghi vào sổ nhận tiền với status='unmatched'
 * (đúng như code làm trước khi kích hoạt), nhưng chưa kích hoạt gì cả.
 */
$db->query("
    INSERT INTO payment_transactions
        (sepay_id, gateway, transfer_amount, content, transfer_type, status)
    VALUES
        ({$SEPAY_ID}, 'MBBank', 50000, 'UR alioth {$SERIAL} retry@test.com', 'in', 'unmatched')
");

$txBefore = q1($db, "SELECT status FROM payment_transactions WHERE sepay_id={$SEPAY_ID}");
ok(($txBefore['status'] ?? '') === 'unmatched', 'Chuẩn bị: giao dịch treo ở trạng thái unmatched', (string)($txBefore['status'] ?? ''));

$regBefore = q1($db, "SELECT status FROM registrations WHERE serial='{$SERIAL}'");
ok(($regBefore['status'] ?? '') === 'Pending', 'Chuẩn bị: đơn vẫn Pending (chưa kích hoạt)', (string)($regBefore['status'] ?? ''));

echo "\n--- SePay retry gửi lại CÙNG id giao dịch ---\n";

$r = send_webhook($BASE_URL, $SECRET, [
    'id'             => $SEPAY_ID,
    'gateway'        => 'MBBank',
    'content'        => 'UR alioth ' . $SERIAL . ' retry@test.com',
    'transferType'   => 'in',
    'transferAmount' => 50000,
]);

ok($r['http'] === 200, 'HTTP 200', 'http=' . $r['http']);
ok(($r['json']['success'] ?? false) === true, 'success=true', json_encode($r['json']));
ok(
    ($r['json']['duplicate'] ?? false) !== true,
    'KHÔNG trả về duplicate=true (phải xử lý lại, không được bỏ qua)',
    json_encode($r['json'])
);
ok(($r['json']['matched'] ?? false) === true, 'Đã kích hoạt ở lần retry này', json_encode($r['json']));

// ---- Kiểm tra kết quả ----
$regAfter = q1($db, "SELECT status FROM registrations WHERE serial='{$SERIAL}'");
ok(($regAfter['status'] ?? '') === 'Active', 'registrations đã chuyển Active', (string)($regAfter['status'] ?? ''));

$serAfter = q1($db, "SELECT COUNT(*) AS c FROM serial WHERE UPPER(Serial)='{$SERIAL}'");
ok((int)$serAfter['c'] === 1, 'Bảng serial đã có bản ghi (đúng 1)', 'count=' . $serAfter['c']);

$txAfter = q1($db, "SELECT status FROM payment_transactions WHERE sepay_id={$SEPAY_ID}");
ok(($txAfter['status'] ?? '') === 'matched', 'Sổ nhận tiền cập nhật matched', (string)($txAfter['status'] ?? ''));

echo "\n--- Retry LẦN 3 (đã xong thật rồi) ---\n";

$r = send_webhook($BASE_URL, $SECRET, [
    'id'             => $SEPAY_ID,
    'gateway'        => 'MBBank',
    'content'        => 'UR alioth ' . $SERIAL . ' retry@test.com',
    'transferType'   => 'in',
    'transferAmount' => 50000,
]);
ok(($r['json']['duplicate'] ?? false) === true, 'Lần 3 báo duplicate=true (không xử lý lại)', json_encode($r['json']));

$serFinal = q1($db, "SELECT COUNT(*) AS c FROM serial WHERE UPPER(Serial)='{$SERIAL}'");
ok((int)$serFinal['c'] === 1, 'Vẫn chỉ 1 bản ghi serial', 'count=' . $serFinal['c']);

$db->close();

echo "\n==============================================\n";
echo "PASS: {$pass}   FAIL: {$fail}\n";
echo "==============================================\n";
exit($fail === 0 ? 0 : 1);
