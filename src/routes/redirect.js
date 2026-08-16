'use strict';

// BF-2144 · 슬러그 열거(Slug Enumeration) 완화 — resolve(redirect) 엔드포인트에 rate limit 적용.
//
// 실제 해석(redirect) 로직은 src/links/routes.js 의 resolveLink 에 있다. 이 모듈은 담당 파일
// 범위(src/routes/redirect.js) 안에서 그 로직을 감싸는 얇은 래퍼로, rate limit 게이트를
// store/link-cache/link-metrics 호출 이전 최전단에 추가한다. 차단(429)된 요청은 resolveLink
// 에 도달하지 않으므로 hits/캐시/계측에 영향을 주지 않는다. 302/404/410 응답 스키마는
// src/links/routes.js 의 기존 동작 그대로 유지한다(이번 작업 범위 밖).

const { resolveLink: baseResolveLink } = require('../links/routes');
const { checkRateLimit } = require('../middleware/rateLimitMiddleware');

/**
 * @param {{ limiter?: { check(ip: string): { allowed: boolean, retryAfterSeconds?: number } }, ip?: string }} [rateLimit]
 * @returns {null | { status: 429, body: object, headers: object }}
 */
function gateByRateLimit(rateLimit) {
  if (!rateLimit || !rateLimit.limiter) return null;
  return checkRateLimit(rateLimit.limiter, rateLimit.ip);
}

async function resolveLink(store, slug, clock, rateLimit) {
  const blocked = gateByRateLimit(rateLimit);
  if (blocked) return blocked;

  return baseResolveLink(store, slug, clock);
}

module.exports = {
  resolveLink,
};
