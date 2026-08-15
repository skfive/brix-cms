'use strict';

class LinkStore {
  async create(_record) {
    throw new Error('LinkStore.create() not implemented');
  }

  async findBySlug(_slug) {
    throw new Error('LinkStore.findBySlug() not implemented');
  }

  async exists(_slug) {
    throw new Error('LinkStore.exists() not implemented');
  }

  async incrementClicks(_slug) {
    throw new Error('LinkStore.incrementClicks() not implemented');
  }

  async remove(_slug) {
    throw new Error('LinkStore.remove() not implemented');
  }
}

module.exports = { LinkStore };
