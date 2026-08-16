'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createMemoryLinkStore } = require('../../src/links/stores/memoryLinkStore');
const { createFileLinkStore } = require('../../src/links/stores/fileLinkStore');
const { createLinkCache } = require('../../src/links/cache/linkCache');

function tempFilePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'links-cache-'));
  return path.join(dir, 'links.json');
}

function createCountingStore(base) {
  const calls = { save: 0, get: 0, delete: 0, incrementHits: 0 };
  return {
    calls,
    async save(link) {
      calls.save += 1;
      return base.save(link);
    },
    async get(slug) {
      calls.get += 1;
      return base.get(slug);
    },
    async delete(slug) {
      calls.delete += 1;
      return base.delete(slug);
    },
    async incrementHits(slug) {
      calls.incrementHits += 1;
      return base.incrementHits(slug);
    },
  };
}

function sampleLink(overrides = {}) {
  return {
    slug: 'x1',
    targetUrl: 'https://example.com',
    createdAt: '2026-08-15T00:00:00.000Z',
    expiresAt: null,
    hits: 0,
    ...overrides,
  };
}

test('cache hit 시 store(파일 I/O)를 거치지 않는다 (AC1)', async () => {
  const counting = createCountingStore(createFileLinkStore(tempFilePath()));
  const cache = createLinkCache(counting);

  await cache.save(sampleLink());
  assert.equal(counting.calls.get, 0, 'write-through 캐시라 save 직후 get() 은 store.get 을 호출하지 않는다');

  const hit1 = await cache.get('x1');
  const hit2 = await cache.get('x1');
  assert.equal(counting.calls.get, 0, 'save 로 populate 된 캐시 hit 은 store.get 을 호출하지 않는다');
  assert.equal(hit1.targetUrl, 'https://example.com');
  assert.equal(hit2.hits, 0);
});

test('cache miss 후 populate 되면 이후 hit 은 store.get 을 다시 호출하지 않는다', async () => {
  const backing = createMemoryLinkStore();
  await backing.save(sampleLink({ slug: 'x2' }));
  const counting = createCountingStore(backing);
  const cache = createLinkCache(counting);

  const first = await cache.get('x2');
  assert.equal(counting.calls.get, 1, '첫 조회는 캐시에 없으므로 store 를 호출해 populate 한다');
  assert.equal(first.slug, 'x2');

  const second = await cache.get('x2');
  assert.equal(counting.calls.get, 1, '두 번째 조회는 캐시 hit 이므로 store 를 호출하지 않는다');
  assert.equal(second.slug, 'x2');
});

test('§2 #1 생성: save 후 get 은 캐시 hit 이며 최신 값을 반환한다', async () => {
  const cache = createLinkCache(createMemoryLinkStore());
  await cache.save(sampleLink({ slug: 'create1' }));
  const found = await cache.get('create1');
  assert.equal(found.targetUrl, 'https://example.com');
});

test('§2 #2 만료 갱신: 동일 slug 재-save 시 캐시가 갱신된 expiresAt 을 반환한다', async () => {
  const cache = createLinkCache(createMemoryLinkStore());
  await cache.save(sampleLink({ slug: 'ttl1', expiresAt: '2026-08-15T00:01:00.000Z' }));
  await cache.save(sampleLink({ slug: 'ttl1', expiresAt: '2026-08-15T00:02:00.000Z' }));

  const found = await cache.get('ttl1');
  assert.equal(found.expiresAt, '2026-08-15T00:02:00.000Z');
});

test('§2 #3 삭제: delete 성공 시 캐시가 evict 되어 이후 get 은 store 를 재조회해 null 을 반환한다', async () => {
  const backing = createMemoryLinkStore();
  const counting = createCountingStore(backing);
  const cache = createLinkCache(counting);

  await cache.save(sampleLink({ slug: 'del1' }));
  const deleted = await cache.delete('del1');
  assert.equal(deleted, true);

  const getCallsBefore = counting.calls.get;
  const found = await cache.get('del1');
  assert.equal(found, null);
  assert.equal(counting.calls.get, getCallsBefore + 1, '삭제 후 get 은 캐시 miss 로 처리되어 store 를 다시 호출한다');
});

test('§2 #3 삭제: delete 실패(존재하지 않음) 시 캐시를 건드리지 않는다', async () => {
  const cache = createLinkCache(createMemoryLinkStore());
  const deleted = await cache.delete('missing');
  assert.equal(deleted, false);
});

test('§2 #4 hits 증가: incrementHits 후 get 은 캐시 hit 이며 증가된 hits 를 반환한다', async () => {
  const backing = createMemoryLinkStore();
  const counting = createCountingStore(backing);
  const cache = createLinkCache(counting);

  await cache.save(sampleLink({ slug: 'hits1' }));
  const updated = await cache.incrementHits('hits1');
  assert.equal(updated.hits, 1);

  const getCallsBefore = counting.calls.get;
  const found = await cache.get('hits1');
  assert.equal(found.hits, 1);
  assert.equal(counting.calls.get, getCallsBefore, 'incrementHits 직후 get 은 캐시 hit 이므로 store.get 을 호출하지 않는다');
});

test('§6 edge case: incrementHits 가 null 을 반환하면(레이스로 삭제됨) 캐시를 갱신하지 않는다', async () => {
  const backing = createMemoryLinkStore();
  const cache = createLinkCache(backing);

  const result = await cache.incrementHits('never-existed');
  assert.equal(result, null);
});

test('onHit/onMiss 콜백이 각각 정확히 호출된다', async () => {
  const backing = createMemoryLinkStore();
  await backing.save(sampleLink({ slug: 'cb1' }));

  let hits = 0;
  let misses = 0;
  const cache = createLinkCache(backing, {
    onHit: () => {
      hits += 1;
    },
    onMiss: () => {
      misses += 1;
    },
  });

  await cache.get('cb1');
  assert.equal(misses, 1);
  assert.equal(hits, 0);

  await cache.get('cb1');
  assert.equal(hits, 1);
  assert.equal(misses, 1);
});

test('§5 계약: linkCache 는 LinkStore 와 동일한 4개 메서드를 노출한다', () => {
  const cache = createLinkCache(createMemoryLinkStore());
  assert.equal(typeof cache.save, 'function');
  assert.equal(typeof cache.get, 'function');
  assert.equal(typeof cache.delete, 'function');
  assert.equal(typeof cache.incrementHits, 'function');
});
