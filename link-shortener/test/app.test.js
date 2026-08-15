'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/app');
const { FileLinkStore } = require('../src/store/FileLinkStore');

let server;
let baseUrl;

before(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'link-app-'));
  const store = new FileLinkStore(path.join(dir, 'links.json'));
  const app = createApp({ store });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function postLink(body) {
  return fetch(`${baseUrl}/api/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('POST /api/links는 유효한 URL로 201과 링크 정보를 반환한다', async () => {
  const res = await postLink({ url: 'https://example.com' });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(typeof body.slug, 'string');
  assert.equal(body.url, 'https://example.com');
  assert.equal(body.shortUrl, `${baseUrl}/${body.slug}`);
  assert.equal(typeof body.createdAt, 'string');
});

test('POST /api/links는 customSlug 지정 시 해당 slug를 사용한다', async () => {
  const res = await postLink({
    url: 'https://example.com/custom',
    customSlug: 'my-custom-1',
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.slug, 'my-custom-1');
});

test('POST /api/links는 http/https가 아닌 URL에 400을 반환한다', async () => {
  const res = await postLink({ url: 'ftp://example.com' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'BAD_REQUEST');
});

test('POST /api/links는 형식 위반 customSlug에 400을 반환한다', async () => {
  const res = await postLink({ url: 'https://example.com', customSlug: 'a b!' });
  assert.equal(res.status, 400);
});

test('POST /api/links는 이미 사용 중인 customSlug에 409를 반환한다', async () => {
  await postLink({ url: 'https://example.com', customSlug: 'dup-slug-1' });
  const res = await postLink({
    url: 'https://example.com/other',
    customSlug: 'dup-slug-1',
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, 'SLUG_CONFLICT');
});

test('GET /:slug는 302로 원본 URL로 리다이렉트하고 hits를 증가시킨다', async () => {
  const createRes = await postLink({
    url: 'https://example.com/redirect-target',
    customSlug: 'redir-test1',
  });
  const { slug } = await createRes.json();

  const res = await fetch(`${baseUrl}/${slug}`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://example.com/redirect-target');

  const statsRes = await fetch(`${baseUrl}/api/links/${slug}/stats`);
  const stats = await statsRes.json();
  assert.equal(stats.hits, 1);
});

test('GET /:slug는 없는 slug에 404 JSON을 반환한다', async () => {
  const res = await fetch(`${baseUrl}/not-a-real-slug`, { redirect: 'manual' });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.ok(body.error);
});

test('GET /api/links/:slug/stats는 slug/url/hits/createdAt을 반환한다', async () => {
  const createRes = await postLink({
    url: 'https://example.com/stats-target',
    customSlug: 'stats-test1',
  });
  const created = await createRes.json();

  const res = await fetch(`${baseUrl}/api/links/${created.slug}/stats`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.slug, created.slug);
  assert.equal(body.url, 'https://example.com/stats-target');
  assert.equal(body.hits, 0);
  assert.equal(body.createdAt, created.createdAt);
});

test('GET /api/links/:slug/stats는 없는 slug에 404를 반환한다', async () => {
  const res = await fetch(`${baseUrl}/api/links/missing-slug-xyz/stats`);
  assert.equal(res.status, 404);
});

test('DELETE /api/links/:slug는 204를 반환하고 이후 조회는 404다', async () => {
  const createRes = await postLink({
    url: 'https://example.com/delete-target',
    customSlug: 'del-test01',
  });
  const created = await createRes.json();

  const delRes = await fetch(`${baseUrl}/api/links/${created.slug}`, {
    method: 'DELETE',
  });
  assert.equal(delRes.status, 204);

  const statsRes = await fetch(`${baseUrl}/api/links/${created.slug}/stats`);
  assert.equal(statsRes.status, 404);
});

test('DELETE /api/links/:slug는 없는 slug에 404를 반환한다', async () => {
  const res = await fetch(`${baseUrl}/api/links/missing-del-xyz`, {
    method: 'DELETE',
  });
  assert.equal(res.status, 404);
});

test('잘못된 JSON 본문은 500이 아닌 400을 반환한다', async () => {
  const res = await fetch(`${baseUrl}/api/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid-json',
  });
  assert.equal(res.status, 400);
});
