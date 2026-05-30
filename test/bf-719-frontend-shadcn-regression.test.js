/**
 * BF-719 회귀 가드 — frontend 진입 버그 fix + shadcn 다크 CMS UI
 *
 * 배경:
 *   1) `pnpm start:dev` 가 `nest start --watch` 만 실행해 NestJS 백엔드(3000)만
 *      기동되고 Next.js 프론트엔드(3001)는 별도 명령으로만 떠서, 운영자가
 *      `start:dev` 만 실행하면 frontend 진입이 불가능했다.
 *   2) 디자인 명세(cms-dark-shadcn-BF-716.md)의 다크 모드 셸·컴포넌트가
 *      실제 코드에 적용되지 않아 라이트 모드로만 렌더링됐다.
 *
 *   본 가드는 그 회귀 클래스를 정적으로 검출한다 (node_modules 불필요):
 *     - start:dev 가 next dev(프론트엔드) 를 부팅한다
 *     - 루트 레이아웃이 dark 클래스로 dark-first 활성화
 *     - 상태 배지가 명세 §7.5 다크 색상을 사용
 *     - 셸에 헤더(56px/border-b)·검색·아바타가 존재
 *     - .dark 토큰 값이 보존됨 (명세 §8.1 — 토큰 값 수정 금지)
 *
 * 실행: node --test test/bf-719-frontend-shadcn-regression.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}
function readJson(rel) {
  const stripped = read(rel).replace(/^\s*\/\/.*$/gm, '');
  return JSON.parse(stripped);
}

// ──────────────────────────────────────────────────────────────
// AC1: start:dev 가 프론트엔드를 부팅한다
// ──────────────────────────────────────────────────────────────

describe('BF-719 · start:dev 프론트엔드 부팅 가드', () => {
  test('start:dev 스크립트가 next dev 를 실행한다 (프론트엔드 진입 가능)', () => {
    const pkg = readJson('package.json');
    const startDev = pkg.scripts?.['start:dev'] ?? '';
    assert.ok(startDev.length > 0, 'start:dev 스크립트가 없습니다');
    assert.ok(
      startDev.includes('next dev'),
      `start:dev 가 next dev 를 실행하지 않습니다 — frontend 진입 불가: "${startDev}"`,
    );
  });

  test('start:dev 가 NestJS 백엔드(nest start)도 함께 기동한다', () => {
    const pkg = readJson('package.json');
    const startDev = pkg.scripts?.['start:dev'] ?? '';
    assert.ok(
      startDev.includes('nest start'),
      `start:dev 가 nest start 백엔드를 기동하지 않습니다: "${startDev}"`,
    );
  });

  test('dev / dev:next 스크립트가 보존된다', () => {
    const pkg = readJson('package.json');
    assert.ok((pkg.scripts?.dev ?? '').includes('next dev'), 'dev 스크립트 회귀');
    assert.ok(
      (pkg.scripts?.['dev:next'] ?? '').includes('next dev'),
      'dev:next 스크립트 회귀',
    );
  });

  test('Next.js 14 가 미지원하는 next.config.ts 가 없고 .mjs/.js 가 존재한다', () => {
    assert.ok(
      !fs.existsSync(path.join(ROOT, 'next.config.ts')),
      'next.config.ts 는 Next.js 14 가 지원하지 않습니다 — dev/build 즉시 종료',
    );
    const hasJsConfig =
      fs.existsSync(path.join(ROOT, 'next.config.mjs')) ||
      fs.existsSync(path.join(ROOT, 'next.config.js'));
    assert.ok(hasJsConfig, 'next.config.mjs(또는 .js) 가 없습니다');
  });

  test('lockfile 에 핵심 프론트엔드 의존성(next)이 잠겨 있다', () => {
    // 원본 lockfile 은 frontend 의존성을 누락해 --frozen-lockfile 설치가 실패했다.
    const lock = read('pnpm-lock.yaml');
    assert.match(lock, /\bnext@14/, 'pnpm-lock.yaml 에 next 가 잠겨 있지 않습니다 — frozen 설치 실패');
  });
});

// ──────────────────────────────────────────────────────────────
// AC2: 다크 모드 활성화 + 셸/컴포넌트 적용
// ──────────────────────────────────────────────────────────────

describe('BF-719 · 다크 모드 dark-first 활성화 가드', () => {
  test('루트 레이아웃 <html> 에 dark 클래스가 적용된다 (명세 §8.1)', () => {
    const layout = read('app/layout.tsx');
    assert.match(
      layout,
      /<html[^>]*className=\{[^}]*\bdark\b/,
      'app/layout.tsx 의 <html> 에 dark 클래스가 없습니다 — 라이트 모드로 렌더링됩니다',
    );
  });

  test('.dark 토큰 값이 보존된다 (명세 §8.1 — 토큰 값 수정 금지)', () => {
    const css = read('app/globals.css');
    const darkBlock = css.slice(css.indexOf('.dark'));
    assert.match(darkBlock, /--background:\s*240 10% 3\.9%/, '--background 다크 토큰 회귀');
    assert.match(darkBlock, /--foreground:\s*0 0% 98%/, '--foreground 다크 토큰 회귀');
    assert.match(darkBlock, /--border:\s*240 3\.7% 15\.9%/, '--border 다크 토큰 회귀');
    assert.match(darkBlock, /--muted-foreground:\s*240 5% 64\.9%/, '--muted-foreground 다크 토큰 회귀');
  });
});

describe('BF-719 · 상태 배지 다크 색상 가드 (명세 §7.5)', () => {
  test('badge 의 draft/published/archived 가 다크 대응 색상을 사용한다', () => {
    const badge = read('components/ui/badge.tsx');
    assert.match(badge, /draft:\s*'bg-zinc-800 text-zinc-400 border border-zinc-700'/, 'DRAFT 다크 배지 회귀');
    assert.match(badge, /published:\s*'bg-green-500\/15 text-green-400 border border-green-500\/30'/, 'PUBLISHED 다크 배지 회귀');
    assert.match(badge, /archived:\s*'bg-yellow-500\/15 text-yellow-400 border border-yellow-500\/30'/, 'ARCHIVED 다크 배지 회귀');
  });
});

describe('BF-719 · 관리자 셸 헤더 가드 (명세 §7.2)', () => {
  test('admin-shell 에 56px(h-14) border-b 헤더가 존재한다', () => {
    const shell = read('components/admin-shell.tsx');
    assert.match(shell, /<header[^>]*h-14/, '헤더(h-14)가 없습니다');
    assert.match(shell, /<header[^>]*border-b/, '헤더 border-b 가 없습니다');
  });

  test('헤더에 검색 입력과 아바타가 존재한다', () => {
    const shell = read('components/admin-shell.tsx');
    assert.match(shell, /Search/, '헤더 검색 아이콘이 없습니다');
    assert.match(shell, /aria-label="사용자"/, '헤더 아바타가 없습니다');
  });
});

describe('BF-719 · 통계 카드 / 데이터 테이블 컴포넌트 가드 (명세 §7.3·§7.4)', () => {
  test('StatCard 컴포넌트가 존재하고 대시보드가 사용한다', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'components/stat-card.tsx')), 'StatCard 컴포넌트 없음');
    const dash = read('app/(admin)/dashboard/page.tsx');
    assert.match(dash, /StatCard/, '대시보드가 StatCard 를 사용하지 않습니다');
  });

  test('DataTablePagination 컴포넌트가 존재하고 목록 페이지가 사용한다', () => {
    assert.ok(
      fs.existsSync(path.join(ROOT, 'components/data-table-pagination.tsx')),
      'DataTablePagination 컴포넌트 없음',
    );
    for (const rel of ['app/(admin)/posts/page.tsx', 'app/(admin)/pages/page.tsx']) {
      const src = read(rel);
      assert.match(src, /DataTablePagination/, `${rel} 가 페이지네이션을 사용하지 않습니다`);
      assert.match(src, /ArrowUpDown/, `${rel} 에 정렬 토글이 없습니다`);
    }
  });
});
