/**
 * BF-689 — 공유 기반 모델·유틸 E2E/통합 회귀 가드
 *
 * 목적:
 *   - 공유 타입/유틸 경계 입력 동작 보호 (dev 미테스트 경계값)
 *   - 마이그레이션 적용 후 기존 인증 흐름(JwtAuthGuard) 무영향 검증
 *
 * dev 기존 테스트 (중복 금지):
 *   - src/shared/utils/slug.util.spec.ts        → generateSlug 12케이스
 *   - src/shared/utils/pagination.util.spec.ts  → createPagination / calcSkip 10케이스
 *   - src/auth/strategies/jwt.strategy.spec.ts  → validate 유효/sub누락, 생성자 오류
 *   - src/auth/auth.service.spec.ts             → register / login 단위 테스트
 *   - src/auth/auth.controller.spec.ts          → register / login 컨트롤러 테스트
 *
 * tester 고유 영역:
 *   AC1: 공유 유틸 경계 입력 (슬래시·역슬래시·pageSize=0) + 소스 contract 가드
 *   AC2: 마이그레이션 후 인증 흐름 E2E (실제 DB + HTTP 엔드포인트 + JWT 형식 검증)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { execSync } from 'child_process';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AddressInfo } from 'net';

import { AppModule } from '../src/app.module';
import { AuthModule } from '../src/auth/auth.module';
import { generateSlug } from '../src/shared/utils/slug.util';
import {
  createPagination,
  calcSkip,
} from '../src/shared/utils/pagination.util';
import { PublishStatus } from '../src/shared/types/publish-status.types';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import type { JwtPayload } from '../src/auth/interfaces/jwt-payload.interface';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_DB_PATH = '/tmp/brix-test-bf689-regression.db';

// ─── HTTP 헬퍼 (supertest 미설치 — Node.js 내장 http 모듈 사용) ──────────────

interface HttpResponse {
  status: number;
  body: string;
  contentType: string | null;
}

function httpPost(url: string, data: object): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(data);
    const urlObj = new URL(url);
    const req = http.request(
      {
        hostname: urlObj.hostname,
        port: parseInt(urlObj.port, 10),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk: Buffer) => {
          responseBody += chunk.toString();
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: responseBody,
            contentType: res.headers['content-type'] ?? null,
          });
        });
      },
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ─── AC1: 공유 유틸 경계 입력 회귀 가드 ──────────────────────────────────────

describe('[BF-689] 공유 유틸 경계 입력 회귀 가드', () => {
  // dev 가 이미 검증한 케이스 (중복 금지):
  //   영문/한글/특수문자/공백/연속공백/앞뒤공백/혼합/중복하이픈/빈문자열/숫자/언더스코어
  describe('generateSlug — dev 미테스트 슬래시·역슬래시 경계값', () => {
    test('슬래시(/)를 하이픈으로 변환한다', () => {
      expect(generateSlug('foo/bar')).toBe('foo-bar');
    });

    test('역슬래시(\\)를 하이픈으로 변환한다', () => {
      expect(generateSlug('foo\\bar')).toBe('foo-bar');
    });

    test('슬래시와 공백 혼합을 단일 하이픈으로 정규화한다', () => {
      expect(generateSlug('hello / world')).toBe('hello-world');
    });
  });

  // dev 가 이미 검증한 케이스: total=0 (totalPages=0)
  // tester 추가: pageSize=0 (0 나눗셈 방지 경계)
  describe('createPagination — pageSize=0 경계값', () => {
    test('pageSize=0 이면 totalPages=0 — 0 나눗셈 방지 동작 유지', () => {
      const result = createPagination([], 10, 1, 0);
      expect(result.totalPages).toBe(0);
    });
  });

  // dev 가 이미 검증한 케이스: page=1,2,3,4 / pageSize=5,10,20
  // tester 추가: pageSize=1 (최소 단위)
  describe('calcSkip — pageSize=1 경계값', () => {
    test('pageSize=1 이면 skip = page-1', () => {
      expect(calcSkip(5, 1)).toBe(4);
    });
  });

  describe('PublishStatus enum 값 contract', () => {
    test("DRAFT 값이 문자열 'DRAFT'", () => {
      expect(PublishStatus.DRAFT).toBe('DRAFT');
    });

    test("PUBLISHED 값이 문자열 'PUBLISHED'", () => {
      expect(PublishStatus.PUBLISHED).toBe('PUBLISHED');
    });

    test("ARCHIVED 값이 문자열 'ARCHIVED'", () => {
      expect(PublishStatus.ARCHIVED).toBe('ARCHIVED');
    });

    test('PublishStatus 키가 3개 — 값 추가/삭제 silent break 방지', () => {
      expect(Object.keys(PublishStatus).length).toBe(3);
    });
  });
});

// ─── AC1: 공유 모듈 소스 contract 가드 ───────────────────────────────────────

describe('[BF-689] 공유 모듈 소스 contract 가드', () => {
  const readSrc = (relPath: string): string =>
    fs.readFileSync(path.join(PROJECT_ROOT, relPath), 'utf-8');

  describe('shared/utils/index.ts — 유틸 export contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/shared/utils/index.ts');
    });

    test('generateSlug export 존재', () => {
      expect(src).toContain('generateSlug');
    });

    test('createPagination export 존재', () => {
      expect(src).toContain('createPagination');
    });

    test('calcSkip export 존재', () => {
      expect(src).toContain('calcSkip');
    });
  });

  describe('shared/types/index.ts — 타입 export contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/shared/types/index.ts');
    });

    test('PublishStatus export 존재', () => {
      expect(src).toContain('PublishStatus');
    });

    test('Pagination export 존재', () => {
      expect(src).toContain('Pagination');
    });

    test('AuthorSummary export 존재', () => {
      expect(src).toContain('AuthorSummary');
    });

    test('SlugParams export 존재', () => {
      expect(src).toContain('SlugParams');
    });
  });

  describe('JwtAuthGuard 소스 contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/auth/guards/jwt-auth.guard.ts');
    });

    test("AuthGuard('jwt') 확장 존재 — passport jwt 전략 연결 보장", () => {
      expect(src).toContain("AuthGuard('jwt')");
    });

    test('@Injectable() 데코레이터 존재', () => {
      expect(src).toContain('@Injectable()');
    });

    test('JwtAuthGuard 클래스 정의 존재', () => {
      expect(src).toContain('JwtAuthGuard');
    });
  });

  describe('AuthModule 소스 contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/auth/auth.module.ts');
    });

    test('exports 에 JwtAuthGuard 존재', () => {
      expect(src).toContain('JwtAuthGuard');
    });

    test('exports 에 AuthService 존재', () => {
      expect(src).toContain('AuthService');
    });

    test('providers 에 JwtStrategy 존재', () => {
      expect(src).toContain('JwtStrategy');
    });

    test('PassportModule import 존재', () => {
      expect(src).toContain('PassportModule');
    });
  });

  describe('Prisma 스키마 CMS 모델 contract', () => {
    let schema: string;
    beforeAll(() => {
      schema = readSrc('prisma/schema.prisma');
    });

    test('User 모델 존재 — 인증 기반 모델 보존', () => {
      expect(schema).toContain('model User');
    });

    test('Post 모델 존재 — BF-687 CMS 마이그레이션 결과', () => {
      expect(schema).toContain('model Post');
    });

    test('Page 모델 존재 — BF-687 CMS 마이그레이션 결과', () => {
      expect(schema).toContain('model Page');
    });

    test('Comment 모델 존재 — BF-687 CMS 마이그레이션 결과', () => {
      expect(schema).toContain('model Comment');
    });

    test('User.email unique 제약 존재 — 중복 가입 방지', () => {
      expect(schema).toContain('@unique');
    });
  });

  describe('마이그레이션 파일 contract', () => {
    test('User 모델 마이그레이션 파일 존재', () => {
      const migPath = path.join(
        PROJECT_ROOT,
        'prisma/migrations/20260529071747_add_user_model/migration.sql',
      );
      expect(fs.existsSync(migPath)).toBe(true);
    });

    test('CMS 모델 마이그레이션 파일 존재', () => {
      const migPath = path.join(
        PROJECT_ROOT,
        'prisma/migrations/20260529090510_add_cms_models/migration.sql',
      );
      expect(fs.existsSync(migPath)).toBe(true);
    });

    test('CMS 마이그레이션에 Post 테이블 CREATE 존재', () => {
      const sql = fs.readFileSync(
        path.join(
          PROJECT_ROOT,
          'prisma/migrations/20260529090510_add_cms_models/migration.sql',
        ),
        'utf-8',
      );
      expect(sql).toContain('CREATE TABLE "Post"');
      expect(sql).toContain('CREATE TABLE "Page"');
      expect(sql).toContain('CREATE TABLE "Comment"');
    });

    test('User 마이그레이션에 User 테이블 CREATE 존재', () => {
      const sql = fs.readFileSync(
        path.join(
          PROJECT_ROOT,
          'prisma/migrations/20260529071747_add_user_model/migration.sql',
        ),
        'utf-8',
      );
      expect(sql).toContain('CREATE TABLE "User"');
    });
  });
});

// ─── AC2: JwtStrategy null/undefined payload 경계 회귀 가드 ──────────────────
// dev 기존 테스트: validate({ email, role }) 누락 sub → UnauthorizedException ✓
// tester 추가: null / undefined 자체 입력 (optional chaining 동작 보장)

describe('[BF-689] JwtStrategy null·undefined payload 경계 회귀 가드', () => {
  let strategy: JwtStrategy;

  beforeAll(() => {
    const configService = {
      get: jest.fn().mockReturnValue('bf689-test-secret'),
    } as unknown as ConfigService;
    strategy = new JwtStrategy(configService);
  });

  test('null payload 입력 시 UnauthorizedException throw', () => {
    expect(() => strategy.validate(null as unknown as JwtPayload)).toThrow(
      UnauthorizedException,
    );
  });

  test('undefined payload 입력 시 UnauthorizedException throw', () => {
    expect(() => strategy.validate(undefined as unknown as JwtPayload)).toThrow(
      UnauthorizedException,
    );
  });
});

// ─── AC2: 마이그레이션 후 인증 흐름 E2E 회귀 가드 ────────────────────────────
// CMS 모델(Post/Page/Comment) 마이그레이션 후 User 기반 인증이 무영향임을 검증

describe('[BF-689] 마이그레이션 후 인증 흐름 E2E 회귀 가드', () => {
  let app: INestApplication;
  let port: number;

  beforeAll(async () => {
    // setup.e2e.ts 의 health test DB 와 분리된 전용 테스트 DB
    process.env['DATABASE_URL'] = `file:${TEST_DB_PATH}`;
    process.env['JWT_SECRET'] = 'bf689-regression-test-jwt-secret-min32chars!!';

    // 양 마이그레이션 배포 (20260529071747_add_user_model + 20260529090510_add_cms_models)
    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
      stdio: 'ignore',
    });

    // AppModule (ConfigModule global, PrismaModule global) + AuthModule 통합 부팅
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AuthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    // port=0 → OS 가 빈 포트 자동 할당 (충돌 방지)
    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('앱 부팅 상태 검증', () => {
    test('NestJS 앱 인스턴스 정상 생성 — 마이그레이션 후 DB 연결 성공', () => {
      expect(app).toBeDefined();
    });

    test('HTTP 서버 포트가 0 초과 — 정상 Listen 확인', () => {
      expect(port).toBeGreaterThan(0);
    });

    test('테스트 DB 파일 생성됨 — 마이그레이션 + PrismaService.$connect 성공', () => {
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    });
  });

  describe('POST /auth/register — 마이그레이션 후 회원가입 흐름', () => {
    test('HTTP 201 + { id, email, role } 반환', async () => {
      const { status, body } = await httpPost(
        `http://localhost:${port}/auth/register`,
        { email: 'bf689-test@example.com', password: 'testpass8' },
      );
      expect(status).toBe(201);
      const parsed = JSON.parse(body) as {
        id: number;
        email: string;
        role: string;
      };
      expect(parsed.id).toBeGreaterThan(0);
      expect(parsed.email).toBe('bf689-test@example.com');
      expect(parsed.role).toBe('user');
    });

    test('응답에 password_hash 미노출 — 민감 정보 유출 방지', async () => {
      const { body } = await httpPost(
        `http://localhost:${port}/auth/register`,
        { email: 'bf689-nohash@example.com', password: 'testpass8' },
      );
      expect(body).not.toContain('password_hash');
    });

    test('비밀번호 8자 미만 요청 시 HTTP 400', async () => {
      const { status } = await httpPost(
        `http://localhost:${port}/auth/register`,
        { email: 'bf689-short@example.com', password: 'short' },
      );
      expect(status).toBe(400);
    });
  });

  describe('POST /auth/login — 마이그레이션 후 로그인 흐름', () => {
    const TEST_EMAIL = 'bf689-login@example.com';
    const TEST_PASS = 'loginpass8';

    beforeAll(async () => {
      // 로그인 테스트용 계정 미리 생성
      await httpPost(`http://localhost:${port}/auth/register`, {
        email: TEST_EMAIL,
        password: TEST_PASS,
      });
    });

    test('HTTP 200 + { access_token } 반환', async () => {
      const { status, body } = await httpPost(
        `http://localhost:${port}/auth/login`,
        { email: TEST_EMAIL, password: TEST_PASS },
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as { access_token: string };
      expect(typeof parsed.access_token).toBe('string');
      expect(parsed.access_token.length).toBeGreaterThan(0);
    });

    test('access_token 이 JWT 형식 (헤더.페이로드.서명 3부분)', async () => {
      const { body } = await httpPost(`http://localhost:${port}/auth/login`, {
        email: TEST_EMAIL,
        password: TEST_PASS,
      });
      const parsed = JSON.parse(body) as { access_token: string };
      const parts = parsed.access_token.split('.');
      // JWT 는 항상 header.payload.signature 3개 파트
      expect(parts.length).toBe(3);
    });

    test('잘못된 비밀번호로 로그인하면 HTTP 401', async () => {
      const { status } = await httpPost(`http://localhost:${port}/auth/login`, {
        email: TEST_EMAIL,
        password: 'wrongpassword',
      });
      expect(status).toBe(401);
    });

    test('존재하지 않는 이메일로 로그인하면 HTTP 401', async () => {
      const { status } = await httpPost(`http://localhost:${port}/auth/login`, {
        email: 'ghost-bf689@example.com',
        password: TEST_PASS,
      });
      expect(status).toBe(401);
    });
  });
});
