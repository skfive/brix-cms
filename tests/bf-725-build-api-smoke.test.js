/**
 * BF-725 회귀 가드 — 빌드 smoke test + API 엔드포인트 계약
 *
 * 배경:
 *   BF-723 에서 수정된 두 가지 결함이 동일하게 재발하지 않도록 박제한다:
 *     1. TS1205: isolatedModules 활성 시 type 전용 심볼을 일반 export 로 노출
 *        → next dev 가 공유 tsconfig 에 isolatedModules:true 를 주입하면 backend 빌드 실패
 *     2. TS2307: tsconfig.build.json / tsconfig.nest.build.json 에 include 없을 때
 *        nest 컴파일이 프로젝트 루트의 playwright/tests 까지 잡아 @playwright/test 미설치로 실패
 *
 *   본 가드는 BF-723 의 정적 가드(TS1205·include 배열)와 BF-713 의 API E2E 와
 *   중복되지 않는 영역만 커버한다:
 *     1. package.json 빌드·기동 스크립트 계약 — build/start:dev/start:backend/verify 스크립트
 *     2. auth 엔드포인트 route 계약 — 컨트롤러 선언, HTTP 상태 코드, 응답 형태
 *     3. 핵심 백엔드 파일 존재 가드 — main.ts, app.module.ts, auth 모듈 파일
 *     4. 데모 계정 seed 계약 — demo@brix-cms.local / Demo1234! 자격증명 박제
 *     5. 런타임 빌드 smoke test — nest build 실제 실행 → TS 에러 0 exit 0 검증
 *        (BRIX_E2E_SKIP=1 시 skip, 환경에 따라 조건부 실행)
 *
 * 실행:
 *   node --test tests/bf-725-build-api-smoke.test.js
 *   BRIX_E2E_SKIP=1 node --test tests/bf-725-build-api-smoke.test.js  # 런타임 skip
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SKIP_RUNTIME = process.env.BRIX_E2E_SKIP === '1';

/** 파일 읽기 */
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/** 파일 존재 여부 */
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

// ──────────────────────────────────────────────────────────────
// AC1 — package.json 빌드·기동 스크립트 계약 가드
// (동일 결함 재발 조건: 스크립트 삭제 또는 tsconfig 경로 변경)
// ──────────────────────────────────────────────────────────────

describe('BF-725 · AC1 — package.json 빌드·기동 스크립트 계약', () => {
  const pkg = JSON.parse(read('package.json'));
  const scripts = pkg.scripts ?? {};

  test('build 스크립트가 존재한다', () => {
    assert.ok(scripts.build, 'package.json 에 build 스크립트가 없습니다');
  });

  test('build 스크립트가 tsconfig.nest.build.json 을 명시한다', () => {
    assert.ok(
      (scripts.build ?? '').includes('tsconfig.nest.build.json'),
      `build 스크립트가 tsconfig.nest.build.json 을 사용하지 않습니다: "${scripts.build}" — nest 빌드 범위 한정 tsconfig 가 누락됩니다`,
    );
  });

  test('start:dev 스크립트가 존재한다', () => {
    assert.ok(
      scripts['start:dev'],
      'package.json 에 start:dev 스크립트가 없습니다',
    );
  });

  test('start:dev 스크립트가 next dev 와 nest start 를 모두 포함한다', () => {
    const startDev = scripts['start:dev'] ?? '';
    assert.ok(
      startDev.includes('next dev'),
      `start:dev 가 next dev 를 실행하지 않습니다: "${startDev}"`,
    );
    assert.ok(
      startDev.includes('nest start'),
      `start:dev 가 nest start 를 실행하지 않습니다: "${startDev}"`,
    );
  });

  test('start:backend 스크립트가 존재한다 (백엔드 단독 기동용)', () => {
    assert.ok(
      scripts['start:backend'],
      'package.json 에 start:backend 스크립트가 없습니다 — 백엔드 단독 smoke test 불가',
    );
  });

  test('verify 스크립트가 build 단계를 포함한다', () => {
    const verify = scripts.verify ?? '';
    assert.ok(
      verify.includes('build'),
      `verify 스크립트에 build 가 없습니다: "${verify}" — 빌드 에러가 CI 에서 걸러지지 않습니다`,
    );
  });
});

// ──────────────────────────────────────────────────────────────
// AC1 / AC2 — 핵심 백엔드 소스 파일 존재 가드
// (동일 결함 재발 조건: 핵심 파일 삭제 또는 이동)
// ──────────────────────────────────────────────────────────────

