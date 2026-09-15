/**
 * api/update-link.js
 * Vercel Serverless Function
 * Tiếp nhận Webhook từ Google Apps Script khi có ROM mới tải lên Google Drive
 */

export default async function handler(req, res) {
  // 1. Chỉ chấp nhận phương thức POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: true, 
      message: 'Chỉ hỗ trợ phương thức POST' 
    });
  }

  // 2. Xác thực Secret Token
  const SECRET_TOKEN = process.env.DRIVE_WEBHOOK_SECRET || 'ma_bao_mat_cua_ban';
  const authHeader = req.headers['authorization'];
  
  if (authHeader !== `Bearer ${SECRET_TOKEN}`) {
    return res.status(401).json({ 
      error: true, 
      message: 'Từ chối truy cập: Mã bảo mật không hợp lệ' 
    });
  }

  try {
    const payload = req.body;
    console.log('📡 Nhận dữ liệu Webhook từ Google Drive:', payload);

    /**
     * Dữ liệu payload có thể là:
     * 1. Danh sách toàn bộ active_roms
     * 2. Hoặc một file đơn lẻ: { fileId, fileName, webViewLink, webContentLink, lastUpdated }
     */

    // Trả về kết quả thành công
    return res.status(200).json({
      success: true,
      message: 'Đã nhận và xử lý Webhook thành công',
      receivedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Lỗi khi xử lý webhook:', error);
    return res.status(500).json({ 
      error: true, 
      message: 'Lỗi máy chủ cục bộ', 
      details: error.message 
    });
  }
}
