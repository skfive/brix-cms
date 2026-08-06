'use strict';

// BF-1786 · 인사말 미니 페이지 회귀 테스트
// frozen ui-contract@v1 (selector / state / token / 접근성) 을 가드한다.
// 외부 라이브러리·번들러·DOM shim 없이 순수 Node 내장 모듈만 사용한다.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const greeting = require(path.join(ROOT, 'app.js'));

// ---------------------------------------------------------------------------
// §3.2~3.6 정적 계약 — index.html selector / 접근성
// ---------------------------------------------------------------------------

test('루트 컨테이너에 greeting 클래스가 있다', () => {
  assert.match(html, /class="[^"]*\bgreeting\b[^"]*"/);
});

test('#greeting-name-input 은 greeting__input 클래스와 연결된 <label> 을 가진다', () => {
  assert.match(html, /id="greeting-name-input"/);
  assert.match(html, /class="[^"]*\bgreeting__input\b[^"]*"/);
  assert.match(html, /<label[^>]*for="greeting-name-input"/);
});

test('#greeting-submit 은 greeting__submit 클래스와 aria-label="인사말 생성" 을 가진다', () => {
  assert.match(html, /id="greeting-submit"/);
  assert.match(html, /class="[^"]*\bgreeting__submit\b[^"]*"/);
  assert.match(html, /aria-label="인사말 생성"/);
});

test('#greeting-output 은 greeting__output 클래스와 role="status" 를 가진다', () => {
  assert.match(html, /id="greeting-output"/);
  assert.match(html, /class="[^"]*\bgreeting__output\b[^"]*"/);
  assert.match(html, /role="status"/);
});

test('§3.4 디자인 토큰이 exact 값으로 정의된다', () => {
  assert.match(html, /--color-action-primary:\s*#2563eb/);
  assert.match(html, /--space-control-gap:\s*12px/);
});

test('버튼 색상과 컨트롤 간격에 디자인 토큰을 사용한다', () => {
  assert.match(html, /var\(--color-action-primary\)/);
  assert.match(html, /var\(--space-control-gap\)/);
});

// ---------------------------------------------------------------------------
// §4 상태 전이 로직 — app.js 순수 함수
// ---------------------------------------------------------------------------

test('STATES 는 idle/success/error 세 상태만 노출한다', () => {
  assert.deepEqual(greeting.STATES, { IDLE: 'idle', SUCCESS: 'success', ERROR: 'error' });
});

test('success: 유효한 이름 제출 시 인사말과 success 상태를 반환한다', () => {
  const result = greeting.resolveSubmit('철수');
  assert.equal(result.state, 'success');
  assert.equal(result.statusName, 'success');
  assert.match(result.message, /안녕하세요, 철수님!/);
});

test('success: 앞뒤 공백은 trim 되어 인사말에 반영된다', () => {
  const result = greeting.resolveSubmit('  영희  ');
  assert.equal(result.state, 'success');
  assert.match(result.message, /안녕하세요, 영희님!/);
});

test('error: 빈 이름 제출 시 error 상태와 오류 안내를 반환한다', () => {
  const result = greeting.resolveSubmit('');
  assert.equal(result.state, 'error');
  assert.equal(result.statusName, 'error');
  assert.match(result.message, /이름을 입력/);
});

test('error: 공백만 입력해도 error 로 처리한다', () => {
  const result = greeting.resolveSubmit('   ');
  assert.equal(result.state, 'error');
});

test('idle 복원: idleState 는 idle 상태와 초기 안내를 반환한다', () => {
  const result = greeting.idleState();
  assert.equal(result.state, 'idle');
  assert.equal(result.statusName, 'idle');
  assert.ok(result.message.length > 0);
});

// ---------------------------------------------------------------------------
// §3.6 접근성 — 상태명을 색상 없이 화면 텍스트로 노출
// ---------------------------------------------------------------------------

test('renderText 는 모든 상태에서 상태명을 텍스트로 노출한다', () => {
  assert.match(greeting.renderText(greeting.idleState()), /idle/);
  assert.match(greeting.renderText(greeting.resolveSubmit('철수')), /success/);
  assert.match(greeting.renderText(greeting.resolveSubmit('')), /error/);
});
