'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeExpiresAt, isExpired } = require('../../src/links/expiry');

test('computeExpiresAt adds ttlSeconds to now and returns an ISO string', () => {
  const now = new Date('2026-08-15T10:00:00.000Z');
  assert.equal(computeExpiresAt(now, 60), '2026-08-15T10:01:00.000Z');
});

test('isExpired returns false when expiresAt is null (무기한 링크)', () => {
  const link = { expiresAt: null };
  const now = new Date('2026-08-15T10:00:00.000Z');
  assert.equal(isExpired(link, now), false);
});

test('isExpired returns false when expiresAt is undefined (레거시 레코드, 정규화 전)', () => {
  const link = {};
  const now = new Date('2026-08-15T10:00:00.000Z');
  assert.equal(isExpired(link, now), false);
});

test('isExpired returns false 1ms before expiresAt', () => {
  const link = { expiresAt: '2026-08-15T10:00:00.000Z' };
  const now = new Date('2026-08-15T09:59:59.999Z');
  assert.equal(isExpired(link, now), false);
});

test('isExpired returns true exactly at expiresAt (경계값: now >= expiresAt)', () => {
  const link = { expiresAt: '2026-08-15T10:00:00.000Z' };
  const now = new Date('2026-08-15T10:00:00.000Z');
  assert.equal(isExpired(link, now), true);
});

test('isExpired returns true 1ms after expiresAt', () => {
  const link = { expiresAt: '2026-08-15T10:00:00.000Z' };
  const now = new Date('2026-08-15T10:00:00.001Z');
  assert.equal(isExpired(link, now), true);
});
