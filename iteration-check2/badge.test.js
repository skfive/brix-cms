'use strict';

// BF-1839 · 배지 페이지 회귀 테스트
// frozen ui-contract@v1 (selector / state / token / 접근성 / 반응형) 을 가드한다.
// 외부 라이브러리·번들러·DOM shim 없이 순수 Node 내장 모듈만 사용한다.
// (브라우저/E2E 검증은 downstream tester 담당 — 여기서는 정적 계약만 검증)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, 'badge.html'), 'utf8');

// ---------------------------------------------------------------------------
// §4.2 DOM ID — 컨테이너 + 3종 배지 (frozen)
// ---------------------------------------------------------------------------

test('컨테이너는 #badge-list 이다', () => {
  assert.match(html, /id="badge-list"/);
});

test('성공/경고/오류 배지는 각각 #badge-success / #badge-warning / #badge-error 이다', () => {
  assert.match(html, /id="badge-success"/);
  assert.match(html, /id="badge-warning"/);
  assert.match(html, /id="badge-error"/);
});

// ---------------------------------------------------------------------------
// §4.3 CSS 클래스 — base + label(BEM element) + 3종 modifier (frozen)
// ---------------------------------------------------------------------------

test('배지 base 클래스 .badge 와 라벨 element .badge__label 이 존재한다', () => {
  assert.match(html, /class="[^"]*\bbadge\b[^"]*"/);
  assert.match(html, /class="[^"]*\bbadge__label\b[^"]*"/);
});

test('성공 배지는 .badge--success modifier 를 가진다', () => {
  assert.match(html, /id="badge-success"[^>]*class="[^"]*\bbadge--success\b[^"]*"/);
});

test('경고 배지는 .badge--warning modifier 를 가진다', () => {
  assert.match(html, /id="badge-warning"[^>]*class="[^"]*\bbadge--warning\b[^"]*"/);
});

test('오류 배지는 .badge--error modifier 를 가진다', () => {
  assert.match(html, /id="badge-error"[^>]*class="[^"]*\bbadge--error\b[^"]*"/);
});

// ---------------------------------------------------------------------------
// §4.5 디자인 토큰 — exact 값 + var() 사용 (frozen — 변경 금지)
// ---------------------------------------------------------------------------

test('§4.5 디자인 토큰이 exact 값으로 :root 에 정의된다', () => {
  assert.match(html, /--color-badge-success:\s*#16a34a/);
  assert.match(html, /--color-badge-warning:\s*#d97706/);
  assert.match(html, /--color-badge-error:\s*#dc2626/);
  assert.match(html, /--color-badge-text:\s*#ffffff/);
  assert.match(html, /--space-badge-gap:\s*12px/);
});

test('배지 배경/텍스트/간격에 디자인 토큰 var() 를 사용한다', () => {
  assert.match(html, /var\(--color-badge-success\)/);
  assert.match(html, /var\(--color-badge-warning\)/);
  assert.match(html, /var\(--color-badge-error\)/);
  assert.match(html, /var\(--color-badge-text\)/);
  assert.match(html, /var\(--space-badge-gap\)/);
});

// ---------------------------------------------------------------------------
// §4.6 접근성 — role="status" + 상태명 텍스트 라벨 (색상 비의존)
// ---------------------------------------------------------------------------

test('3종 배지는 각각 role="status" 를 가진다', () => {
  assert.match(html, /id="badge-success"[^>]*role="status"/);
  assert.match(html, /id="badge-warning"[^>]*role="status"/);
  assert.match(html, /id="badge-error"[^>]*role="status"/);
});

test("상태명 텍스트 라벨 '성공'/'경고'/'오류' 가 화면 텍스트로 존재한다", () => {
  assert.match(html, /성공/);
  assert.match(html, /경고/);
  assert.match(html, /오류/);
});

// ---------------------------------------------------------------------------
// §4.7 반응형 — 320px 이상 overflow 방지 근거
// ---------------------------------------------------------------------------

test('viewport meta 와 overflow 방지 근거(flex-wrap / max-width 등)가 있다', () => {
  assert.match(html, /viewport/);
  assert.match(html, /flex-wrap|max-width/);
});
