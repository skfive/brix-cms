/**
 * BF-721 — E2E 인프라 정적 계약 가드 (node:test, 서버 불필요)
 *
 * Playwright E2E 가 실행될 때 필요한 전제 조건과
 * UI 선택자 계약(locator)이 조용히 깨지지 않도록 정적으로 검증한다.
 *
 * 검증 범위 (dev / bf-719 중복 항목 제외):
 *   - E2E 인프라 파일 존재 (playwright.config.ts, spec 파일, screenshots 디렉토리)
 *   - AC1: 루트 진입 리다이렉트 계약 (app/page.tsx → /login)
 *   - AC1: dark-first 계약 (<html class="dark ...">)
 *   - AC2: 로그인 폼 locator 계약 (#email, #password, submit)
 *   - AC2: AdminShell locator 계약 (<aside>, <header>, AlertDialog, "로그아웃")
 *   - AC2: 포스트 테이블 locator 계약 (Table 컴포넌트)
 *   - AC2: ContentForm locator 계약 (#title, #content)
 *
 * 실행: node --test tests/e2e/bf-721-e2e-guard.test.js
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

// ──────────────────────────────────────────────────────────────
// E2E 인프라 파일 존재 가드
// ──────────────────────────────────────────────────────────────

describe('BF-721 · E2E 인프라 파일 존재 가드', () => {
  test('playwright.config.ts (또는 .js/.mjs) 가 존재한다', () => {
    const exists =
      fs.existsSync(path.join(ROOT, 'playwright.config.ts')) ||
      fs.existsSync(path.join(ROOT, 'playwright.config.js')) ||
      fs.existsSync(path.join(ROOT, 'playwright.config.mjs'));
    assert.ok(exists, 'playwright.config.ts(또는 .js/.mjs) 가 없습니다 — Playwright 실행 불가');
  });

  test('playwright.config.ts 에 testDir 와 snapshotDir 가 선언된다', () => {
    const config = read('playwright.config.ts');
    assert.match(config, /testDir/, 'playwright.config.ts 에 testDir 없음');
    assert.match(
      config,
      /snapshotDir|screenshots/,
      'playwright.config.ts 에 스크린샷 경로 설정 없음',
    );
  });

  test('playwright.config.ts 에 baseURL 이 localhost:3001 로 설정된다', () => {
    const config = read('playwright.config.ts');
    assert.match(
      config,
      /localhost:3001/,
      'playwright.config.ts 의 baseURL 이 Next.js dev 포트(3001)가 아닙니다',
    );
  });

  test('playwright.config.ts 에 colorScheme dark 가 설정된다', () => {
    const config = read('playwright.config.ts');
    assert.match(config, /colorScheme.*dark|dark.*colorScheme/, 'playwright.config.ts 에 dark colorScheme 설정 없음 — 다크 모드 스크린샷 불가');
  });

  test('tests/e2e/ 디렉토리가 존재한다', () => {
    assert.ok(
      fs.existsSync(path.join(ROOT, 'tests', 'e2e')),
      'tests/e2e/ 디렉토리가 없습니다',
    );
  });

  test('tests/e2e/screenshots/ 디렉토리가 존재한다', () => {
    assert.ok(
      fs.existsSync(path.join(ROOT, 'tests', 'e2e', 'screenshots')),
      'tests/e2e/screenshots/ 가 없습니다 — page.screenshot() 저장 경로 없음',
    );
  });

  test('bf-721-dark-screenshots.spec.ts Playwright spec 파일이 존재한다', () => {
    assert.ok(
      fs.existsSync(path.join(ROOT, 'tests', 'e2e', 'bf-721-dark-screenshots.spec.ts')),
      'tests/e2e/bf-721-dark-screenshots.spec.ts 가 없습니다',
    );
  });

  test('spec 파일에 BRIX_E2E_SKIP 가드가 존재한다 (CI skip 대응)', () => {
    const spec = read('tests/e2e/bf-721-dark-screenshots.spec.ts');
    assert.match(spec, /BRIX_E2E_SKIP/, 'spec 에 BRIX_E2E_SKIP 가드 없음 — 서버 없는 CI 에서 fail 발생 가능');
  });
});

// ──────────────────────────────────────────────────────────────
// AC1 — 루트 진입 리다이렉트 + dark-first 계약 가드
// ──────────────────────────────────────────────────────────────

describe('BF-721 · AC1 — 루트 진입 리다이렉트 계약 (app/page.tsx)', () => {
  test('app/page.tsx 가 /login 으로 redirect 한다', () => {
    const rootPage = read('app/page.tsx');
    assert.match(
      rootPage,
      /redirect\(['"`]\/login['"`]\)/,
      'app/page.tsx 가 /login 으로 리다이렉트하지 않습니다 — AC1 미충족',
    );
  });

  test('app/layout.tsx <html> 에 dark 클래스가 포함된다 (dark-first)', () => {
    const layout = read('app/layout.tsx');
    assert.match(
      layout,
      /<html[^>]*dark/,
      'app/layout.tsx <html> 에 dark 클래스 없음 — dark-first 활성화 안 됨',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// AC2 — 로그인 폼 locator 계약 가드
// ──────────────────────────────────────────────────────────────

describe('BF-721 · AC2 — 로그인 폼 locator 계약 (app/(auth)/login/page.tsx)', () => {
  test('#email input 이 존재한다', () => {
    const loginPage = read('app/(auth)/login/page.tsx');
    assert.match(
      loginPage,
      /id="email"/,
      'id="email" 없음 — E2E page.fill("#email", ...) locator 깨짐',
    );
  });

  test('#password input 이 존재한다', () => {
    const loginPage = read('app/(auth)/login/page.tsx');
    assert.match(
      loginPage,
      /id="password"/,
      'id="password" 없음 — E2E page.fill("#password", ...) locator 깨짐',
    );
  });

  test('type="submit" 버튼이 존재한다', () => {
    const loginPage = read('app/(auth)/login/page.tsx');
    assert.match(
      loginPage,
      /type="submit"/,
      'submit 버튼 없음 — E2E page.click("button[type=submit]") locator 깨짐',
    );
  });

  test('/dashboard 리다이렉트 로직이 존재한다', () => {
    const loginPage = read('app/(auth)/login/page.tsx');
    assert.match(
      loginPage,
      /\/dashboard/,
      '로그인 성공 후 /dashboard 이동 로직 없음',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// AC2 — AdminShell locator 계약 가드
// ──────────────────────────────────────────────────────────────

describe('BF-721 · AC2 — AdminShell locator 계약 (components/admin-shell.tsx)', () => {
  test('<aside> 사이드바가 존재한다', () => {
    const shell = read('components/admin-shell.tsx');
    assert.match(
      shell,
      /<aside/,
      '<aside> 없음 — E2E page.locator("aside") 깨짐',
    );
  });

  test('사이드바 너비 w-[240px] 클래스가 존재한다 (명세 §4)', () => {
    const shell = read('components/admin-shell.tsx');
    assert.match(
      shell,
      /w-\[240px\]/,
      'aside 의 w-[240px] 없음 — 사이드바 너비 명세 §4 회귀',
    );
  });

  test('<header> 헤더가 존재한다', () => {
    const shell = read('components/admin-shell.tsx');
    assert.match(
      shell,
      /<header/,
      '<header> 없음 — E2E page.locator("header") 깨짐',
    );
  });

  test('헤더 높이 h-14 클래스가 존재한다 (명세 §7.2 56px)', () => {
    const shell = read('components/admin-shell.tsx');
    assert.match(
      shell,
      /h-14/,
      'header h-14 없음 — 헤더 높이 명세 §7.2 회귀',
    );
  });

  test('로그아웃 AlertDialogContent 가 존재한다', () => {
    const shell = read('components/admin-shell.tsx');
    assert.match(
      shell,
      /AlertDialogContent/,
      'AlertDialogContent 없음 — E2E page.locator("[role=alertdialog]") 깨짐',
    );
  });

  test('"로그아웃" 텍스트를 가진 트리거가 존재한다', () => {
    const shell = read('components/admin-shell.tsx');
    assert.match(
      shell,
      /로그아웃/,
      '"로그아웃" 텍스트 없음 — E2E page.click("button:has-text(로그아웃)") 깨짐',
    );
  });

  test('aria-label="사용자" 아바타가 존재한다 (명세 §7.2)', () => {
    const shell = read('components/admin-shell.tsx');
    assert.match(
      shell,
      /aria-label="사용자"/,
      'aria-label="사용자" 아바타 없음 — 헤더 아바타 명세 §7.2 회귀',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// AC2 — 포스트 테이블 locator 계약 가드
// ──────────────────────────────────────────────────────────────

describe('BF-721 · AC2 — 포스트 테이블 locator 계약 (app/(admin)/posts/page.tsx)', () => {
  test('Table 컴포넌트를 사용한다', () => {
    const postsPage = read('app/(admin)/posts/page.tsx');
    assert.match(
      postsPage,
      /from.*['"].*\/table['"]/,
      'posts 페이지에 Table import 없음 — E2E page.waitForSelector("table") 깨짐',
    );
  });

  test('ArrowUpDown 정렬 토글이 존재한다 (명세 §7.4)', () => {
    const postsPage = read('app/(admin)/posts/page.tsx');
    assert.match(postsPage, /ArrowUpDown/, 'ArrowUpDown 정렬 토글 없음 — 명세 §7.4 회귀');
  });
});

// ──────────────────────────────────────────────────────────────
// AC2 — ContentForm locator 계약 가드
// ──────────────────────────────────────────────────────────────

describe('BF-721 · AC2 — ContentForm locator 계약 (components/content-form.tsx)', () => {
  test('#title input 이 존재한다', () => {
    const form = read('components/content-form.tsx');
    assert.match(
      form,
      /id="title"/,
      'id="title" 없음 — E2E page.fill("#title", ...) locator 깨짐',
    );
  });

  test('#content textarea 가 존재한다', () => {
    const form = read('components/content-form.tsx');
    assert.match(
      form,
      /id="content"/,
      'id="content" 없음 — E2E page.locator("#content") 깨짐',
    );
  });
});
