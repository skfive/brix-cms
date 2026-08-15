'use strict';

function computeExpiresAt(now, ttlSeconds) {
  return new Date(now.getTime() + ttlSeconds * 1000).toISOString();
}

function isExpired(link, now) {
  const expiresAt = link && link.expiresAt !== undefined ? link.expiresAt : null;
  if (expiresAt === null) {
    return false;
  }
  return now.getTime() >= new Date(expiresAt).getTime();
}

module.exports = { computeExpiresAt, isExpired };
