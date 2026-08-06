'use strict';

// BF-1833 · km↔mile 변환기 회귀 테스트
// frozen ui-contract@v1 (selector / state / token / 접근성) + 변환 로직을 가드한다.
// 외부 라이브러리·번들러·DOM shim 없이 순수 Node 내장 모듈만 사용한다.
// (브라우저/E2E 검증은 downstream tester 담당 — 여기서는 정적 계약 + 순수 로직만 검증)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, 'units.html'), 'utf8');
// units.js 는 document 미정의(Node) 시 DOM 배선을 건너뛰고 순수 API 만 export 한다.
const units = require('./units.js');

// ---------------------------------------------------------------------------
// §3.1 정적 계약 — DOM ID selector
// ---------------------------------------------------------------------------

test('루트 컨테이너는 #converter-root + .converter 이다', () => {
  assert.match(html, /id="converter-root"/);
  assert.match(html, /class="[^"]*\bconverter\b[^"]*"/);
});

test('km-input / mile-input 입력 필드가 존재한다', () => {
  assert.match(html, /id="km-input"/);
  assert.match(html, /id="mile-input"/);
});

test('km-result / mile-result 결과 영역이 존재한다', () => {
  assert.match(html, /id="km-result"/);
  assert.match(html, /id="mile-result"/);
});

test('reset-button 초기화 버튼이 존재한다', () => {
  assert.match(html, /id="reset-button"/);
});

test('§3.1 CSS class 계약(converter__field/result/reset/error)이 존재한다', () => {
  assert.match(html, /\bconverter__field\b/);
  assert.match(html, /\bconverter__result\b/);
  assert.match(html, /\bconverter__reset\b/);
  assert.match(html, /\bconverter__error\b/);
});

// ---------------------------------------------------------------------------
// §3.2 디자인 토큰 — exact 값 + var() 사용
// ---------------------------------------------------------------------------

test('§3.2 디자인 토큰이 exact 값으로 정의된다', () => {
  assert.match(html, /--color-action-primary:\s*#2563eb/);
  assert.match(html, /--space-control-gap:\s*12px/);
  assert.match(html, /--color-error-text:\s*#dc2626/);
  assert.match(html, /--color-result-text:\s*#111827/);
});

test('토큰을 var() 로 실제 사용한다', () => {
  assert.match(html, /var\(--color-action-primary\)/);
  assert.match(html, /var\(--space-control-gap\)/);
  assert.match(html, /var\(--color-error-text\)/);
  assert.match(html, /var\(--color-result-text\)/);
});

// ---------------------------------------------------------------------------
// §3.3 접근성 — aria-label
// ---------------------------------------------------------------------------

test('km-input / mile-input / reset-button 에 aria-label 이 있다', () => {
  assert.match(html, /id="km-input"[^>]*aria-label="킬로미터 입력"|aria-label="킬로미터 입력"[^>]*id="km-input"/);
  assert.match(html, /aria-label="마일 입력"/);
  assert.match(html, /aria-label="입력 초기화"/);
});

// ---------------------------------------------------------------------------
// §3.4 반응형 — 320px 이상 overflow 방지 + 480px 세로 쌓기 근거
// ---------------------------------------------------------------------------

test('반응형 근거(viewport meta / max-width / 480px media query)가 있다', () => {
  assert.match(html, /viewport/);
  assert.match(html, /max-width/);
  assert.match(html, /480px/);
});

// ---------------------------------------------------------------------------
// §5 변환 로직 (순수 함수 — DOM 불필요)
// ---------------------------------------------------------------------------

test('kmToMile: km × 0.621371', () => {
  assert.ok(Math.abs(units.kmToMile(10) - 6.21371) < 1e-9);
  assert.ok(Math.abs(units.kmToMile(1) - 0.621371) < 1e-9);
});

test('mileToKm: mile × 1.609344', () => {
  assert.ok(Math.abs(units.mileToKm(10) - 16.09344) < 1e-9);
  assert.ok(Math.abs(units.mileToKm(1) - 1.609344) < 1e-9);
});

// ---------------------------------------------------------------------------
// §4 상태 모델 — convertFrom 순수 로직
// ---------------------------------------------------------------------------

test('AC-1 km-converted: 10 km 입력 → mile-result "6.21 mile"', () => {
  const r = units.convertFrom('km', '10');
  assert.equal(r.state, 'km-converted');
  assert.equal(r.resultText, '6.21 mile');
  assert.equal(r.errorText, '');
});

test('AC-2 mile-converted: 10 mile 입력 → km-result "16.09 km"', () => {
  const r = units.convertFrom('mile', '10');
  assert.equal(r.state, 'mile-converted');
  assert.equal(r.resultText, '16.09 km');
  assert.equal(r.errorText, '');
});

test('소수 2자리 고정: 1 km → "0.62 mile"', () => {
  assert.equal(units.convertFrom('km', '1').resultText, '0.62 mile');
});

test('AC-3 invalid-input: 문자 입력 → invalid-input + 오류 텍스트', () => {
  const r = units.convertFrom('km', 'abc');
  assert.equal(r.state, 'invalid-input');
  assert.equal(r.resultText, '');
  assert.ok(r.errorText.trim().length > 0);
});

test('AC-3 invalid-input: 음수 입력 → invalid-input', () => {
  const r = units.convertFrom('mile', '-5');
  assert.equal(r.state, 'invalid-input');
  assert.ok(r.errorText.trim().length > 0);
});

test('빈 입력 → idle 복원(오류 아님)', () => {
  const r = units.convertFrom('km', '');
  assert.equal(r.state, 'idle');
  assert.equal(r.resultText, '');
  assert.equal(r.errorText, '');
  assert.equal(units.convertFrom('mile', '   ').state, 'idle');
});

test('§4 상태명이 색상 없이 텍스트로 노출된다(statusText)', () => {
  assert.ok(units.convertFrom('km', '10').statusText.includes('km-converted'));
  assert.ok(units.convertFrom('mile', '10').statusText.includes('mile-converted'));
  assert.ok(units.convertFrom('km', 'abc').statusText.includes('invalid-input'));
  assert.ok(units.convertFrom('km', '').statusText.includes('idle'));
});

test('INVALID_TEXT 오류 문구가 비어있지 않다', () => {
  assert.ok(typeof units.INVALID_TEXT === 'string' && units.INVALID_TEXT.trim().length > 0);
});
