/**
 * BF-693 — PostModule E2E 회귀 가드
 *
 * dev·기존 테스트에서 이미 검증된 케이스 (중복 금지):
 *   - test/post.e2e-spec.ts (BF-691)
 *       : 기본 CRUD E2E — 비인증 401 / 인증 201·200·204 / 타인 403
 *       : 슬러그 퍼블릭 조회 (published→200, draft→404, non-existent→404)
 *       : 기본 페이지네이션 (shape 검증, pageSize=2, PUBLISHED only)
 *   - src/posts/posts.service.spec.ts
 *       : ConflictException·NotFoundException·ForbiddenException (Prisma mocked)
 *       : findAll 빈 목록 / PUBLISHED 필터 (mocked)
 *   - src/posts/posts.controller.spec.ts
 *       : page=0 정규화 / invalid page 정규화 (service mocked)
 *
 * BF-693 tester 고유 회귀 가드:
 *   AC1: 소스 계약 — @UseGuards(JwtAuthGuard) 쓰기 3엔드포인트 보호 + PUBLISHED 필터 존재 + PostsModule 등록
 *   AC2: ARCHIVED 포스트 슬러그 조회 → HTTP 404 (BF-691 DRAFT만 검증, ARCHIVED 미커버)
 *   AC2: ARCHIVED 포스트 목록 미포함 검증 (BF-691 미커버)
 *   AC2: 슬러그 중복 생성 → HTTP 409 (BF-691 미커버 E2E — service.spec 단위만 있음)
 *   AC3: 빈 DB 상태 HTTP 응답 — data:[], total:0, totalPages:0 (BF-691 은 포스트 있는 상태만 테스트)
 *   AC3: 범위 초과 페이지(page=9999) → data:[] 반환 (BF-691 미커버)
 */

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { execSync } from 'child_process';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { AddressInfo } from 'net';
import { AppModule } from '../src/app.module';

const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── HTTP 헬퍼 ─────────────────────────────────────────────────────────────────

interface HttpResponse {
  status: number;
  body: string;
}

function httpRequest(
  method: string,
  url: string,
  data?: object,
  token?: string,
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const bodyStr = data ? JSON.stringify(data) : '';
    const urlObj = new URL(url);
    const headers: Record<string, string | number> = {
      'Content-Type': 'application/json',
    };
    if (bodyStr) {
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: urlObj.hostname,
        port: parseInt(urlObj.port, 10),
        path: urlObj.pathname + urlObj.search,
        method,
        headers,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk: Buffer) => {
          responseBody += chunk.toString();
        });
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: responseBody });
        });
      },
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function httpPost(
  url: string,
  data: object,
  token?: string,
): Promise<HttpResponse> {
  return httpRequest('POST', url, data, token);
}

function httpGet(url: string): Promise<HttpResponse> {
  return httpRequest('GET', url);
}

// ── AC1: 소스 계약 가드 (정적) ────────────────────────────────────────────────
// 목적: 핵심 보안·필터 코드가 silent 삭제/변경되지 않도록 contract 를 고정한다.

describe('[BF-693] AC1 — PostModule 소스 계약 가드', () => {
  const readSrc = (relPath: string): string =>
    fs.readFileSync(path.join(PROJECT_ROOT, relPath), 'utf-8');

  // ── posts.controller.ts — 쓰기 엔드포인트 인증 가드 계약 ─────────────────

  describe('posts.controller.ts — @UseGuards(JwtAuthGuard) 계약', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/posts/posts.controller.ts');
    });

    test('JwtAuthGuard import 존재 — 가드 의존성 보존', () => {
      expect(src).toContain('JwtAuthGuard');
    });

    test('@UseGuards(JwtAuthGuard) 가 3회 이상 존재 — POST·PATCH·DELETE 모두 보호', () => {
      const matches = src.match(/@UseGuards\(JwtAuthGuard\)/g) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });

    test('GET /posts 퍼블릭 엔드포인트(findAll) 에 @UseGuards 없음 — 인증 없이 조회 가능', () => {
      // @Get() 데코레이터(목록) 이후 async findAll 앞 블록에 @UseGuards 미존재 검증
      const getListIdx = src.indexOf('@Get()\n');
      const findAllIdx = src.indexOf('async findAll(', getListIdx);
      const block = src.slice(getListIdx, findAllIdx);
      expect(block).not.toContain('@UseGuards');
    });

    test('GET /posts/:slug 퍼블릭 엔드포인트(findBySlug) 에 @UseGuards 없음', () => {
      const getSlugIdx = src.indexOf("@Get(':slug')");
      const findBySlugIdx = src.indexOf('async findBySlug(', getSlugIdx);
      const block = src.slice(getSlugIdx, findBySlugIdx);
      expect(block).not.toContain('@UseGuards');
    });
  });

  // ── posts.service.ts — PUBLISHED 필터 계약 ───────────────────────────────

  describe('posts.service.ts — findPublishedBySlug PUBLISHED 필터 계약', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/posts/posts.service.ts');
    });

    test('findPublishedBySlug 메서드 내에 status: PublishStatus.PUBLISHED 필터 존재', () => {
      const methodStart = src.indexOf('findPublishedBySlug');
      const methodEnd = src.indexOf('\n  }', methodStart);
      const methodBody = src.slice(methodStart, methodEnd);
      expect(methodBody).toContain('status: PublishStatus.PUBLISHED');
    });

    test('findAll 메서드 내에 PublishStatus.PUBLISHED 필터 존재 — 목록도 발행만 노출', () => {
      const methodStart = src.indexOf('async findAll(');
      const methodEnd = src.indexOf('\n  }', methodStart);
      const methodBody = src.slice(methodStart, methodEnd);
      expect(methodBody).toContain('PublishStatus.PUBLISHED');
    });
  });

  // ── app.module.ts — PostsModule 등록 계약 ────────────────────────────────

  describe('app.module.ts — PostsModule 등록 계약', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/app.module.ts');
    });

    test('PostsModule import 선언 존재', () => {
      expect(src).toContain("from './posts/posts.module'");
    });

    test('@Module imports 배열에 PostsModule 포함', () => {
      const moduleBlock = src.slice(
        src.indexOf('@Module('),
        src.indexOf('export class AppModule'),
      );
      expect(moduleBlock).toContain('PostsModule');
    });
  });

  // ── posts.module.ts — PostsService export + AuthModule 의존성 계약 ────────

  describe('posts.module.ts — 모듈 구성 계약', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/posts/posts.module.ts');
    });

    test('AuthModule import 존재 — JwtAuthGuard 의존성 보존', () => {
      expect(src).toContain('AuthModule');
    });

    test('exports 에 PostsService 존재 — 외부 모듈 사용 가능성 보장', () => {
      expect(src).toContain('PostsService');
    });
  });
});

