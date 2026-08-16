'use strict';

// BF-2144 · Open Redirect 결함 수정 + rate limit 적용.
//
// 실제 링크 생성/조회/삭제 로직은 src/links/routes.js 에 있다(BF-2145 planner 산출물이
// 근거로 명시한 파일). 이 모듈은 담당 파일 범위(src/routes/links.js) 안에서 그 로직을
// 감싸는 얇은 래퍼로, (1) 저장 전 targetUrl 스킴 검증과 (2) rate limit 게이트를
// store/cache/metrics 호출 이전 최전단에 추가한다. src/links/routes.js 자체의 302/404/410,
// hits, TTL 계약은 변경하지 않는다.

const { createLink: baseCreateLink, getStats: baseGetStats, deleteLink: baseDeleteLink } =
  require('../links/routes');
const { checkRateLimit } = require('../middleware/rateLimitMiddleware');

const TARGET_URL_SCHEME_PATTERN = /^(https?):\/\//i;

/**
 * targetUrl 이 http/https 스킴으로 시작하는지 검사한다. 대소문자는 무시하되,
 * 선행 공백/제어문자나 스킴 내부 공백은 앵커(^)로 인해 자동 거부된다.
 * @param {unknown} targetUrl
 * @returns {boolean}
 */
function hasValidTargetUrlScheme(targetUrl) {
  return typeof targetUrl === 'string' && TARGET_URL_SCHEME_PATTERN.test(targetUrl);
}

/**
 * @param {{ limiter?: { check(ip: string): { allowed: boolean, retryAfterSeconds?: number } }, ip?: string }} [rateLimit]
 * @returns {null | { status: 429, body: object, headers: object }}
 */
function gateByRateLimit(rateLimit) {
  if (!rateLimit || !rateLimit.limiter) return null;
  return checkRateLimit(rateLimit.limiter, rateLimit.ip);
}

async function createLink(store, input, clock, rateLimit) {
  const blocked = gateByRateLimit(rateLimit);
  if (blocked) return blocked;

  if (!hasValidTargetUrlScheme(input && input.targetUrl)) {
    return { status: 400, body: { error: { code: 'INVALID_TARGET_SCHEME' } } };
  }

  return baseCreateLink(store, input, clock);
}

async function getStats(store, slug, clock, rateLimit) {
  const blocked = gateByRateLimit(rateLimit);
  if (blocked) return blocked;

  return baseGetStats(store, slug, clock);
}

async function deleteLink(store, slug, rateLimit) {
  const blocked = gateByRateLimit(rateLimit);
  if (blocked) return blocked;

  return baseDeleteLink(store, slug);
}

module.exports = {
  hasValidTargetUrlScheme,
  createLink,
  getStats,
  deleteLink,
};
