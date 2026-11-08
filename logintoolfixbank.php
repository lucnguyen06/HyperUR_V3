<?php
$servername = "localhost";
$username = "ycoozxap_lcnguyn06";
$password = "Tl29126@"; // Mật khẩu Database
$dbname = "ycoozxap_fixbanktool";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    die("FAIL_DB");
}

$tk = isset($_POST['tk']) ? $_POST['tk'] : '';
$pass = isset($_POST['pass']) ? $_POST['pass'] : '';

if (!empty($tk) && !empty($pass)) {
    // 1. Cập nhật câu lệnh lấy thêm trường fullname
    $stmt = $conn->prepare("SELECT password, fullname FROM users WHERE username = ? LIMIT 1");
    $stmt->bind_param("s", $tk);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows > 0) {
        // 2. Hứng dữ liệu trả về gồm mật khẩu băm và họ tên
        $stmt->bind_result($hashed_password_from_db, $fullname_from_db);
        $stmt->fetch();
        
        // 3. Kiểm tra mật khẩu
        if (password_verify($pass, $hashed_password_from_db)) {
            // Trả về SUCCESS kèm theo họ tên, ngăn cách bằng dấu |
            // Nếu fullname rỗng (khách cũ), sẽ trả về "Khách Hàng"
            $ten_hien_thi = !empty($fullname_from_db) ? $fullname_from_db : "Khách Hàng";
            echo "SUCCESS|" . $ten_hien_thi;
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