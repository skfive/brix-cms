'use strict';

const BASE62_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const SLUG_LENGTH = 7;
const CUSTOM_SLUG_PATTERN = /^[A-Za-z0-9-]{4,32}$/;
const MAX_GENERATE_RETRIES = 5;

function generateSlug() {
  let slug = '';
  for (let i = 0; i < SLUG_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * BASE62_ALPHABET.length);
    slug += BASE62_ALPHABET[index];
  }
  return slug;
}

function isValidCustomSlug(value) {
  return typeof value === 'string' && CUSTOM_SLUG_PATTERN.test(value);
}

async function generateUniqueSlug(exists) {
  for (let attempt = 0; attempt < MAX_GENERATE_RETRIES; attempt += 1) {
    const candidate = generateSlug();
    // eslint-disable-next-line no-await-in-loop
    if (!(await exists(candidate))) {
      return candidate;
    }
  }
  throw new Error('slug 생성 실패 — 재시도 초과');
}

module.exports = {
  SLUG_LENGTH,
  CUSTOM_SLUG_PATTERN,
  generateSlug,
  isValidCustomSlug,
  generateUniqueSlug,
};
