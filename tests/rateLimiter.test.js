'use strict';

// BF-2144 · 결함 2(Rate Limit 부재) 재현(RED) 및 수정(GREEN) 테스트
// 대상: src/lib/rateLimiter.js — createRateLimiter({ limit, windowMs, clock }) -> { check(ip) }
// 경계값: 창 경계(window boundary) · 초과(exceed) · 회복(recovery)를 주입 clock 으로 검증한다.

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRateLimiter } = require('../src/lib/rateLimiter');

function createControllableClock(startMs) {
  let current = startMs;
  return {
    now: () => new Date(current),
    advanceMs(ms) {
      current += ms;
    },
  };
}

test('createRateLimiter: clock 미주입 시 생성 자체를 거부한다', () => {
  assert.throws(() => createRateLimiter({ limit: 30, windowMs: 60000 }), TypeError);
});

test('check: 한도(30회) 이내 요청은 모두 allowed=true', () => {
  const clock = createControllableClock(0);
  const limiter = createRateLimiter({ limit: 30, windowMs: 60000, clock });

  for (let i = 0; i < 30; i += 1) {
    const result = limiter.check('203.0.113.1');
    assert.equal(result.allowed, true, `요청 ${i + 1}번째는 허용되어야 한다`);
  }
});

test('check(초과): 31번째 요청은 거부되고 retryAfterSeconds 를 반환한다', () => {
  const clock = createControllableClock(0);
  const limiter = createRateLimiter({ limit: 30, windowMs: 60000, clock });

  for (let i = 0; i < 30; i += 1) limiter.check('203.0.113.1');

  const blocked = limiter.check('203.0.113.1');
  assert.equal(blocked.allowed, false);
  // 30건 모두 t=0 에 발생 → oldest=0, windowMs=60000, now=0 → (0+60000-0)/1000 = 60
  assert.equal(blocked.retryAfterSeconds, 60);
});

test('check(창 경계): now - windowMs 와 정확히 같은 시각의 타임스탬프는 아직 유효하다', () => {
  const clock = createControllableClock(0);
  const limiter = createRateLimiter({ limit: 30, windowMs: 60000, clock });

  for (let i = 0; i < 30; i += 1) limiter.check('203.0.113.1'); // 모두 t=0

  clock.advanceMs(60000); // now=60000 → windowStart=0 → t=0 은 여전히 포함(>=)
  const stillBlocked = limiter.check('203.0.113.1');
  assert.equal(stillBlocked.allowed, false);
  // oldest=0, now=60000 → (0+60000-60000)/1000=0 → Math.max(1, 0) = 1
  assert.equal(stillBlocked.retryAfterSeconds, 1);
});

test('check(회복): 윈도가 완전히 지나면(now - windowMs 보다 오래됨) 다시 허용된다', () => {
  const clock = createControllableClock(0);
  const limiter = createRateLimiter({ limit: 30, windowMs: 60000, clock });

  for (let i = 0; i < 30; i += 1) limiter.check('203.0.113.1'); // 모두 t=0

  clock.advanceMs(60001); // now=60001 → windowStart=1 → t=0 은 제거 대상
  const recovered = limiter.check('203.0.113.1');
  assert.equal(recovered.allowed, true);
});

test('check(회복 후 재차단): 회복 이후 다시 30회를 채우면 31번째는 재차단된다', () => {
  const clock = createControllableClock(0);
  const limiter = createRateLimiter({ limit: 30, windowMs: 60000, clock });

  for (let i = 0; i < 30; i += 1) limiter.check('203.0.113.1');
  clock.advanceMs(60001);
  for (let i = 0; i < 30; i += 1) limiter.check('203.0.113.1');

  const blockedAgain = limiter.check('203.0.113.1');
  assert.equal(blockedAgain.allowed, false);
});

test('check: IP 별로 카운터가 독립적이다', () => {
  const clock = createControllableClock(0);
  const limiter = createRateLimiter({ limit: 30, windowMs: 60000, clock });

  for (let i = 0; i < 30; i += 1) limiter.check('203.0.113.1');
  const otherIp = limiter.check('198.51.100.7');

  assert.equal(otherIp.allowed, true);
});

test('check: limit/windowMs 커스텀 값도 그대로 적용된다', () => {
  const clock = createControllableClock(0);
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000, clock });

  assert.equal(limiter.check('203.0.113.1').allowed, true);
  assert.equal(limiter.check('203.0.113.1').allowed, true);
  const blocked = limiter.check('203.0.113.1');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
});
