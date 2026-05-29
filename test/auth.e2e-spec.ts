/**
 * BF-685 — 인증 모듈 E2E 회귀 가드
 *
 * 목적: 머지된 인증 모듈(register/login/JwtAuthGuard)이 미래 변경에도
 *       silent break 되지 않도록 보호한다.
 *
 * dev 기존 테스트 (중복 금지):
 *   - src/auth/auth.service.spec.ts      → register/login 단위 (mock)
 *   - src/auth/auth.controller.spec.ts   → 컨트롤러 위임 (mock)
 *   - src/auth/dto/auth.dto.spec.ts      → DTO 유효성 검사 단위
 *   - src/auth/strategies/jwt.strategy.spec.ts → JwtStrategy validate (mock)
 *
 * tester 고유 영역:
 *   1. 실 HTTP 서버 + 실 SQLite DB — register → login → 보호 라우트 E2E
 *   2. 토큰 미보유 → 401 응답 E2E
 *   3. 잘못된 자격증명 → 401 응답 E2E
 *   4. 소스 contract 정적 가드 (파일 존재·내용 기반)
 */

// CRITICAL: setup.e2e.ts 가 health DB 경로를 설정하므로 인증 전용 DB 로 override
// PrismaClient 생성 전에 적용되어야 함 — 모듈 최상단 설정
process.env.DATABASE_URL = 'file:/tmp/brix-test-auth-bf685.db';
process.env.JWT_SECRET = 'test-jwt-secret-bf685';

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Get,
  UseGuards,
  Module,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { AddressInfo } from 'net';

import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaModule } from '../src/prisma/prisma.module';

// ─── 테스트 상수 ─────────────────────────────────────────────────────────────
const TEST_DB_PATH = '/tmp/brix-test-auth-bf685.db';
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ─── 보호 라우트 테스트용 컨트롤러 (테스트 내 선언, 소스 변경 불필요) ─────────
@Controller('protected')
class TestProtectedController {
  @Get()
  @UseGuards(JwtAuthGuard)
  getProtected(): { message: string } {
    return { message: '접근 허용됨' };
  }
}

// ─── 테스트 전용 AppModule (AuthModule + 보호 라우트 포함) ────────────────────
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule],
  controllers: [TestProtectedController],
})
class TestAuthAppModule {}

// ─── HTTP 헬퍼 ───────────────────────────────────────────────────────────────
interface HttpResponse {
  status: number;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}

function httpRequest(
  options: http.RequestOptions,
  body?: string,
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () =>
        resolve({
          status: res.statusCode!,
          body: data,
          headers: res.headers as Record<string, string | string[] | undefined>,
        }),
      );
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function postJson(
  url: string,
  payload: Record<string, unknown>,
  token?: string,
): Promise<HttpResponse> {
  const bodyStr = JSON.stringify(payload);
  const parsed = new URL(url);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(bodyStr).toString(),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return httpRequest(
    {
      hostname: parsed.hostname,
      port: Number(parsed.port),
      path: parsed.pathname,
      method: 'POST',
      headers,
    },
    bodyStr,
  );
}

function getJson(url: string, token?: string): Promise<HttpResponse> {
  const parsed = new URL(url);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return httpRequest({
    hostname: parsed.hostname,
    port: Number(parsed.port),
    path: parsed.pathname,
    method: 'GET',
    headers,
  });
}

