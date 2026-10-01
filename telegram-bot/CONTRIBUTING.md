# Contributing to HyperUR Telegram Bot

Cảm ơn bạn đã quan tâm đến việc đóng góp cho HyperUR Bot! 🎉

## 📋 Mục Lục

- [Code of Conduct](#code-of-conduct)
- [Làm thế nào để đóng góp](#làm-thế-nào-để-đóng-góp)
- [Báo cáo lỗi](#báo-cáo-lỗi)
- [Đề xuất tính năng](#đề-xuất-tính-năng)
- [Coding Guidelines](#coding-guidelines)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

Dự án này tuân theo [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/). Bằng việc tham gia, bạn đồng ý tuân theo các quy tắc này.

## Làm thế nào để đóng góp

### 🐛 Báo cáo lỗi

Trước khi báo cáo lỗi:

1. Kiểm tra xem lỗi đã được báo cáo chưa trong [Issues](https://github.com/your-repo/issues)
2. Đảm bảo bạn đang dùng phiên bản mới nhất
3. Thu thập thông tin về lỗi (logs, screenshots, steps to reproduce)

Khi tạo bug report:

- Sử dụng tiêu đề rõ ràng và mô tả
- Mô tả các bước để reproduce lỗi
- Giải thích hành vi mong đợi vs hành vi thực tế
- Cung cấp screenshots nếu có thể
- Đính kèm logs (bỏ sensitive data)
- Ghi rõ environment (OS, Node version, etc.)

### 💡 Đề xuất tính năng

Trước khi đề xuất tính năng:

1. Kiểm tra xem tính năng đã được đề xuất chưa
2. Đảm bảo tính năng phù hợp với mục tiêu của project

Khi tạo feature request:

- Tiêu đề rõ ràng
- Mô tả chi tiết tính năng
- Giải thích tại sao tính năng này hữu ích
- Đưa ra ví dụ cụ thể nếu có thể

## Coding Guidelines

### JavaScript Style

Chúng tôi tuân theo [JavaScript Standard Style](https://standardjs.com/):

```javascript
// ✅ Good
async function processData(input) {
  try {
    const result = await fetchData(input);
    return result;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// ❌ Bad
async function processData(input){
    let result=await fetchData(input)
    return result
}
```

### Naming Conventions

- **Variables & Functions**: camelCase
  ```javascript
  const userName = 'John';
  function getUserData() {}
  ```

- **Classes**: PascalCase
  ```javascript
  class BillHandler {}
  ```

- **Constants**: UPPER_SNAKE_CASE
  ```javascript
  const MAX_RETRY_COUNT = 3;
  ```

- **Files**: camelCase hoặc kebab-case
  ```
  billHandler.js
  user-service.js
  ```

### Comments

- Sử dụng JSDoc cho functions
- Giải thích "why" không phải "what"
- Giữ comments ngắn gọn và có ý nghĩa

```javascript
/**
 * Approve bill and send ROM link to user
 * @param {string} billId - The bill ID
 * @param {number} adminId - Admin who approved
 * @param {string} romLink - ROM download link
 * @returns {Promise<Object>} Updated bill object
 */
async function approveBill(billId, adminId, romLink) {
  // Implementation
}
```

### Error Handling

Luôn handle errors properly:

```javascript
// ✅ Good
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', error);
  throw new CustomError('User-friendly message');
}

// ❌ Bad
try {
  await riskyOperation();
} catch (error) {
  console.log(error);
}
```

### Async/Await

Ưu tiên async/await thay vì callbacks:

```javascript
// ✅ Good
async function getData() {
  const result = await fetchData();
  return result;
}

// ❌ Bad
function getData(callback) {
  fetchData((error, result) => {
    callback(error, result);
  });
}
```

## Pull Request Process

### 1. Fork & Clone

```bash
git clone https://github.com/your-username/HyperUR_V3.git
cd HyperUR_V3/telegram-bot
```

### 2. Create Branch

```bash
git checkout -b feature/your-feature-name
# hoặc
git checkout -b fix/bug-description
```

Branch naming:
- `feature/` - Tính năng mới
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring

### 3. Make Changes

- Viết code clean và có ý nghĩa
- Thêm tests nếu có thể
- Update documentation nếu cần
- Follow coding guidelines

### 4. Test

```bash
# Chạy tests (nếu có)
npm test

# Test thủ công
npm start
```

### 5. Commit

Sử dụng [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add auto-approve feature"
git commit -m "fix: resolve bill upload error"
git commit -m "docs: update README setup guide"
```

Commit types:
- `feat`: Tính năng mới
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting)
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

### 6. Push & Create PR

```bash
git push origin feature/your-feature-name
```

Sau đó tạo Pull Request trên GitHub với:

- Tiêu đề rõ ràng
- Mô tả chi tiết changes
- Link đến related issues
- Screenshots nếu có UI changes

### 7. Code Review

- Trả lời comments từ reviewers
- Make requested changes
- Keep PR updated với main branch

### 8. Merge

Sau khi được approve, PR sẽ được merge bởi maintainers.

## Development Setup

```bash
# Clone repo
git clone https://github.com/your-repo/HyperUR_V3.git
cd HyperUR_V3/telegram-bot

# Install dependencies
npm install

# Copy env file
cp .env.example .env

# Edit .env với credentials
nano .env

# Start development
npm run dev
```

## Testing

```bash
# Run all tests
npm test

# Run specific test
npm test -- database.test.js

# Run with coverage
npm run test:coverage
```

## Project Structure

Hiểu rõ cấu trúc để biết đặt code ở đâu:

```
telegram-bot/
├── bot.js              # Entry point
├── config.js           # Configuration
├── database.js         # Database layer
├── handlers/           # Request handlers
│   ├── billHandler.js
│   ├── adminHandler.js
│   └── userHandler.js
├── utils.js           # Utilities
├── logger.js          # Logging
└── integration.js     # Website integration
```

## Resources

- [Telegraf Documentation](https://telegraf.js.org/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [JavaScript Style Guide](https://github.com/airbnb/javascript)

## Questions?

- Mở issue với tag `question`
- Liên hệ maintainers:
  - [@lcnguy06](https://t.me/lcnguy06)
  - [@Usagi79](https://t.me/Usagi79)

---

Cảm ơn bạn đã đóng góp! 🙏
