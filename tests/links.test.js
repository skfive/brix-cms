'use strict';

// BF-2144 · Open Redirect(결함 1) + 슬러그 열거(결함 3) 재현(RED) 및 수정(GREEN) 테스트
// 대상: src/routes/links.js (createLink/getStats/deleteLink 래퍼), src/routes/redirect.js
// (resolveLink 래퍼). 실제 로직은 src/links/routes.js 에 위임하며, 이 테스트는 래퍼가
// 추가한 스킴 검증·rate limit 게이트만 검증한다(302/404/410 shape 자체는 src/links 쪽 계약).

const test = require('node:test');
const assert = require('node:assert/strict');

const { createLink, getStats, deleteLink, hasValidTargetUrlScheme } = require('../src/routes/links');
const { resolveLink } = require('../src/routes/redirect');

function createFakeStore(seed) {
  const links = new Map(Object.entries(seed || {}));
  let saveCalls = 0;
  return {
    async save(link) {
      saveCalls += 1;
      links.set(link.slug, link);
      return link;
    },
    async get(slug) {
      return links.get(slug) || null;
    },
    async incrementHits(slug) {
      const link = links.get(slug);
      if (link) link.hits += 1;
    },
    async delete(slug) {
      return links.delete(slug);
    },
    get saveCallCount() {
      return saveCalls;
    },
  };
}

function fixedClock(isoString) {
  return { now: () => new Date(isoString) };
}

// --- 결함 1: Open Redirect — 스킴 검증 (판정 예시 표 그대로) ---

test('hasValidTargetUrlScheme: http/https 대소문자 변형 허용', () => {
  assert.equal(hasValidTargetUrlScheme('http://example.com'), true);
  assert.equal(hasValidTargetUrlScheme('HTTPS://example.com'), true);
  assert.equal(hasValidTargetUrlScheme('HtTpS://example.com'), true);
});

test('hasValidTargetUrlScheme: 위험 스킴/변형 거부', () => {
  assert.equal(hasValidTargetUrlScheme('javascript:alert(1)'), false);
  assert.equal(hasValidTargetUrlScheme('JAVASCRIPT:alert(1)'), false);
  assert.equal(hasValidTargetUrlScheme(' javascript:alert(1)'), false);
  assert.equal(hasValidTargetUrlScheme(' http://example.com'), false);
  assert.equal(hasValidTargetUrlScheme('http ://example.com'), false);
  assert.equal(hasValidTargetUrlScheme('data:text/html,...'), false);
  assert.equal(hasValidTargetUrlScheme('//evil.com'), false);
  assert.equal(hasValidTargetUrlScheme('ftp://example.com'), false);
  assert.equal(hasValidTargetUrlScheme(''), false);
  assert.equal(hasValidTargetUrlScheme(null), false);
  assert.equal(hasValidTargetUrlScheme(undefined), false);
  assert.equal(hasValidTargetUrlScheme(123), false);
});

test('createLink: 잘못된 스킴은 400 INVALID_TARGET_SCHEME 이고 store.save 를 호출하지 않는다(슬러그 공간 미소모)', async () => {
  const store = createFakeStore();
  const clock = fixedClock('2026-08-16T00:00:00.000Z');

  const result = await createLink(
    store,
    { targetUrl: 'javascript:alert(document.cookie)', slug: 'abc1234' },
    clock,
  );

  assert.deepEqual(result, { status: 400, body: { error: { code: 'INVALID_TARGET_SCHEME' } } });
  assert.equal(store.saveCallCount, 0);
});

test('createLink: protocol-relative(//evil.com) targetUrl 도 거부된다', async () => {
  const store = createFakeStore();
  const clock = fixedClock('2026-08-16T00:00:00.000Z');

  const result = await createLink(store, { targetUrl: '//evil.com', slug: 'abc1234' }, clock);

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'INVALID_TARGET_SCHEME');
  assert.equal(store.saveCallCount, 0);
});

test('createLink: 유효한 http/https targetUrl 은 기존 createLink 로 위임되어 201 을 반환한다', async () => {
  const store = createFakeStore();
  const clock = fixedClock('2026-08-16T00:00:00.000Z');

  const result = await createLink(
    store,
    { targetUrl: 'HTTPS://example.com', slug: 'abc1234' },
    clock,
  );

  assert.equal(result.status, 201);
  assert.equal(result.body.targetUrl, 'HTTPS://example.com');
  assert.equal(store.saveCallCount, 1);
});

// --- rate limit 게이트: store/cache/metrics 앞단 최전단 배치 ---

function blockingLimiter(retryAfterSeconds) {
  return { check: () => ({ allowed: false, retryAfterSeconds: retryAfterSeconds || 5 }) };
}

function allowingLimiter() {
  return { check: () => ({ allowed: true }) };
}