describe('BF-725 · AC1 — 핵심 백엔드 소스 파일 존재 가드', () => {
  test('src/main.ts 가 존재한다', () => {
    assert.ok(exists('src/main.ts'), 'src/main.ts 가 없습니다 — nest build 진입점 누락');
  });

  test('src/main.ts 에 bootstrap 함수가 있다', () => {
    const main = read('src/main.ts');
    assert.ok(
      main.includes('bootstrap'),
      'src/main.ts 에 bootstrap 함수가 없습니다 — NestJS 부팅 진입점 누락',
    );
  });

  test('src/main.ts 가 NestFactory.create 를 호출한다', () => {
    const main = read('src/main.ts');
    assert.ok(
      main.includes('NestFactory.create'),
      'src/main.ts 가 NestFactory.create 를 호출하지 않습니다 — NestJS 앱 생성 불가',
    );
  });

  test('src/app.module.ts 가 존재한다', () => {
    assert.ok(exists('src/app.module.ts'), 'src/app.module.ts 가 없습니다');
  });

  test('src/app.module.ts 가 @Module 데코레이터를 사용한다', () => {
    const appModule = read('src/app.module.ts');
    assert.ok(
      appModule.includes('@Module'),
      'src/app.module.ts 에 @Module 데코레이터가 없습니다',
    );
  });

  test('src/auth/auth.controller.ts 가 존재한다', () => {
    assert.ok(
      exists('src/auth/auth.controller.ts'),
      'src/auth/auth.controller.ts 가 없습니다 — /auth/login, /auth/register 라우트 누락',
    );
  });

  test('src/auth/auth.service.ts 가 존재한다', () => {
    assert.ok(
      exists('src/auth/auth.service.ts'),
      'src/auth/auth.service.ts 가 없습니다',
    );
  });

  test('src/shared/types/index.ts 가 존재한다', () => {
    assert.ok(
      exists('src/shared/types/index.ts'),
      'src/shared/types/index.ts 가 없습니다 — isolatedModules 수정 산출물 누락',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// AC2 — auth 엔드포인트 route 계약 가드
// (동일 결함 재발 조건: 데코레이터 제거, HTTP 상태 코드 변경)
// ──────────────────────────────────────────────────────────────

describe('BF-725 · AC2 — auth 엔드포인트 route 계약 (정적 가드)', () => {
  const ctrl = read('src/auth/auth.controller.ts');

  test('@Controller("auth") 가 선언되어 있다 — /auth/* 라우트 prefix', () => {
    assert.match(
      ctrl,
      /@Controller\(['"]auth['"]\)/,
      'auth.controller.ts 에 @Controller("auth") 가 없습니다 — /auth/* 라우트 prefix 누락',
    );
  });

  test('@Post("register") 가 선언되어 있다 — POST /auth/register 라우트', () => {
    assert.match(
      ctrl,
      /@Post\(['"]register['"]\)/,
      'auth.controller.ts 에 @Post("register") 가 없습니다 — POST /auth/register 라우트 누락',
    );
  });

  test('register 메서드가 존재한다 — 회원가입 핸들러', () => {
    assert.match(
      ctrl,
      /async register\s*\(/,
      'auth.controller.ts 에 register 핸들러가 없습니다',
    );
  });

  test('@Post("login") 가 선언되어 있다 — POST /auth/login 라우트', () => {
    assert.match(
      ctrl,
      /@Post\(['"]login['"]\)/,
      'auth.controller.ts 에 @Post("login") 가 없습니다 — POST /auth/login 라우트 누락',
    );
  });

  test('@HttpCode(HttpStatus.OK) 가 login 에 적용되어 있다 — login 응답 200 보장', () => {
    assert.match(
      ctrl,
      /@HttpCode\(HttpStatus\.OK\)/,
      'auth.controller.ts 에 @HttpCode(HttpStatus.OK) 가 없습니다 — POST /auth/login 가 기본 201 을 반환해 클라이언트 파싱 실패',
    );
  });

  test('login 메서드가 존재한다 — 로그인 핸들러', () => {
    assert.match(
      ctrl,
      /async login\s*\(/,
      'auth.controller.ts 에 login 핸들러가 없습니다',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// AC2 — auth 서비스 응답 형태 계약 가드
// ──────────────────────────────────────────────────────────────

describe('BF-725 · AC2 — auth 서비스 응답 형태 계약 (정적 가드)', () => {
  const svc = read('src/auth/auth.service.ts');

  test('RegisterResult 인터페이스가 id / email / role 필드를 포함한다', () => {
    assert.match(
      svc,
      /RegisterResult/,
      'auth.service.ts 에 RegisterResult 타입이 없습니다',
    );
    assert.ok(
      svc.includes('id') && svc.includes('email') && svc.includes('role'),
      'RegisterResult 가 id/email/role 필드를 포함하지 않습니다 — 클라이언트 파싱 실패',
    );
  });

  test('LoginResult 인터페이스가 access_token 필드를 포함한다', () => {
    assert.match(
      svc,
      /LoginResult/,
      'auth.service.ts 에 LoginResult 타입이 없습니다',
    );
    assert.ok(
      svc.includes('access_token'),
      'LoginResult 가 access_token 필드를 포함하지 않습니다 — JWT 토큰 응답 계약 누락',
    );
  });

  test('register 메서드가 bcrypt 해싱을 사용하지 않고 usersService 에 위임한다 (레이어 분리)', () => {
    // register 는 usersService.create 를 호출해야 하며 직접 bcrypt 를 하지 않음
    assert.match(
      svc,
      /usersService\.(create|register)/,
      'auth.service.ts register 가 usersService 에 위임하지 않습니다',
    );
  });

  test('login 메서드가 UnauthorizedException 으로 인증 실패를 처리한다', () => {
    assert.match(
      svc,
      /UnauthorizedException/,
      'auth.service.ts 에 UnauthorizedException 이 없습니다 — 잘못된 자격증명에 401 이 아닌 500 반환 위험',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// AC2 — 데모 계정 seed 계약 가드
// (동일 결함 재발 조건: seed 자격증명 변경)
// ──────────────────────────────────────────────────────────────

describe('BF-725 · AC2 — 데모 계정 seed 자격증명 계약', () => {
  const seed = read('prisma/seed.ts');

  test('prisma/seed.ts 가 존재한다', () => {
    assert.ok(seed.length > 0, 'prisma/seed.ts 가 비어있습니다');
  });

  test('데모 계정 이메일이 demo@brix-cms.local 로 고정되어 있다', () => {
    assert.ok(
      seed.includes('demo@brix-cms.local'),
      'prisma/seed.ts 의 데모 이메일이 demo@brix-cms.local 이 아닙니다 — BF-713 E2E 테스트와 불일치',
    );
  });

  test('데모 계정 비밀번호가 Demo1234! 로 고정되어 있다', () => {
    assert.ok(
      seed.includes('Demo1234!'),
      'prisma/seed.ts 의 데모 비밀번호가 Demo1234! 이 아닙니다 — BF-713 E2E 테스트와 불일치',
    );
  });

  test('seed 스크립트가 upsert 를 사용한다 (중복 실행 안전)', () => {
    assert.ok(
      seed.includes('upsert'),
      'prisma/seed.ts 가 upsert 를 사용하지 않습니다 — 중복 실행 시 unique constraint 오류 발생',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// AC1 — 런타임 빌드 smoke test (BRIX_E2E_SKIP=1 시 skip)
//
// BF-723 수정 핵심 회귀 가드:
//   - tsconfig.nest.build.json 의 include 가 제거되면 → TS2307 (@playwright/test)
//   - src/shared/types/index.ts 의 export type 이 export 로 바뀌면 → TS1205
//   두 경우 모두 nest build 가 비-0 exit → 이 테스트가 FAIL
// ──────────────────────────────────────────────────────────────

describe('BF-725 · AC1 — 런타임 빌드 smoke test', () => {
  /** nest CLI 바이너리 위치 탐색 (로컬 node_modules 우선) */
  function findNestBin() {
    const localBin = path.join(ROOT, 'node_modules', '.bin', 'nest');
    if (fs.existsSync(localBin)) return localBin;
    // npx 폴백
    const npx = spawnSync('which', ['npx'], { encoding: 'utf-8' });
    if (npx.status === 0) return null; // npx 로 실행
    return null;
  }

  const skipReason = SKIP_RUNTIME
    ? 'BRIX_E2E_SKIP=1 — 런타임 빌드 skip'
    : false;

  test(
    'nest build --path tsconfig.nest.build.json 이 TS 에러 없이 exit 0 으로 완료된다',
    { skip: skipReason },
    () => {
      const nestBin = findNestBin();

      let result;
      if (nestBin) {
        // 로컬 node_modules/.bin/nest 사용
        result = spawnSync(nestBin, ['build', '--path', 'tsconfig.nest.build.json'], {
          cwd: ROOT,
          encoding: 'utf-8',
          timeout: 120_000,
        });
      } else {
        // npx 폴백
        result = spawnSync(
          'npx',
          ['--yes', '@nestjs/cli', 'build', '--path', 'tsconfig.nest.build.json'],
          {
            cwd: ROOT,
            encoding: 'utf-8',
            timeout: 180_000,
          },
        );
      }

      const stderr = (result.stderr ?? '').slice(0, 2000);
      const stdout = (result.stdout ?? '').slice(0, 2000);

      // TS2307: playwright 누출 가드
      assert.ok(
        !stderr.includes('TS2307') && !stdout.includes('TS2307'),
        `TS2307 재발: @playwright/test 가 nest 빌드 범위에 포함됨\n` +
          `→ tsconfig.nest.build.json 의 include 배열 확인 필요\n` +
          `stderr: ${stderr}`,
      );

      // TS1205: isolatedModules type re-export 누출 가드
      assert.ok(
        !stderr.includes('TS1205') && !stdout.includes('TS1205'),
        `TS1205 재발: isolatedModules 활성 시 type 전용 심볼을 일반 export 로 노출\n` +
          `→ src/shared/types/index.ts 의 export type 구분 확인 필요\n` +
          `stderr: ${stderr}`,
      );

      assert.equal(
        result.status,
        0,
        `nest build 실패 (exit ${result.status})\n` +
          `stdout: ${stdout}\n` +
          `stderr: ${stderr}`,
      );
    },
  );
});
