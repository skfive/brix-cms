'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  SLUG_LENGTH,
  generateSlug,
  isValidCustomSlug,
  generateUniqueSlug,
} = require('../src/slug');

test('generateSlug는 7자 base62 문자열을 생성한다', () => {
  const slug = generateSlug();
  assert.equal(slug.length, SLUG_LENGTH);
  assert.match(slug, /^[A-Za-z0-9]{7}$/);
});

test('isValidCustomSlug는 4~32자 영숫자·하이픈을 허용한다', () => {
  assert.equal(isValidCustomSlug('abcd'), true);
  assert.equal(isValidCustomSlug('a'.repeat(32)), true);
  assert.equal(isValidCustomSlug('my-link'), true);
});

test('isValidCustomSlug는 길이/문자 위반을 거부한다', () => {
  assert.equal(isValidCustomSlug('abc'), false);
  assert.equal(isValidCustomSlug('a'.repeat(33)), false);
  assert.equal(isValidCustomSlug('bad slug!'), false);
  assert.equal(isValidCustomSlug(undefined), false);
});

test('generateUniqueSlug는 충돌 시 재시도해 사용 가능한 slug를 반환한다', async () => {
  let callCount = 0;
  const exists = async () => {
    callCount += 1;
    return callCount <= 2;
  };
  const slug = await generateUniqueSlug(exists);
  assert.equal(callCount, 3);
  assert.equal(slug.length, SLUG_LENGTH);
});

test('generateUniqueSlug는 5회 모두 충돌하면 예외를 던진다', async () => {
  let callCount = 0;
  const exists = async () => {
    callCount += 1;
    return true;
  };
  await assert.rejects(() => generateUniqueSlug(exists), /재시도 초과/);
  assert.equal(callCount, 5);
});

test('generateSlug는 예측 불가능한 crypto 기반 난수를 사용하고 Math.random을 쓰지 않는다', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/slug.js'), 'utf8');
  assert.equal(/Math\.random/.test(source), false);
  assert.match(source, /require\(['"]crypto['"]\)/);
  assert.match(source, /crypto\.random(Int|Bytes)/);
});
