/**
 * BF-691 — PostModule CRUD + 슬러그 퍼블릭 조회 E2E 테스트
 *
 * AC1: 인증된 사용자 쓰기(생성/수정/삭제) 정상 처리 + 비인증 쓰기 401
 * AC2: 발행 포스트 슬러그 퍼블릭 조회 + 미발행 노출 안 됨
 * AC3: 목록 페이지네이션 동작 + app.module.ts PostModule 등록 확인
 */

import * as fs from 'fs';
import * as http from 'http';
import { execSync } from 'child_process';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { AddressInfo } from 'net';

import { AppModule } from '../src/app.module';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_DB_PATH = '/tmp/brix-test-bf691-post-module.db';

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

function httpGet(url: string, token?: string): Promise<HttpResponse> {
  return httpRequest('GET', url, undefined, token);
}

// ── E2E 테스트 ────────────────────────────────────────────────────────────────

describe('[BF-691] PostModule CRUD + 슬러그 퍼블릭 조회 E2E', () => {
  let app: INestApplication;
  let port: number;
  let accessToken: string;
  let anotherToken: string; // 다른 사용자 토큰 (ForbiddenException 검증용)

  const TEST_USER = {
    email: 'bf691-author@example.com',
    password: 'testpass8',
  };
  const OTHER_USER = {
    email: 'bf691-other@example.com',
    password: 'testpass8',
  };

  beforeAll(async () => {
    process.env['DATABASE_URL'] = `file:${TEST_DB_PATH}`;
    process.env['JWT_SECRET'] =
      'bf691-post-module-test-jwt-secret-min32chars!!';

    // Prisma 마이그레이션 배포
    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
      stdio: 'ignore',
    });

    // NestJS 앱 부팅 (AppModule 에 PostModule 포함)
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;

    // 테스트 계정 생성 + 토큰 획득
    await httpPost(`http://localhost:${port}/auth/register`, TEST_USER);
    const loginRes = await httpPost(
      `http://localhost:${port}/auth/login`,
      TEST_USER,
    );
    const loginBody = JSON.parse(loginRes.body) as { access_token: string };
    accessToken = loginBody.access_token;

    await httpPost(`http://localhost:${port}/auth/register`, OTHER_USER);
    const otherLoginRes = await httpPost(
      `http://localhost:${port}/auth/login`,
      OTHER_USER,
    );
    const otherLoginBody = JSON.parse(otherLoginRes.body) as {
      access_token: string;
    };
    anotherToken = otherLoginBody.access_token;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  // ── AC1: 인증 CRUD ──────────────────────────────────────────────────────────

  describe('AC1: 쓰기 엔드포인트 인증 보호', () => {
    describe('POST /posts (포스트 생성)', () => {
      it('인증 토큰 없으면 HTTP 401', async () => {
        const { status } = await httpPost(`http://localhost:${port}/posts`, {
          title: '비인증 포스트',
        });
        expect(status).toBe(401);
      });

      it('인증 토큰 있으면 HTTP 201 + PostResponse 반환', async () => {
        const { status, body } = await httpPost(
          `http://localhost:${port}/posts`,
          { title: 'BF-691 테스트 포스트', slug: 'bf691-test-post' },
          accessToken,
        );
        expect(status).toBe(201);
        const parsed = JSON.parse(body) as {
          id: number;
          title: string;
          slug: string;
          status: string;
          author: { email: string };
        };
        expect(parsed.id).toBeGreaterThan(0);
        expect(parsed.title).toBe('BF-691 테스트 포스트');
        expect(parsed.slug).toBe('bf691-test-post');
        expect(parsed.status).toBe('DRAFT');
        expect(parsed.author.email).toBe(TEST_USER.email);
      });

      it('slug 미지정 시 title 에서 자동 생성', async () => {
        const { status, body } = await httpPost(
          `http://localhost:${port}/posts`,
          { title: 'Auto Slug Post' },
          accessToken,
        );
        expect(status).toBe(201);
        const parsed = JSON.parse(body) as { slug: string };
        expect(parsed.slug).toBe('auto-slug-post');
      });

      it('title 누락 시 HTTP 400 (ValidationPipe)', async () => {
        const { status } = await httpPost(
          `http://localhost:${port}/posts`,
          { content: '제목 없는 포스트' },
          accessToken,
        );
        expect(status).toBe(400);
      });
    });

    describe('PATCH /posts/:id (포스트 수정)', () => {
      let postId: number;

      beforeAll(async () => {
        const { body } = await httpPost(
          `http://localhost:${port}/posts`,
          { title: 'PATCH 테스트 포스트', slug: 'patch-test-post' },
          accessToken,
        );
        const parsed = JSON.parse(body) as { id: number };
        postId = parsed.id;
      });

      it('인증 토큰 없으면 HTTP 401', async () => {
        const { status } = await httpPatch(
          `http://localhost:${port}/posts/${postId}`,
          { title: '수정 시도' },
        );
        expect(status).toBe(401);
      });

      it('인증 토큰 있으면 수정 성공 HTTP 200', async () => {
        const { status, body } = await httpPatch(
          `http://localhost:${port}/posts/${postId}`,
          { title: '수정된 제목' },
          accessToken,
        );
        expect(status).toBe(200);
        const parsed = JSON.parse(body) as { title: string };
        expect(parsed.title).toBe('수정된 제목');
      });

      it('다른 사용자가 수정하면 HTTP 403', async () => {
        const { status } = await httpPatch(
          `http://localhost:${port}/posts/${postId}`,
          { title: '타인 수정 시도' },
          anotherToken,
        );
        expect(status).toBe(403);
      });
    });

    describe('DELETE /posts/:id (포스트 삭제)', () => {
      let deleteTargetId: number;

      beforeAll(async () => {
        const { body } = await httpPost(
          `http://localhost:${port}/posts`,
          { title: '삭제용 포스트', slug: 'delete-target-post' },
          accessToken,
        );
        const parsed = JSON.parse(body) as { id: number };
        deleteTargetId = parsed.id;
      });

      it('인증 토큰 없으면 HTTP 401', async () => {
        const { status } = await httpDelete(
          `http://localhost:${port}/posts/${deleteTargetId}`,
        );
        expect(status).toBe(401);
      });

      it('다른 사용자가 삭제하면 HTTP 403', async () => {
        const { status } = await httpDelete(
          `http://localhost:${port}/posts/${deleteTargetId}`,
          anotherToken,
        );
        expect(status).toBe(403);
      });

      it('작성자가 삭제하면 HTTP 204 반환', async () => {
        const { status } = await httpDelete(
          `http://localhost:${port}/posts/${deleteTargetId}`,
          accessToken,
        );
        expect(status).toBe(204);
      });

      it('삭제 후 재조회 시 HTTP 404', async () => {
        // slug 조회가 아닌 존재하지 않는 ID 기반 PATCH 로 확인
        const { status } = await httpPatch(
          `http://localhost:${port}/posts/${deleteTargetId}`,
          { title: '삭제 후 수정 시도' },
          accessToken,
        );
        expect(status).toBe(404);
      });
    });
  });

  // ── AC2: 슬러그 퍼블릭 조회 ────────────────────────────────────────────────

  describe('AC2: 슬러그 퍼블릭 조회', () => {
    beforeAll(async () => {
      // 발행 포스트 생성
      await httpPost(
        `http://localhost:${port}/posts`,
        {
          title: '발행된 포스트',
          slug: 'published-post-bf691',
          status: 'PUBLISHED',
        },
        accessToken,
      );

      // 미발행(DRAFT) 포스트 생성
      await httpPost(
        `http://localhost:${port}/posts`,
        {
          title: '초안 포스트',
          slug: 'draft-post-bf691',
          status: 'DRAFT',
        },
        accessToken,
      );
    });

    it('발행된 포스트 — 인증 없이 슬러그로 조회 가능 (HTTP 200)', async () => {
      const { status, body } = await httpGet(
        `http://localhost:${port}/posts/published-post-bf691`,
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as { slug: string; status: string };
      expect(parsed.slug).toBe('published-post-bf691');
      expect(parsed.status).toBe('PUBLISHED');
    });

    it('발행된 포스트 응답에 author 정보 포함', async () => {
      const { body } = await httpGet(
        `http://localhost:${port}/posts/published-post-bf691`,
      );
      const parsed = JSON.parse(body) as {
        author: { id: number; email: string; role: string };
      };
      expect(parsed.author).toBeDefined();
      expect(parsed.author.email).toBe(TEST_USER.email);
    });

    it('미발행(DRAFT) 포스트 슬러그 조회 — HTTP 404 반환', async () => {
      const { status } = await httpGet(
        `http://localhost:${port}/posts/draft-post-bf691`,
      );
      expect(status).toBe(404);
    });

    it('존재하지 않는 슬러그 조회 — HTTP 404 반환', async () => {
      const { status } = await httpGet(
        `http://localhost:${port}/posts/no-such-post-xyz`,
      );
      expect(status).toBe(404);
    });
  });

  // ── AC3: 목록 페이지네이션 + AppModule 등록 확인 ────────────────────────────

  describe('AC3: 발행 포스트 목록 페이지네이션', () => {
    it('GET /posts — 인증 없이 발행 포스트 목록 조회 가능', async () => {
      const { status, body } = await httpGet(`http://localhost:${port}/posts`);
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as {
        data: unknown[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
      expect(parsed.data).toBeDefined();
      expect(typeof parsed.total).toBe('number');
      expect(parsed.page).toBe(1);
      expect(parsed.pageSize).toBe(10);
      expect(typeof parsed.totalPages).toBe('number');
    });

    it('페이지네이션 파라미터(page=1, pageSize=2) 동작 확인', async () => {
      const { status, body } = await httpGet(
        `http://localhost:${port}/posts?page=1&pageSize=2`,
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as {
        data: unknown[];
        page: number;
        pageSize: number;
        totalPages: number;
      };
      expect(parsed.page).toBe(1);
      expect(parsed.pageSize).toBe(2);
      expect(parsed.data.length).toBeLessThanOrEqual(2);
    });

    it('목록에는 PUBLISHED 상태 포스트만 포함 (DRAFT 제외)', async () => {
      const { body } = await httpGet(`http://localhost:${port}/posts`);
      const parsed = JSON.parse(body) as {
        data: { status: string }[];
      };
      for (const post of parsed.data) {
        expect(post.status).toBe('PUBLISHED');
      }
    });

    it('AppModule 에 PostModule 등록 — NestJS 앱 부팅 성공 (통합 확인)', () => {
      // beforeAll 에서 AppModule 만으로 부팅 성공했으면 PostModule 등록 확인됨
      expect(app).toBeDefined();
      expect(port).toBeGreaterThan(0);
    });
  });
});
