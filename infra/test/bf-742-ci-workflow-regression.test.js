/**
 * BF-742 회귀 가드 — CI/CD 워크플로 (.github/workflows/ci.yml) 계약
 *
 * 배경 (Epic BF-738 인프라 산출물):
 *   배포 산출물(Dockerfile / docker-compose.yml / .env.example / pnpm-lock.yaml)은
 *   이미 존재하나 이를 PR 마다 자동 검증하는 CI 파이프라인이 없었다.
 *   본 가드는 BF-742 에서 추가한 GitHub Actions CI 워크플로가 미래에
 *   silent break(트리거 제거 / verify 단계 누락 / docker 빌드 잡 삭제)되지 않도록
 *   정량 fact 를 정적으로 박제한다.
 *
 * AC 매핑:
 *   - AC1 (백엔드 산출물이 배포 가능): docker-build 잡이 실제 이미지를 빌드한다
 *   - AC2 (PR 생성 시 CI 검증 통과): pull_request 트리거 + verify 잡(lint/typecheck/build/test)
 *
 * 실행:
 *   node --test infra/test/bf-742-ci-workflow-regression.test.js
 *
 * 의존성 없는 순수 fs 가드 — node_modules 없이 로컬/CI 어디서나 실행된다.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW_REL = '.github/workflows/ci.yml';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

// ──────────────────────────────────────────────────────────────
// 파일 존재 + 트리거 계약
// ──────────────────────────────────────────────────────────────

describe('BF-742 · CI 워크플로 파일 존재 + 트리거 계약', () => {
  test('.github/workflows/ci.yml 이 존재한다', () => {
    assert.ok(exists(WORKFLOW_REL), `${WORKFLOW_REL} 가 없습니다 — CI 파이프라인 누락`);
  });

  test('워크플로가 pull_request 트리거를 가진다 (AC2: PR 생성 시 CI 검증)', () => {
    const wf = read(WORKFLOW_REL);
    assert.match(wf, /pull_request:/, 'pull_request 트리거가 없습니다 — PR 에서 CI 가 돌지 않습니다');
  });

  test('워크플로가 main 브랜치 push 트리거를 가진다', () => {
    const wf = read(WORKFLOW_REL);
    assert.match(wf, /push:/, 'push 트리거가 없습니다');
    assert.match(wf, /branches:\s*\[\s*main\s*\]/, 'main 브랜치 대상 지정이 없습니다');
  });
});

// ──────────────────────────────────────────────────────────────
// verify 잡 — lint / typecheck / build / test 계약 (AC2)
// ──────────────────────────────────────────────────────────────

describe('BF-742 · verify 잡 — 코드 검증 단계 계약 (AC2)', () => {
  const wf = exists(WORKFLOW_REL) ? read(WORKFLOW_REL) : '';

  test('verify 잡이 정의되어 있다', () => {
    assert.match(wf, /^\s{2}verify:/m, 'verify 잡이 없습니다');
  });

  test('Node 20 으로 셋업한다', () => {
    assert.match(wf, /actions\/setup-node@/, 'actions/setup-node 가 없습니다');
    assert.match(wf, /node-version:\s*['"]?20/, 'node-version 20 지정이 없습니다');
  });

  test('corepack 으로 pnpm 을 활성화한다', () => {
    assert.match(wf, /corepack enable/, 'corepack enable 이 없습니다 — pnpm 미활성');
  });

  test('pnpm install --frozen-lockfile 로 lockfile 정합성을 강제한다', () => {
    assert.match(
      wf,
      /pnpm install --frozen-lockfile/,
      'pnpm install --frozen-lockfile 단계가 없습니다 — lockfile drift 미검출',
    );
  });

  test('prisma generate 단계가 typecheck/build 이전에 존재한다 (@prisma/client 생성)', () => {
    assert.match(wf, /prisma generate/, 'prisma generate 단계가 없습니다 — typecheck/build 에서 @prisma/client 미생성으로 실패');
    const genIdx = wf.indexOf('prisma generate');
    const typecheckIdx = wf.indexOf('pnpm typecheck');
    const buildIdx = wf.indexOf('pnpm build');
    assert.ok(genIdx > -1 && typecheckIdx > -1 && genIdx < typecheckIdx, 'prisma generate 가 typecheck 보다 먼저 와야 합니다');
    assert.ok(genIdx < buildIdx, 'prisma generate 가 build 보다 먼저 와야 합니다');
  });

  test('lint / typecheck / build / test 단계를 모두 실행한다', () => {
    for (const step of ['pnpm lint', 'pnpm typecheck', 'pnpm build', 'pnpm test']) {
      assert.ok(wf.includes(step), `${step} 단계가 없습니다`);
    }
  });

  test('테스트 실행에 필요한 JWT_SECRET / DATABASE_URL env 를 제공한다', () => {
    assert.match(wf, /JWT_SECRET:/, 'JWT_SECRET env 가 없습니다 — 앱 부팅/테스트 실패 위험');
    assert.match(wf, /DATABASE_URL:/, 'DATABASE_URL env 가 없습니다');
  });

  test('BF-742 자체 회귀 가드를 CI 에서 실행한다 (self-validating)', () => {
    assert.ok(
      wf.includes('infra/test/bf-742-ci-workflow-regression.test.js'),
      'CI 가 BF-742 가드를 실행하지 않습니다 — 워크플로 회귀가 잡히지 않습니다',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// docker-build 잡 — 배포 이미지 빌드 검증 (AC1)
// ──────────────────────────────────────────────────────────────

describe('BF-742 · docker-build 잡 — 배포 가능성 검증 (AC1)', () => {
  const wf = exists(WORKFLOW_REL) ? read(WORKFLOW_REL) : '';

  test('docker-build 잡이 정의되어 있다', () => {
    assert.match(wf, /^\s{2}docker-build:/m, 'docker-build 잡이 없습니다 — 배포 이미지 빌드 미검증');
  });

  test('.env.example 로부터 .env 를 준비한다 (compose 가 env_file: .env 요구)', () => {
    assert.match(wf, /cp \.env\.example \.env/, '.env 준비 단계가 없습니다 — compose 기동 시 JWT_SECRET 미설정');
  });

  test('docker compose build 로 실제 배포 이미지를 빌드한다', () => {
    assert.match(wf, /docker compose build/, 'docker compose build 단계가 없습니다 — 배포 산출물이 빌드되는지 미검증');
  });

  test('docker compose config 로 compose 정의 유효성을 검증한다', () => {
    assert.match(wf, /docker compose config/, 'docker compose config 검증 단계가 없습니다');
  });
});
