'use strict';

// 카운터 증감·리셋 회귀 테스트 (node --test)
// DOM 바인딩(mountCounter)의 브라우저 검증은 downstream tester 소관이므로,
// 여기서는 DOM 비의존 순수 상태 로직(createCounter)만 회귀 검증한다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCounter } = require('./counter.js');

test('초기값은 0이다', () => {
  const counter = createCounter();
  assert.equal(counter.value, 0);
});

test('증가 시 counter 값이 1씩 갱신된다', () => {
  const counter = createCounter();
  assert.equal(counter.increment(), 1);
  assert.equal(counter.increment(), 2);
  assert.equal(counter.value, 2);
});

test('감소 시 1씩 갱신되며 음수를 허용한다', () => {
  const counter = createCounter();
  assert.equal(counter.decrement(), -1);
  assert.equal(counter.decrement(), -2);
  assert.equal(counter.value, -2);
});

test('리셋 시 0으로 복원된다', () => {
  const counter = createCounter();
  counter.increment();
  counter.increment();
  counter.increment();
  assert.equal(counter.value, 3);
  assert.equal(counter.reset(), 0);
  assert.equal(counter.value, 0);
});

test('리셋을 반복해도 항상 0을 유지한다', () => {
  const counter = createCounter();
  counter.decrement();
  counter.reset();
  counter.reset();
  assert.equal(counter.value, 0);
});

test('증가와 감소가 섞여도 정확히 누적된다', () => {
  const counter = createCounter();
  counter.increment(); // 1
  counter.increment(); // 2
  counter.decrement(); // 1
  counter.decrement(); // 0
  counter.decrement(); // -1
  assert.equal(counter.value, -1);
});
