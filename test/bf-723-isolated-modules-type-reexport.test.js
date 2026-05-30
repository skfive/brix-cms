/**
 * BF-723 회귀 가드 — TS1205 (isolatedModules type re-export) 빌드에러 방지
 *
 * 목적:
 *   루트 tsconfig.json 은 NestJS 백엔드와 Next.js App Router 가 공유한다.
 *   `pnpm start:dev` 는 `next dev` 와 `nest start --watch` 를 동시에 띄우는데,
 *   `next dev` 는 기동 시 공유 tsconfig.json 에 `isolatedModules: true` 를
 *   주입한다. 그 결과 같은 tsconfig 로 컴파일되는 NestJS 측(`src/**`)에서
 *   `src/shared/types/index.ts` 의 type-only re-export 가
 *   TS1205 (Re-exporting a type when 'isolatedModules' is enabled requires
 *   using 'export type') 빌드에러를 일으켜 backend 기동이 실패했다.
 *
 *   본 가드는 그 에러 클래스를 두 층위로 검출한다:
 *     1. 정적 가드(항상 실행) — index.ts 의 type 전용 심볼은 `export type`,
 *        런타임 값(enum PublishStatus)은 일반 `export` 로 구분되어 있는가.
 *     2. 컴파일 가드(typescript 설치 시) — isolatedModules 를 강제로 켠 채
 *        index.ts 를 트랜스파일해 TS1205 가 재발하지 않음을 박제.
 *
 * 실행: node --test test/bf-723-isolated-modules-type-reexport.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const INDEX_REL = 'src/shared/types/index.ts';

/** 파일 읽기 */
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

// ──────────────────────────────────────────────────────────────
// 1. 정적 가드 — export type / export 구분 (항상 실행)
// ──────────────────────────────────────────────────────────────

describe('BF-723 · shared/types re-export 정적 가드 (TS1205 방지)', () => {
  const src = read(INDEX_REL);

  test('index.ts 가 존재한다', () => {
    assert.ok(src.length > 0);
  });

  test('type 전용 심볼(AuthorSummary)은 `export type` 으로 재-export 된다', () => {
    assert.match(src, /export\s+type\s*\{[^}]*\bAuthorSummary\b[^}]*\}\s*from\s*'\.\/author\.types'/);
  });

  test('type 전용 심볼(Pagination)은 `export type` 으로 재-export 된다', () => {
    assert.match(src, /export\s+type\s*\{[^}]*\bPagination\b[^}]*\}\s*from\s*'\.\/pagination\.types'/);
  });

  test('type 전용 심볼(SlugParams)은 `export type` 으로 재-export 된다', () => {
    assert.match(src, /export\s+type\s*\{[^}]*\bSlugParams\b[^}]*\}\s*from\s*'\.\/slug\.types'/);
  });

  test('type 전용 심볼(PublishStatusType)은 `export type` 으로 재-export 된다', () => {
    assert.match(src, /export\s+type\s*\{[^}]*\bPublishStatusType\b[^}]*\}\s*from\s*'\.\/publish-status\.types'/);
  });

  test('런타임 값(enum PublishStatus)은 일반 `export` 로 재-export 된다 (값이므로 export type 금지)', () => {
    // PublishStatus 가 포함된 `export {`(type 없음) 구문이 존재해야 한다.
    const valueExportLines = src
      .split('\n')
      .filter((l) => /\bPublishStatus\b/.test(l) && !/\bPublishStatusType\b/.test(l));
    assert.ok(
      valueExportLines.some((l) => /export\s*\{/.test(l) && !/export\s+type/.test(l)),
      'PublishStatus enum 은 값이므로 `export { PublishStatus }` 형태여야 한다',
    );
  });

  test('어떤 type 전용 심볼도 값 export(`export {`, `export type` 아님) 로 누출되지 않는다', () => {
    const lines = src.split('\n');
    for (const sym of ['AuthorSummary', 'Pagination', 'SlugParams', 'PublishStatusType']) {
      const leaking = lines.filter(
        (l) => new RegExp(`\\b${sym}\\b`).test(l) && /export\s*\{/.test(l) && !/export\s+type/.test(l),
      );
      assert.equal(
        leaking.length,
        0,
        `${sym} 은 type 전용이므로 값 export 로 노출되면 TS1205 가 재발한다`,
      );
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 2. 컴파일 가드 — isolatedModules 강제 ON 트랜스파일 (typescript 설치 시)
// ──────────────────────────────────────────────────────────────

describe('BF-723 · isolatedModules 컴파일 가드 (typescript 설치 시)', () => {
  let ts;
  try {
    ts = require('typescript');
  } catch {
    ts = null;
  }

  test('isolatedModules=true 로 shared/types 를 프로그램 컴파일 시 TS1205 가 발생하지 않는다', (t) => {
    if (!ts) {
      t.skip('typescript 미설치 — 정적 가드로 대체');
      return;
    }
    // transpileModule 은 단일 파일만 보므로 type/value 구분이 불가해 TS1205 를
    // 검출하지 못한다. 실제 재현을 위해 shared/types 전체를 Program 으로 컴파일한다.
    const dir = path.join(ROOT, 'src/shared/types');
    const rootNames = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
      .map((f) => path.join(dir, f));

    const program = ts.createProgram(rootNames, {
      isolatedModules: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
      noEmit: true,
      skipLibCheck: true,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    const ts1205 = diagnostics.filter((d) => d.code === 1205);
    assert.equal(
      ts1205.length,
      0,
      `TS1205 재발: ${ts1205
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
        .join('; ')}`,
    );
  });
});

// ──────────────────────────────────────────────────────────────
// 3. nest 빌드 범위 가드 — backend 컴파일이 src 로 한정되는가 (AC1)
// ──────────────────────────────────────────────────────────────
//
// `pnpm start:dev` 의 `nest start --watch` 는 tsconfig.build.json 으로,
// `pnpm build` 는 tsconfig.nest.build.json 으로 backend 를 컴파일한다.
// 두 설정에 `include` 가 없으면 tsc 가 프로젝트 루트의 모든 .ts
// (playwright.config.ts, tests/e2e/**) 까지 컴파일 대상에 넣어,
// @playwright/test 미설치로 TS2307 가 발생해 backend 기동이 막혔다.
// nest-cli.json 의 `sourceRoot: "src"` 와 일치하도록 컴파일 범위를
// src 로 한정한다.

describe('BF-723 · nest 빌드 컴파일 범위 가드 (AC1 — backend 무에러 기동)', () => {
  function readJson(rel) {
    const raw = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
    return JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ''));
  }

  for (const rel of ['tsconfig.build.json', 'tsconfig.nest.build.json']) {
    test(`${rel} 의 include 가 backend 컴파일을 src 로 한정한다`, () => {
      const cfg = readJson(rel);
      assert.ok(Array.isArray(cfg.include), `${rel} 에 include 배열이 없다`);
      assert.ok(
        cfg.include.some((p) => /^src\//.test(p)),
        `${rel} 의 include 가 src 를 가리켜야 한다 — playwright.config.ts/tests 가 backend 컴파일에 누출되면 TS2307`,
      );
      assert.ok(
        !cfg.include.some((p) => /playwright|^tests\//.test(p)),
        `${rel} 의 include 가 playwright/tests 를 포함하면 안 된다`,
      );
    });
  }
});
