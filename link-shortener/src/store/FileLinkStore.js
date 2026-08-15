'use strict';

const fs = require('fs/promises');
const path = require('path');
const { LinkStore } = require('./LinkStore');

class FileLinkStore extends LinkStore {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.writeQueue = Promise.resolve();
    this.cache = null;
    this.loadPromise = null;
  }

  async _ensureLoaded() {
    if (this.cache) return this.cache;
    if (!this.loadPromise) {
      this.loadPromise = this._loadFromDisk();
    }
    this.cache = await this.loadPromise;
    return this.cache;
  }

  async _loadFromDisk() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const records = JSON.parse(raw);
      return new Map(records.map((record) => [record.slug, record]));
    } catch (err) {
      if (err.code === 'ENOENT') {
        return new Map();
      }
      throw err;
    }
  }

  async _persist(map) {
    const records = Array.from(map.values());
    const dir = path.dirname(this.filePath);
    const tmpPath = `${this.filePath}.tmp`;
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(tmpPath, JSON.stringify(records, null, 2), 'utf8');
    await fs.rename(tmpPath, this.filePath);
  }

  _enqueue(task) {
    const run = this.writeQueue.then(task);
    this.writeQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async create(record) {
    return this._enqueue(async () => {
      const map = await this._ensureLoaded();
      if (map.has(record.slug)) {
        throw new Error(`slug 이미 존재: ${record.slug}`);
      }
      map.set(record.slug, record);
      await this._persist(map);
      return record;
    });
  }

  async findBySlug(slug) {
    const map = await this._ensureLoaded();
    return map.get(slug) || null;
  }

  async exists(slug) {
    const map = await this._ensureLoaded();
    return map.has(slug);
  }

  async incrementClicks(slug) {
    return this._enqueue(async () => {
      const map = await this._ensureLoaded();
      const record = map.get(slug);
      if (!record) return null;
      const updated = { ...record, clicks: record.clicks + 1 };
      map.set(slug, updated);
      await this._persist(map);
      return updated;
    });
  }

  async remove(slug) {
    return this._enqueue(async () => {
      const map = await this._ensureLoaded();
      if (!map.has(slug)) return false;
      map.delete(slug);
      await this._persist(map);
      return true;
    });
  }
}

module.exports = { FileLinkStore };
