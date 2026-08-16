'use strict';

/**
 * 인메모리 슬라이딩 윈도 rate limiter. 외부 의존성 없이 주입 가능한 clock 기반 순수 모듈.
 * @param {{ limit?: number, windowMs?: number, clock: { now(): Date } }} options
 * @returns {{ check(ip: string): { allowed: boolean, retryAfterSeconds?: number } }}
 */
function createRateLimiter(options) {
  const opts = options || {};
  const limit = opts.limit === undefined ? 30 : opts.limit;
  const windowMs = opts.windowMs === undefined ? 60000 : opts.windowMs;
  const clock = opts.clock;

  if (!clock || typeof clock.now !== 'function') {
    throw new TypeError('createRateLimiter requires a clock with a now() method');
  }

  const timestampsByIp = new Map();

  function check(ip) {
    const now = clock.now().getTime();
    const windowStart = now - windowMs;

    const existing = timestampsByIp.get(ip) || [];
    const active = existing.filter((ts) => ts >= windowStart);

    if (active.length >= limit) {
      timestampsByIp.set(ip, active);
      const oldest = active[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      return { allowed: false, retryAfterSeconds };
    }

    active.push(now);
    timestampsByIp.set(ip, active);
    return { allowed: true };
  }

  return { check };
}

module.exports = { createRateLimiter };
