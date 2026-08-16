'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createLinkMetrics } = require('../../src/links/metrics/linkMetrics');

test('초기 상태는 모든 카운트가 0이고 §3 스키마 형태를 갖는다', () => {
  const metrics = createLinkMetrics();
  assert.deepEqual(metrics.getMetrics(), {
    requestsTotal: 0,
    statusCounts: { '302': 0, '404': 0, '410': 0 },
    resolveLatencyMs: { p50: 0, p95: 0 },
    cache: { hits: 0, misses: 0 },
  });
});

test('recordRequest 는 requestsTotal 을 모든 상태코드에 대해 누적한다', () => {
  const metrics = createLinkMetrics();
  metrics.recordRequest(201);
  metrics.recordRequest(302);
  metrics.recordRequest(404);
  metrics.recordRequest(400);

  assert.equal(metrics.getMetrics().requestsTotal, 4);
});

test('statusCounts 는 302/404/410 만 세부 집계하고 그 외(201/204/400)는 제외한다', () => {
  const metrics = createLinkMetrics();
  metrics.recordRequest(201);
  metrics.recordRequest(204);
  metrics.recordRequest(400);
  metrics.recordRequest(302);
  metrics.recordRequest(302);
  metrics.recordRequest(404);
  metrics.recordRequest(410);

  const { statusCounts, requestsTotal } = metrics.getMetrics();
  assert.deepEqual(statusCounts, { '302': 2, '404': 1, '410': 1 });
  assert.equal(requestsTotal, 7);
});

test('recordCacheHit / recordCacheMiss 는 cache.hits / cache.misses 를 각각 누적한다', () => {
  const metrics = createLinkMetrics();
  metrics.recordCacheHit();
  metrics.recordCacheHit();
  metrics.recordCacheMiss();

  assert.deepEqual(metrics.getMetrics().cache, { hits: 2, misses: 1 });
});

test('resolveLatencyMs 는 최근 표본의 정렬 기반 p50/p95 를 반환한다 (1~10ms 균등 표본)', () => {
  const metrics = createLinkMetrics();
  for (let ms = 1; ms <= 10; ms += 1) {
    metrics.recordResolveLatency(ms);
  }

  const { resolveLatencyMs } = metrics.getMetrics();
  assert.equal(resolveLatencyMs.p50, 5);
  assert.equal(resolveLatencyMs.p95, 10);
});

test('resolveLatencyMs 는 입력 순서와 무관하게 정렬 후 백분위수를 계산한다', () => {
  const metrics = createLinkMetrics();
  [40, 10, 30, 20].forEach((ms) => metrics.recordResolveLatency(ms));

  const { resolveLatencyMs } = metrics.getMetrics();
  assert.equal(resolveLatencyMs.p50, 20);
  assert.equal(resolveLatencyMs.p95, 40);
});

test('maxSamples 를 초과하는 표본은 오래된 것부터 버려지는 슬라이딩 윈도우다', () => {
  const metrics = createLinkMetrics({ maxSamples: 3 });
  [100, 200, 300].forEach((ms) => metrics.recordResolveLatency(ms));
  metrics.recordResolveLatency(1);

  const { resolveLatencyMs } = metrics.getMetrics();
  assert.equal(resolveLatencyMs.p50, 200);
  assert.equal(resolveLatencyMs.p95, 300);
});

test('maxSamples 가 0이면 표본을 전혀 보관하지 않는다 (slice(-0) 함정 회귀)', () => {
  const metrics = createLinkMetrics({ maxSamples: 0 });
  metrics.recordResolveLatency(10);
  metrics.recordResolveLatency(20);

  const { resolveLatencyMs } = metrics.getMetrics();
  assert.equal(resolveLatencyMs.p50, 0);
  assert.equal(resolveLatencyMs.p95, 0);
});

test('injectable clock: options.clock 이 주입되면 내부 recorder 훅에 clock.now() 값이 전달된다', () => {
  const fixedNow = new Date('2026-08-15T00:00:00.000Z');
  const observed = [];
  const metrics = createLinkMetrics({
    clock: { now: () => fixedNow },
    recorder: {
      onRequest: (status, at) => observed.push(['request', status, at]),
      onCacheHit: (at) => observed.push(['hit', at]),
    },
  });

  metrics.recordRequest(302);
  metrics.recordCacheHit();

  assert.deepEqual(observed, [
    ['request', 302, fixedNow],
    ['hit', fixedNow],
  ]);
});

test('handleMetricsRequest 는 기존 route 함수와 동일한 {status, body} 컨벤션으로 200과 getMetrics() 를 반환한다', () => {
  const metrics = createLinkMetrics();
  metrics.recordRequest(302);
  metrics.recordCacheHit();
  metrics.recordResolveLatency(5);

  const res = metrics.handleMetricsRequest();
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, metrics.getMetrics());
});
