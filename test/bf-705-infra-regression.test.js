/**
 * BF-705 회귀 가드 — docker compose 기동 + pnpm lockfile 검증
 *
 * 목적:
 *   BF-703 에서 추가된 docker-compose.yml, Dockerfile, pnpm-lock.yaml 이
 *   미래에 silent break 되지 않도록 정량 fact 를 박제한다.
 *
 * 구성:
 *   1. 정적 파일 가드 (항상 실행) — yaml/json 구조 검증
 *   2. 런타임 가드 (BRIX_E2E_SKIP=1 시 skip) — 실제 CLI 실행 검증
 *
 * 실행: node --test test/bf-705-infra-regression.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SKIP_E2E = process.env.BRIX_E2E_SKIP === '1';

// ──────────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────────

/** 파일 읽기 */
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/** 파일 존재 여부 */
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

/** CLI 바이너리 존재 여부 */
function hasBin(bin) {
  const result = spawnSync('which', [bin], { encoding: 'utf-8' });
  return result.status === 0;
}

// ──────────────────────────────────────────────────────────────
// AC2: pnpm lockfile 정합성 — 정적 가드
// ──────────────────────────────────────────────────────────────

describe('AC2 · pnpm lockfile 정합성 — 정적 가드', () => {
  test('pnpm-lock.yaml 파일이 존재한다', () => {
    assert.ok(exists('pnpm-lock.yaml'), 'pnpm-lock.yaml 가 없습니다');
  });

  test('pnpm-lock.yaml lockfileVersion 이 9.0 이다', () => {
    const content = read('pnpm-lock.yaml');
    assert.ok(
      content.includes("lockfileVersion: '9.0'"),
      "lockfileVersion: '9.0' 가 없습니다",
    );
  });

  test('pnpm-lock.yaml 에 importers 섹션이 있다', () => {
    const content = read('pnpm-lock.yaml');
    assert.ok(content.includes('importers:'), 'importers: 섹션이 없습니다');
  });

  test('pnpm-lock.yaml 에 packages 또는 snapshots 섹션이 있다 (의존성 존재 확인)', () => {
    const content = read('pnpm-lock.yaml');
    const hasPackages = content.includes('packages:') || content.includes('snapshots:');
    assert.ok(hasPackages, 'packages/snapshots 섹션이 없습니다 — lockfile 이 비어있을 수 있습니다');
  });

  test('package.json 에 packageManager 필드가 있다', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.ok(
      pkg.packageManager,
      'package.json 에 packageManager 필드가 없습니다',
    );
    assert.match(
      pkg.packageManager,
      /^pnpm@/,
      `packageManager 가 pnpm 이 아닙니다: ${pkg.packageManager}`,
    );
  });

  test('package.json verify 스크립트가 pnpm 명령을 사용한다', () => {
    const pkg = JSON.parse(read('package.json'));
    const verify = pkg.scripts?.verify ?? '';
    assert.ok(
      verify.includes('pnpm'),
      `verify 스크립트가 pnpm 을 사용하지 않습니다: "${verify}"`,
    );
    assert.ok(
      !verify.includes('npm run'),
      `verify 스크립트에 npm run 이 남아있습니다: "${verify}"`,
    );
  });

  test('.npmrc 에 shamefully-hoist=false 가 있다', () => {
    const content = read('.npmrc');
    assert.ok(
      content.includes('shamefully-hoist=false'),
      '.npmrc 에 shamefully-hoist=false 가 없습니다',
    );
  });

  test('package-lock.json 이 제거되었다 (npm 잔재 제거)', () => {
    assert.ok(
      !exists('package-lock.json'),
      'package-lock.json 이 아직 존재합니다 — npm 잔재가 남아 있습니다',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// AC1: docker compose 기동 — 정적 가드 (docker-compose.yml)
// ──────────────────────────────────────────────────────────────

describe('AC1 · docker-compose.yml 구조 가드', () => {
  test('docker-compose.yml 파일이 존재한다', () => {
    assert.ok(exists('docker-compose.yml'), 'docker-compose.yml 가 없습니다');
  });

  test('docker-compose.yml 에 app 서비스가 정의되어 있다', () => {
    const content = read('docker-compose.yml');
    assert.ok(content.includes('  app:'), 'app 서비스가 없습니다');
  });

  test('docker-compose.yml app 서비스가 3000:3000 포트를 노출한다', () => {
    const content = read('docker-compose.yml');
    assert.ok(
      content.includes('"3000:3000"') || content.includes("'3000:3000'") || content.includes('3000:3000'),
      'app 서비스에 3000:3000 포트 매핑이 없습니다',
    );
  });

  test('docker-compose.yml DATABASE_URL 이 SQLite named volume 경로를 가리킨다', () => {
    const content = read('docker-compose.yml');
    assert.ok(
      content.includes('DATABASE_URL'),
      'DATABASE_URL env 가 없습니다',
    );
    assert.ok(
      content.includes('/data/dev.db'),
      'DATABASE_URL 이 /data/dev.db 를 가리키지 않습니다',
    );
  });

  test('docker-compose.yml db-data named volume 이 정의되어 있다', () => {
    const content = read('docker-compose.yml');
    assert.ok(content.includes('db-data:'), 'db-data volume 정의가 없습니다');
    assert.ok(
      content.includes('- db-data:/data'),
      'app 서비스에 db-data:/data 마운트가 없습니다',
    );
  });

  test('docker-compose.yml app 서비스에 restart: unless-stopped 가 있다', () => {
    const content = read('docker-compose.yml');
    assert.ok(
      content.includes('restart: unless-stopped'),
      'restart: unless-stopped 가 없습니다',
    );
  });

  test('docker-compose.yml app 서비스가 env_file: .env 를 참조한다', () => {
    const content = read('docker-compose.yml');
    assert.ok(
      content.includes('- .env'),
      'env_file .env 참조가 없습니다',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// AC1: docker compose 기동 — 정적 가드 (Dockerfile)
// ──────────────────────────────────────────────────────────────

describe('AC1 · Dockerfile 구조 가드', () => {
  test('Dockerfile 이 존재한다', () => {
    assert.ok(exists('Dockerfile'), 'Dockerfile 이 없습니다');
  });

  test('Dockerfile 이 multi-stage 빌드를 사용한다 (builder + production)', () => {
    const content = read('Dockerfile');
    assert.ok(content.includes('AS builder'), 'builder stage 가 없습니다');
    assert.ok(content.includes('AS production'), 'production stage 가 없습니다');
  });

  test('Dockerfile builder 스테이지에서 pnpm install --frozen-lockfile 을 실행한다', () => {
    const content = read('Dockerfile');
    assert.ok(
      content.includes('pnpm install --frozen-lockfile'),
      'builder 스테이지에 pnpm install --frozen-lockfile 이 없습니다',
    );
  });

  test('Dockerfile production 스테이지에서 pnpm install --frozen-lockfile --prod 를 실행한다', () => {
    const content = read('Dockerfile');
    assert.ok(
      content.includes('pnpm install --frozen-lockfile --prod'),
      'production 스테이지에 pnpm install --frozen-lockfile --prod 가 없습니다',
    );
  });

  test('Dockerfile 이 pnpm-lock.yaml 을 COPY 한다 (캐시 레이어 최적화)', () => {
    const content = read('Dockerfile');
    assert.ok(
      content.includes('pnpm-lock.yaml'),
      'Dockerfile 에 pnpm-lock.yaml COPY 가 없습니다',
    );
  });

  test('Dockerfile CMD 가 prisma migrate deploy 를 포함한다', () => {
    const content = read('Dockerfile');
    assert.ok(
      content.includes('prisma migrate deploy'),
      'CMD 에 prisma migrate deploy 가 없습니다',
    );
  });

  test('Dockerfile CMD 가 node dist/main 으로 앱을 기동한다', () => {
    const content = read('Dockerfile');
    assert.ok(
      content.includes('node dist/main'),
      'CMD 에 node dist/main 이 없습니다',
    );
  });

  test('Dockerfile 이 EXPOSE 3000 을 선언한다', () => {
    const content = read('Dockerfile');
    assert.ok(content.includes('EXPOSE 3000'), 'EXPOSE 3000 이 없습니다');
  });

  test('Dockerfile 이 corepack enable 로 pnpm 을 활성화한다', () => {
    const content = read('Dockerfile');
    assert.ok(
      content.includes('corepack enable'),
      'corepack enable 이 없습니다',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// AC1: .dockerignore 가드
// ──────────────────────────────────────────────────────────────

describe('AC1 · .dockerignore 가드 — 민감 파일 제외', () => {
  test('.dockerignore 가 존재한다', () => {
    assert.ok(exists('.dockerignore'), '.dockerignore 가 없습니다');
  });

  test('.dockerignore 가 node_modules 를 제외한다', () => {
    const content = read('.dockerignore');
    assert.ok(content.includes('node_modules'), '.dockerignore 에 node_modules 가 없습니다');
  });

  test('.dockerignore 가 .env 를 제외한다 (시크릿 보호)', () => {
    const content = read('.dockerignore');
    assert.ok(content.includes('.env'), '.dockerignore 에 .env 가 없습니다');
  });

  test('.dockerignore 가 *.db 를 제외한다 (SQLite 파일 보호)', () => {
    const content = read('.dockerignore');
    assert.ok(content.includes('*.db'), '.dockerignore 에 *.db 가 없습니다');
  });

  test('.dockerignore 가 dist 를 제외한다', () => {
    const content = read('.dockerignore');
    assert.ok(content.includes('dist'), '.dockerignore 에 dist 가 없습니다');
  });
});

// ──────────────────────────────────────────────────────────────
// AC2: 런타임 가드 — pnpm install --frozen-lockfile
// ──────────────────────────────────────────────────────────────

describe('AC2 · 런타임 가드 — pnpm install --frozen-lockfile', () => {
  test('pnpm install --frozen-lockfile 이 exit 0 으로 완료된다', { skip: SKIP_E2E || !hasBin('pnpm') ? 'pnpm 미설치 또는 BRIX_E2E_SKIP=1' : false }, () => {
    const result = spawnSync(
      'pnpm',
      ['install', '--frozen-lockfile'],
      {
        cwd: ROOT,
        encoding: 'utf-8',
        timeout: 120_000,
      },
    );
    assert.equal(
      result.status,
      0,
      `pnpm install --frozen-lockfile 실패 (exit ${result.status})\nstderr: ${result.stderr}`,
    );
  });
});

// ──────────────────────────────────────────────────────────────
// AC1: 런타임 가드 — docker compose build smoke test
// ──────────────────────────────────────────────────────────────

describe('AC1 · 런타임 가드 — docker compose smoke test', () => {
  const skipReason = SKIP_E2E
    ? 'BRIX_E2E_SKIP=1'
    : !hasBin('docker')
      ? 'docker 미설치'
      : false;

  test('docker compose config 가 유효하다 (--quiet-pull)', { skip: skipReason }, () => {
    // docker compose config 로 yaml 파싱 검증 (빌드 없이 빠르게)
    const result = spawnSync(
      'docker',
      ['compose', 'config'],
      {
        cwd: ROOT,
        encoding: 'utf-8',
        timeout: 30_000,
        env: { ...process.env, DATABASE_URL: 'file:/data/dev.db' },
      },
    );
    assert.equal(
      result.status,
      0,
      `docker compose config 실패\nstderr: ${result.stderr}`,
    );
    const output = result.stdout;
    assert.ok(output.includes('app'), 'compose 설정에 app 서비스가 없습니다');
    assert.ok(output.includes('3000'), 'compose 설정에 3000 포트가 없습니다');
  });

  test('docker compose build 가 exit 0 으로 완료된다', { skip: skipReason }, () => {
    // .env.example 기반 임시 .env 생성 (없으면 빈 파일)
    const envExample = exists('.env.example') ? read('.env.example') : '';
    const envPath = path.join(ROOT, '.env');
    const envExisted = exists('.env');
    if (!envExisted) {
      fs.writeFileSync(envPath, envExample, 'utf-8');
    }

    try {
      const result = spawnSync(
        'docker',
        ['compose', 'build', '--no-cache'],
        {
          cwd: ROOT,
          encoding: 'utf-8',
          timeout: 300_000, // 빌드는 최대 5분
        },
      );
      assert.equal(
        result.status,
        0,
        `docker compose build 실패 (exit ${result.status})\nstderr: ${result.stderr}`,
      );
    } finally {
      if (!envExisted && exists('.env')) {
        fs.unlinkSync(envPath);
      }
    }
  });
});
