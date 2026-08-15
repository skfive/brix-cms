'use strict';

const path = require('path');
const { createApp } = require('./app');
const { FileLinkStore } = require('./store/FileLinkStore');

const PORT = process.env.PORT || 3000;
const DATA_FILE =
  process.env.LINKS_DATA_FILE || path.join(__dirname, '..', 'data', 'links.json');

const store = new FileLinkStore(DATA_FILE);
const app = createApp({ store });

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`link-shortener listening on port ${PORT}`);
});
