(function () {
  var count = 0;
  var overlay = null;
  var textEl = null;
  var hideTimer = null;
  var toastOverlay = null;
  var toastHideTimer = null;

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'globalLoading';
    overlay.className = 'loading-overlay hidden';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('role', 'status');
    overlay.innerHTML =
      '<div class="loading-panel">' +
        '<div class="loading-seal-wrap">' +
          '<div class="loading-seal-ring"></div>' +
          '<div class="loading-seal">⚜</div>' +
        '</div>' +
        '<p class="loading-text">處理中</p>' +
        '<div class="loading-dots"><span></span><span></span><span></span></div>' +
      '</div>';
    document.body.appendChild(overlay);
    textEl = overlay.querySelector('.loading-text');
  }

  function ensureToast() {
    if (toastOverlay) return;
    toastOverlay = document.createElement('div');
    toastOverlay.id = 'globalToast';
    toastOverlay.className = 'toast-overlay hidden info';
    toastOverlay.setAttribute('aria-hidden', 'true');
    toastOverlay.setAttribute('role', 'alertdialog');
    toastOverlay.innerHTML =
      '<div class="toast-panel">' +
        '<div class="toast-icon">⚜</div>' +
        '<p class="toast-message"></p>' +
        '<button type="button" class="toast-close">確定</button>' +
      '</div>';
    document.body.appendChild(toastOverlay);
    toastOverlay.querySelector('.toast-close').addEventListener('click', hideToast);
    toastOverlay.addEventListener('click', function (e) {
      if (e.target === toastOverlay) hideToast();
    });
  }

  function showLoading(message) {
    ensureOverlay();
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    count += 1;
    if (textEl) textEl.textContent = message || '處理中';
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function hideLoading() {
    if (!overlay) return;
    count = Math.max(0, count - 1);
    if (count === 0) {
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
    }
  }

  function withLoading(fn, message) {
    showLoading(message);
    return Promise.resolve()
      .then(fn)
      .finally(hideLoading);
  }

  function briefLoading(message, ms) {
    showLoading(message || '請稍候');
    hideTimer = setTimeout(hideLoading, ms || 380);
  }

  function hideToast() {
    if (!toastOverlay) return;
    if (toastHideTimer) {
      clearTimeout(toastHideTimer);
      toastHideTimer = null;
    }
    toastOverlay.classList.add('hidden');
    toastOverlay.setAttribute('aria-hidden', 'true');
  }

  function showToast(message, type) {
    ensureToast();
    hideToast();
    var kind = type === 'success' || type === 'error' ? type : 'info';
    toastOverlay.className = 'toast-overlay ' + kind;
    toastOverlay.querySelector('.toast-icon').textContent =
      kind === 'success' ? '✓' : kind === 'error' ? '✕' : '⚜';
    toastOverlay.querySelector('.toast-message').textContent = message || '';
    toastOverlay.classList.remove('hidden');
    toastOverlay.setAttribute('aria-hidden', 'false');
    toastHideTimer = setTimeout(hideToast, kind === 'error' ? 4500 : 3200);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest(
      'button, .btn-gold, .btn-outline, .btn-gold-link, .slot-scroll-btn, .nav-tab'
    );
    if (!btn || btn.disabled || btn.dataset.noLoading !== undefined) return;
    if (btn.classList.contains('slot-scroll-btn')) return;
    if (btn.type === 'submit') return;
    if (btn.dataset.async !== undefined) return;
    if (btn.closest('#globalLoading') || btn.closest('#globalToast')) return;

    btn.classList.add('is-pressed');
    setTimeout(function () { btn.classList.remove('is-pressed'); }, 150);

    briefLoading(btn.dataset.loadingText || '請稍候');
  }, { capture: true });

  window.UIFeedback = {
    showLoading: showLoading,
    hideLoading: hideLoading,
    withLoading: withLoading,
    briefLoading: briefLoading,
    toast: showToast,
    showToast: showToast
  };

  window.showToast = showToast;
})();
