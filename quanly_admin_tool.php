<?php
session_start();

$servername = "localhost";
$username = "ycoozxap_lcnguyn06";
$password = "Tl29126@"; 
$dbname = "ycoozxap_fixbanktool";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) die("Lỗi kết nối máy chủ");

// ==========================================
// 1. ĐĂNG NHẬP & ĐĂNG XUẤT
// ==========================================
if (isset($_POST['admin_login'])) {
    $tk_login = trim($_POST['admin_user']);
    $pass_login = trim($_POST['admin_pass']); 

    $stmt = $conn->prepare("SELECT password, role FROM users WHERE username = ? LIMIT 1");
    $stmt->bind_param("s", $tk_login);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows > 0) {
        $stmt->bind_result($db_pass, $db_role);
        $stmt->fetch();
        if (password_verify($pass_login, $db_pass)) {
            if ($db_role === 'admin') {
                $_SESSION['is_admin'] = true;
                $_SESSION['admin_name'] = $tk_login;
                header("Location: quanly_admin_tool.php"); 
                exit;
            } else {
                $error = "Tài khoản này không có quyền Quản trị!";
            }
        } else {
            $error = "Sai mật khẩu!";
        }
    } else {
        $error = "Tài khoản không tồn tại!";
    }
    $stmt->close();
}

if (isset($_GET['logout'])) {
    session_destroy();
    header("Location: quanly_admin_tool.php"); 
    exit;
}

// GIAO DIỆN ĐĂNG NHẬP ADMIN
if (!isset($_SESSION['is_admin'])) {
    ?>
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Đăng nhập Quản Trị</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body class="bg-light d-flex align-items-center justify-content-center" style="height: 100vh;">
        <div class="card shadow-lg border-0" style="width: 400px;">
            <div class="card-header bg-primary text-white text-center py-3">
                <h4 class="mb-0">HỆ THỐNG QUẢN TRỊ</h4>
            </div>
            <div class="card-body p-4">
                <?php if (isset($error)) echo "<div class='alert alert-danger'>$error</div>"; ?>
                <form method='POST'>
                    <div class="mb-3">
                        <label class="form-label fw-bold">Tài khoản Admin</label>
                        <input type='text' name='admin_user' class="form-control" required>
                    </div>
                    <div class="mb-4">
                        <label class="form-label fw-bold">Mật khẩu</label>
                        <input type='password' name='admin_pass' class="form-control" required>
                    </div>
                    <button type='submit' name='admin_login' class="btn btn-primary w-100 fw-bold">ĐĂNG NHẬP</button>
                </form>
            </div>
        </div>
    </body>
    </html>
    <?php
    exit;
}

// ==========================================
// 2. XỬ LÝ THÊM, SỬA, XÓA
// ==========================================
if (isset($_POST['add_user'])) {
    $fullname = trim($_POST['new_fullname']);
    $email = trim($_POST['new_email']);
    $tk = trim($_POST['new_tk']);
    $pass = trim($_POST['new_pass']);
    $role = $_POST['new_role']; 
    
    if (!empty($tk) && !empty($pass)) {
        $check = $conn->prepare("SELECT id FROM users WHERE username = ?");
        $check->bind_param("s", $tk);
        $check->execute();
        $check->store_result();
        if ($check->num_rows > 0) {
            $msg = "<div class='alert alert-danger'>Lỗi: Tên đăng nhập <b>$tk</b> đã tồn tại!</div>";
        } else {
            $hashed = password_hash($pass, PASSWORD_DEFAULT);
            $stmt = $conn->prepare("INSERT INTO users (fullname, email, username, password, role) VALUES (?, ?, ?, ?, ?)");
            $stmt->bind_param("sssss", $fullname, $email, $tk, $hashed, $role);
            $stmt->execute();
            $stmt->close();
            $msg = "<div class='alert alert-success'>Thành công: Đã cấp tài khoản <b>$tk</b>.</div>";
        }
        $check->close();
    }
}

