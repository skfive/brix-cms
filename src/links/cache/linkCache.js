'use strict';

const DEFAULT_TTL_MS = 30000;

function noop() {}

function createLinkCache(store, options = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const onHit = options.onHit ?? noop;
  const onMiss = options.onMiss ?? noop;

  const entries = new Map();

  function populate(slug, value) {
    entries.set(slug, { value, expiresAt: Date.now() + ttlMs });
  }

  function readFresh(slug) {
    const entry = entries.get(slug);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      entries.delete(slug);
      return undefined;
    }
    return entry.value;
  }

  return {
    async save(link) {
      const saved = await store.save(link);
      populate(saved.slug, saved);
      return saved;
    },

    async get(slug) {
      const cached = readFresh(slug);
      if (cached !== undefined) {
        onHit(slug);
        return cached;
      }

      onMiss(slug);
      const value = await store.get(slug);
      if (value !== null) {
        populate(slug, value);
      }
      return value;
    },

    async delete(slug) {
      const deleted = await store.delete(slug);
      if (deleted) {
        entries.delete(slug);
      }
      return deleted;
    },

    async incrementHits(slug) {
      const updated = await store.incrementHits(slug);
      if (updated !== null) {
        populate(slug, updated);
      }
      return updated;
    },
  };
}

module.exports = { createLinkCache };
