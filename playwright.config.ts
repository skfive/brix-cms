/**
 * Playwright 설정 — BF-721 E2E + 다크 모드 스크린샷 회귀 가드
 *
 * testDir      : tests/e2e/
 * snapshotDir  : tests/e2e/screenshots/  (toHaveScreenshot 기준 baseline 저장)
 * baseURL      : http://localhost:3001   (Next.js dev 포트)
 * colorScheme  : dark                    (BF-719 dark-first 강제 적용)
 *
 * 실행:
 *   npx playwright test                  # 전체
 *   npx playwright test --update-snapshots  # baseline 초기화 (첫 실행 or UI 의도적 변경 시)
 *   BRIX_E2E_SKIP=1 npx playwright test  # 서버 없는 CI 환경 skip
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  snapshotDir: './tests/e2e/screenshots',
  outputDir: './tests/e2e/test-results',

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:3001',
    colorScheme: 'dark',
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /**
   * webServer: CI 에서는 외부에서 서버를 기동한 뒤 실행 (BRIX_E2E_SKIP 대응)
   * 로컬에서는 reuseExistingServer=true 로 기존 서버 재사용
   */
  webServer: process.env.BRIX_E2E_SKIP === '1'
    ? undefined
    : {
        command: 'pnpm start:dev',
        url: 'http://localhost:3001',
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
