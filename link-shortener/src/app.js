'use strict';

const path = require('path');
const express = require('express');
const { createLinksRouter } = require('./routes/links');

function createApp({ store }) {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(createLinksRouter(store));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: '요청 본문이 올바른 JSON 형식이 아닙니다.' },
      });
      return;
    }
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: '서버 내부 오류가 발생했습니다.' },
    });
  });

  return app;
}

module.exports = { createApp };
