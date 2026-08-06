'use strict';

// BF-1833 · km↔mile 변환기 로직
// frozen ui-contract@v1 (§4 상태 모델 / §5 변환 규칙)을 구현한다.
// - 순수 변환/상태 로직은 DOM 없이 테스트 가능하도록 CommonJS 로 export 한다.
// - 브라우저에서는 <script src="units.js"> 로 로드되어 DOM 을 배선한다.
//   (document 미정의인 Node 테스트에서는 배선을 건너뛴다.)

(function () {
  'use strict';

  // §5.3 유효성 실패 시 노출할 오류 문구 (frozen 텍스트)
  var INVALID_TEXT = '숫자(0 이상)를 입력하세요';

  // §5.1 변환 공식 (순수 함수)
  function kmToMile(km) {
    return km * 0.621371;
  }
  function mileToKm(mile) {
    return mile * 1.609344;
  }

  // §5.2 소수점 이하 2자리 고정 표시
  function format2(n) {
    return n.toFixed(2);
  }

  // 입력 문자열을 숫자로 파싱한다. (순수 함수 — DOM 비의존)
  // 반환: { empty: true } | { ok: false } | { ok: true, value }
  function parseInput(raw) {
    if (raw === null || raw === undefined) {
      return { empty: true };
    }
    var s = String(raw).trim();
    if (s === '') {
      return { empty: true };
    }
    // 정수/소수/선행 부호만 허용 (지수·16진수·문자 혼입 거부)
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) {
      return { ok: false };
    }
    var n = Number(s);
    if (!isFinite(n)) {
      return { ok: false };
    }
    return { ok: true, value: n };
  }

  // §4 입력값을 상태로 환원한다. unit: 'km' | 'mile' (순수 함수)
  // 반환: { state, resultText, errorText, statusText }
  function convertFrom(unit, raw) {
    var parsed = parseInput(raw);

    // 빈 입력 → idle 복원 (오류 아님)
    if (parsed.empty) {
      return { state: 'idle', resultText: '', errorText: '', statusText: '상태: idle' };
    }
    // 숫자 아님 / 음수 → invalid-input
    if (!parsed.ok || parsed.value < 0) {
      return {
        state: 'invalid-input',
        resultText: '',
        errorText: INVALID_TEXT,
        statusText: '상태: invalid-input — ' + INVALID_TEXT
      };
    }
    // km → mile
    if (unit === 'km') {
      var mile = format2(kmToMile(parsed.value)) + ' mile';
      return { state: 'km-converted', resultText: mile, errorText: '', statusText: '상태: km-converted — ' + mile };
    }
    // mile → km
    var km = format2(mileToKm(parsed.value)) + ' km';
    return { state: 'mile-converted', resultText: km, errorText: '', statusText: '상태: mile-converted — ' + km };
  }

  var api = {
    INVALID_TEXT: INVALID_TEXT,
    kmToMile: kmToMile,
    mileToKm: mileToKm,
    format2: format2,
    parseInput: parseInput,
    convertFrom: convertFrom
  };

  // 순수 로직을 테스트(Node)에서 DOM 없이 로드할 수 있도록 export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.__units = api;
  }

  // -------------------------------------------------------------------------
  // DOM 배선 — 브라우저에서만 (Node 테스트에서는 document 미정의 → 건너뜀)
  // -------------------------------------------------------------------------
  if (typeof document === 'undefined') {
    return;
  }

  function els() {
    return {
      root: document.getElementById('converter-root'),
      kmInput: document.getElementById('km-input'),
      mileInput: document.getElementById('mile-input'),
      kmResult: document.getElementById('km-result'),
      mileResult: document.getElementById('mile-result'),
      resetButton: document.getElementById('reset-button'),
      error: document.querySelector('.converter__error')
    };
  }

  // §4.2 후조건: idle 초기값으로 결과·오류·상태를 되돌린다 (입력은 호출 측 결정)
  function clearOutputs(e) {
    e.kmResult.textContent = '';
    e.mileResult.textContent = '';
    e.error.textContent = '';
    e.kmResult.setAttribute('aria-label', '마일→킬로미터 변환 결과: 없음');
    e.mileResult.setAttribute('aria-label', '킬로미터→마일 변환 결과: 없음');
  }

  // 한 방향 입력을 처리해 결과/상태를 렌더한다.
  function handleInput(unit) {
    var e = els();
    if (!e.root) {
      return;
    }
    var input = unit === 'km' ? e.kmInput : e.mileInput;
    var result = convertFrom(unit, input.value);

    clearOutputs(e);
    e.root.setAttribute('data-state', result.state);
    // §3.3 상태명을 접근성 이름으로 노출 (색상 비의존)
    e.root.setAttribute('aria-label', result.statusText);

    if (result.state === 'km-converted') {
      e.mileResult.textContent = result.resultText;
      e.mileResult.setAttribute('aria-label', '킬로미터→마일 변환 결과: ' + result.resultText);
    } else if (result.state === 'mile-converted') {
      e.kmResult.textContent = result.resultText;
      e.kmResult.setAttribute('aria-label', '마일→킬로미터 변환 결과: ' + result.resultText);
    } else if (result.state === 'invalid-input') {
      e.error.textContent = result.errorText;
    }
  }

  // §4.2 초기화: 입력·결과·오류를 모두 비우고 idle 로 복원, control 재활성화
  function reset() {
    var e = els();
    if (!e.root) {
      return;
    }
    e.kmInput.value = '';
    e.mileInput.value = '';
    e.kmInput.disabled = false;
    e.mileInput.disabled = false;
    e.resetButton.disabled = false;
    clearOutputs(e);
    e.root.setAttribute('data-state', 'idle');
    e.root.setAttribute('aria-label', '상태: idle');
    e.kmInput.focus();
  }

  function wire() {
    var e = els();
    if (!e.root) {
      return;
    }
    e.kmInput.addEventListener('input', function () { handleInput('km'); });
    e.mileInput.addEventListener('input', function () { handleInput('mile'); });
    e.resetButton.addEventListener('click', reset);
    e.root.setAttribute('data-state', 'idle');
    e.root.setAttribute('aria-label', '상태: idle');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
