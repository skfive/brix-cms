'use strict';

// BF-1576 · CMS 스네이크 랭킹 관리 화면 (infra)
// 라우트/상태 통합 테스트 — 정적 서버 라우트가 frozen UI 계약대로 화면을
// 제공하고 backend API base URL(환경 변수)을 주입하는지 검증한다.
// node --test 로 실행 (브라우저/E2E 는 downstream tester 담당).

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ADMIN_SNAKE_RANKING_BASE_PATH,
  resolveApiBaseUrl,
  createAdminSnakeRankingHandler,
} = require('../src/routes/admin-snake-ranking.js');

// 최소 http.ServerResponse 목 — 실제 서버/브라우저 없이 라우트 단위 검증.
function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    ended: false,
    writeHead(code, hdrs) {
      this.statusCode = code;
      if (hdrs) {
        for (const key of Object.keys(hdrs)) {
          this.headers[key.toLowerCase()] = hdrs[key];
        }
      }
      return this;
    },
    setHeader(key, value) {
      this.headers[String(key).toLowerCase()] = value;
    },
    end(chunk) {
      if (chunk) this.body += chunk;
      this.ended = true;
    },
  };
}

function request(handler, method, url) {
  const res = mockRes();
  const handled = handler({ method, url }, res);
  return { res, handled };
}

test('base path 상수는 /admin/snake-ranking 이다', () => {
  assert.equal(ADMIN_SNAKE_RANKING_BASE_PATH, '/admin/snake-ranking');
});

test('resolveApiBaseUrl 은 환경 변수를 사용하고 없으면 빈 문자열', () => {
  assert.equal(
    resolveApiBaseUrl({ SNAKE_ADMIN_API_BASE_URL: 'https://api.example.test' }),
    'https://api.example.test',
  );
  assert.equal(resolveApiBaseUrl({}), '');
  // 후행 슬래시는 정규화되어 제거된다.
  assert.equal(
    resolveApiBaseUrl({ SNAKE_ADMIN_API_BASE_URL: 'https://api.example.test/' }),
    'https://api.example.test',
  );
});

test('index 라우트는 frozen dom id/class 와 접근성 계약을 포함한 HTML 을 제공한다', () => {
  const handler = createAdminSnakeRankingHandler({ apiBaseUrl: 'https://api.example.test' });
  const { res } = request(handler, 'GET', ADMIN_SNAKE_RANKING_BASE_PATH);

  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /text\/html/);

  // frozen dom ids
  for (const id of [
    'snake-ranking-root',
    'snake-ranking-mode-filter',
    'snake-ranking-limit-select',
    'snake-ranking-table',
    'snake-ranking-error',
  ]) {
    assert.ok(res.body.includes(`id="${id}"`), `dom id 누락: ${id}`);
  }

  // frozen css classes
  for (const cls of [
    'snake-ranking',
    'snake-ranking__filters',
    'snake-ranking__table',
    'snake-ranking__error',
  ]) {
    assert.ok(res.body.includes(cls), `css class 누락: ${cls}`);
  }

  // 접근성: caption/aria-label, role="alert", label for
  assert.ok(res.body.includes('스네이크 랭킹 목록'), 'table caption/aria-label 누락');
  assert.ok(res.body.includes('role="alert"'), 'error role="alert" 누락');
  assert.ok(/for="snake-ranking-mode-filter"/.test(res.body), 'mode filter label 누락');
  assert.ok(/for="snake-ranking-limit-select"/.test(res.body), 'limit select label 누락');

  // 상태 텍스트 (색상만으로 구분 금지 — 화면 텍스트로 노출)
  assert.ok(res.body.includes('표시할 랭킹이 없습니다'), 'empty 텍스트 누락');
  assert.ok(res.body.includes('랭킹을 불러올 수 없습니다'), 'error 텍스트 누락');

  // ranking.js / ranking.css 를 로드한다
  assert.ok(res.body.includes('ranking.css'), 'ranking.css 링크 누락');
  assert.ok(res.body.includes('ranking.js'), 'ranking.js 스크립트 누락');
});

test('index 라우트는 API base URL 을 주입하고 placeholder 를 남기지 않는다', () => {
  const handler = createAdminSnakeRankingHandler({ apiBaseUrl: 'https://api.example.test' });
  const { res } = request(handler, 'GET', ADMIN_SNAKE_RANKING_BASE_PATH);

  assert.ok(res.body.includes('https://api.example.test'), 'API base 주입 실패');
  assert.ok(
    !res.body.includes('__SNAKE_ADMIN_API_BASE_URL__'),
    'placeholder 가 치환되지 않고 남아 있음',
  );
});

test('index 라우트는 후행 슬래시 경로도 처리한다', () => {
  const handler = createAdminSnakeRankingHandler({ apiBaseUrl: '' });
  const { res } = request(handler, 'GET', `${ADMIN_SNAKE_RANKING_BASE_PATH}/`);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /text\/html/);
});

test('주입되는 API base URL 은 JS 문자열로 안전하게 이스케이프된다', () => {
  const handler = createAdminSnakeRankingHandler({ apiBaseUrl: 'https://x"y</script>' });
  const { res } = request(handler, 'GET', ADMIN_SNAKE_RANKING_BASE_PATH);
  // 따옴표는 이스케이프, </script> 는 무력화되어 스크립트 컨텍스트를 깨지 않는다.
  assert.ok(!res.body.includes('https://x"y</script>'), '이스케이프되지 않은 원문이 그대로 삽입됨');
  assert.ok(res.body.includes('\\"'), '따옴표 이스케이프 누락');
});

test('ranking.css 는 text/css 로 제공되고 frozen 토큰을 포함한다', () => {
  const handler = createAdminSnakeRankingHandler({ apiBaseUrl: '' });
  const { res } = request(handler, 'GET', `${ADMIN_SNAKE_RANKING_BASE_PATH}/ranking.css`);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /text\/css/);
  for (const token of [
    '--color-surface',
    '--color-text-primary',
    '--color-border',
    '--color-error',
    '--space-cell-padding',
  ]) {
    assert.ok(res.body.includes(token), `token 누락: ${token}`);
  }
});

test('ranking.js 는 application/javascript 로 제공되고 backend 엔드포인트를 소비한다', () => {
  const handler = createAdminSnakeRankingHandler({ apiBaseUrl: '' });
  const { res } = request(handler, 'GET', `${ADMIN_SNAKE_RANKING_BASE_PATH}/ranking.js`);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /application\/javascript/);
  assert.ok(res.body.includes('/api/admin/snake/scores'), 'backend 엔드포인트 경로 누락');
});

test('알 수 없는 하위 경로는 404 를 반환한다', () => {
  const handler = createAdminSnakeRankingHandler({ apiBaseUrl: '' });
  const { res } = request(handler, 'GET', `${ADMIN_SNAKE_RANKING_BASE_PATH}/nope.txt`);
  assert.equal(res.statusCode, 404);
});
