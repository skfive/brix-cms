'use strict';

const { LinkStore } = require('./LinkStore');

class MemoryLinkStore extends LinkStore {
  constructor() {
    super();
    this.records = new Map();
  }

  async create(record) {
    if (this.records.has(record.slug)) {
      throw new Error(`slug 이미 존재: ${record.slug}`);
    }
    this.records.set(record.slug, record);
    return record;
  }

  async findBySlug(slug) {
    return this.records.get(slug) || null;
  }

  async exists(slug) {
    return this.records.has(slug);
  }

  async incrementClicks(slug) {
    const record = this.records.get(slug);
    if (!record) return null;
    const updated = { ...record, clicks: record.clicks + 1 };
    this.records.set(slug, updated);
    return updated;
  }

  async remove(slug) {
    if (!this.records.has(slug)) return false;
    this.records.delete(slug);
    return true;
  }
}

module.exports = { MemoryLinkStore };
