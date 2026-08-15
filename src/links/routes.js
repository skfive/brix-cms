'use strict';

const { computeExpiresAt, isExpired } = require('./expiry');

function isValidTtlSeconds(ttlSeconds) {
  return Number.isInteger(ttlSeconds) && ttlSeconds > 0;
}

async function createLink(store, { targetUrl, slug, ttlSeconds }, clock) {
  if (ttlSeconds !== undefined && !isValidTtlSeconds(ttlSeconds)) {
    return { status: 400, body: { error: { code: 'INVALID_TTL' } } };
  }

  const now = clock.now();
  const expiresAt = ttlSeconds === undefined ? null : computeExpiresAt(now, ttlSeconds);
  const saved = await store.save({
    slug,
    targetUrl,
    createdAt: now.toISOString(),
    expiresAt,
    hits: 0,
  });

  return { status: 201, body: { ...saved } };
}

async function resolveLink(store, slug, clock) {
  const link = await store.get(slug);
  if (!link) {
    return { status: 404, body: { error: { code: 'NOT_FOUND' } } };
  }

  const now = clock.now();
  if (isExpired(link, now)) {
    return {
      status: 410,
      body: { error: 'LINK_EXPIRED', slug, expiredAt: link.expiresAt },
    };
  }

  await store.incrementHits(slug);
  return { status: 302, body: { targetUrl: link.targetUrl } };
}

async function getStats(store, slug, clock) {
  const link = await store.get(slug);
  if (!link) {
    return { status: 404, body: { error: { code: 'NOT_FOUND' } } };
  }

  const now = clock.now();
  return {
    status: 200,
    body: { ...link, expiresAt: link.expiresAt, isExpired: isExpired(link, now) },
  };
}

async function deleteLink(store, slug) {
  const deleted = await store.delete(slug);
  if (!deleted) {
    return { status: 404, body: { error: { code: 'NOT_FOUND' } } };
  }
  return { status: 204, body: null };
}

module.exports = {
  createLink,
  resolveLink,
  getStats,
  deleteLink,
  isValidTtlSeconds,
};