// ─── E2E 가드: register → login → 보호 라우트 흐름 ──────────────────────────
describe('[BF-685] 인증 모듈 E2E 회귀 가드', () => {
  let app: INestApplication;
  let port: number;

  beforeAll(async () => {
    // 인증 전용 테스트 DB 에 스키마 적용 (User + HealthLog 테이블 생성)
    execSync(
      'npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss',
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env },
        stdio: 'ignore',
      },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAuthAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    // port 0 → OS 가 빈 포트 자동 할당 (포트 충돌 방지)
    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;
  });

  afterAll(async () => {
    await app.close();
    // 임시 테스트 DB 정리
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  // ── AC1: register → login → 보호 라우트 정상 흐름 ──────────────────────────
  describe('AC1: register → login → 보호 라우트 정상 흐름', () => {
    const testEmail = `e2e-flow-${Date.now()}@example.com`;
    const testPassword = 'StrongPass!1';
    let accessToken: string;

    it('POST /auth/register → 201 + { id, email, role } 반환', async () => {
      const res = await postJson(`http://localhost:${port}/auth/register`, {
        email: testEmail,
        password: testPassword,
      });

      expect(res.status).toBe(201);
      const body = JSON.parse(res.body) as {
        id: number;
        email: string;
        role: string;
      };
      expect(body.id).toBeGreaterThan(0);
      expect(body.email).toBe(testEmail);
      expect(body.role).toBe('user');
    });

    it('register 응답에 password_hash 미노출 — 민감정보 누수 없음', async () => {
      const res = await postJson(`http://localhost:${port}/auth/register`, {
        email: `no-hash-${Date.now()}@example.com`,
        password: testPassword,
      });
      expect(res.body).not.toContain('password_hash');
    });

    it('POST /auth/login → 200 + { access_token } 반환 (JWT 형식)', async () => {
      const res = await postJson(`http://localhost:${port}/auth/login`, {
        email: testEmail,
        password: testPassword,
      });

      expect(res.status).toBe(200);
      const body = JSON.parse(res.body) as { access_token: string };
      expect(typeof body.access_token).toBe('string');
      expect(body.access_token.length).toBeGreaterThan(0);
      // JWT 형식 확인: header.payload.signature (3 부분)
      expect(body.access_token.split('.').length).toBe(3);
      accessToken = body.access_token;
    });

    it('GET /protected + 유효 토큰 → 200 응답', async () => {
      const res = await getJson(
        `http://localhost:${port}/protected`,
        accessToken,
      );
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body) as { message: string };
      expect(body.message).toBe('접근 허용됨');
    });
  });

  // ── AC2: 토큰 미보유 → 401 가드 ────────────────────────────────────────────
  describe('AC2: 토큰 미보유 → 401 응답', () => {
    it('GET /protected 토큰 없음 → 401', async () => {
      const res = await getJson(`http://localhost:${port}/protected`);
      expect(res.status).toBe(401);
    });

    it('GET /protected 빈 Bearer 값 → 401', async () => {
      const parsed = new URL(`http://localhost:${port}/protected`);
      const res = await httpRequest({
        hostname: parsed.hostname,
        port: Number(parsed.port),
        path: parsed.pathname,
        method: 'GET',
        headers: { Authorization: 'Bearer ' },
      });
      expect(res.status).toBe(401);
    });

    it('GET /protected 잘못된 형식 토큰 → 401', async () => {
      const res = await getJson(
        `http://localhost:${port}/protected`,
        'not-a-valid-jwt',
      );
      expect(res.status).toBe(401);
    });
  });

  // ── AC3: 잘못된 자격증명 → 인증 실패 응답 ────────────────────────────────
  describe('AC3: 잘못된 자격증명 → 인증 실패 응답', () => {
    const existingEmail = `e2e-cred-${Date.now()}@example.com`;
    const correctPassword = 'CorrectPass!1';

    beforeAll(async () => {
      // 잘못된 자격증명 테스트용 사용자 등록
      await postJson(`http://localhost:${port}/auth/register`, {
        email: existingEmail,
        password: correctPassword,
      });
    });

    it('POST /auth/login — 존재하지 않는 이메일 → 401', async () => {
      const res = await postJson(`http://localhost:${port}/auth/login`, {
        email: 'nonexistent@example.com',
        password: correctPassword,
      });
      expect(res.status).toBe(401);
    });

    it('POST /auth/login — 잘못된 비밀번호 → 401', async () => {
      const res = await postJson(`http://localhost:${port}/auth/login`, {
        email: existingEmail,
        password: 'WrongPassword!',
      });
      expect(res.status).toBe(401);
    });

    it('POST /auth/login — 401 응답에 비밀번호 정보 미노출', async () => {
      const res = await postJson(`http://localhost:${port}/auth/login`, {
        email: existingEmail,
        password: 'WrongPassword!',
      });
      expect(res.body).not.toContain('password_hash');
      expect(res.body).not.toContain(correctPassword);
    });
  });

  // ── 보조: 중복 이메일 등록 → 409 ────────────────────────────────────────────
  describe('중복 이메일 등록 → 409 Conflict', () => {
    const dupeEmail = `e2e-dupe-${Date.now()}@example.com`;

    it('동일 이메일 첫 번째 등록 → 201', async () => {
      const res = await postJson(`http://localhost:${port}/auth/register`, {
        email: dupeEmail,
        password: 'AnyPass!123',
      });
      expect(res.status).toBe(201);
    });

    it('동일 이메일 두 번째 등록 → 409 Conflict', async () => {
      const res = await postJson(`http://localhost:${port}/auth/register`, {
        email: dupeEmail,
        password: 'AnyPass!123',
      });
      expect(res.status).toBe(409);
    });
  });

  // ── 보조: 앱 인스턴스 정상 부팅 확인 ──────────────────────────────────────
  describe('앱 인스턴스 및 DB 부팅 확인', () => {
    it('TestAuthAppModule (AuthModule + PrismaModule) 정상 생성', () => {
      expect(app).toBeDefined();
    });

    it('HTTP 서버 포트가 0 초과 — 정상 Listen', () => {
      expect(port).toBeGreaterThan(0);
    });

    it('테스트 DB 파일 생성됨 — Prisma $connect 성공 증거', () => {
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    });
  });
});

