'use strict';

const { Router } = require('express');
const { isValidCustomSlug, generateUniqueSlug } = require('../slug');

function isValidUrl(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  let parsed;
  try {
    parsed = new URL(value);
  } catch (err) {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

function badRequest(res, message) {
  res.status(400).json({ error: { code: 'BAD_REQUEST', message } });
}

function notFound(res, message) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message } });
}

function internalError(res, message) {
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message } });
}

function toShortUrl(req, slug) {
  return `${req.protocol}://${req.get('host')}/${slug}`;
}

function toLinkResponse(req, record) {
  return {
    slug: record.slug,
    shortUrl: toShortUrl(req, record.slug),
    url: record.originalUrl,
    createdAt: record.createdAt,
  };
}

function toStatsResponse(record) {
  return {
    slug: record.slug,
    url: record.originalUrl,
    hits: record.clicks,
    createdAt: record.createdAt,
  };
}

function createLinksRouter(store) {
  const router = Router();

  router.post('/api/links', async (req, res) => {
    const { url, customSlug } = req.body || {};

    if (!isValidUrl(url)) {
      badRequest(res, 'url은 http/https로 시작하는 유효한 URL이어야 합니다.');
      return;
    }

    if (customSlug !== undefined && !isValidCustomSlug(customSlug)) {
      badRequest(res, 'customSlug는 4~32자의 영숫자와 하이픈만 허용합니다.');
      return;
    }

    try {
      let slug;
      if (customSlug !== undefined) {
        if (await store.exists(customSlug)) {
          res.status(409).json({
            error: {
              code: 'SLUG_CONFLICT',
              message: `이미 사용 중인 slug: ${customSlug}`,
            },
          });
          return;
        }
        slug = customSlug;
      } else {
        slug = await generateUniqueSlug((candidate) => store.exists(candidate));
      }

      const record = await store.create({
        slug,
        originalUrl: url,
        createdAt: new Date().toISOString(),
        clicks: 0,
      });

      res.status(201).json(toLinkResponse(req, record));
    } catch (err) {
      console.error(err);
      internalError(res, '단축 링크 생성 중 오류가 발생했습니다.');
    }
  });

  router.get('/api/links/:slug/stats', async (req, res) => {
    try {
      const record = await store.findBySlug(req.params.slug);
      if (!record) {
        notFound(res, `slug를 찾을 수 없습니다: ${req.params.slug}`);
        return;
      }
      res.status(200).json(toStatsResponse(record));
    } catch (err) {
      console.error(err);
      internalError(res, '통계 조회 중 오류가 발생했습니다.');
    }
  });

  router.delete('/api/links/:slug', async (req, res) => {
    try {
      const removed = await store.remove(req.params.slug);
      if (!removed) {
        notFound(res, `slug를 찾을 수 없습니다: ${req.params.slug}`);
        return;
      }
      res.status(204).end();
    } catch (err) {
      console.error(err);
      internalError(res, '삭제 중 오류가 발생했습니다.');
    }
  });

  // 이 라우트는 catch-all(단일 세그먼트) 이므로 라우터 안에서 반드시 마지막에 위치해야 한다.
  // 이후에 새 GET 라우트를 추가할 경우 이 라우트보다 먼저 등록해야 도달 가능하다.
  router.get('/:slug', async (req, res) => {
    if (!isValidCustomSlug(req.params.slug)) {
      notFound(res, `slug를 찾을 수 없습니다: ${req.params.slug}`);
      return;
    }

    try {
      const record = await store.incrementClicks(req.params.slug);
      if (!record) {
        notFound(res, `slug를 찾을 수 없습니다: ${req.params.slug}`);
        return;
      }
      res.redirect(302, record.originalUrl);
    } catch (err) {
      console.error(err);
      internalError(res, '리다이렉트 중 오류가 발생했습니다.');
    }
  });

  return router;
}

module.exports = { createLinksRouter, isValidUrl };
