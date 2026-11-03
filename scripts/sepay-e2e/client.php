<?php
/**
 * ============================================================
 *  E2E test client cho SePay webhook
 * ============================================================
 *  G?i webhook qua HTTP TH?T v?i HMAC-SHA256 th?t, r?i ki?m tra
 *  tr?ng th?i DB ?? ch?c ch?n: x?c th?c, ch?ng tr?ng, b?c serial,
 *  k?ch ho?t registrations + serial ??u ??ng.
 *
 *  Y?u c?u: server ?? ch?y (xem scripts/run-sepay-e2e.ps1)
 *  Ch?y:    php scripts/sepay-e2e/client.php
 * ============================================================
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

// ------------------------------------------------------------
// G?i webhook v?i ch? k? HMAC h?p l?
// ------------------------------------------------------------
function send_webhook($url, $secret, $payload, $opts = [])
{
    $body = is_string($payload) ? $payload : json_encode($payload);

    $timestamp = $opts['timestamp'] ?? time();
    $signature = $opts['signature'] ?? ('sha256=' . hash_hmac('sha256', $timestamp . '.' . $body, $secret));
    $omitSig   = $opts['omit_signature'] ?? false;

    $headers = ['Content-Type: application/json'];
    if (!$omitSig) {
        $headers[] = 'X-SePay-Signature: ' . $signature;
    }
    if (!($opts['omit_timestamp'] ?? false)) {
        $headers[] = 'X-SePay-Timestamp: ' . $timestamp;
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    return [
        'http' => $code,
        'raw'  => $res,
        'json' => json_decode((string)$res, true),
        'err'  => $err,
    ];
}

// ------------------------------------------------------------
// K?t n?i DB test
// ------------------------------------------------------------
// Kh?ng throw exception ?? test t? b?o l?i r? r?ng h?n
mysqli_report(MYSQLI_REPORT_OFF);

$db = new mysqli($dbHost, $dbUser, $dbPass, $dbName);
if ($db->connect_error) {
    fwrite(STDERR, "Kh?ng k?t n?i ???c DB test: {$db->connect_error}\n");
    exit(1);
}
$db->set_charset('utf8mb4');

function q1($db, $sql)
{
    $rs = $db->query($sql);
    if (!$rs) {
        return null;
    }
    $row = $rs->fetch_assoc();
    return $row;
}

// ------------------------------------------------------------
// D? li?u test: 1 ??n Pending ?? ??ng k? tr??c
// ------------------------------------------------------------
$db->query("DELETE FROM payment_transactions");
$db->query("DELETE FROM registrations WHERE serial IN ('TSTSERIAL1','TSTSERIAL2','TSTSERIAL3','TSTSERIAL4')");
$db->query("DELETE FROM serial WHERE Serial IN ('TSTSERIAL1','TSTSERIAL2','TSTSERIAL3','TSTSERIAL4')");

$db->query("
    INSERT INTO registrations
        (serial, codename, plan, payment_method, sender_name, sender_email,
         transaction_code, status, activated_at, expired_at)
    VALUES
        ('TSTSERIAL1', 'alioth', '??ng k? c? ?ng h? (V?nh vi?n)', 'Chuy?n Kho?n VietQR (24/7)',
         '', 'buyer1@test.com', '', 'Pending', NULL, NULL)
");
ok($db->affected_rows === 1, 'Chu?n b?: t?o ??n Pending TSTSERIAL1');

echo "\n--- NH?M 1: X?C TH?C ---\n";

// 1.1 Kh?ng c? ch? k?
$r = send_webhook($BASE_URL, $SECRET, ['id' => 1], ['omit_signature' => true]);
ok($r['http'] === 401, 'Thi?u ch? k? -> 401', 'http=' . $r['http']);

// 1.2 Ch? k? sai
$r = send_webhook($BASE_URL, $SECRET, ['id' => 2], ['signature' => 'sha256=deadbeef']);
ok($r['http'] === 401, 'Ch? k? sai -> 401', 'http=' . $r['http']);

// 1.3 Timestamp c? (replay)
$r = send_webhook($BASE_URL, $SECRET, ['id' => 3], ['timestamp' => time() - 4000]);
ok($r['http'] === 401, 'Timestamp c? -> 401 (ch?ng replay)', 'http=' . $r['http']);

// 1.4 Kh?ng c? timestamp
$r = send_webhook($BASE_URL, $SECRET, ['id' => 4], ['omit_timestamp' => true]);
ok($r['http'] === 401, 'Thi?u timestamp -> 401', 'http=' . $r['http']);

// 1.5 DB kh?ng ???c ghi b?i c?c request b? t? ch?i
$row = q1($db, "SELECT COUNT(*) AS c FROM payment_transactions");
ok((int)$row['c'] === 0, 'Request b? t? ch?i kh?ng ghi v?o DB', 'count=' . $row['c']);

echo "\n--- NH?M 2: GIAO D?CH H?P L? ---\n";

// 2.1 Ti?n v?o ??ng, kh?p serial trong registrations
$r = send_webhook($BASE_URL, $SECRET, [
    'id'               => 92704,
    'gateway'          => 'MBBank',
    'transactionDate'  => '2026-11-03 15:30:00',
    'accountNumber'    => '0379050602',
    'code'             => '',
    'content'          => 'UR alioth TSTSERIAL1 buyer1@test.com',
    'transferType'     => 'in',
    'description'      => 'NGUYEN VAN A chuyen tien',
    'transferAmount'   => 50000,
    'accumulated'      => 50000,
    'referenceCode'    => 'FT2600001',
]);
ok($r['http'] === 200, 'HTTP 200', 'http=' . $r['http']);
ok(($r['json']['success'] ?? false) === true, 'Body c? success=true (SePay kh?ng retry)', json_encode($r['json']));
ok(($r['json']['matched'] ?? false) === true, 'matched=true', json_encode($r['json']));
ok(($r['json']['serial'] ?? '') === 'TSTSERIAL1', 'Tr? v? ??ng serial', $r['json']['serial'] ?? '');
ok(($r['json']['regUpdated'] ?? false) === true, '?? c?p nh?t registrations');
ok(($r['json']['serialInserted'] ?? false) === true, '?? ch?n v?o b?ng serial');

// 2.2 Ki?m tra DB: registrations -> Active
$reg = q1($db, "SELECT status, transaction_code, activated_at, expired_at FROM registrations WHERE serial='TSTSERIAL1'");
ok($reg['status'] === 'Active', 'registrations.status = Active', $reg['status']);
ok(strpos((string)$reg['transaction_code'], 'SEPAY-92704') === 0, 'transaction_code = SEPAY-92704', (string)$reg['transaction_code']);
ok($reg['activated_at'] !== null, 'activated_at ?? set');
ok($reg['expired_at'] === null, 'expired_at = NULL (v?nh vi?n)', (string)$reg['expired_at']);

// 2.3 Ki?m tra DB: b?ng serial c? b?n ghi
$ser = q1($db, "SELECT STT, Device, Serial, Gmail, Time FROM serial WHERE Serial='TSTSERIAL1'");
ok($ser !== null, '?? th?m v?o b?ng serial (b?ng quy?t ??nh b?n quy?n)');
ok(($ser['Time'] ?? '') === 'unlimited', 'serial.Time = unlimited', (string)($ser['Time'] ?? ''));
ok(($ser['Device'] ?? '') === 'alioth', 'serial.Device l?y t? codename', (string)($ser['Device'] ?? ''));
ok(($ser['Gmail'] ?? '') === 'buyer1@test.com', 'serial.Gmail l?y t? email ??n', (string)($ser['Gmail'] ?? ''));

// 2.4 B?ng giao d?ch
$tx = q1($db, "SELECT status, matched_serial, matched_email FROM payment_transactions WHERE sepay_id=92704");
ok(($tx['status'] ?? '') === 'matched', 'payment_transactions.status = matched', (string)($tx['status'] ?? ''));
ok(($tx['matched_serial'] ?? '') === 'TSTSERIAL1', 'L?u matched_serial', (string)($tx['matched_serial'] ?? ''));

// 2.5 Audit log
$log = q1($db, "SELECT action, username FROM admin_logs WHERE record_id='TSTSERIAL1' AND action='payment_activate' ORDER BY id DESC LIMIT 1");
ok($log !== null, '?? ghi admin_logs (audit)');
ok(($log['username'] ?? '') === 'sepay_webhook', 'admin_logs.username = sepay_webhook', (string)($log['username'] ?? ''));

echo "\n--- NH?M 3: CH?NG TR?NG (SePay retry) ---\n";

$before = q1($db, "SELECT COUNT(*) AS c FROM serial");
$r = send_webhook($BASE_URL, $SECRET, [
    'id'             => 92704,   // c?ng id
    'gateway'        => 'MBBank',
    'content'        => 'UR alioth TSTSERIAL1 buyer1@test.com',
    'transferType'   => 'in',
    'transferAmount' => 50000,
]);
$after = q1($db, "SELECT COUNT(*) AS c FROM serial");

ok($r['http'] === 200, 'Retry c?ng id -> HTTP 200', 'http=' . $r['http']);
ok(($r['json']['duplicate'] ?? false) === true, 'B?o duplicate=true', json_encode($r['json']));
ok((int)$before['c'] === (int)$after['c'], 'Kh?ng t?o th?m b?n ghi serial', "{$before['c']} -> {$after['c']}");

echo "\n--- NH?M 4: C?C TR??NG H?P KH?NG K?CH HO?T ---\n";

// 4.1 Ti?n ra (transferType = out)
$r = send_webhook($BASE_URL, $SECRET, [
    'id'             => 50001,
    'content'        => 'UR alioth TSTSERIAL2 x@test.com',
    'transferType'   => 'out',
    'transferAmount' => 50000,
]);
ok($r['http'] === 200, 'Ti?n ra -> 200 (b? qua)', 'http=' . $r['http']);

// 4.2 Ti?n v?o kh?ng ?? (bi?n: 39.999? < ng??ng 40.000?)
$db->query("
    INSERT INTO registrations (serial, codename, plan, sender_email, status)
    VALUES ('TSTSERIAL2', 'alioth', 'Test', 'buyer2@test.com', 'Pending')
");
$r = send_webhook($BASE_URL, $SECRET, [
    'id'             => 50002,
    'content'        => 'UR alioth TSTSERIAL2 buyer2@test.com',
    'transferType'   => 'in',
    'transferAmount' => 39999,   // < 40000
]);
ok($r['http'] === 200, 'Ti?n ch?a ?? -> 200', 'http=' . $r['http']);
ok(($r['json']['matched'] ?? true) === false, 'Ti?n ch?a ?? -> matched=false', json_encode($r['json']));

$reg2 = q1($db, "SELECT status FROM registrations WHERE serial='TSTSERIAL2'");
ok($reg2['status'] === 'Pending', 'Ti?n ch?a ?? -> KH?NG k?ch ho?t (v?n Pending)', $reg2['status']);
$ser2 = q1($db, "SELECT COUNT(*) AS c FROM serial WHERE Serial='TSTSERIAL2'");
ok((int)$ser2['c'] === 0, 'Ti?n ch?a ?? -> kh?ng th?m v?o b?ng serial', 'count=' . $ser2['c']);

// 4.3 N?i dung kh?ng c? serial
$r = send_webhook($BASE_URL, $SECRET, [
    'id'             => 50003,
    'content'        => 'chuyen tien mua rom',
    'transferType'   => 'in',
    'transferAmount' => 50000,
]);
ok($r['http'] === 200, 'Kh?ng kh?p serial -> 200 (kh?ng retry)', 'http=' . $r['http']);
ok(($r['json']['matched'] ?? true) === false, 'Kh?ng kh?p -> matched=false', json_encode($r['json']));

$tx3 = q1($db, "SELECT status FROM payment_transactions WHERE sepay_id=50003");
ok(($tx3['status'] ?? '') === 'unmatched', 'Ghi l?i giao d?ch kh?ng kh?p ?? admin soi', (string)($tx3['status'] ?? ''));

echo "\n--- NH?M 5: SERIAL ?? C? S?N ---\n";

$db->query("INSERT INTO serial (STT, Device, Serial, Gmail, Time) VALUES (999001, 'vangogh', 'TSTSERIAL3', 'old@test.com', 'unlimited')");
$r = send_webhook($BASE_URL, $SECRET, [
    'id'             => 50004,
    'content'        => 'UR vangogh TSTSERIAL3 old@test.com',
    'transferType'   => 'in',
    'transferAmount' => 50000,
]);
ok($r['http'] === 200, 'Serial ?? t?n t?i -> 200', 'http=' . $r['http']);
ok(($r['json']['serialInserted'] ?? true) === false, 'Kh?ng ch?n tr?ng b?n ghi serial', json_encode($r['json']));

$cnt = q1($db, "SELECT COUNT(*) AS c FROM serial WHERE Serial='TSTSERIAL3'");
ok((int)$cnt['c'] === 1, 'Ch? c? 1 b?n ghi TSTSERIAL3', 'count=' . $cnt['c']);

echo "\n--- NH?M 5B: BI?N S? TI?N ---\n";

// ??ng m?c t?i thi?u 40.000? ph?i ???C k?ch ho?t (kh?ng l?i off-by-one)
$db->query("
    INSERT INTO registrations (serial, codename, plan, sender_email, status)
    VALUES ('TSTSERIAL4', 'alioth', 'Test', 'buyer4@test.com', 'Pending')
");
$r = send_webhook($BASE_URL, $SECRET, [
    'id'             => 50005,
    'content'        => 'UR alioth TSTSERIAL4 buyer4@test.com',
    'transferType'   => 'in',
    'transferAmount' => 40000,   // == ng??ng
]);
ok(($r['json']['matched'] ?? false) === true, '??ng 40.000? -> ???c k?ch ho?t', json_encode($r['json']));
$reg4 = q1($db, "SELECT status FROM registrations WHERE serial='TSTSERIAL4'");
ok(($reg4['status'] ?? '') === 'Active', '??n 40.000? -> Active', (string)($reg4['status'] ?? ''));

echo "\n--- NH?M 6: HEALTH CHECK & METHOD ---\n";

$ch = curl_init($BASE_URL);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$hj = json_decode((string)$res, true);
ok($code === 200, 'GET health-check -> 200', 'http=' . $code);
ok(($hj['success'] ?? false) === true, 'Health-check success=true');
ok(($hj['hmacConfigured'] ?? false) === true, 'Health-check b?o ?? c?u h?nh HMAC');

$ch = curl_init($BASE_URL);
curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => 'PUT', CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
ok($code === 405, 'Method kh?c POST/GET -> 405', 'http=' . $code);

// ------------------------------------------------------------
// T?ng k?t
// ------------------------------------------------------------
$db->close();

echo "\n==============================================\n";
echo "PASS: {$pass}   FAIL: {$fail}\n";
echo "==============================================\n";
exit($fail === 0 ? 0 : 1);

