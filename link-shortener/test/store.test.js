'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { FileLinkStore } = require('../src/store/FileLinkStore');

async function makeTempFile() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'link-store-'));
  return path.join(dir, 'links.json');
}

test('create는 레코드를 저장하고 반환한다', async () => {
  const store = new FileLinkStore(await makeTempFile());
  const record = await store.create({
    slug: 'abc123x',
    originalUrl: 'https://example.com',
    createdAt: new Date().toISOString(),
    clicks: 0,
  });
  assert.equal(record.slug, 'abc123x');
  const found = await store.findBySlug('abc123x');
  assert.deepEqual(found, record);
});

test('create는 중복 slug에 대해 예외를 던진다', async () => {
  const store = new FileLinkStore(await makeTempFile());
  await store.create({
    slug: 'dup1234',
    originalUrl: 'https://example.com',
    createdAt: new Date().toISOString(),
    clicks: 0,
  });
  await assert.rejects(() =>
    store.create({
      slug: 'dup1234',
      originalUrl: 'https://other.com',
      createdAt: new Date().toISOString(),
      clicks: 0,
    })
  );
});

test('exists/findBySlug는 없는 slug에 대해 각각 false/null을 반환한다', async () => {
  const store = new FileLinkStore(await makeTempFile());
  assert.equal(await store.exists('missing'), false);
  assert.equal(await store.findBySlug('missing'), null);
});

test('incrementClicks는 clicks를 1씩 증가시킨다', async () => {
  const store = new FileLinkStore(await makeTempFile());
  await store.create({
    slug: 'hit1234',
    originalUrl: 'https://example.com',
    createdAt: new Date().toISOString(),
    clicks: 0,
  });
  const updated = await store.incrementClicks('hit1234');
  assert.equal(updated.clicks, 1);
  const updated2 = await store.incrementClicks('hit1234');
  assert.equal(updated2.clicks, 2);
});

test('incrementClicks는 없는 slug에 대해 null을 반환한다', async () => {
  const store = new FileLinkStore(await makeTempFile());
  assert.equal(await store.incrementClicks('missing'), null);
});

test('remove는 존재하는 slug를 삭제하고 true를 반환한다', async () => {
  const store = new FileLinkStore(await makeTempFile());
  await store.create({
    slug: 'rm12345',
    originalUrl: 'https://example.com',
    createdAt: new Date().toISOString(),
    clicks: 0,
  });
  assert.equal(await store.remove('rm12345'), true);
  assert.equal(await store.exists('rm12345'), false);
});

test('remove는 없는 slug에 대해 false를 반환한다', async () => {
  const store = new FileLinkStore(await makeTempFile());
  assert.equal(await store.remove('missing'), false);
});

test('동시 쓰기 요청은 직렬화되어 모두 반영된다', async () => {
  const store = new FileLinkStore(await makeTempFile());
  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      store.create({
        slug: `slug${i}`,
        originalUrl: 'https://example.com',
        createdAt: new Date().toISOString(),
        clicks: 0,
      })
    )
  );
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    assert.equal(await store.exists(`slug${i}`), true);
  }
});

test('새 FileLinkStore 인스턴스는 파일에서 기존 레코드를 로드한다', async () => {
  const filePath = await makeTempFile();
  const store1 = new FileLinkStore(filePath);
  await store1.create({
    slug: 'load123',
    originalUrl: 'https://example.com',
    createdAt: new Date().toISOString(),
    clicks: 0,
  });

  const store2 = new FileLinkStore(filePath);
  const found = await store2.findBySlug('load123');
  assert.equal(found.slug, 'load123');
});
