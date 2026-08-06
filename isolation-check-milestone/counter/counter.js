'use strict';

// 카운터 상태 로직 (DOM 비의존) — 단일 정수 카운트를 메모리에서 관리한다.
// 외부 라이브러리·번들러 없이 브라우저가 classic <script> 로 직접 로드한다.
function createCounter() {
  let value = 0;
  return {
    get value() {
      return value;
    },
    increment() {
      value += 1;
      return value;
    },
    decrement() {
      value -= 1; // 음수 허용 (하한 없음)
      return value;
    },
    reset() {
      value = 0;
      return value;
    },
  };
}

// DOM 바인딩 — frozen UI 계약(counter-value / counter-increment /
// counter-decrement / counter-reset)에 카운터 상태를 연결한다.
function mountCounter(doc) {
  const counter = createCounter();
  const valueEl = doc.getElementById('counter-value');
  const incrementBtn = doc.getElementById('counter-increment');
  const decrementBtn = doc.getElementById('counter-decrement');
  const resetBtn = doc.getElementById('counter-reset');

  function render() {
    valueEl.textContent = String(counter.value);
    // 초기화·리셋 후조건: 세 버튼은 항상 활성 상태로 유지한다.
    incrementBtn.disabled = false;
    decrementBtn.disabled = false;
    resetBtn.disabled = false;
  }

  incrementBtn.addEventListener('click', () => {
    counter.increment();
    render();
  });
  decrementBtn.addEventListener('click', () => {
    counter.decrement();
    render();
  });
  resetBtn.addEventListener('click', () => {
    counter.reset();
    render();
  });

  render(); // 초기값 '0' 렌더 + 세 버튼 활성
  return { counter, render };
}

// 브라우저: DOM 준비 시 자동 마운트 (file:// 지원, 외부 의존 없음).
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountCounter(document));
  } else {
    mountCounter(document);
  }
}

// node --test: CommonJS 내보내기.
// 브라우저 classic <script> 에서는 module 이 정의되지 않아 이 블록은 건너뛴다.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createCounter, mountCounter };
}
