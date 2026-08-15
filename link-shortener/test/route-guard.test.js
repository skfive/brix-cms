'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../src/app');

function makeSpyStore() {
  const store = {
    incrementClicksCallCount: 0,
    async create(record) {
      return record;
    },
    async findBySlug() {
      return null;
    },
    async exists() {
      return false;
    },
    async incrementClicks() {
      store.incrementClicksCallCount += 1;
      return null;
    },
    async remove() {
      return false;
    },
  };
  return store;
}

let server;
let baseUrl;
let store;

before(async () => {
  store = makeSpyStore();
  const app = createApp({ store });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /favicon.ico는 slug 형식 밖이므로 store 조회 없이 즉시 404를 반환한다', async () => {
  const res = await fetch(`${baseUrl}/favicon.ico`, { redirect: 'manual' });
  assert.equal(res.status, 404);
  assert.equal(store.incrementClicksCallCount, 0);
});

test('GET /ab (4자 미만)은 slug 형식 밖이므로 store 조회 없이 즉시 404를 반환한다', async () => {
  const res = await fetch(`${baseUrl}/ab`, { redirect: 'manual' });
  assert.equal(res.status, 404);
  assert.equal(store.incrementClicksCallCount, 0);
});

test('GET /:slug는 형식(4~32자 영숫자·하이픈)에 맞는 경로면 store 조회를 거쳐 404를 반환한다', async () => {
  const res = await fetch(`${baseUrl}/valid-format-slug`, { redirect: 'manual' });
  assert.equal(res.status, 404);
  assert.equal(store.incrementClicksCallCount, 1);
});

test('router.get(\'/:slug\', ...) catch-all은 links.js 내 다른 모든 router.* 등록보다 뒤에 위치해야 한다', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/routes/links.js'),
    'utf8'
  );
  const registrations = [...source.matchAll(/router\.(get|post|put|delete|patch)\(/g)];
  assert.ok(registrations.length > 1);

  const catchAllIndex = source.indexOf("router.get('/:slug'");
  assert.notEqual(catchAllIndex, -1);

  const lastRegistration = registrations[registrations.length - 1];
  assert.equal(lastRegistration.index, catchAllIndex);
});
