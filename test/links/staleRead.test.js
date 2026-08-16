'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createMemoryLinkStore } = require('../../src/links/stores/memoryLinkStore');
const { createLinkCache } = require('../../src/links/cache/linkCache');
const { createLink, resolveLink, getStats, deleteLink } = require('../../src/links/routes');

function fixedClock(isoString) {
  const now = new Date(isoString);
  return { now: () => now };
}

test('§4 #1: createLink 직후 resolveLink 는 방금 생성한 targetUrl 로 302 를 반환한다', async () => {
  const store = createLinkCache(createMemoryLinkStore());
  const clock = fixedClock('2026-08-15T00:00:00.000Z');

  await createLink(store, { targetUrl: 'https://fresh.example.com', slug: 'X' }, clock);
  const res = await resolveLink(store, 'X', clock);

  assert.equal(res.status, 302);
  assert.equal(res.body.targetUrl, 'https://fresh.example.com');
});

test('§4 #2: resolveLink 를 N회 반복 호출 후 즉시 getStats 의 hits 는 N 과 일치한다', async () => {
  const store = createLinkCache(createMemoryLinkStore());
  const clock = fixedClock('2026-08-15T00:00:00.000Z');
  const N = 5;

  await createLink(store, { targetUrl: 'https://example.com', slug: 'X' }, clock);
  for (let i = 0; i < N; i += 1) {
    await resolveLink(store, 'X', clock);
  }
  const stats = await getStats(store, 'X', clock);

  assert.equal(stats.body.hits, N);
});

test('§4 #3: deleteLink 직후 resolveLink 는 404 를 반환한다 (삭제된 링크가 302 로 새지 않음)', async () => {
  const store = createLinkCache(createMemoryLinkStore());
  const clock = fixedClock('2026-08-15T00:00:00.000Z');

  await createLink(store, { targetUrl: 'https://example.com', slug: 'X' }, clock);
  await deleteLink(store, 'X');
  const res = await resolveLink(store, 'X', clock);

  assert.equal(res.status, 404);
});

test('§4 #4: 동일 slug 재-createLink(만료 갱신) 직후 getStats 의 expiresAt 은 최신 TTL 기준 값이다', async () => {
  const store = createLinkCache(createMemoryLinkStore());
  const clock = fixedClock('2026-08-15T00:00:00.000Z');

  await createLink(store, { targetUrl: 'https://example.com', slug: 'X', ttlSeconds: 60 }, clock);
  await createLink(store, { targetUrl: 'https://example.com', slug: 'X', ttlSeconds: 120 }, clock);
  const stats = await getStats(store, 'X', clock);

  assert.equal(stats.body.expiresAt, '2026-08-15T00:02:00.000Z');
});

test('§4 #5: deleteLink 후 동일 slug 재생성 시 resolveLink 는 새 레코드 기준으로 302 를 반환한다', async () => {
  const store = createLinkCache(createMemoryLinkStore());
  const clock = fixedClock('2026-08-15T00:00:00.000Z');

  await createLink(store, { targetUrl: 'https://old.example.com', slug: 'X' }, clock);
  await deleteLink(store, 'X');
  await createLink(store, { targetUrl: 'https://new.example.com', slug: 'X' }, clock);
  const res = await resolveLink(store, 'X', clock);

  assert.equal(res.status, 302);
  assert.equal(res.body.targetUrl, 'https://new.example.com');
});

// 회귀: 캐시 레이어를 거쳐도 기존 302/404/410·hits·TTL 계약은 불변이다.

test('회귀: 캐시를 거쳐도 존재하지 않는 slug 는 404 를 반환한다', async () => {
  const store = createLinkCache(createMemoryLinkStore());
  const clock = fixedClock('2026-08-15T00:00:00.000Z');

  const res = await resolveLink(store, 'missing', clock);
  assert.equal(res.status, 404);
});

test('회귀: 캐시를 거쳐도 만료된 링크는 410 LINK_EXPIRED 를 반환하고 hits 는 증가하지 않는다', async () => {
  const store = createLinkCache(createMemoryLinkStore());
  const clock = fixedClock('2026-08-15T00:00:00.000Z');

  await createLink(store, { targetUrl: 'https://example.com', slug: 'expired', ttlSeconds: 60 }, clock);
  const res = await resolveLink(store, 'expired', fixedClock('2026-08-15T00:01:00.000Z'));

  assert.equal(res.status, 410);
  assert.equal(res.body.error, 'LINK_EXPIRED');
  const stats = await getStats(store, 'expired', clock);
  assert.equal(stats.body.hits, 0);
});

test('회귀: 캐시를 거쳐도 미만료 링크는 302 를 반환하고 hits 가 정확히 증가한다', async () => {
  const store = createLinkCache(createMemoryLinkStore());
  const clock = fixedClock('2026-08-15T00:00:00.000Z');

  await createLink(store, { targetUrl: 'https://example.com', slug: 'active', ttlSeconds: 60 }, clock);
  await resolveLink(store, 'active', clock);
  await resolveLink(store, 'active', clock);

  const stats = await getStats(store, 'active', clock);
  assert.equal(stats.body.hits, 2);
});

test('회귀: 캐시를 거쳐도 deleteLink 는 존재하지 않는 slug 에 404 를 반환한다', async () => {
  const store = createLinkCache(createMemoryLinkStore());
  const res = await deleteLink(store, 'missing');
  assert.equal(res.status, 404);
});
