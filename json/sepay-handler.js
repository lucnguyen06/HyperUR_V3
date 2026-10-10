/**
 * SePay Payment Handler
 * HyperUR V3 - Quản lý luồng thanh toán SePay
 */

(function () {
  'use strict';

  const config = window.SEPAY_CONFIG || {};
  
  // State management
  const state = {
    currentSerial: null,
    currentPlan: null,
    selectedAmount: 50000,
    transactionId: null,
    isProcessing: false,
    paymentStatus: null
  };

  // Public API
  window.SePayHandler = {
    
    /**
     * Khởi tạo SePay QR & Payment Form
     * @param {string} serial - Serial number
     * @param {number} amount - Amount in VND
     */
    initPayment: function(serial, amount = 50000) {
      state.currentSerial = serial;
      state.selectedAmount = amount;
      
      console.log('SePay: Initializing payment for serial:', serial, 'amount:', amount);
      
      // Generate QR code for bank transfer
      this.generateQRCode(amount);
      
      // Update payment form
      this.updatePaymentForm(serial, amount);
    },

    /**
     * Tạo QR Code từ SePay API hoặc static VietQR fallback
     */
    generateQRCode: function(amount) {
      const { bankCode, accountNo, accountName } = config.BANK_INFO;
      
      // Try SePay API first
      const qrUrl = `${config.API_URL}/qr/create?bank=${bankCode}&account=${accountNo}&template=compact&amount=${amount}`;
      
      const qrImg = document.getElementById('payment-qr-image');
      if (qrImg) {
        // First try SePay API
        qrImg.src = qrUrl;
        qrImg.alt = `QR Code - ${bankCode} ${accountNo} - ${amount.toLocaleString('vi-VN')}đ`;
        
        // Fallback to static VietQR if API fails
        qrImg.onerror = function() {
          console.warn('SePay API QR failed, using VietQR fallback');
          qrImg.src = 'https://vietqr.app/img?bank=MBBank&acc=VQRQAMNWP9901&template=&showinfo=false&holder=NGUYEN%20TAN%20LUC';
        };
      }
      
      console.log('SePay QR generated:', qrUrl);
    },

    /**
     * Cập nhật hiển thị form thanh toán
     */
    updatePaymentForm: function(serial, amount) {
      // Update amount display
      const amountVal = document.getElementById('donation-amount-val');
      if (amountVal) {
        amountVal.textContent = amount.toLocaleString('vi-VN') + 'đ';
      }

      // Update suggested transfer content
      const suggestedSyntax = document.getElementById('suggested-syntax');
      if (suggestedSyntax) {
        suggestedSyntax.textContent = `UR ${serial}`;
      }

      // Update bank info display
      const { bankCode, accountNo, accountName } = config.BANK_INFO;
      const bankNameVal = document.getElementById('bank-name-val');
      if (bankNameVal) {
        bankNameVal.textContent = `${bankCode}Bank - Chuyển khoản thường`;
      }

      const bankOwnerVal = document.getElementById('bank-owner-val');
      if (bankOwnerVal) {
        bankOwnerVal.textContent = accountName + ` (NH: ${bankCode}Bank)`;
      }

      const bankAccVal = document.getElementById('bank-acc-val');
      if (bankAccVal) {
        bankAccVal.textContent = accountNo;
      }
    },

    /**
     * Bắt đầu polling kiểm tra status thanh toán
     * Trong thực tế, SePay sẽ gửi webhook, nhưng polling là backup
     */
    pollPaymentStatus: async function(serial) {
      state.isProcessing = true;
      let attempts = 0;
      const maxAttempts = config.MAX_STATUS_CHECKS || 30;

      console.log('SePay: Starting payment status polling for serial:', serial);

      while (attempts < maxAttempts && state.isProcessing) {
        try {
          // Check payment status từ server (server check SePay API)
          const response = await fetch(`/api/check-payment-status.php?serial=${encodeURIComponent(serial)}`);
          const result = await response.json();

          if (result.success && result.data.status === 'completed') {
            console.log('SePay: Payment completed!', result.data);
            state.paymentStatus = 'completed';
            state.isProcessing = false;
            
            // Show success message
            this.showPaymentSuccess(serial);
            return result.data;
          }

          if (result.data.status === 'failed') {
            console.error('SePay: Payment failed');
            state.paymentStatus = 'failed';
            state.isProcessing = false;
            this.showPaymentError('Thanh toán thất bại. Vui lòng thử lại.');
            return null;
          }

          attempts++;
          console.log(`SePay: Check ${attempts}/${maxAttempts} - Status: ${result.data.status}`);

          // Wait before next check
          await new Promise(resolve => setTimeout(resolve, config.STATUS_CHECK_INTERVAL || 3000));

        } catch (error) {
          console.error('SePay: Status check error:', error);
          attempts++;
        }
      }

      if (state.isProcessing) {
        state.isProcessing = false;
        this.showPaymentTimeout();
      }
    },

    /**
     * Hiển thị message thành công
     */
    showPaymentSuccess: function(serial) {
      const modal = document.getElementById('modal-register-result');
      if (modal) {
        const title = modal.querySelector('h2');
        const message = modal.querySelector('.modal-message');

        if (title) title.textContent = '✅ Thanh Toán Thành Công!';
        if (message) {
          message.innerHTML = `
            <p><strong>Serial ${serial}</strong> đã được kích hoạt thành công!</p>
            <p>Email xác nhận đã được gửi đến địa chỉ của bạn. Vui lòng kiểm tra inbox.</p>
            <p>Bạn có thể sử dụng ROM HyperUR ngay bây giờ.</p>
          `;
        }
        
        modal.style.display = 'flex';
      }
    },

    /**
     * Hiển thị message lỗi
     */
    showPaymentError: function(message) {
      const modal = document.getElementById('modal-register-result');
      if (modal) {
        const title = modal.querySelector('h2');
        const msgEl = modal.querySelector('.modal-message');

        if (title) title.textContent = '❌ Thanh Toán Thất Bại';
        if (msgEl) msgEl.innerHTML = `<p>${message}</p>`;
        
        modal.style.display = 'flex';
      }
    },

    /**
     * Hiển thị message timeout
     */
    showPaymentTimeout: function() {
      const modal = document.getElementById('modal-register-result');
      if (modal) {
        const title = modal.querySelector('h2');
        const message = modal.querySelector('.modal-message');

        if (title) title.textContent = '⏱️ Chờ Thanh Toán Quá Lâu';
        if (message) {
          message.innerHTML = `
            <p>Hệ thống chưa nhận được xác nhận thanh toán từ ngân hàng.</p>
            <p>Vui lòng kiểm tra lại chuyển khoản của bạn hoặc <a href="https://t.me/HuperUltraRateChat" target="_blank">liên hệ hỗ trợ</a>.</p>
          `;
        }
        
        modal.style.display = 'flex';
      }
    },

    /**
     * Copy nội dung chuyển khoản
     */
    copyTransferContent: function(serial) {
      const content = `UR ${serial}`;
      navigator.clipboard.writeText(content).then(() => {
        this.showToast('✅ Đã sao chép nội dung chuyển khoản!');
      }).catch(err => {
        console.error('Copy failed:', err);
      });
    },

    /**
     * Open SePay QR in fullscreen (for mobile scanning)
     */
    openQRFullscreen: function() {
      const qrImg = document.getElementById('payment-qr-image');
      if (qrImg) {
        const modal = document.createElement('div');
        modal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
        `;
        
        const container = document.createElement('div');
        container.style.cssText = `
          background: white;
          padding: 20px;
          border-radius: 12px;
          max-width: 90%;
          text-align: center;
        `;
        
        const img = document.createElement('img');
        img.src = qrImg.src;
        img.style.cssText = 'max-width: 100%; height: auto;';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕ Đóng';
        closeBtn.style.cssText = `
          margin-top: 20px;
          padding: 12px 24px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        `;
        closeBtn.onclick = () => modal.remove();
        
        container.appendChild(img);
        container.appendChild(closeBtn);
        modal.appendChild(container);
        document.body.appendChild(modal);
      }
    },

    /**
     * Show toast notification
     */
    showToast: function(message, duration = 3000) {
      const toast = document.createElement('div');
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        z-index: 9999;
        animation: slideUp 0.3s ease;
      `;
      
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), duration);
    }
  };

})();