test('createLink: rate limit 초과 시 429 + Retry-After 를 반환하고 store.save 를 호출하지 않는다', async () => {
  const store = createFakeStore();
  const clock = fixedClock('2026-08-16T00:00:00.000Z');

  const result = await createLink(
    store,
    { targetUrl: 'http://example.com', slug: 'abc1234' },
    clock,
    { limiter: blockingLimiter(7), ip: '203.0.113.1' },
  );

  assert.equal(result.status, 429);
  assert.deepEqual(result.body, { error: { code: 'RATE_LIMITED' } });
  assert.equal(result.headers['Retry-After'], '7');
  assert.equal(store.saveCallCount, 0);
});

test('createLink: rate limit 허용 시 기존 흐름대로 동작한다', async () => {
  const store = createFakeStore();
  const clock = fixedClock('2026-08-16T00:00:00.000Z');

  const result = await createLink(
    store,
    { targetUrl: 'http://example.com', slug: 'abc1234' },
    clock,
    { limiter: allowingLimiter(), ip: '203.0.113.1' },
  );

  assert.equal(result.status, 201);
  assert.equal(store.saveCallCount, 1);
});

test('getStats/deleteLink: rate limit 초과 시 429 이고 store 를 호출하지 않는다', async () => {
  const store = createFakeStore({
    abc1234: { slug: 'abc1234', targetUrl: 'http://example.com', createdAt: '2026-08-16T00:00:00.000Z', expiresAt: null, hits: 0 },
  });
  const clock = fixedClock('2026-08-16T00:00:00.000Z');
  const rateLimit = { limiter: blockingLimiter(3), ip: '203.0.113.1' };

  const statsResult = await getStats(store, 'abc1234', clock, rateLimit);
  const deleteResult = await deleteLink(store, 'abc1234', rateLimit);

  assert.equal(statsResult.status, 429);
  assert.equal(deleteResult.status, 429);
});

test('getStats: 존재하지 않는 슬러그는 기존과 동일한 404 shape 를 유지한다(회귀 없음)', async () => {
  const store = createFakeStore();
  const clock = fixedClock('2026-08-16T00:00:00.000Z');

  const result = await getStats(store, 'missing1', clock);

  assert.deepEqual(result, { status: 404, body: { error: { code: 'NOT_FOUND' } } });
});

// --- 결함 3: 슬러그 열거 완화 — resolve(redirect) 엔드포인트 rate limit ---

test('resolveLink: rate limit 초과 시 429 이고 기존 resolveLink(store)를 호출하지 않는다(hits 미증가)', async () => {
  const store = createFakeStore({
    abc1234: { slug: 'abc1234', targetUrl: 'http://example.com', createdAt: '2026-08-16T00:00:00.000Z', expiresAt: null, hits: 0 },
  });
  const clock = fixedClock('2026-08-16T00:00:00.000Z');

  const result = await resolveLink(store, 'abc1234', clock, {
    limiter: blockingLimiter(9),
    ip: '203.0.113.1',
  });

  assert.equal(result.status, 429);
  assert.deepEqual(result.body, { error: { code: 'RATE_LIMITED' } });
  assert.equal(result.headers['Retry-After'], '9');

  const link = await store.get('abc1234');
  assert.equal(link.hits, 0);
});

test('resolveLink: rate limit 허용 시 기존 302 응답 계약이 그대로 유지된다', async () => {
  const store = createFakeStore({
    abc1234: { slug: 'abc1234', targetUrl: 'http://example.com', createdAt: '2026-08-16T00:00:00.000Z', expiresAt: null, hits: 0 },
  });
  const clock = fixedClock('2026-08-16T00:00:00.000Z');

  const result = await resolveLink(store, 'abc1234', clock, {
    limiter: allowingLimiter(),
    ip: '203.0.113.1',
  });

  assert.deepEqual(result, { status: 302, body: { targetUrl: 'http://example.com' } });
});

test('resolveLink: 존재하지 않는 슬러그(404)와 만료된 슬러그(410)는 기존 shape 그대로 유지된다(회귀 없음)', async () => {
  const store = createFakeStore({
    expired1: {
      slug: 'expired1',
      targetUrl: 'http://example.com',
      createdAt: '2026-08-01T00:00:00.000Z',
      expiresAt: '2026-08-02T00:00:00.000Z',
      hits: 0,
    },
  });
  const clock = fixedClock('2026-08-16T00:00:00.000Z');

  const notFound = await resolveLink(store, 'missing1', clock);
  assert.deepEqual(notFound, { status: 404, body: { error: { code: 'NOT_FOUND' } } });

  const expired = await resolveLink(store, 'expired1', clock);
  assert.equal(expired.status, 410);
  assert.equal(expired.body.slug, 'expired1');
  assert.equal(expired.body.expiredAt, '2026-08-02T00:00:00.000Z');
});
