(function () {
  'use strict';

  var form = document.getElementById('link-form');
  var urlInput = document.getElementById('link-url-input');
  var customSlugInput = document.getElementById('link-custom-slug-input');
  var submitBtn = document.getElementById('link-submit-btn');
  var resultEl = document.getElementById('link-result');
  var shortUrlEl = document.getElementById('link-result-short-url');
  var errorEl = document.getElementById('link-result-error');
  var statusEl = document.getElementById('link-form-status');

  var STATE_TEXT = {
    idle: '대기 중',
    submitting: '제출 중',
    success: '생성 완료',
    error: '오류 발생',
  };

  function setState(state) {
    document.body.setAttribute('data-state', state);
    if (statusEl) {
      statusEl.textContent = '현재 상태: ' + STATE_TEXT[state];
    }
  }

  function resetResult() {
    resultEl.hidden = true;
    resultEl.classList.remove('link-result--success', 'link-result--error');
    shortUrlEl.textContent = '';
    errorEl.textContent = '';
  }

  function showSuccess(data) {
    resultEl.hidden = false;
    resultEl.classList.remove('link-result--error');
    resultEl.classList.add('link-result--success');
    shortUrlEl.textContent = data.shortUrl;
    errorEl.textContent = '';
  }

  function showError(message) {
    resultEl.hidden = false;
    resultEl.classList.remove('link-result--success');
    resultEl.classList.add('link-result--error');
    errorEl.textContent = message;
    shortUrlEl.textContent = '';
  }

  function setSubmitting(isSubmitting) {
    Array.prototype.forEach.call(form.elements, function (el) {
      el.disabled = isSubmitting;
    });
    submitBtn.disabled = isSubmitting;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    resetResult();
    setState('submitting');
    setSubmitting(true);

    var payload = { url: urlInput.value };
    if (customSlugInput.value) {
      payload.customSlug = customSlugInput.value;
    }

    fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) {
            var message =
              (data && data.error && data.error.message) || '요청을 처리할 수 없습니다.';
            throw new Error(message);
          }
          return data;
        });
      })
      .then(function (data) {
        showSuccess(data);
        setSubmitting(false);
        setState('success');
      })
      .catch(function (err) {
        showError(err.message || '알 수 없는 오류가 발생했습니다.');
        setSubmitting(false);
        setState('idle');
      });
  });
})();