// ─── 정적 contract 가드: 소스 파일 기반 ─────────────────────────────────────
describe('[BF-685] 인증 모듈 소스 contract 가드', () => {
  const readSrc = (relPath: string): string =>
    fs.readFileSync(path.join(PROJECT_ROOT, relPath), 'utf-8');

  describe('AuthController contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/auth/auth.controller.ts');
    });

    test("@Controller('auth') 데코레이터 존재", () => {
      expect(src).toContain("@Controller('auth')");
    });

    test('POST /auth/register 라우트 데코레이터 존재', () => {
      expect(src).toContain("@Post('register')");
    });

    test('POST /auth/login 라우트 데코레이터 존재', () => {
      expect(src).toContain("@Post('login')");
    });

    test('@HttpCode(HttpStatus.OK) 로그인 응답 코드 명시 존재', () => {
      expect(src).toContain('HttpStatus.OK');
    });
  });

  describe('AuthService contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/auth/auth.service.ts');
    });

    test('register 메서드 존재', () => {
      expect(src).toContain('async register');
    });

    test('login 메서드 존재', () => {
      expect(src).toContain('async login');
    });

    test('RegisterResult 인터페이스 — id, email, role 필드 존재', () => {
      expect(src).toContain('id: number');
      expect(src).toContain('email: string');
      expect(src).toContain('role: string');
    });

    test('LoginResult 인터페이스 — access_token 필드 존재', () => {
      expect(src).toContain('access_token: string');
    });

    test('bcrypt.compare 사용 — 비밀번호 검증 로직 존재', () => {
      expect(src).toContain('bcrypt.compare');
    });

    test('UnauthorizedException throw 존재 — 인증 실패 처리', () => {
      expect(src).toContain('UnauthorizedException');
    });
  });

  describe('AuthModule contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/auth/auth.module.ts');
    });

    test('PassportModule import 존재', () => {
      expect(src).toContain('PassportModule');
    });

    test('JwtModule.registerAsync 존재', () => {
      expect(src).toContain('JwtModule.registerAsync');
    });

    test('JwtAuthGuard exports 존재 — 타 모듈에서 사용 가능', () => {
      expect(src).toContain('JwtAuthGuard');
      expect(src).toContain('exports');
    });

    test('ValidationPipe APP_PIPE 글로벌 등록 존재', () => {
      expect(src).toContain('APP_PIPE');
      expect(src).toContain('ValidationPipe');
    });
  });

  describe('JwtAuthGuard contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/auth/guards/jwt-auth.guard.ts');
    });

    test("AuthGuard('jwt') 확장 존재", () => {
      expect(src).toContain("AuthGuard('jwt')");
    });

    test('@Injectable() 데코레이터 존재', () => {
      expect(src).toContain('@Injectable()');
    });
  });

  describe('JwtStrategy contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/auth/strategies/jwt.strategy.ts');
    });

    test('fromAuthHeaderAsBearerToken 존재 — Authorization Bearer 헤더 파싱', () => {
      expect(src).toContain('fromAuthHeaderAsBearerToken');
    });

    test('ignoreExpiration: false 존재 — 만료 토큰 거부', () => {
      expect(src).toContain('ignoreExpiration: false');
    });

    test('JWT_SECRET 환경변수 참조 존재', () => {
      expect(src).toContain('JWT_SECRET');
    });
  });

  describe('JwtPayload interface contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/auth/interfaces/jwt-payload.interface.ts');
    });

    test('sub, email, role 필드 존재 — JWT payload 구조 보장', () => {
      expect(src).toContain('sub: number');
      expect(src).toContain('email: string');
      expect(src).toContain('role: string');
    });
  });

  describe('Prisma User 모델 contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('prisma/schema.prisma');
    });

    test('User 모델 존재', () => {
      expect(src).toContain('model User');
    });

    test('email 필드 + @unique 제약 존재', () => {
      expect(src).toContain('email');
      expect(src).toContain('@unique');
    });

    test('password_hash 필드 존재 — 평문 비밀번호 저장 금지 구조', () => {
      expect(src).toContain('password_hash');
    });

    test('role 필드 + 기본값 "user" 존재', () => {
      expect(src).toContain('role');
      expect(src).toContain('"user"');
    });
  });

  describe('User 모델 마이그레이션 SQL contract', () => {
    let sql: string;
    beforeAll(() => {
      const migrationsDir = path.join(PROJECT_ROOT, 'prisma/migrations');
      const dirs = fs.readdirSync(migrationsDir).filter((d) => {
        const dirPath = path.join(migrationsDir, d);
        return (
          fs.statSync(dirPath).isDirectory() &&
          fs.existsSync(path.join(dirPath, 'migration.sql'))
        );
      });
      sql = dirs
        .map((d) =>
          fs.readFileSync(
            path.join(migrationsDir, d, 'migration.sql'),
            'utf-8',
          ),
        )
        .join('\n');
    });

    test('User 테이블 생성 SQL 존재', () => {
      expect(sql).toContain('CREATE TABLE "User"');
    });

    test('email UNIQUE 인덱스 존재', () => {
      expect(sql).toContain('CREATE UNIQUE INDEX "User_email_key"');
    });

    test('password_hash 컬럼 존재', () => {
      expect(sql).toContain('"password_hash"');
    });
  });
});
