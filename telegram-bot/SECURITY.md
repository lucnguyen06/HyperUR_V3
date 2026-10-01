# Security Policy

## Supported Versions

Các phiên bản đang được hỗ trợ security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

Nếu bạn phát hiện lỗ hổng bảo mật trong HyperUR Telegram Bot, vui lòng **KHÔNG** tạo public issue.

### Cách báo cáo

1. **Email riêng tư:**
   - Gửi email đến: security@hyperur.com (hoặc admin email)
   - Subject: `[SECURITY] HyperUR Bot - Description`

2. **Telegram:**
   - Liên hệ trực tiếp: [@lcnguy06](https://t.me/lcnguy06) hoặc [@Usagi79](https://t.me/Usagi79)
   - Nêu rõ đây là security issue

### Thông tin cần cung cấp

- Mô tả chi tiết lỗ hổng
- Steps to reproduce
- Potential impact
- Suggested fix (nếu có)
- Your contact information

### Response Timeline

- **24h**: Xác nhận đã nhận báo cáo
- **72h**: Đánh giá ban đầu và severity
- **7 days**: Plan để fix
- **30 days**: Release patch (cho critical issues)

### Disclosure Policy

Chúng tôi tuân theo **Responsible Disclosure**:

1. Không public disclose cho đến khi có patch
2. Credit sẽ được ghi nhận trong CHANGELOG
3. Patch sẽ được release sớm nhất có thể

## Security Best Practices

### Cho Users

1. **Bảo vệ .env file:**
   - Không commit vào git
   - Không share publicly
   - Set proper file permissions

2. **Bot Token:**
   - Revoke token ngay nếu bị lộ
   - Không share token với ai
   - Tạo token mới từ @BotFather nếu nghi ngờ

3. **Admin IDs:**
   - Chỉ add admin đáng tin cậy
   - Review danh sách admin thường xuyên
   - Xóa admin không còn cần thiết

4. **Server Security:**
   - Keep server updated
   - Use firewall
   - Enable SSH key authentication
   - Disable root login

5. **Database:**
   - Backup thường xuyên
   - Encrypt sensitive data
   - Set proper file permissions

### Cho Developers

1. **Input Validation:**
   ```javascript
   // ✅ Always validate user input
   if (!isValidDeviceCode(input)) {
     throw new Error('Invalid input');
   }
   ```

2. **Sanitize Output:**
   ```javascript
   // ✅ Escape markdown characters
   const escaped = Utils.escapeMarkdown(userInput);
   ```

3. **Rate Limiting:**
   ```javascript
   // ✅ Implement rate limiting
   if (!rateLimit.check(userId)) {
     return ctx.reply('Too many requests');
   }
   ```

4. **Error Handling:**
   ```javascript
   // ✅ Never expose sensitive info in errors
   catch (error) {
     logger.error(error); // Log full error
     ctx.reply('An error occurred'); // Generic message to user
   }
   ```

5. **Dependencies:**
   ```bash
   # ✅ Audit dependencies regularly
   npm audit
   npm audit fix
   ```

## Known Security Considerations

### 1. File Upload
- Bills are stored locally
- Max file size enforced
- File type validation
- No execution of uploaded files

### 2. Database
- JSON file-based (không public accessible)
- No SQL injection risk
- Consider encryption for sensitive data

### 3. API Keys
- Stored in .env
- Not committed to git
- Server-side only

### 4. Rate Limiting
- Implemented for photo uploads
- Prevents spam and abuse

### 5. Admin Access
- Admin IDs validated
- No privilege escalation possible
- Actions logged

## Security Checklist

- [ ] .env file not in git
- [ ] BOT_TOKEN kept secret
- [ ] Admin IDs restricted
- [ ] File uploads validated
- [ ] Rate limiting enabled
- [ ] Error messages sanitized
- [ ] Dependencies up to date
- [ ] Logs don't contain sensitive data
- [ ] Server properly secured
- [ ] Regular backups configured

## Updates

Security updates được release ngay khi có patch. Theo dõi:

- GitHub Releases
- Telegram Channel: @hypermodupdate
- Email notifications (nếu subscribed)

## Contact

Security concerns: security@hyperur.com

Maintainers:
- [@lcnguy06](https://t.me/lcnguy06)
- [@Usagi79](https://t.me/Usagi79)

---

**Lưu ý:** Document này sẽ được cập nhật khi có thay đổi về security policy.

Last updated: 2026-10-01
