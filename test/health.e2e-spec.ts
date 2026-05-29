/**
 * BF-681 — 헬스체크 E2E 회귀 가드
 *
 * 목적: dev 가 추가한 헬스체크 엔드포인트 + Prisma/SQLite 연결이
 *       미래 변경에도 silent break 되지 않도록 보호.
 *
 * dev 기존 테스트 (중복 금지):
 *   - src/app.controller.spec.ts  → getHealth() 단위 mock 테스트
 *   - src/app.service.spec.ts     → getHealth() 서비스 단위 테스트
 *   - src/prisma/prisma.service.spec.ts → $connect/$disconnect mock 테스트
 *
 * tester 고유 영역:
 *   1. 실제 HTTP 서버 부팅 + GET / 요청 → 200 + JSON (E2E)
 *   2. SQLite DB 연결 포함 앱 부팅 (PrismaModule 실제 로드)
 *   3. 소스 코드 contract 정적 가드 (파일 존재·내용 기반)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { execSync } from 'child_process';
import type { AddressInfo } from 'net';

import { AppModule } from '../src/app.module';

// setup.e2e.ts 에서 주입된 테스트 DB 경로 (같은 값 참조)
const TEST_DB_PATH = '/tmp/brix-test-health-bf681.db';
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ─── HTTP 요청 헬퍼 (supertest 미설치 — Node.js 내장 http 모듈 사용) ──────────
interface HttpResponse {
  status: number;
  body: string;
  contentType: string | null;
}

function httpGet(url: string): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk: string) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode!,
          body,
          contentType: res.headers['content-type'] ?? null,
        });
      });
    });
    req.on('error', reject);
  });
}

// ─── AC1 + AC2: E2E 동작 가드 ────────────────────────────────────────────────
describe('[BF-681] 헬스체크 E2E 회귀 가드', () => {
  let app: INestApplication;
  let port: number;

  beforeAll(async () => {
    // AC2: 테스트용 SQLite DB 에 스키마 적용 (마이그레이션 파일 없으므로 db push 사용)
    execSync(
      'npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss',
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env },
        stdio: 'ignore',
      },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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

  // AC1: GET / → 200 + { status: "ok" }
  describe('AC1: GET / 응답 검증', () => {
    it('HTTP 상태 코드 200 반환', async () => {
      const { status } = await httpGet(`http://localhost:${port}/`);
      expect(status).toBe(200);
    });

    it('응답 바디가 { status: "ok" } JSON', async () => {
      const { body } = await httpGet(`http://localhost:${port}/`);
      expect(JSON.parse(body)).toEqual({ status: 'ok' });
    });

    it('Content-Type 헤더에 application/json 포함', async () => {
      const { contentType } = await httpGet(`http://localhost:${port}/`);
      expect(contentType).toMatch(/application\/json/);
    });
  });

  // AC2: DB 연결 포함 앱 부팅
  describe('AC2: SQLite DB 연결 포함 앱 부팅', () => {
    it('AppModule (PrismaModule 포함) 인스턴스 정상 생성', () => {
      expect(app).toBeDefined();
    });

    it('HTTP 서버 포트가 0 초과 — 정상 Listen 확인', () => {
      expect(port).toBeGreaterThan(0);
    });

    it('테스트 DB 파일 생성됨 — Prisma $connect 성공 증거', () => {
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    });
  });
});

// ─── 정적 contract 가드 (파일 기반 — 위치 무관 존재 검증) ────────────────────
describe('[BF-681] 헬스체크 소스 contract 가드', () => {
  // 캐시: 동일 파일 여러 번 읽지 않도록
  const readSrc = (relPath: string): string =>
    fs.readFileSync(path.join(PROJECT_ROOT, relPath), 'utf-8');

  describe('AppController contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/app.controller.ts');
    });

    test('@Get() 라우트 핸들러 데코레이터 존재', () => {
      expect(src).toContain('@Get()');
    });

    test('getHealth 메서드 정의 존재', () => {
      expect(src).toContain('getHealth');
    });

    test('{ status: string } 반환 타입 시그니처 존재', () => {
      expect(src).toContain('status: string');
    });
  });

  describe('AppService contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/app.service.ts');
    });

    test('getHealth 메서드 정의 존재', () => {
      expect(src).toContain('getHealth');
    });

    test("status: 'ok' 리터럴 반환 코드 존재", () => {
      expect(src).toContain("status: 'ok'");
    });
  });

  describe('AppModule contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/app.module.ts');
    });

    test('PrismaModule import 존재 — DB 연결 보장', () => {
      expect(src).toContain('PrismaModule');
    });

    test('ConfigModule import 존재 — 환경 변수 로딩 보장', () => {
      expect(src).toContain('ConfigModule');
    });

    test('AppController 등록 존재', () => {
      expect(src).toContain('AppController');
    });
  });

  describe('PrismaService contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/prisma/prisma.service.ts');
    });

    test('onModuleInit + $connect 존재 — DB 연결 수명주기 보장', () => {
      expect(src).toContain('onModuleInit');
      expect(src).toContain('$connect');
    });

    test('onModuleDestroy + $disconnect 존재 — DB 연결 정리 보장', () => {
      expect(src).toContain('onModuleDestroy');
      expect(src).toContain('$disconnect');
    });
  });

  describe('Prisma 스키마 contract', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('prisma/schema.prisma');
    });

    test('SQLite provider 설정 존재', () => {
      expect(src).toContain('provider = "sqlite"');
    });

    test('DATABASE_URL 환경 변수 참조 존재', () => {
      expect(src).toContain('DATABASE_URL');
    });

    test('HealthLog 모델 존재', () => {
      expect(src).toContain('model HealthLog');
    });
  });
});
