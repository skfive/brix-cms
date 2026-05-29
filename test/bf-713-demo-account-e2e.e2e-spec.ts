/**
 * BF-713 — 가입/로그인/로그아웃/post/pages + demo 계정 E2E + API 통합 회귀 가드
 *
 * 기존 테스트 커버리지 (중복 제외):
 *   BF-689: register/login E2E, JWT 형식, 공유 유틸 경계값
 *   BF-691: Post CRUD E2E (생성/수정/삭제/슬러그), 페이지네이션 기본형
 *   BF-693: Post 회귀 (ARCHIVED 404, 슬러그 중복 409, 빈 DB, 범위 초과 페이지)
 *   BF-697: Page CRUD E2E (생성/수정/삭제/슬러그)
 *   BF-699: Comment E2E (댓글 작성/목록 조회, 비인증 401)
 *   BF-701: Comment 회귀 가드
 *
 * BF-713 고유 커버리지:
 *   AC1: 단일 사용자의 가입→로그인→post 작성→로그아웃(토큰 폐기) 연속 시나리오
 *        — 4단계를 하나의 it 으로 묶어 전체 흐름 green 을 보장
 *   AC2: demo 계정 (demo@brix-cms.local / Demo1234!) 자격증명으로
 *        posts / pages / comments 모든 API happy path cover
 *        + 모든 보호 엔드포인트 인증 없이 401 cover
 *        + 잘못된 자격증명 로그인 시도 401 cover
 *   AC3: package.json 에 test:e2e / test:api 스크립트 존재
 *        + README.md 에 테스트 실행 가이드 존재 (정적 가드)
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
const TEST_DB_PATH = '/tmp/brix-test-bf713-demo-account.db';

// demo 계정 자격증명 (prisma/seed.ts 와 동일)
const DEMO_EMAIL = 'demo@brix-cms.local';
const DEMO_PASSWORD = 'Demo1234!';

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

function httpGet(url: string, token?: string): Promise<HttpResponse> {
  return httpRequest('GET', url, undefined, token);
}

function httpPost(
  url: string,
  data: object,
  token?: string,
): Promise<HttpResponse> {
  return httpRequest('POST', url, data, token);
}

function httpPatch(
  url: string,
  data: object,
  token?: string,
): Promise<HttpResponse> {
  return httpRequest('PATCH', url, data, token);
}

function httpDelete(url: string, token?: string): Promise<HttpResponse> {
  return httpRequest('DELETE', url, undefined, token);
}

// ── 앱 인스턴스 (전체 test suite 공유) ───────────────────────────────────────

let app: INestApplication;
let port: number;
let demoToken: string; // demo 계정 JWT

beforeAll(async () => {
  process.env['DATABASE_URL'] = `file:${TEST_DB_PATH}`;
  process.env['JWT_SECRET'] = 'bf713-demo-e2e-test-jwt-secret-min32chars!!!';

  // Prisma 마이그레이션 적용
  execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
    cwd: PROJECT_ROOT,
    env: { ...process.env },
    stdio: 'ignore',
  });

  // NestJS 앱 부팅
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();
  await app.listen(0);
  port = (app.getHttpServer().address() as AddressInfo).port;

  // demo 계정 생성 (테스트 자급자족 — seed 스크립트에 의존하지 않음)
  await httpPost(`http://localhost:${port}/auth/register`, {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  const loginRes = await httpPost(`http://localhost:${port}/auth/login`, {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  const loginBody = JSON.parse(loginRes.body) as { access_token: string };
  demoToken = loginBody.access_token;
}, 60_000);

afterAll(async () => {
  await app?.close();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AC1: 가입→로그인→post 작성→로그아웃 전체 시나리오
// ─────────────────────────────────────────────────────────────────────────────

describe('[BF-713] AC1: 가입→로그인→post 작성→로그아웃 전체 시나리오', () => {
  /**
   * 4단계 연속 시나리오를 단일 it 으로 묶어 전체 흐름을 보장.
   * JWT 는 stateless — "로그아웃" = 클라이언트가 토큰 폐기.
   * 토큰 없이 보호 엔드포인트를 호출하면 서버가 401 을 반환함을 검증.
   */
  it('4단계 연속 시나리오 전체 green', async () => {
    const base = `http://localhost:${port}`;

    // ── 1단계: 신규 회원가입 ─────────────────────────────────────────────────
    const regRes = await httpPost(`${base}/auth/register`, {
      email: 'bf713-lifecycle@test.local',
      password: 'lifecycle8!',
    });
    expect(regRes.status).toBe(201);
    const regBody = JSON.parse(regRes.body) as {
      id: number;
      email: string;
      role: string;
    };
    expect(regBody.id).toBeGreaterThan(0);
    expect(regBody.email).toBe('bf713-lifecycle@test.local');
    expect(regBody.role).toBe('user');

    // ── 2단계: 로그인 → access_token 획득 ───────────────────────────────────
    const loginRes = await httpPost(`${base}/auth/login`, {
      email: 'bf713-lifecycle@test.local',
      password: 'lifecycle8!',
    });
    expect(loginRes.status).toBe(200);
    const loginBody = JSON.parse(loginRes.body) as { access_token: string };
    const token = loginBody.access_token;
    // JWT 구조 검증: header.payload.signature
    expect(token.split('.').length).toBe(3);

    // ── 3단계: 인증 토큰으로 post 작성 → 201 ────────────────────────────────
    const postRes = await httpPost(
      `${base}/posts`,
      { title: 'BF-713 생명주기 포스트', slug: 'bf713-lifecycle-post' },
      token,
    );
    expect(postRes.status).toBe(201);
    const postBody = JSON.parse(postRes.body) as { id: number; status: string };
    expect(postBody.id).toBeGreaterThan(0);
    expect(postBody.status).toBe('DRAFT');

    // ── 4단계: 로그아웃 시뮬레이션 ──────────────────────────────────────────
    // 클라이언트가 토큰 폐기 → 이후 보호 엔드포인트 접근 시 401
    // (토큰 미전달 = 세션 종료 시나리오)
    const postId = postBody.id;
    const afterLogoutRes = await httpPatch(
      `${base}/posts/${postId}`,
      { title: '로그아웃 후 수정 시도' },
      // token 을 전달하지 않음 = 토큰 폐기
    );
    expect(afterLogoutRes.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2: demo 계정 API 전체 커버리지
// ─────────────────────────────────────────────────────────────────────────────

describe('[BF-713] AC2: demo 계정 (demo@brix-cms.local) API 전체 커버리지', () => {
  // ── 인증 흐름 ───────────────────────────────────────────────────────────────

  describe('인증 흐름 — happy path + 실패 케이스', () => {
    it('demo 계정 로그인 성공 → HTTP 200 + access_token', async () => {
      const { status, body } = await httpPost(
        `http://localhost:${port}/auth/login`,
        { email: DEMO_EMAIL, password: DEMO_PASSWORD },
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as { access_token: string };
      expect(typeof parsed.access_token).toBe('string');
    });

    it('잘못된 비밀번호로 로그인 → HTTP 401', async () => {
      const { status } = await httpPost(
        `http://localhost:${port}/auth/login`,
        { email: DEMO_EMAIL, password: 'WrongPassword1!' },
      );
      expect(status).toBe(401);
    });

    it('존재하지 않는 이메일로 로그인 → HTTP 401', async () => {
      const { status } = await httpPost(
        `http://localhost:${port}/auth/login`,
        { email: 'nobody@bf713.test', password: DEMO_PASSWORD },
      );
      expect(status).toBe(401);
    });

    it('이미 등록된 이메일로 재가입 시도 → HTTP 409 (ConflictException)', async () => {
      const { status } = await httpPost(
        `http://localhost:${port}/auth/register`,
        { email: DEMO_EMAIL, password: DEMO_PASSWORD },
      );
      expect(status).toBe(409);
    });
  });

  // ── Post API ────────────────────────────────────────────────────────────────

  describe('Post API — demo 계정 happy path', () => {
    let publishedPostSlug: string;
    let createdPostId: number;

    beforeAll(async () => {
      // PUBLISHED 포스트 생성 (슬러그 퍼블릭 조회 테스트용)
      const res = await httpPost(
        `http://localhost:${port}/posts`,
        {
          title: 'BF-713 Demo Published Post',
          slug: 'bf713-demo-published-post',
          status: 'PUBLISHED',
        },
        demoToken,
      );
      const body = JSON.parse(res.body) as { id: number; slug: string };
      publishedPostSlug = body.slug;
      createdPostId = body.id;
    });

    it('demo 계정으로 POST /posts → HTTP 201 + id/author 반환', async () => {
      const { status, body } = await httpPost(
        `http://localhost:${port}/posts`,
        { title: 'Demo Draft Post BF-713', slug: 'bf713-demo-draft-post' },
        demoToken,
      );
      expect(status).toBe(201);
      const parsed = JSON.parse(body) as {
        id: number;
        status: string;
        author: { email: string };
      };
      expect(parsed.id).toBeGreaterThan(0);
      expect(parsed.status).toBe('DRAFT');
      expect(parsed.author.email).toBe(DEMO_EMAIL);
    });

    it('GET /posts — 인증 없이 발행 포스트 목록 → HTTP 200 + 페이지네이션 shape', async () => {
      const { status, body } = await httpGet(`http://localhost:${port}/posts`);
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as {
        data: unknown[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
      expect(Array.isArray(parsed.data)).toBe(true);
      expect(typeof parsed.total).toBe('number');
      expect(typeof parsed.totalPages).toBe('number');
    });

    it('GET /posts/:slug — demo 계정의 발행 포스트 퍼블릭 조회 → HTTP 200', async () => {
      const { status, body } = await httpGet(
        `http://localhost:${port}/posts/${publishedPostSlug}`,
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as {
        slug: string;
        author: { email: string };
      };
      expect(parsed.slug).toBe(publishedPostSlug);
      expect(parsed.author.email).toBe(DEMO_EMAIL);
    });

    it('demo 계정으로 PATCH /posts/:id → HTTP 200 (작성자 수정)', async () => {
      const { status, body } = await httpPatch(
        `http://localhost:${port}/posts/${createdPostId}`,
        { title: 'BF-713 Demo Updated Post' },
        demoToken,
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as { title: string };
      expect(parsed.title).toBe('BF-713 Demo Updated Post');
    });

    it('demo 계정으로 DELETE /posts/:id → HTTP 204 (작성자 삭제)', async () => {
      // 삭제 전용 포스트 생성
      const createRes = await httpPost(
        `http://localhost:${port}/posts`,
        { title: 'BF-713 Delete Target', slug: 'bf713-delete-target-demo' },
        demoToken,
      );
      const { id: deleteId } = JSON.parse(createRes.body) as { id: number };

      const { status } = await httpDelete(
        `http://localhost:${port}/posts/${deleteId}`,
        demoToken,
      );
      expect(status).toBe(204);
    });
  });

  // ── Page API ────────────────────────────────────────────────────────────────

  describe('Page API — demo 계정 happy path', () => {
    let publishedPageSlug: string;
    let createdPageId: number;

    beforeAll(async () => {
      // PUBLISHED 페이지 생성 (슬러그 퍼블릭 조회 테스트용)
      const res = await httpPost(
        `http://localhost:${port}/pages`,
        {
          title: 'BF-713 Demo Published Page',
          slug: 'bf713-demo-published-page',
          status: 'PUBLISHED',
        },
        demoToken,
      );
      const body = JSON.parse(res.body) as { id: number; slug: string };
      publishedPageSlug = body.slug;
      createdPageId = body.id;
    });

    it('demo 계정으로 POST /pages → HTTP 201 + id 반환', async () => {
      const { status, body } = await httpPost(
        `http://localhost:${port}/pages`,
        { title: 'Demo Draft Page BF-713', slug: 'bf713-demo-draft-page' },
        demoToken,
      );
      expect(status).toBe(201);
      const parsed = JSON.parse(body) as { id: number; status: string };
      expect(parsed.id).toBeGreaterThan(0);
      expect(parsed.status).toBe('DRAFT');
    });

    it('GET /pages/:slug — demo 계정의 발행 페이지 퍼블릭 조회 → HTTP 200', async () => {
      const { status, body } = await httpGet(
        `http://localhost:${port}/pages/${publishedPageSlug}`,
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as {
        slug: string;
        author: { email: string };
      };
      expect(parsed.slug).toBe(publishedPageSlug);
      expect(parsed.author.email).toBe(DEMO_EMAIL);
    });

    it('demo 계정으로 PATCH /pages/:id → HTTP 200 (작성자 수정)', async () => {
      const { status, body } = await httpPatch(
        `http://localhost:${port}/pages/${createdPageId}`,
        { title: 'BF-713 Demo Updated Page' },
        demoToken,
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as { title: string };
      expect(parsed.title).toBe('BF-713 Demo Updated Page');
    });

    it('demo 계정으로 DELETE /pages/:id → HTTP 204 (작성자 삭제)', async () => {
      // 삭제 전용 페이지 생성
      const createRes = await httpPost(
        `http://localhost:${port}/pages`,
        {
          title: 'BF-713 Page Delete Target',
          slug: 'bf713-delete-target-page-demo',
        },
        demoToken,
      );
      const { id: deleteId } = JSON.parse(createRes.body) as { id: number };

      const { status } = await httpDelete(
        `http://localhost:${port}/pages/${deleteId}`,
        demoToken,
      );
      expect(status).toBe(204);
    });
  });

  // ── Comment API ─────────────────────────────────────────────────────────────

  describe('Comment API — demo 계정 happy path', () => {
    let commentTargetPostId: number;

    beforeAll(async () => {
      // 댓글을 달 PUBLISHED 포스트 생성
      const res = await httpPost(
        `http://localhost:${port}/posts`,
        {
          title: 'BF-713 Comment Test Post',
          slug: 'bf713-comment-test-post',
          status: 'PUBLISHED',
        },
        demoToken,
      );
      const body = JSON.parse(res.body) as { id: number };
      commentTargetPostId = body.id;
    });

    it('demo 계정으로 POST /posts/:postId/comments → HTTP 201 + content/author', async () => {
      const { status, body } = await httpPost(
        `http://localhost:${port}/posts/${commentTargetPostId}/comments`,
        { content: 'BF-713 demo 계정 테스트 댓글' },
        demoToken,
      );
      expect(status).toBe(201);
      const parsed = JSON.parse(body) as {
        id: number;
        content: string;
        author: { email: string };
      };
      expect(parsed.id).toBeGreaterThan(0);
      expect(parsed.content).toBe('BF-713 demo 계정 테스트 댓글');
      expect(parsed.author.email).toBe(DEMO_EMAIL);
    });

    it('GET /posts/:postId/comments — 인증 없이 댓글 목록 → HTTP 200 + 배열', async () => {
      const { status, body } = await httpGet(
        `http://localhost:${port}/posts/${commentTargetPostId}/comments`,
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as unknown[];
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    });
  });

  // ── 모든 보호 엔드포인트 — 인증 없이 401 ────────────────────────────────────

  describe('모든 보호 엔드포인트 — 인증 없이 401', () => {
    it('POST /posts — 토큰 없음 → HTTP 401', async () => {
      const { status } = await httpPost(`http://localhost:${port}/posts`, {
        title: '비인증 포스트 시도',
      });
      expect(status).toBe(401);
    });

    it('PATCH /posts/:id — 토큰 없음 → HTTP 401', async () => {
      const { status } = await httpPatch(
        `http://localhost:${port}/posts/999999`,
        { title: '비인증 수정 시도' },
      );
      expect(status).toBe(401);
    });

    it('DELETE /posts/:id — 토큰 없음 → HTTP 401', async () => {
      const { status } = await httpDelete(
        `http://localhost:${port}/posts/999999`,
      );
      expect(status).toBe(401);
    });

    it('POST /pages — 토큰 없음 → HTTP 401', async () => {
      const { status } = await httpPost(`http://localhost:${port}/pages`, {
        title: '비인증 페이지 시도',
      });
      expect(status).toBe(401);
    });

    it('PATCH /pages/:id — 토큰 없음 → HTTP 401', async () => {
      const { status } = await httpPatch(
        `http://localhost:${port}/pages/999999`,
        { title: '비인증 페이지 수정 시도' },
      );
      expect(status).toBe(401);
    });

    it('DELETE /pages/:id — 토큰 없음 → HTTP 401', async () => {
      const { status } = await httpDelete(
        `http://localhost:${port}/pages/999999`,
      );
      expect(status).toBe(401);
    });

    it('POST /posts/:postId/comments — 토큰 없음 → HTTP 401', async () => {
      const { status } = await httpPost(
        `http://localhost:${port}/posts/1/comments`,
        { content: '비인증 댓글 시도' },
      );
      expect(status).toBe(401);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3: package.json scripts + README 테스트 가이드 정적 가드
// ─────────────────────────────────────────────────────────────────────────────

describe('[BF-713] AC3: package.json scripts + README 테스트 가이드 정적 가드', () => {
  const pkgPath = path.join(PROJECT_ROOT, 'package.json');
  const readmePath = path.join(PROJECT_ROOT, 'README.md');

  let pkg: { scripts: Record<string, string> };
  let readme: string;

  beforeAll(() => {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      scripts: Record<string, string>;
    };
    readme = fs.readFileSync(readmePath, 'utf-8');
  });

  it('package.json 에 test:e2e 스크립트 존재', () => {
    expect(pkg.scripts['test:e2e']).toBeDefined();
    expect(typeof pkg.scripts['test:e2e']).toBe('string');
  });

  it('package.json 에 test:api 스크립트 존재', () => {
    expect(pkg.scripts['test:api']).toBeDefined();
    expect(typeof pkg.scripts['test:api']).toBe('string');
  });

  it('test:e2e 스크립트가 jest-e2e.json 설정 참조', () => {
    expect(pkg.scripts['test:e2e']).toContain('jest-e2e.json');
  });

  it('test:api 스크립트가 jest-e2e.json 설정 참조', () => {
    expect(pkg.scripts['test:api']).toContain('jest-e2e.json');
  });

  it('README.md 에 test:e2e 실행 가이드 존재', () => {
    expect(readme).toContain('test:e2e');
  });

  it('README.md 에 test:api 실행 가이드 존재', () => {
    expect(readme).toContain('test:api');
  });

  it('README.md 에 demo 계정 이메일 존재 — demo@brix-cms.local', () => {
    expect(readme).toContain('demo@brix-cms.local');
  });
});
