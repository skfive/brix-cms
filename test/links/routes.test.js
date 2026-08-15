'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createMemoryLinkStore } = require('../../src/links/stores/memoryLinkStore');
const { createLink, resolveLink, getStats, deleteLink } = require('../../src/links/routes');

function fixedClock(isoString) {
  const now = new Date(isoString);
  return { now: () => now };
}

test('createLink: ttlSeconds 미지정 시 expiresAt은 null이다 (무만료)', async () => {
  const store = createMemoryLinkStore();
  const res = await createLink(
    store,
    { targetUrl: 'https://example.com', slug: 'a1' },
    fixedClock('2026-08-15T00:00:00.000Z'),
  );
  assert.equal(res.status, 201);
  assert.equal(res.body.expiresAt, null);
});

test('createLink: ttlSeconds 지정 시 ISO expiresAt이 응답에 포함된다', async () => {
  const store = createMemoryLinkStore();
  const res = await createLink(
    store,
    { targetUrl: 'https://example.com', slug: 'a2', ttlSeconds: 60 },
    fixedClock('2026-08-15T00:00:00.000Z'),
  );
  assert.equal(res.status, 201);
  assert.equal(res.body.expiresAt, '2026-08-15T00:01:00.000Z');
});

test('createLink: ttlSeconds가 0이면 400 INVALID_TTL을 반환한다', async () => {
  const store = createMemoryLinkStore();
  const res = await createLink(
    store,
    { targetUrl: 'https://example.com', slug: 'a3', ttlSeconds: 0 },
    fixedClock('2026-08-15T00:00:00.000Z'),
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_TTL');
});

test('createLink: ttlSeconds가 음수이면 400 INVALID_TTL을 반환한다', async () => {
  const store = createMemoryLinkStore();
  const res = await createLink(
    store,
    { targetUrl: 'https://example.com', slug: 'a4', ttlSeconds: -1 },
    fixedClock('2026-08-15T00:00:00.000Z'),
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_TTL');
});

test('createLink: ttlSeconds가 2592000을 초과해도 상한 없이 유효하다', async () => {
  const store = createMemoryLinkStore();
  const res = await createLink(
    store,
    { targetUrl: 'https://example.com', slug: 'a4b', ttlSeconds: 2592001 },
    fixedClock('2026-08-15T00:00:00.000Z'),
  );
  assert.equal(res.status, 201);
  assert.equal(res.body.expiresAt, '2026-09-14T00:00:01.000Z');
});

test('createLink: ttlSeconds가 정수가 아니면 400 INVALID_TTL을 반환한다', async () => {
  const store = createMemoryLinkStore();
  const res = await createLink(
    store,
    { targetUrl: 'https://example.com', slug: 'a5', ttlSeconds: 60.5 },
    fixedClock('2026-08-15T00:00:00.000Z'),
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_TTL');
});

test('resolveLink: 존재하지 않는 slug는 404를 반환한다', async () => {
  const store = createMemoryLinkStore();
  const res = await resolveLink(store, 'missing', fixedClock('2026-08-15T00:00:00.000Z'));
  assert.equal(res.status, 404);
});

test('resolveLink: 만료된 링크는 410 LINK_EXPIRED를 반환하고 hits는 증가하지 않는다', async () => {
  const store = createMemoryLinkStore();
  await store.save({
    slug: 'expired',
    targetUrl: 'https://example.com',
    createdAt: '2026-08-15T00:00:00.000Z',
    expiresAt: '2026-08-15T00:01:00.000Z',
    hits: 0,
  });
  const res = await resolveLink(store, 'expired', fixedClock('2026-08-15T00:01:00.000Z'));
  assert.equal(res.status, 410);
  assert.equal(res.body.error, 'LINK_EXPIRED');
  assert.equal(res.body.slug, 'expired');
  assert.equal(res.body.expiredAt, '2026-08-15T00:01:00.000Z');
  const stored = await store.get('expired');
  assert.equal(stored.hits, 0);
});

test('resolveLink: 미만료 링크는 302를 반환하고 hits가 증가한다', async () => {
  const store = createMemoryLinkStore();
  await store.save({
    slug: 'active',
    targetUrl: 'https://example.com',
    createdAt: '2026-08-15T00:00:00.000Z',
    expiresAt: '2026-08-15T00:01:00.000Z',
    hits: 0,
  });
  const res = await resolveLink(store, 'active', fixedClock('2026-08-15T00:00:59.999Z'));
  assert.equal(res.status, 302);
  const stored = await store.get('active');
  assert.equal(stored.hits, 1);
});

test('getStats: 만료된 링크도 200으로 조회되며 isExpired가 true다', async () => {
  const store = createMemoryLinkStore();
  await store.save({
    slug: 'stat1',
    targetUrl: 'https://example.com',
    createdAt: '2026-08-15T00:00:00.000Z',
    expiresAt: '2026-08-15T00:01:00.000Z',
    hits: 3,
  });
  const res = await getStats(store, 'stat1', fixedClock('2026-08-15T00:01:00.000Z'));
  assert.equal(res.status, 200);
  assert.equal(res.body.isExpired, true);
  assert.equal(res.body.expiresAt, '2026-08-15T00:01:00.000Z');
});

test('getStats: 미만료 링크는 isExpired가 false다', async () => {
  const store = createMemoryLinkStore();
  await store.save({
    slug: 'stat2',
    targetUrl: 'https://example.com',
    createdAt: '2026-08-15T00:00:00.000Z',
    expiresAt: null,
    hits: 0,
  });
  const res = await getStats(store, 'stat2', fixedClock('2026-08-15T00:00:00.000Z'));
  assert.equal(res.status, 200);
  assert.equal(res.body.isExpired, false);
  assert.equal(res.body.expiresAt, null);
});

test('getStats: 존재하지 않는 slug는 404를 반환한다', async () => {
  const store = createMemoryLinkStore();
  const res = await getStats(store, 'missing', fixedClock('2026-08-15T00:00:00.000Z'));
  assert.equal(res.status, 404);
});

test('deleteLink: 만료된 링크도 만료 여부와 무관하게 204로 삭제된다', async () => {
  const store = createMemoryLinkStore();
  await store.save({
    slug: 'del-expired',
    targetUrl: 'https://example.com',
    createdAt: '2026-08-15T00:00:00.000Z',
    expiresAt: '2020-01-01T00:00:00.000Z',
    hits: 0,
  });
  const res = await deleteLink(store, 'del-expired');
  assert.equal(res.status, 204);
});

test('deleteLink: 존재하지 않는 slug는 404를 반환한다', async () => {
  const store = createMemoryLinkStore();
  const res = await deleteLink(store, 'missing');
  assert.equal(res.status, 404);
});
