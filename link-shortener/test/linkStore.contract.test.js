'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { FileLinkStore } = require('../src/store/FileLinkStore');
const { MemoryLinkStore } = require('../src/store/memoryLinkStore');
const { createStore } = require('../src/store/createStore');

async function testCreateAndFindBySlug(store) {
  const record = { slug: 'abc123', url: 'https://example.com', clicks: 0 };
  const created = await store.create(record);
  assert.deepEqual(created, record);
  const found = await store.findBySlug('abc123');
  assert.deepEqual(found, record);
}

async function testCreateDuplicateSlugThrows(store) {
  const record = { slug: 'dup1', url: 'https://example.com', clicks: 0 };
  await store.create(record);
  await assert.rejects(() => store.create(record));
}

async function testFindBySlugMissingReturnsNull(store) {
  const found = await store.findBySlug('missing-slug');
  assert.equal(found, null);
}

async function testExists(store) {
  assert.equal(await store.exists('exists1'), false);
  await store.create({ slug: 'exists1', url: 'https://example.com', clicks: 0 });
  assert.equal(await store.exists('exists1'), true);
}

async function testIncrementClicks(store) {
  await store.create({ slug: 'clicks1', url: 'https://example.com', clicks: 0 });
  const updated = await store.incrementClicks('clicks1');
  assert.equal(updated.clicks, 1);
  const found = await store.findBySlug('clicks1');
  assert.equal(found.clicks, 1);
}

async function testIncrementClicksMissingReturnsNull(store) {
  const result = await store.incrementClicks('missing-slug');
  assert.equal(result, null);
}

async function testRemove(store) {
  await store.create({ slug: 'remove1', url: 'https://example.com', clicks: 0 });
  const removed = await store.remove('remove1');
  assert.equal(removed, true);
  assert.equal(await store.exists('remove1'), false);
}

async function testRemoveMissingReturnsFalse(store) {
  const result = await store.remove('missing-remove');
  assert.equal(result, false);
}

const contractCases = [
  ['create 후 findBySlug 로 조회 가능', testCreateAndFindBySlug],
  ['중복 slug 로 create 시 예외', testCreateDuplicateSlugThrows],
  ['존재하지 않는 slug findBySlug 는 null', testFindBySlugMissingReturnsNull],
  ['exists 는 존재 여부를 반환', testExists],
  ['incrementClicks 는 clicks 를 1 증가', testIncrementClicks],
  ['존재하지 않는 slug incrementClicks 는 null', testIncrementClicksMissingReturnsNull],
  ['remove 는 레코드를 삭제하고 true 반환', testRemove],
  ['존재하지 않는 slug remove 는 false', testRemoveMissingReturnsFalse],
];

const implementations = [
  {
    name: 'FileLinkStore',
    create: async (t) => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'link-store-contract-'));
      t.after(async () => {
        await fs.rm(dir, { recursive: true, force: true });
      });
      return new FileLinkStore(path.join(dir, 'links.json'));
    },
  },
  {
    name: 'MemoryLinkStore',
    create: async () => new MemoryLinkStore(),
  },
];

for (const { name, create } of implementations) {
  test(`${name} — LinkStore 계약 준수`, async (t) => {
    for (const [caseName, caseFn] of contractCases) {
      await t.test(caseName, async (t2) => {
        const store = await create(t2);
        await caseFn(store);
      });
    }
  });
}

function withLinkStoreEnv(t, value) {
  const original = process.env.LINK_STORE;
  if (value === undefined) {
    delete process.env.LINK_STORE;
  } else {
    process.env.LINK_STORE = value;
  }
  t.after(() => {
    if (original === undefined) delete process.env.LINK_STORE;
    else process.env.LINK_STORE = original;
  });
}

test('createStore — kind 미지정 시 LINK_STORE env 가 없으면 기본값 file', async (t) => {
  withLinkStoreEnv(t, undefined);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'link-store-contract-'));
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });
  const store = createStore({ filePath: path.join(dir, 'links.json') });
  assert.ok(store instanceof FileLinkStore);
});

test('createStore — LINK_STORE env 로 구현체 선택', (t) => {
  withLinkStoreEnv(t, 'memory');
  const store = createStore();
  assert.ok(store instanceof MemoryLinkStore);
});

test('createStore — 명시적 kind 인자가 env 보다 우선', (t) => {
  withLinkStoreEnv(t, 'memory');
  const store = createStore({ kind: 'file', filePath: '/tmp/link-store-contract-unused.json' });
  assert.ok(store instanceof FileLinkStore);
});

test('createStore — 알 수 없는 kind 는 예외를 던진다', () => {
  assert.throws(() => createStore({ kind: 'redis' }), /Unknown LINK_STORE kind/);
});
