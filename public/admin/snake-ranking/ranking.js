'use strict';

// BF-1576 · CMS 스네이크 랭킹 관리 화면 client
//
// 소비하는 backend API 계약 (planning-contract@v1 / GET /api/admin/snake/scores):
//   요청:  GET {API_BASE}/api/admin/snake/scores?mode=<mode>&limit=<n>
//          - mode="all" 이면 모드 파라미터를 생략(전체 조회)
//          - limit 은 표시 개수
//   응답:  200 JSON — { "scores": [ Entry, ... ] } (또는 Entry 배열)
//          Entry = { rank?, nickname, score, mode, recordedAt }
//          rank 미제공 시 목록 순서로 순위를 계산한다.
//   오류:  비 2xx 응답 또는 네트워크 실패 → error 상태.
//
// API_BASE 는 라우트(src/routes/admin-snake-ranking.js)가 환경 변수
// SNAKE_ADMIN_API_BASE_URL 값을 index.html 에 주입한 것이다. 미주입(정적 오픈)
// 시에는 same-origin('') 으로 동작한다.

(function () {
  var STATES = {
    IDLE: 'idle',
    LOADING: 'loading',
    SUCCESS: 'success',
    EMPTY: 'empty',
    ERROR: 'error',
  };

  var STATE_TEXT = {
    idle: '준비되었습니다.',
    loading: '랭킹을 불러오는 중…',
    success: '랭킹을 불러왔습니다.',
    empty: '표시할 랭킹이 없습니다.',
    error: '랭킹을 불러올 수 없습니다.',
  };

  var PLACEHOLDER = '__SNAKE_ADMIN_API_BASE_URL__';

  function normalizeBase(raw) {
    if (typeof raw !== 'string') return '';
    if (raw.indexOf(PLACEHOLDER) !== -1) return '';
    return raw.replace(/\/+$/, '');
  }

  function buildUrl(base, mode, limit) {
    var url = base + '/api/admin/snake/scores';
    var params = [];
    if (mode && mode !== 'all') params.push('mode=' + encodeURIComponent(mode));
    if (limit) params.push('limit=' + encodeURIComponent(limit));
    return params.length ? url + '?' + params.join('&') : url;
  }

  function extractScores(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.scores)) return data.scores;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  }

  function formatScore(value) {
    if (typeof value === 'number' && isFinite(value)) {
      return value.toLocaleString('ko-KR');
    }
    return value == null ? '-' : String(value);
  }

  function formatDate(value) {
    if (value == null || value === '') return '-';
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleString('ko-KR');
  }

  function cellText(value) {
    return value == null || value === '' ? '-' : String(value);
  }

  function init() {
    var root = document.getElementById('snake-ranking-root');
    if (!root) return;

    var modeSelect = document.getElementById('snake-ranking-mode-filter');
    var limitSelect = document.getElementById('snake-ranking-limit-select');
    var tableBody = root.querySelector('[data-role="table-body"]');
    var statusEl = root.querySelector('[data-role="status"]');

    var base = normalizeBase(window.SNAKE_ADMIN_API_BASE);
    var requestSeq = 0;

    function setControlsDisabled(disabled) {
      if (modeSelect) modeSelect.disabled = disabled;
      if (limitSelect) limitSelect.disabled = disabled;
    }

    function setState(state) {
      root.setAttribute('data-state', state);
      if (statusEl) statusEl.textContent = STATE_TEXT[state] || '';
      // 상태별 영역 표시 토글 (hidden 속성으로 접근성/표시 동시 제어)
      toggle('[data-role="loading"]', state === STATES.LOADING);
      toggle('[data-role="empty"]', state === STATES.EMPTY);
      toggle('#snake-ranking-error', state === STATES.ERROR, true);
      // 초기화/취소/실패 뒤에는 control 을 다시 사용할 수 있어야 한다.
      setControlsDisabled(state === STATES.LOADING);
    }

    function toggle(selector, visible, byId) {
      var el = byId ? document.querySelector(selector) : root.querySelector(selector);
      if (el) el.hidden = !visible;
    }

    function renderRows(rows) {
      if (!tableBody) return;
      tableBody.textContent = '';
      rows.forEach(function (entry, index) {
        var tr = document.createElement('tr');
        tr.className = 'snake-ranking__row';
        var rank =
          entry && entry.rank != null ? entry.rank : index + 1;
        appendCell(tr, cellText(rank));
        appendCell(tr, cellText(entry && entry.nickname));
        appendCell(tr, formatScore(entry && entry.score));
        appendCell(tr, cellText(entry && entry.mode));
        appendCell(
          tr,
          formatDate(entry && (entry.recordedAt || entry.createdAt || entry.timestamp)),
        );
        tableBody.appendChild(tr);
      });
    }

    function appendCell(tr, text) {
      var td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    }

    function populateModeOptions(rows) {
      if (!modeSelect) return;
      var existing = {};
      Array.prototype.forEach.call(modeSelect.options, function (opt) {
        existing[opt.value] = true;
      });
      rows.forEach(function (entry) {
        var mode = entry && entry.mode;
        if (mode && !existing[mode]) {
          existing[mode] = true;
          var opt = document.createElement('option');
          opt.value = mode;
          opt.textContent = mode;
          modeSelect.appendChild(opt);
        }
      });
    }

    function load() {
      var mode = modeSelect ? modeSelect.value : 'all';
      var limit = limitSelect ? limitSelect.value : '';
      var seq = ++requestSeq;

      setState(STATES.LOADING);

      fetch(buildUrl(base, mode, limit), {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      })
        .then(function (resp) {
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          return resp.json();
        })
        .then(function (data) {
          if (seq !== requestSeq) return; // 오래된 응답 무시
          var rows = extractScores(data);
          if (rows.length === 0) {
            renderRows([]);
            setState(STATES.EMPTY);
            return;
          }
          renderRows(rows);
          populateModeOptions(rows);
          setState(STATES.SUCCESS);
        })
        .catch(function () {
          if (seq !== requestSeq) return;
          setState(STATES.ERROR);
        });
    }

    if (modeSelect) modeSelect.addEventListener('change', load);
    if (limitSelect) limitSelect.addEventListener('change', load);

    setState(STATES.IDLE);
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
