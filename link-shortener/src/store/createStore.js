'use strict';

const { FileLinkStore } = require('./FileLinkStore');
const { MemoryLinkStore } = require('./memoryLinkStore');

function createStore({ kind = process.env.LINK_STORE || 'file', ...options } = {}) {
  switch (kind) {
    case 'file':
      return new FileLinkStore(options.filePath);
    case 'memory':
      return new MemoryLinkStore();
    default:
      throw new Error(`Unknown LINK_STORE kind: ${kind}`);
  }
}

module.exports = { createStore };
