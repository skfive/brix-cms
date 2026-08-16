'use strict';

const RATE_LIMITED_RESPONSE_BODY = { error: { code: 'RATE_LIMITED' } };

/**
 * 요청 객체가 제공하는 IP를 그대로 사용한다(X-Forwarded-For 등 프록시 헤더 신뢰 체계는 범위 밖).
 * @param {{ ip?: string, socket?: { remoteAddress?: string }, connection?: { remoteAddress?: string } }} req
 * @returns {string}
 */
function extractClientIp(req) {
  if (!req) return 'unknown';
  if (typeof req.ip === 'string' && req.ip) return req.ip;
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  if (req.connection && req.connection.remoteAddress) return req.connection.remoteAddress;
  return 'unknown';
}

/**
 * 순수 판정 함수: 프레임워크 비의존. 링크 라우트의 `{status, body}` 반환 관례를 따른다.
 * @param {{ check(ip: string): { allowed: boolean, retryAfterSeconds?: number } }} limiter
 * @param {string} ip
 * @returns {null | { status: 429, body: object, headers: { 'Retry-After': string } }}
 */
function checkRateLimit(limiter, ip) {
  const result = limiter.check(ip);
  if (result.allowed) return null;
  return {
    status: 429,
    body: RATE_LIMITED_RESPONSE_BODY,
    headers: { 'Retry-After': String(result.retryAfterSeconds) },
  };
}

/**
 * Express 호환 미들웨어. res.status/json 이 있으면 사용하고, 없으면 raw http
 * writeHead/end 로 폴백한다.
 * @param {{ limiter: { check(ip: string): { allowed: boolean, retryAfterSeconds?: number } } }} options
 */
function createRateLimitMiddleware(options) {
  const limiter = options && options.limiter;
  if (!limiter || typeof limiter.check !== 'function') {
    throw new TypeError('createRateLimitMiddleware requires a limiter with a check() method');
  }

  return function rateLimitMiddleware(req, res, next) {
    const ip = extractClientIp(req);
    const blocked = checkRateLimit(limiter, ip);

    if (!blocked) {
      next();
      return;
    }

    if (typeof res.set === 'function' && typeof res.status === 'function') {
      res.set('Retry-After', blocked.headers['Retry-After']);
      res.status(blocked.status).json(blocked.body);
      return;
    }

    res.writeHead(blocked.status, {
      'Content-Type': 'application/json',
      'Retry-After': blocked.headers['Retry-After'],
    });
    res.end(JSON.stringify(blocked.body));
  };
}

module.exports = {
  extractClientIp,
  checkRateLimit,
  createRateLimitMiddleware,
};
