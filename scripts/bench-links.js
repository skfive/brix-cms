#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createFileLinkStore } = require('../src/links/stores/fileLinkStore');
const { createLinkCache } = require('../src/links/cache/linkCache');
const { createLink, resolveLink } = require('../src/links/routes');

const SLUG_COUNT = 50;
const ITERATIONS = Number(process.env.BENCH_ITERATIONS) || 2000;
const WARMUP_ITERATIONS = Math.min(200, ITERATIONS);

const tempDirs = [];

function fixedClock() {
  const now = new Date();
  return { now: () => now };
}

function percentile(sortedSamples, p) {
  if (sortedSamples.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedSamples.length) - 1;
  const index = Math.min(Math.max(rank, 0), sortedSamples.length - 1);
  return sortedSamples[index];
}

function tempFilePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'links-bench-'));
  tempDirs.push(dir);
  return path.join(dir, 'links.json');
}

function cleanupTempDirs() {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function seedLinks(store, clock) {
  for (let i = 0; i < SLUG_COUNT; i += 1) {
    await createLink(store, { targetUrl: `https://example.com/${i}`, slug: `bench-${i}` }, clock);
  }
}

async function resolveLoop(store, clock, iterations) {
  const durationsMs = [];
  for (let i = 0; i < iterations; i += 1) {
    const slug = `bench-${i % SLUG_COUNT}`;
    const start = process.hrtime.bigint();
    // eslint-disable-next-line no-await-in-loop
    await resolveLink(store, slug, clock);
    const end = process.hrtime.bigint();
    durationsMs.push(Number(end - start) / 1e6);
  }
  return durationsMs;
}

async function runBench(store, clock, onAfterWarmup) {
  // 워밍업(측정 제외)으로 두 조건 모두 동일하게 JIT 최적화가 적용된 뒤 측정해,
  // raw 를 먼저 실행하는 순서 자체가 만드는 편향을 없앤다.
  await resolveLoop(store, clock, WARMUP_ITERATIONS);
  onAfterWarmup?.();
  const durationsMs = (await resolveLoop(store, clock, ITERATIONS)).sort((a, b) => a - b);
  return { p50: percentile(durationsMs, 50), p95: percentile(durationsMs, 95) };
}

async function main() {
  const clock = fixedClock();

  const rawStore = createFileLinkStore(tempFilePath());
  await seedLinks(rawStore, clock);
  const rawResult = await runBench(rawStore, clock);

  const backingStore = createFileLinkStore(tempFilePath());
  await seedLinks(backingStore, clock);
  let cacheHits = 0;
  let cacheMisses = 0;
  const cachedStore = createLinkCache(backingStore, {
    onHit: () => {
      cacheHits += 1;
    },
    onMiss: () => {
      cacheMisses += 1;
    },
  });
  const cachedResult = await runBench(cachedStore, clock, () => {
    // 워밍업 동안의 hit/miss는 리포트 대상이 아니므로 측정 구간 시작 전에 리셋한다.
    cacheHits = 0;
    cacheMisses = 0;
  });

  const hitRate = ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1);

  console.log(`bench-links: slug ${SLUG_COUNT}개 x resolveLink ${ITERATIONS}회 (워밍업 ${WARMUP_ITERATIONS}회 별도)\n`);
  console.log(`raw (no cache)     p50=${rawResult.p50.toFixed(3)}ms p95=${rawResult.p95.toFixed(3)}ms`);
  console.log(`cached (linkCache) p50=${cachedResult.p50.toFixed(3)}ms p95=${cachedResult.p95.toFixed(3)}ms`);
  console.log(`\ncache hits=${cacheHits} misses=${cacheMisses} (hit rate=${hitRate}%)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(cleanupTempDirs);