// ── AC2: ARCHIVED 슬러그·슬러그 중복 E2E 회귀 가드 ──────────────────────────
// BF-691 이 검증하지 않은 두 케이스를 HTTP 레벨에서 고정한다.

describe('[BF-693] AC2 — ARCHIVED 슬러그·슬러그 중복 E2E 회귀 가드', () => {
  const TEST_DB = '/tmp/brix-test-bf693-ac2.db';
  let app: INestApplication;
  let port: number;
  let accessToken: string;

  const TEST_USER = {
    email: 'bf693-ac2@example.com',
    password: 'testpass8',
  };

  beforeAll(async () => {
    process.env['DATABASE_URL'] = `file:${TEST_DB}`;
    process.env['JWT_SECRET'] = 'bf693-ac2-regression-jwt-secret-32chars!!';

    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;

    await httpPost(`http://localhost:${port}/auth/register`, TEST_USER);
    const loginRes = await httpPost(
      `http://localhost:${port}/auth/login`,
      TEST_USER,
    );
    accessToken = (JSON.parse(loginRes.body) as { access_token: string })
      .access_token;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  // AC2-1: ARCHIVED 포스트 → 슬러그 조회 404 + 목록 미포함 ─────────────────

  describe('ARCHIVED 포스트 — 슬러그 퍼블릭 조회·목록 미노출', () => {
    beforeAll(async () => {
      // ARCHIVED 상태 포스트 생성
      await httpPost(
        `http://localhost:${port}/posts`,
        {
          title: 'Archived Post BF-693',
          slug: 'archived-post-bf693',
          status: 'ARCHIVED',
        },
        accessToken,
      );
    });

    test('ARCHIVED 포스트 슬러그 퍼블릭 조회 — HTTP 404 반환', async () => {
      const { status } = await httpGet(
        `http://localhost:${port}/posts/archived-post-bf693`,
      );
      expect(status).toBe(404);
    });

    test('ARCHIVED 포스트는 GET /posts 목록에 미포함', async () => {
      const { body } = await httpGet(`http://localhost:${port}/posts`);
      const parsed = JSON.parse(body) as { data: { slug: string }[] };
      const slugs = parsed.data.map((p) => p.slug);
      expect(slugs).not.toContain('archived-post-bf693');
    });
  });

  // AC2-2: 슬러그 중복 생성 → HTTP 409 ────────────────────────────────────
  // posts.service.spec.ts 의 ConflictException 은 Prisma mocked 단위 테스트.
  // 이 가드는 실 DB + NestJS 앱 전체 흐름에서 409 가 HTTP 레벨에 도달함을 고정한다.

  describe('슬러그 중복 생성 — HTTP 409', () => {
    beforeAll(async () => {
      // 원본 포스트 생성
      await httpPost(
        `http://localhost:${port}/posts`,
        { title: '원본 포스트 BF-693', slug: 'dup-slug-bf693' },
        accessToken,
      );
    });

    test('이미 존재하는 slug 로 포스트 생성 시도 — HTTP 409 반환', async () => {
      const { status } = await httpPost(
        `http://localhost:${port}/posts`,
        { title: '중복 슬러그 포스트', slug: 'dup-slug-bf693' },
        accessToken,
      );
      expect(status).toBe(409);
    });

    test('409 응답 바디에 statusCode:409 포함', async () => {
      const { body } = await httpPost(
        `http://localhost:${port}/posts`,
        { title: '중복 슬러그 재시도', slug: 'dup-slug-bf693' },
        accessToken,
      );
      const parsed = JSON.parse(body) as { statusCode: number };
      expect(parsed.statusCode).toBe(409);
    });
  });
});

// ── AC3: 페이지네이션 경계 E2E 회귀 가드 ─────────────────────────────────────
// BF-691 은 포스트가 이미 생성된 상태의 페이지네이션만 검증.
// 이 가드는 빈 DB 상태 + 범위 초과 페이지 두 경계를 HTTP 레벨에서 고정한다.

describe('[BF-693] AC3 — 페이지네이션 경계 E2E 회귀 가드', () => {
  const TEST_DB = '/tmp/brix-test-bf693-ac3.db';
  let app: INestApplication;
  let port: number;
  let accessToken: string;

  const TEST_USER = {
    email: 'bf693-ac3@example.com',
    password: 'testpass8',
  };

  beforeAll(async () => {
    process.env['DATABASE_URL'] = `file:${TEST_DB}`;
    process.env['JWT_SECRET'] = 'bf693-ac3-pagination-jwt-secret-32chars!!';

    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;

    await httpPost(`http://localhost:${port}/auth/register`, TEST_USER);
    const loginRes = await httpPost(
      `http://localhost:${port}/auth/login`,
      TEST_USER,
    );
    accessToken = (JSON.parse(loginRes.body) as { access_token: string })
      .access_token;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  // AC3-1: 빈 목록 상태 — 포스트 0건 시 HTTP 응답 구조 ──────────────────────
  // 이 describe 는 posts 생성 beforeAll 이 없으므로 빈 DB 상태에서 실행된다.
  // Jest 실행 순서 보장: 중첩 describe 의 beforeAll 은 해당 describe 직전에 실행되므로
  // "빈 목록" 케이스는 "범위 초과 페이지" describe 의 beforeAll(포스트 생성) 이전에 실행된다.

  describe('빈 목록 — PUBLISHED 포스트 0건 상태', () => {
    test('GET /posts — data:[], total:0, totalPages:0 반환', async () => {
      const { status, body } = await httpGet(`http://localhost:${port}/posts`);
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as {
        data: unknown[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
      expect(parsed.data).toEqual([]);
      expect(parsed.total).toBe(0);
      expect(parsed.totalPages).toBe(0);
      expect(parsed.page).toBe(1);
      expect(parsed.pageSize).toBe(10);
    });

    test('빈 목록에서 pageSize=1 파라미터도 data:[] 반환', async () => {
      const { body } = await httpGet(
        `http://localhost:${port}/posts?page=1&pageSize=1`,
      );
      const parsed = JSON.parse(body) as { data: unknown[]; total: number };
      expect(parsed.data).toEqual([]);
      expect(parsed.total).toBe(0);
    });
  });

  // AC3-2: 범위 초과 페이지(page=9999) — 마지막 페이지 이후 data:[] ──────────

  describe('범위 초과 페이지 (page=9999)', () => {
    beforeAll(async () => {
      // PUBLISHED 포스트 2건 생성 — 실제 데이터가 있을 때 page=9999 검증
      await httpPost(
        `http://localhost:${port}/posts`,
        { title: '발행 포스트 A', slug: 'pub-a-bf693', status: 'PUBLISHED' },
        accessToken,
      );
      await httpPost(
        `http://localhost:${port}/posts`,
        { title: '발행 포스트 B', slug: 'pub-b-bf693', status: 'PUBLISHED' },
        accessToken,
      );
    });

    test('page=9999 요청 시 data:[] 반환 — 마지막 페이지 이후 빈 배열 보장', async () => {
      const { status, body } = await httpGet(
        `http://localhost:${port}/posts?page=9999&pageSize=10`,
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as {
        data: unknown[];
        total: number;
        page: number;
      };
      expect(parsed.data).toEqual([]);
      expect(parsed.total).toBe(2); // 전체 2건은 그대로 유지
      expect(parsed.page).toBe(9999);
    });

    test('page=1 은 정상 데이터 반환 — 범위 초과가 다른 페이지 영향 없음', async () => {
      const { body } = await httpGet(
        `http://localhost:${port}/posts?page=1&pageSize=10`,
      );
      const parsed = JSON.parse(body) as { data: unknown[]; total: number };
      expect(parsed.total).toBe(2);
      expect(parsed.data).toHaveLength(2);
    });

    test('pageSize > total 요청 시 data.length <= total 보장', async () => {
      const { status, body } = await httpGet(
        `http://localhost:${port}/posts?pageSize=100`,
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as { data: unknown[]; total: number };
      expect(parsed.data.length).toBeLessThanOrEqual(parsed.total);
    });
  });
});
