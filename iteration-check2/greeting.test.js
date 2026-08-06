'use strict';

// BF-1815 · 인사말 페이지 회귀 테스트
// frozen ui-contract@v1 (selector / state / token / 접근성) 을 가드한다.
// 외부 라이브러리·번들러·DOM shim 없이 순수 Node 내장 모듈만 사용한다.
// (브라우저/E2E 검증은 downstream tester 담당 — 여기서는 정적 계약 + 순수 로직만 검증)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, 'greeting.html'), 'utf8');

// 인라인 <script> 안의 순수 로직(formatToday/resolveDate)을 DOM 없이 로드한다.
// script 는 document 가 없으면 배선을 건너뛰고 globalThis.__greeting 에 API 만 노출한다.
function loadGreetingApi() {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, '인라인 <script> 블록이 있어야 한다');
  // document 는 정의하지 않는다(undefined 유지) — DOM shim 을 쓰지 않는다.
  new Function(match[1])();
  return globalThis.__greeting;
}

// ---------------------------------------------------------------------------
// §4.1 정적 계약 — DOM ID / class selector
// ---------------------------------------------------------------------------

test('루트 컨테이너는 #greeting-root + .greeting 이다', () => {
  assert.match(html, /id="greeting-root"/);
  assert.match(html, /class="[^"]*\bgreeting\b[^"]*"/);
});

test('#greeting-message 는 h1 heading + .greeting__message 이다', () => {
  assert.match(html, /<h1[^>]*id="greeting-message"[^>]*>/);
  assert.match(html, /class="[^"]*\bgreeting__message\b[^"]*"/);
});

test('#greeting-date 는 datetime 속성을 가진 time 요소 + .greeting__date 이다', () => {
  assert.match(html, /<time[^>]*id="greeting-date"[^>]*>/);
  assert.match(html, /<time[^>]*id="greeting-date"[^>]*datetime=/);
  assert.match(html, /class="[^"]*\bgreeting__date\b[^"]*"/);
});

// ---------------------------------------------------------------------------
// §4.3 디자인 토큰 — exact 값 + var() 사용
// ---------------------------------------------------------------------------

test('§4.3 디자인 토큰이 exact 값으로 정의된다', () => {
  assert.match(html, /--color-greeting-text:\s*#1f2937/);
  assert.match(html, /--space-greeting-gap:\s*8px/);
});

test('텍스트 색과 메시지-날짜 간격에 디자인 토큰을 사용한다', () => {
  assert.match(html, /var\(--color-greeting-text\)/);
  assert.match(html, /var\(--space-greeting-gap\)/);
});

// ---------------------------------------------------------------------------
// §4.5 반응형 — 320px 이상 overflow 방지 근거
// ---------------------------------------------------------------------------

test('좁은 뷰포트 overflow 방지 근거(max-width / word-break 등)가 있다', () => {
  assert.match(html, /max-width/);
  assert.match(html, /viewport/);
});

// ---------------------------------------------------------------------------
// §4.2 상태(States) — 순수 로직 검증 (DOM 불필요)
// ---------------------------------------------------------------------------

test('formatToday: 유효한 날짜를 YYYY-MM-DD 로 포맷한다', () => {
  const api = loadGreetingApi();
  assert.equal(api.formatToday(new Date('2026-08-06T00:00:00')), '2026-08-06');
});

test('formatToday: 한 자리 월/일은 0 패딩된다', () => {
  const api = loadGreetingApi();
  assert.equal(api.formatToday(new Date('2026-01-09T00:00:00')), '2026-01-09');
});

test('formatToday: 잘못된 날짜는 null 을 반환한다', () => {
  const api = loadGreetingApi();
  assert.equal(api.formatToday(new Date('invalid')), null);
  assert.equal(api.formatToday(null), null);
  assert.equal(api.formatToday('2026-08-06'), null);
});

test('loaded: 날짜 계산 성공 시 loaded 상태와 YYYY-MM-DD 텍스트/ datetime 을 반환한다', () => {
  const api = loadGreetingApi();
  const result = api.resolveDate(new Date('2026-08-06T00:00:00'));
  assert.equal(result.state, 'loaded');
  assert.equal(result.text, '2026-08-06');
  assert.equal(result.datetime, '2026-08-06');
});

test('date-error: 날짜 계산 실패 시 date-error 상태와 fallback 텍스트를 반환한다', () => {
  const api = loadGreetingApi();
  const result = api.resolveDate(new Date('invalid'));
  assert.equal(result.state, 'date-error');
  assert.equal(result.text, '날짜를 불러올 수 없습니다');
  assert.equal(result.datetime, null);
});

test('인사말 텍스트가 비어있지 않다', () => {
  const api = loadGreetingApi();
  assert.ok(typeof api.GREETING_TEXT === 'string' && api.GREETING_TEXT.trim().length > 0);
});

// ---------------------------------------------------------------------------
// §4.4 접근성 — 상태명을 색상 없이 화면 텍스트/접근성 이름으로 노출
// ---------------------------------------------------------------------------

test('fallback 문구가 화면 텍스트로 존재한다', () => {
  assert.match(html, /날짜를 불러올 수 없습니다/);
});

test('resolveDate 는 상태명을 state 필드로 노출한다(색상 비의존)', () => {
  const api = loadGreetingApi();
  assert.equal(api.resolveDate(new Date('2026-08-06T00:00:00')).state, 'loaded');
  assert.equal(api.resolveDate(new Date('invalid')).state, 'date-error');
});
