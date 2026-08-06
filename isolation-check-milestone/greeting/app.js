'use strict';

// BF-1786 · 인사말 미니 페이지 로직
// 브라우저에서 file:// 로 직접 실행되며, node --test 에서는 CommonJS 로 require 된다.
// 외부 라이브러리·번들러 없이 순수 HTML+JS 로 동작한다.

(function (root) {
  // §3.5 상태 — idle / success / error 세 가지만 존재한다.
  var STATES = { IDLE: 'idle', SUCCESS: 'success', ERROR: 'error' };

  // §3.6 모든 상태는 색상만이 아니라 상태명을 화면 텍스트/접근성 이름으로 노출한다.
  var IDLE_MESSAGE = '이름을 입력하고 버튼을 눌러 주세요.';
  var ERROR_MESSAGE = '이름을 입력해 주세요.';

  function buildGreeting(name) {
    return '안녕하세요, ' + name + '님!';
  }

  // idle 상태(초기 진입 및 error 복원 후) 결과.
  function idleState() {
    return { state: STATES.IDLE, statusName: STATES.IDLE, message: IDLE_MESSAGE };
  }

  // §4 제출 시 상태 전이 — 빈 이름/공백은 error, 유효한 이름은 success.
  function resolveSubmit(rawName) {
    var name = String(rawName == null ? '' : rawName).trim();
    if (name === '') {
      return { state: STATES.ERROR, statusName: STATES.ERROR, message: ERROR_MESSAGE };
    }
    return { state: STATES.SUCCESS, statusName: STATES.SUCCESS, message: buildGreeting(name) };
  }

  // 상태명을 색상 없이도 구분 가능하도록 텍스트에 함께 노출한다.
  function renderText(result) {
    return '상태 ' + result.statusName + ': ' + result.message;
  }

  // 브라우저 DOM 배선 — success/error 후에도 submit 은 계속 사용 가능하고,
  // 재입력 시 idle 로 복원되며 submit 이 재활성화된다.
  function mount(doc) {
    var form = doc.getElementById('greeting-form');
    var input = doc.getElementById('greeting-name-input');
    var submit = doc.getElementById('greeting-submit');
    var output = doc.getElementById('greeting-output');
    if (!form || !input || !submit || !output) {
      return;
    }

    function paint(result) {
      output.setAttribute('data-state', result.state);
      output.textContent = renderText(result);
    }

    paint(idleState());

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      paint(resolveSubmit(input.value));
      submit.disabled = false; // 주 실행 control 은 제출 후에도 계속 활성.
    });

    input.addEventListener('input', function () {
      submit.disabled = false; // 재입력 시 재활성화.
      paint(idleState()); // idle 로 복원.
    });
  }

  var api = {
    STATES: STATES,
    IDLE_MESSAGE: IDLE_MESSAGE,
    ERROR_MESSAGE: ERROR_MESSAGE,
    buildGreeting: buildGreeting,
    idleState: idleState,
    resolveSubmit: resolveSubmit,
    renderText: renderText,
    mount: mount
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // node --test
  }

  if (typeof document !== 'undefined') {
    root.greetingApp = api; // 브라우저 디버깅용 전역
    document.addEventListener('DOMContentLoaded', function () {
      mount(document);
    });
  }
})(typeof window !== 'undefined' ? window : this);
