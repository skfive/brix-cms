'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { normalizeLink } = require('../expiry');

function readAll(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function writeAll(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function createFileLinkStore(filePath) {
  return {
    async save(link) {
      const data = readAll(filePath);
      const normalized = normalizeLink(link);
      data[normalized.slug] = normalized;
      writeAll(filePath, data);
      return { ...normalized };
    },

    async get(slug) {
      const data = readAll(filePath);
      return normalizeLink(data[slug] ?? null);
    },

    async delete(slug) {
      const data = readAll(filePath);
      if (!(slug in data)) return false;
      delete data[slug];
      writeAll(filePath, data);
      return true;
    },

    async incrementHits(slug) {
      const data = readAll(filePath);
      const link = data[slug];
      if (!link) return null;
      link.hits = (link.hits || 0) + 1;
      writeAll(filePath, data);
      return normalizeLink(link);
    },
  };
}

module.exports = { createFileLinkStore };
