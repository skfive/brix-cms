'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { SCHEMA_VERSION, isV2, normalizeToV2 } = require('../src/storage/schemaV2');

const NOW = '2026-08-16T00:00:00.000Z';

test('normalizeToV2 — v1 레코드에 schemaVersion/createdAt/tags를 채운다', () => {
  const v1 = { slug: 'abc', hits: 3, expiresAt: null };

  const result = normalizeToV2(v1, NOW);

  assert.equal(result.schemaVersion, SCHEMA_VERSION);
  assert.equal(result.createdAt, NOW);
  assert.deepEqual(result.tags, []);
});

test('normalizeToV2 — 기존 v1 필드는 값 그대로 보존한다 (파괴적 변경 금지)', () => {
  const v1 = {
    slug: 'xyz',
    hits: 10,
    expiresAt: '2026-01-01T00:00:00.000Z',
    url: 'https://example.com',
  };

  const result = normalizeToV2(v1, NOW);

  assert.equal(result.slug, 'xyz');
  assert.equal(result.hits, 10);
  assert.equal(result.expiresAt, '2026-01-01T00:00:00.000Z');
  assert.equal(result.url, 'https://example.com');
});

test('normalizeToV2 — 이미 v2인 레코드는 값 변경 없이 그대로 반환한다 (idempotent)', () => {
  const v2 = {
    slug: 'already-v2',
    hits: 1,
    expiresAt: null,
    schemaVersion: 2,
    createdAt: '2020-01-01T00:00:00.000Z',
    tags: ['foo'],
  };

  const result = normalizeToV2(v2, NOW);

  assert.deepEqual(result, v2);
  assert.notEqual(result.createdAt, NOW);
});

test('normalizeToV2 — 입력 객체를 변경(mutate)하지 않는다', () => {
  const v1 = { slug: 'immutable-check', hits: 0 };
  const before = JSON.stringify(v1);

  normalizeToV2(v1, NOW);

  assert.equal(JSON.stringify(v1), before);
});

test('normalizeToV2 — null/undefined 입력은 그대로 반환한다', () => {
  assert.equal(normalizeToV2(null, NOW), null);
  assert.equal(normalizeToV2(undefined, NOW), undefined);
});

test('normalizeToV2 — 객체가 아닌 손상된 레코드는 예외를 던진다', () => {
  assert.throws(() => normalizeToV2('broken', NOW), TypeError);
  assert.throws(() => normalizeToV2(['broken'], NOW), TypeError);
});

test('isV2 — schemaVersion 필드 존재 여부로 v1/v2를 판별한다', () => {
  assert.equal(isV2({ slug: 'a' }), false);
  assert.equal(isV2({ slug: 'a', schemaVersion: 2 }), true);
});
