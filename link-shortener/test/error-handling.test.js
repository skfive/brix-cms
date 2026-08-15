'use strict';

const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

function makeThrowingStore() {
  return {
    async create() {
      throw new Error('store create 실패');
    },
    async findBySlug() {
      throw new Error('store findBySlug 실패');
    },
    async exists() {
      return false;
    },
    async incrementClicks() {
      throw new Error('store incrementClicks 실패');
    },
    async remove() {
      throw new Error('store remove 실패');
    },
  };
}

let server;
let baseUrl;
let consoleErrorCalls;
let originalConsoleError;

before(async () => {
  const store = makeThrowingStore();
  const app = createApp({ store });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  consoleErrorCalls = [];
  originalConsoleError = console.error;
  console.error = (...args) => {
    consoleErrorCalls.push(args);
  };
});

afterEach(() => {
  console.error = originalConsoleError;
});

test('POST /api/links는 store 오류 시 500과 함께 서버측에 에러를 로깅하고 응답에는 세부를 노출하지 않는다', async () => {
  const res = await fetch(`${baseUrl}/api/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' }),
  });
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.equal(body.error.message.includes('store create 실패'), false);

  assert.equal(consoleErrorCalls.length, 1);
  const [loggedErr] = consoleErrorCalls[0];
  assert.ok(loggedErr instanceof Error);
  assert.match(loggedErr.stack, /store create 실패/);
});

test('GET /api/links/:slug/stats는 store 오류 시 500과 함께 서버측에 에러를 로깅한다', async () => {
  const res = await fetch(`${baseUrl}/api/links/some-slug/stats`);
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.equal(body.error.message.includes('store findBySlug 실패'), false);

  assert.equal(consoleErrorCalls.length, 1);
  const [loggedErr] = consoleErrorCalls[0];
  assert.ok(loggedErr instanceof Error);
  assert.match(loggedErr.stack, /store findBySlug 실패/);
});

test('DELETE /api/links/:slug는 store 오류 시 500과 함께 서버측에 에러를 로깅한다', async () => {
  const res = await fetch(`${baseUrl}/api/links/some-slug`, { method: 'DELETE' });
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.equal(body.error.message.includes('store remove 실패'), false);

  assert.equal(consoleErrorCalls.length, 1);
  const [loggedErr] = consoleErrorCalls[0];
  assert.ok(loggedErr instanceof Error);
  assert.match(loggedErr.stack, /store remove 실패/);
});

test('GET /:slug는 store 오류 시 500과 함께 서버측에 에러를 로깅한다', async () => {
  const res = await fetch(`${baseUrl}/valid-format-slug`, { redirect: 'manual' });
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.equal(body.error.message.includes('store incrementClicks 실패'), false);

  assert.equal(consoleErrorCalls.length, 1);
  const [loggedErr] = consoleErrorCalls[0];
  assert.ok(loggedErr instanceof Error);
  assert.match(loggedErr.stack, /store incrementClicks 실패/);
});
