'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createMemoryLinkStore } = require('../../src/links/stores/memoryLinkStore');
const { createFileLinkStore } = require('../../src/links/stores/fileLinkStore');

function tempFilePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'links-store-'));
  return path.join(dir, 'links.json');
}

const implementations = [
  { name: 'memoryLinkStore', createStore: () => createMemoryLinkStore() },
  { name: 'fileLinkStore', createStore: () => createFileLinkStore(tempFilePath()) },
];

for (const { name, createStore } of implementations) {
  test(`${name}: save 후 get 으로 동일 레코드를 조회한다`, async () => {
    const store = createStore();
    await store.save({
      slug: 'abc123',
      targetUrl: 'https://example.com',
      createdAt: '2026-08-15T00:00:00.000Z',
      expiresAt: null,
      hits: 0,
    });
    const found = await store.get('abc123');
    assert.equal(found.slug, 'abc123');
    assert.equal(found.targetUrl, 'https://example.com');
    assert.equal(found.expiresAt, null);
  });

  test(`${name}: 존재하지 않는 slug는 null을 반환한다`, async () => {
    const store = createStore();
    assert.equal(await store.get('missing'), null);
  });

  test(`${name}: expiresAt 필드가 없는 레거시 레코드는 null로 정규화된다`, async () => {
    const store = createStore();
    await store.save({
      slug: 'legacy1',
      targetUrl: 'https://example.com',
      createdAt: '2026-08-15T00:00:00.000Z',
      hits: 0,
    });
    const found = await store.get('legacy1');
    assert.equal(found.expiresAt, null);
  });

  test(`${name}: 만료 시각이 지난 레코드도 판정 없이 그대로 조회된다 (store는 만료를 모른다)`, async () => {
    const store = createStore();
    await store.save({
      slug: 'expired1',
      targetUrl: 'https://example.com',
      createdAt: '2026-08-15T00:00:00.000Z',
      expiresAt: '2020-01-01T00:00:00.000Z',
      hits: 0,
    });
    const found = await store.get('expired1');
    assert.equal(found.expiresAt, '2020-01-01T00:00:00.000Z');
  });

  test(`${name}: incrementHits는 hits를 1 증가시킨다`, async () => {
    const store = createStore();
    await store.save({
      slug: 'hits1',
      targetUrl: 'https://example.com',
      createdAt: '2026-08-15T00:00:00.000Z',
      expiresAt: null,
      hits: 0,
    });
    await store.incrementHits('hits1');
    const found = await store.get('hits1');
    assert.equal(found.hits, 1);
  });

  test(`${name}: delete는 존재하는 slug를 삭제하고 true를 반환한다`, async () => {
    const store = createStore();
    await store.save({
      slug: 'del1',
      targetUrl: 'https://example.com',
      createdAt: '2026-08-15T00:00:00.000Z',
      expiresAt: null,
      hits: 0,
    });
    assert.equal(await store.delete('del1'), true);
    assert.equal(await store.get('del1'), null);
  });

  test(`${name}: delete는 만료된 링크도 만료 여부와 무관하게 삭제한다`, async () => {
    const store = createStore();
    await store.save({
      slug: 'del2',
      targetUrl: 'https://example.com',
      createdAt: '2026-08-15T00:00:00.000Z',
      expiresAt: '2020-01-01T00:00:00.000Z',
      hits: 0,
    });
    assert.equal(await store.delete('del2'), true);
  });

  test(`${name}: 존재하지 않는 slug 삭제는 false를 반환한다`, async () => {
    const store = createStore();
    assert.equal(await store.delete('missing'), false);
  });
}
