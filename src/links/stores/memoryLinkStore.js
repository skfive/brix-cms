'use strict';

const { normalizeLink } = require('../expiry');

function createMemoryLinkStore() {
  const links = new Map();

  return {
    async save(link) {
      const normalized = normalizeLink(link);
      links.set(normalized.slug, normalized);
      return { ...normalized };
    },

    async get(slug) {
      return normalizeLink(links.get(slug) ?? null);
    },

    async delete(slug) {
      return links.delete(slug);
    },

    async incrementHits(slug) {
      const link = links.get(slug);
      if (!link) return null;
      link.hits = (link.hits || 0) + 1;
      return { ...link };
    },
  };
}

module.exports = { createMemoryLinkStore };
