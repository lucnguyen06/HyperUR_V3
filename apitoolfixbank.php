<?php
$servername = "localhost";
$username = "ycoozxap_lcnguyn06";
$password = "Tl29126@"; // <-- ĐIỀN LẠI MẬT KHẨU DATABASE VÀO ĐÂY
$dbname = "ycoozxap_fixbanktool";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    die("Lỗi kết nối máy chủ");
}

$tk = isset($_POST['tk']) ? $_POST['tk'] : '';
$pass = isset($_POST['pass']) ? $_POST['pass'] : '';

if (!empty($tk) && !empty($pass)) {
    $stmt = $conn->prepare("SELECT password FROM users WHERE username = ? LIMIT 1");
    $stmt->bind_param("s", $tk);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows > 0) {
        $stmt->bind_result($hashed_password_from_db);
        $stmt->fetch();
        if (password_verify($pass, $hashed_password_from_db)) {
            echo "SUCCESS";
        } else {
            echo "FAIL_PASSWORD";
        }
    } else {
        echo "FAIL_USER";
    }
    $stmt->close();
} else {
    echo "FAIL_EMPTY";
}
$conn->close();
?>