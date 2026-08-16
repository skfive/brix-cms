'use strict';

const DEFAULT_MAX_SAMPLES = 1000;
const TRACKED_STATUS_CODES = ['302', '404', '410'];

function defaultClock() {
  return { now: () => new Date() };
}

function percentile(sortedSamples, p) {
  if (sortedSamples.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedSamples.length) - 1;
  const index = Math.min(Math.max(rank, 0), sortedSamples.length - 1);
  return sortedSamples[index];
}

function createLinkMetrics(options = {}) {
  const clock = options.clock ?? defaultClock();
  const maxSamples = options.maxSamples ?? DEFAULT_MAX_SAMPLES;
  const recorder = options.recorder ?? null;

  let requestsTotal = 0;
  const statusCounts = { '302': 0, '404': 0, '410': 0 };
  let resolveLatencySamples = [];
  let cacheHits = 0;
  let cacheMisses = 0;

  function recordRequest(status) {
    requestsTotal += 1;
    const key = String(status);
    if (TRACKED_STATUS_CODES.includes(key)) {
      statusCounts[key] += 1;
    }
    recorder?.onRequest?.(status, clock.now());
  }

  function recordResolveLatency(ms) {
    resolveLatencySamples.push(ms);
    if (resolveLatencySamples.length > maxSamples) {
      // slice(-0) === slice(0) in JS, so maxSamples<=0 needs an explicit start index.
      resolveLatencySamples = resolveLatencySamples.slice(
        Math.max(0, resolveLatencySamples.length - maxSamples),
      );
    }
    recorder?.onResolveLatency?.(ms, clock.now());
  }

  function recordCacheHit() {
    cacheHits += 1;
    recorder?.onCacheHit?.(clock.now());
  }

  function recordCacheMiss() {
    cacheMisses += 1;
    recorder?.onCacheMiss?.(clock.now());
  }

  function getMetrics() {
    const sorted = [...resolveLatencySamples].sort((a, b) => a - b);
    return {
      requestsTotal,
      statusCounts: { ...statusCounts },
      resolveLatencyMs: {
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
      },
      cache: { hits: cacheHits, misses: cacheMisses },
    };
  }

  function handleMetricsRequest() {
    return { status: 200, body: getMetrics() };
  }

  return {
    recordRequest,
    recordResolveLatency,
    recordCacheHit,
    recordCacheMiss,
    getMetrics,
    handleMetricsRequest,
  };
}

module.exports = { createLinkMetrics };