if (isset($_POST['update_user'])) {
    $id = $_POST['edit_id'];
    $fullname = trim($_POST['edit_fullname']);
    $email = trim($_POST['edit_email']);
    $tk = trim($_POST['edit_tk']);
    $role = $_POST['edit_role'];
    $pass = trim($_POST['edit_pass']); 

    if (!empty($pass)) {
        $hashed = password_hash($pass, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("UPDATE users SET fullname=?, email=?, username=?, password=?, role=? WHERE id=?");
        $stmt->bind_param("sssssi", $fullname, $email, $tk, $hashed, $role, $id);
    } else {
        $stmt = $conn->prepare("UPDATE users SET fullname=?, email=?, username=?, role=? WHERE id=?");
        $stmt->bind_param("ssssi", $fullname, $email, $tk, $role, $id);
    }
    $stmt->execute();
    $stmt->close();
    header("Location: quanly_admin_tool.php"); 
    exit;
}

if (isset($_GET['delete'])) {
    $id_del = $_GET['delete'];
    $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
    $stmt->bind_param("i", $id_del);
    $stmt->execute();
    $stmt->close();
    header("Location: quanly_admin_tool.php"); 
    exit;
}

$edit_mode = false;
if (isset($_GET['edit'])) {
    $edit_mode = true;
    $edit_id = $_GET['edit'];
    $stmt = $conn->prepare("SELECT fullname, email, username, role FROM users WHERE id=?");
    $stmt->bind_param("i", $edit_id);
    $stmt->execute();
    $stmt->bind_result($e_fullname, $e_email, $e_tk, $e_role);
    $stmt->fetch();
    $stmt->close();
}

$result = $conn->query("SELECT id, fullname, email, username, role FROM users ORDER BY id DESC");
?>

<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quản Trị Hệ Thống Tool</title>
    <!-- Tích hợp Bootstrap 5 & Icon -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
    <style>
        body { background-color: #f4f6f9; }
        .navbar { box-shadow: 0 2px 4px rgba(0,0,0,.08); }
        .card { border: none; box-shadow: 0 0 15px rgba(0,0,0,.05); border-radius: 10px; }
        .table th { background-color: #f8f9fa; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.5px; }
        .table-hover tbody tr:hover { background-color: #f1f5f9; }
    </style>
</head>
<body>

<!-- Navbar -->
<nav class="navbar navbar-expand-lg navbar-dark bg-dark mb-4">
    <div class="container">
        <a class="navbar-brand fw-bold" href="quanly_admin_tool.php">
            <i class="bi bi-shield-lock"></i> FIXBANK TOOL ADMIN
        </a>
        <div class="d-flex align-items-center">
            <span class="text-light me-3"><i class="bi bi-person-circle"></i> Xin chào, <b><?php echo $_SESSION['admin_name']; ?></b></span>
            <a href="?logout=true" class="btn btn-outline-danger btn-sm"><i class="bi bi-box-arrow-right"></i> Đăng xuất</a>
        </div>
    </div>
</nav>

<div class="container">
    <?php if(isset($msg)) echo $msg; ?>

    <div class="row">
        <!-- CỘT TRÁI: FORM THÊM/SỬA -->
        <div class="col-lg-4 mb-4">
            <?php if ($edit_mode): ?>
                <div class="card border-warning">
                    <div class="card-header bg-warning text-dark fw-bold">
                        <i class="bi bi-pencil-square"></i> Cập Nhật Tài Khoản (ID: <?php echo $edit_id; ?>)
                    </div>
                    <div class="card-body bg-light">
                        <form method="POST" action="quanly_admin_tool.php">
                            <input type="hidden" name="edit_id" value="<?php echo $edit_id; ?>">
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Họ và tên</label>
                                <input type="text" name="edit_fullname" class="form-control" value="<?php echo htmlspecialchars($e_fullname); ?>" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Email</label>
                                <input type="email" name="edit_email" class="form-control" value="<?php echo htmlspecialchars($e_email); ?>" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Tài khoản đăng nhập</label>
                                <input type="text" name="edit_tk" class="form-control" value="<?php echo htmlspecialchars($e_tk); ?>" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-danger">Mật khẩu mới (Để trống nếu giữ nguyên)</label>
                                <input type="text" name="edit_pass" class="form-control" placeholder="Nhập mật khẩu mới...">
                            </div>
                            <div class="mb-4">
                                <label class="form-label small fw-bold">Phân quyền</label>
                                <select name="edit_role" class="form-select">
                                    <option value="user" <?php if($e_role=='user') echo 'selected'; ?>>👤 Khách hàng (User)</option>
                                    <option value="admin" <?php if($e_role=='admin') echo 'selected'; ?>>🛡️ Quản trị (Admin)</option>
                                </select>
                            </div>
                            <div class="d-grid gap-2">
                                <button type="submit" name="update_user" class="btn btn-warning fw-bold"><i class="bi bi-save"></i> LƯU THAY ĐỔI</button>
                                <a href="quanly_admin_tool.php" class="btn btn-secondary fw-bold">HỦY BỎ</a>
                            </div>
                        </form>
                    </div>
                </div>
            <?php else: ?>
                <div class="card border-primary">
                    <div class="card-header bg-primary text-white fw-bold">
                        <i class="bi bi-person-plus-fill"></i> Cấp Tài Khoản Mới
                    </div>
                    <div class="card-body">
                        <form method="POST">
                            <div class="mb-3">
                                <input type="text" name="new_fullname" class="form-control" placeholder="Họ và tên" required>
                            </div>
                            <div class="mb-3">
                                <input type="email" name="new_email" class="form-control" placeholder="Email" required>
                            </div>
                            <div class="mb-3">
                                <input type="text" name="new_tk" class="form-control" placeholder="Tên đăng nhập" required>
                            </div>
                            <div class="mb-3">
                                <input type="text" name="new_pass" class="form-control" placeholder="Mật khẩu" required>
                            </div>
                            <div class="mb-4">
                                <select name="new_role" class="form-select">
                                    <option value="user">👤 Khách hàng (User)</option>
                                    <option value="admin">🛡️ Quản trị (Admin)</option>
                                </select>
                            </div>
                            <button type="submit" name="add_user" class="btn btn-primary w-100 fw-bold"><i class="bi bi-plus-circle"></i> TẠO TÀI KHOẢN</button>
                        </form>
                    </div>
                </div>
            <?php endif; ?>
        </div>

        <!-- CỘT PHẢI: BẢNG DANH SÁCH -->
        <div class="col-lg-8">
            <div class="card">
                <div class="card-header bg-white fw-bold py-3">
                    <i class="bi bi-people-fill text-primary"></i> DANH SÁCH KHÁCH HÀNG
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th class="ps-3">ID</th>
                                    <th>Khách hàng</th>
                                    <th>Tài khoản</th>
                                    <th>Quyền</th>
                                    <th class="text-end pe-3">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php while($row = $result->fetch_assoc()): ?>
                                <tr>
                                    <td class="ps-3 text-muted">#<?php echo $row['id']; ?></td>
                                    <td>
                                        <div class="fw-bold"><?php echo htmlspecialchars($row['fullname'] ?? ''); ?></div>
                                        <div class="small text-muted"><?php echo htmlspecialchars($row['email'] ?? ''); ?></div>
                                    </td>
                                    <td><span class="text-primary fw-bold"><?php echo htmlspecialchars($row['username']); ?></span></td>
                                    <td>
                                        <?php if($row['role'] == 'admin'): ?>
                                            <span class="badge bg-danger"><i class="bi bi-shield-fill"></i> Admin</span>
                                        <?php else: ?>
                                            <span class="badge bg-secondary"><i class="bi bi-person-fill"></i> User</span>
                                        <?php endif; ?>
                                    </td>
                                    <td class="text-end pe-3">
                                        <a href="?edit=<?php echo $row['id']; ?>" class="btn btn-sm btn-outline-warning" title="Sửa">
                                            <i class="bi bi-pencil"></i>
                                        </a>
                                        <?php if($row['username'] !== $_SESSION['admin_name']): ?>
                                            <a href="?delete=<?php echo $row['id']; ?>" class="btn btn-sm btn-outline-danger ms-1" onclick="return confirm('Bạn có chắc chắn muốn xóa vĩnh viễn khách hàng này?');" title="Xóa">
                                                <i class="bi bi-trash"></i>
                                            </a>
                                        <?php endif; ?>
                                    </td>
                                </tr>
                                <?php endwhile; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
<?php $conn->close(); ?>