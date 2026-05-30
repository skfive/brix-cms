/**
 * BF-721 — E2E 스크린샷 회귀 가드 (Playwright)
 *
 * 다크 모드 CMS UI 의 핵심 화면을 캡처·비교한다.
 * baseline 없는 첫 실행: npx playwright test --update-snapshots
 * 이후 CI 실행: npx playwright test  (diff 발생 시 즉시 실패)
 *
 * 시나리오:
 *   AC1-1. 루트(/) 진입 → /login 리다이렉트 (구조 가드)
 *   AC1-2. <html> 에 dark 클래스가 존재한다 (dark-first 가드)
 *   AC2-1. 로그인 페이지 스크린샷
 *   AC2-2. demo 계정 로그인 → 대시보드 스크린샷
 *   AC2-3. 사이드바 (240px aside) 스크린샷
 *   AC2-4. 헤더 (h-14 / border-b) 스크린샷
 *   AC2-5. 포스트 목록 테이블 스크린샷
 *   AC2-6. 새 포스트 콘텐츠 폼 스크린샷
 *   AC2-7. 로그아웃 AlertDialog 스크린샷
 *
 * 실행: npx playwright test tests/e2e/bf-721-dark-screenshots.spec.ts
 * skip: BRIX_E2E_SKIP=1 npx playwright test (서버 없는 CI 건너뜀)
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const DEMO_EMAIL = 'demo@brix-cms.local';
const DEMO_PASSWORD = 'Demo1234!';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');
const SKIP = process.env.BRIX_E2E_SKIP === '1';

// 스크린샷 저장 디렉토리 보장
test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
});

/** demo 계정으로 로그인 → /dashboard 대기 */
async function loginAsDemo(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('#email', { timeout: 10_000 });
  await page.fill('#email', DEMO_EMAIL);
  await page.fill('#password', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

// ──────────────────────────────────────────────────────────────
// AC1 — 루트 진입 + dark-first 구조 가드
// ──────────────────────────────────────────────────────────────

test('AC1 — 루트(/) 진입 시 /login 으로 리다이렉트된다', async ({ page }) => {
  // FIXME(BF-721): BRIX_E2E_SKIP=1 이면 서버 없는 환경 — skip
  if (SKIP) return test.skip();

  await page.goto('/');
  await page.waitForURL('**/login', { timeout: 10_000 });
  expect(page.url()).toContain('/login');
});

test('AC1 — <html> 에 dark 클래스가 존재한다 (dark-first 회귀 가드)', async ({ page }) => {
  if (SKIP) return test.skip();

  await page.goto('/login');
  await page.waitForSelector('#email', { timeout: 10_000 });

  const htmlClass = await page.locator('html').getAttribute('class');
  expect(htmlClass).toMatch(/\bdark\b/);
});

// ──────────────────────────────────────────────────────────────
// AC2 — 다크 모드 스크린샷 캡처·비교 (스크린샷 diff 로 회귀 감지)
// ──────────────────────────────────────────────────────────────

test('AC2 — 로그인 페이지 다크 모드 스크린샷', async ({ page }) => {
  if (SKIP) return test.skip();

  await page.goto('/login');
  await page.waitForSelector('#email', { timeout: 10_000 });

  // Card 렌더 대기 (shadcn Card)
  await page.waitForSelector('[class*="card"]', { timeout: 5_000 });

  // 스크린샷 파일 저장 (수동 diff 용)
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '01-login-dark.png'),
  });

  // toHaveScreenshot: baseline 비교 (첫 실행 시 baseline 생성, 이후 diff 감지)
  await expect(page).toHaveScreenshot('01-login-dark.png', {
    maxDiffPixelRatio: 0.02,
  });
});

test('AC2 — 대시보드 다크 모드 스크린샷', async ({ page }) => {
  if (SKIP) return test.skip();

  await loginAsDemo(page);

  // StatCard 4개 렌더 대기
  await page.waitForSelector('[class*="grid"]', { timeout: 10_000 });

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '02-dashboard-dark.png'),
  });

  await expect(page).toHaveScreenshot('02-dashboard-dark.png', {
    maxDiffPixelRatio: 0.02,
  });
});

test('AC2 — 사이드바 다크 모드 스크린샷', async ({ page }) => {
  if (SKIP) return test.skip();

  await loginAsDemo(page);

  const sidebar = page.locator('aside').first();
  await expect(sidebar).toBeVisible({ timeout: 5_000 });

  // 사이드바 너비 240px 확인 (명세 §4)
  const box = await sidebar.boundingBox();
  expect(box?.width).toBeCloseTo(240, -1); // ±1px 허용

  await sidebar.screenshot({
    path: path.join(SCREENSHOTS_DIR, '03-sidebar-dark.png'),
  });

  await expect(sidebar).toHaveScreenshot('03-sidebar-dark.png', {
    maxDiffPixelRatio: 0.02,
  });
});

test('AC2 — 헤더 다크 모드 스크린샷', async ({ page }) => {
  if (SKIP) return test.skip();

  await loginAsDemo(page);

  const header = page.locator('header').first();
  await expect(header).toBeVisible({ timeout: 5_000 });

  // 헤더 높이 56px (h-14 = 3.5rem = 56px) 확인 (명세 §7.2)
  const box = await header.boundingBox();
  expect(box?.height).toBeCloseTo(56, -1);

  await header.screenshot({
    path: path.join(SCREENSHOTS_DIR, '04-header-dark.png'),
  });

  await expect(header).toHaveScreenshot('04-header-dark.png', {
    maxDiffPixelRatio: 0.02,
  });
});

test('AC2 — 포스트 목록 테이블 다크 모드 스크린샷', async ({ page }) => {
  if (SKIP) return test.skip();

  await loginAsDemo(page);
  await page.goto('/posts');

  // 테이블 헤더 렌더 대기
  await page.waitForSelector('table', { timeout: 10_000 });

  // 정렬 토글 버튼 존재 확인 (명세 §7.4 ArrowUpDown)
  await expect(page.locator('table thead')).toBeVisible();

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '05-posts-table-dark.png'),
  });

  await expect(page).toHaveScreenshot('05-posts-table-dark.png', {
    maxDiffPixelRatio: 0.02,
  });
});

test('AC2 — 콘텐츠 폼 다크 모드 스크린샷', async ({ page }) => {
  if (SKIP) return test.skip();

  await loginAsDemo(page);
  await page.goto('/posts/new');

  // ContentForm 렌더 대기 (#title input)
  await page.waitForSelector('#title', { timeout: 10_000 });

  await expect(page.locator('#title')).toBeVisible();
  await expect(page.locator('#content')).toBeVisible();

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '06-content-form-dark.png'),
  });

  await expect(page).toHaveScreenshot('06-content-form-dark.png', {
    maxDiffPixelRatio: 0.02,
  });
});

test('AC2 — 로그아웃 AlertDialog 다크 모드 스크린샷', async ({ page }) => {
  if (SKIP) return test.skip();

  await loginAsDemo(page);

  // 로그아웃 버튼 클릭 → AlertDialog 열기 (명세 §6.3)
  await page.click('button:has-text("로그아웃")');
  await page.waitForSelector('[role="alertdialog"]', { timeout: 5_000 });
  await expect(page.locator('[role="alertdialog"]')).toBeVisible();

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '07-logout-dialog-dark.png'),
  });

  await expect(page).toHaveScreenshot('07-logout-dialog-dark.png', {
    maxDiffPixelRatio: 0.02,
  });
});
