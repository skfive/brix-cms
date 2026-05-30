/**
 * BF-715 회귀 가드 — TS17004 (JSX 플래그 누락) 빌드에러 방지
 *
 * 목적:
 *   루트 tsconfig.json 은 NestJS 백엔드와 Next.js App Router 가 공유한다.
 *   과거 이 파일에 `compilerOptions.jsx` 가 없어, Next.js 의 .tsx 파일이
 *   JSX 플래그 없이 컴파일되며 TS17004 (Cannot use JSX unless the '--jsx'
 *   flag is provided) 빌드에러가 발생했다.
 *
 *   본 가드는 그 에러 클래스를 정적으로 검출한다:
 *     1. Next.js 측: jsx / lib(dom) / paths(@/*) / esModuleInterop 존재
 *     2. NestJS 측: module(commonjs) / experimentalDecorators 가 유지되어
 *        가산적 수정이 백엔드 빌드 기반을 회귀시키지 않았음을 박제
 *
 * 정적 가드만 사용 (node_modules 불필요) → CI/로컬 어디서나 실행 가능.
 *
 * 실행: node --test test/bf-715-jsx-tsconfig-regression.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/** JSONC(주석 허용) tsconfig 안전 파싱 */
function readJson(rel) {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
  // tsconfig 은 표준 JSON 으로 작성돼 있으나, 혹시 모를 라인 주석 제거
  const stripped = raw.replace(/^\s*\/\/.*$/gm, '');
  return JSON.parse(stripped);
}

// ──────────────────────────────────────────────────────────────
// AC2/AC4: 루트 tsconfig 의 JSX 설정 — TS17004 검출 가드
// ──────────────────────────────────────────────────────────────

describe('BF-715 · 루트 tsconfig JSX 설정 가드 (TS17004 방지)', () => {
  test('tsconfig.json 이 존재한다', () => {
    assert.ok(
      fs.existsSync(path.join(ROOT, 'tsconfig.json')),
      'tsconfig.json 이 없습니다',
    );
  });

  test('compilerOptions.jsx 가 "preserve" 로 설정되어 있다 (Next.js 13+ App Router)', () => {
    const tsconfig = readJson('tsconfig.json');
    const jsx = tsconfig.compilerOptions?.jsx;
    assert.ok(
      jsx !== undefined,
      'compilerOptions.jsx 가 없습니다 — TS17004 (JSX 플래그 누락) 가 재발합니다',
    );
    assert.equal(
      jsx,
      'preserve',
      `jsx 는 Next.js App Router 기준 "preserve" 여야 합니다 (현재: "${jsx}")`,
    );
  });

  test('compilerOptions.lib 에 dom 이 포함된다 (App Router/shadcn DOM 타입)', () => {
    const tsconfig = readJson('tsconfig.json');
    const lib = (tsconfig.compilerOptions?.lib ?? []).map((l) =>
      String(l).toLowerCase(),
    );
    assert.ok(
      lib.includes('dom'),
      `compilerOptions.lib 에 "dom" 이 없습니다 (현재: ${JSON.stringify(lib)})`,
    );
  });

  test('compilerOptions.paths 에 "@/*" 별칭이 매핑되어 있다', () => {
    const tsconfig = readJson('tsconfig.json');
    const paths = tsconfig.compilerOptions?.paths ?? {};
    assert.ok(
      Array.isArray(paths['@/*']) && paths['@/*'].length > 0,
      '"@/*" path 별칭이 없습니다 — app/components 의 @ import 가 해소되지 않습니다',
    );
  });

  test('compilerOptions.esModuleInterop 이 true 이다 (Next.js 요구)', () => {
    const tsconfig = readJson('tsconfig.json');
    assert.equal(
      tsconfig.compilerOptions?.esModuleInterop,
      true,
      'esModuleInterop 이 true 가 아닙니다',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// 회귀 방지: NestJS 백엔드 빌드 기반이 유지되었는지 박제
// (가산적 수정이 commonjs/decorators 를 깨지 않았음을 보장)
// ──────────────────────────────────────────────────────────────

describe('BF-715 · NestJS 빌드 기반 보존 가드', () => {
  test('module 이 commonjs 로 유지된다 (NestJS)', () => {
    const tsconfig = readJson('tsconfig.json');
    assert.equal(
      tsconfig.compilerOptions?.module,
      'commonjs',
      'module 이 commonjs 가 아닙니다 — NestJS 빌드/ts-jest 가 깨질 수 있습니다',
    );
  });

  test('experimentalDecorators 가 true 로 유지된다 (NestJS DI)', () => {
    const tsconfig = readJson('tsconfig.json');
    assert.equal(
      tsconfig.compilerOptions?.experimentalDecorators,
      true,
      'experimentalDecorators 가 꺼졌습니다 — NestJS 데코레이터가 깨집니다',
    );
  });

  test('emitDecoratorMetadata 가 true 로 유지된다 (NestJS DI)', () => {
    const tsconfig = readJson('tsconfig.json');
    assert.equal(
      tsconfig.compilerOptions?.emitDecoratorMetadata,
      true,
      'emitDecoratorMetadata 가 꺼졌습니다 — NestJS 의존성 주입이 깨집니다',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// AC1: pnpm run dev 진입점 존재 가드
// ──────────────────────────────────────────────────────────────

describe('BF-715 · dev 스크립트 가드', () => {
  test('package.json 에 dev 스크립트가 존재하고 next dev 를 호출한다', () => {
    const pkg = readJson('package.json');
    const dev = pkg.scripts?.dev ?? '';
    assert.ok(dev.length > 0, 'package.json 에 dev 스크립트가 없습니다');
    assert.ok(
      dev.includes('next dev'),
      `dev 스크립트가 next dev 를 호출하지 않습니다: "${dev}"`,
    );
  });
});
