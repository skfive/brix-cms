/**
 * BF-697 — PageModule E2E 회귀 가드
 *
 * AC1: 인증 토큰으로 생성/수정/삭제 각 단계가 2xx 로 성공한다
 * AC2: 비인증 쓰기 요청 → HTTP 401 응답을 가드로 검증한다
 * AC3: 생성된 페이지를 슬러그로 퍼블릭 조회 → 본문이 반환되고 회귀 테스트가 통과한다
 *
 * 중복 제외 범위:
 * - slug 자동 생성 로직, status DRAFT 기본값, content=null 기본값  → page.service.spec.ts
 * - 서비스 단계 ConflictException / ForbiddenException / NotFoundException → page.service.spec.ts
 * - 컨트롤러 파라미터 위임 검증 → page.controller.spec.ts
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
const TEST_DB_PATH = '/tmp/brix-test-bf697-page-e2e.db';

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

describe('[BF-697] PageModule CRUD + 인증 + 슬러그 퍼블릭 조회 E2E', () => {
  let app: INestApplication;
  let port: number;
  let accessToken: string;
  let anotherToken: string; // 다른 사용자 토큰 (403 검증용)

  const TEST_USER = {
    email: 'bf697-author@example.com',
    password: 'testpass8',
  };
  const OTHER_USER = {
    email: 'bf697-other@example.com',
    password: 'testpass8',
  };

  beforeAll(async () => {
    process.env['DATABASE_URL'] = `file:${TEST_DB_PATH}`;
    process.env['JWT_SECRET'] =
      'bf697-page-module-test-jwt-secret-min32chars!!';

    // Prisma 마이그레이션 배포
    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
      stdio: 'ignore',
    });

    // NestJS 앱 부팅 (AppModule 에 PageModule 포함)
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

  // ── AppModule 등록 확인 ─────────────────────────────────────────────────────

  it('AppModule 에 PageModule 등록 — NestJS 앱 부팅 성공', () => {
    // beforeAll 에서 AppModule 기반 부팅이 성공했으면 PageModule 등록 확인됨
    expect(app).toBeDefined();
    expect(port).toBeGreaterThan(0);
  });

  // ── AC2: 비인증 쓰기 401 ────────────────────────────────────────────────────

  describe('AC2: 비인증 쓰기 요청 → HTTP 401', () => {
    it('POST /pages — 인증 토큰 없으면 HTTP 401', async () => {
      const { status } = await httpPost(`http://localhost:${port}/pages`, {
        title: '비인증 페이지 생성 시도',
      });
      expect(status).toBe(401);
    });

    it('PATCH /pages/1 — 인증 토큰 없으면 HTTP 401', async () => {
      const { status } = await httpPatch(`http://localhost:${port}/pages/1`, {
        title: '비인증 수정 시도',
      });
      expect(status).toBe(401);
    });

    it('DELETE /pages/1 — 인증 토큰 없으면 HTTP 401', async () => {
      const { status } = await httpDelete(`http://localhost:${port}/pages/1`);
      expect(status).toBe(401);
    });
  });

  // ── AC1: 인증 CRUD ──────────────────────────────────────────────────────────

  describe('AC1: 인증 토큰으로 CRUD — 각 단계 2xx 성공', () => {
    describe('POST /pages (페이지 생성)', () => {
      it('인증 토큰 있으면 HTTP 201 + PageResponse 반환', async () => {
        const { status, body } = await httpPost(
          `http://localhost:${port}/pages`,
          { title: 'BF-697 테스트 페이지', slug: 'bf697-test-page' },
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
        expect(parsed.title).toBe('BF-697 테스트 페이지');
        expect(parsed.slug).toBe('bf697-test-page');
        expect(parsed.status).toBe('DRAFT');
        expect(parsed.author.email).toBe(TEST_USER.email);
      });

      it('title 누락 시 HTTP 400 (ValidationPipe)', async () => {
        const { status } = await httpPost(
          `http://localhost:${port}/pages`,
          { content: '제목 없는 페이지' },
          accessToken,
        );
        expect(status).toBe(400);
      });
    });

    describe('PATCH /pages/:id (페이지 수정)', () => {
      let pageId: number;

      beforeAll(async () => {
        const { body } = await httpPost(
          `http://localhost:${port}/pages`,
          { title: 'PATCH 테스트 페이지', slug: 'bf697-patch-target' },
          accessToken,
        );
        const parsed = JSON.parse(body) as { id: number };
        pageId = parsed.id;
      });

      it('인증 토큰 있으면 수정 성공 HTTP 200', async () => {
        const { status, body } = await httpPatch(
          `http://localhost:${port}/pages/${pageId}`,
          { title: '수정된 페이지 제목' },
          accessToken,
        );
        expect(status).toBe(200);
        const parsed = JSON.parse(body) as { title: string };
        expect(parsed.title).toBe('수정된 페이지 제목');
      });

      it('수정 응답에 author 정보 포함', async () => {
        const { body } = await httpPatch(
          `http://localhost:${port}/pages/${pageId}`,
          { content: '수정된 내용' },
          accessToken,
        );
        const parsed = JSON.parse(body) as {
          content: string | null;
          author: { id: number; email: string; role: string };
        };
        expect(parsed.content).toBe('수정된 내용');
        expect(parsed.author).toBeDefined();
        expect(parsed.author.email).toBe(TEST_USER.email);
      });

      it('다른 사용자가 수정하면 HTTP 403', async () => {
        const { status } = await httpPatch(
          `http://localhost:${port}/pages/${pageId}`,
          { title: '타인 수정 시도' },
          anotherToken,
        );
        expect(status).toBe(403);
      });

      it('인증 토큰 없으면 HTTP 401', async () => {
        const { status } = await httpPatch(
          `http://localhost:${port}/pages/${pageId}`,
          { title: '비인증 수정 시도' },
        );
        expect(status).toBe(401);
      });
    });

    describe('DELETE /pages/:id (페이지 삭제)', () => {
      let deleteTargetId: number;

      beforeAll(async () => {
        const { body } = await httpPost(
          `http://localhost:${port}/pages`,
          { title: '삭제용 페이지', slug: 'bf697-delete-target' },
          accessToken,
        );
        const parsed = JSON.parse(body) as { id: number };
        deleteTargetId = parsed.id;
      });

      it('인증 토큰 없으면 HTTP 401', async () => {
        const { status } = await httpDelete(
          `http://localhost:${port}/pages/${deleteTargetId}`,
        );
        expect(status).toBe(401);
      });

      it('다른 사용자가 삭제하면 HTTP 403', async () => {
        const { status } = await httpDelete(
          `http://localhost:${port}/pages/${deleteTargetId}`,
          anotherToken,
        );
        expect(status).toBe(403);
      });

      it('작성자가 삭제하면 HTTP 204 반환', async () => {
        const { status } = await httpDelete(
          `http://localhost:${port}/pages/${deleteTargetId}`,
          accessToken,
        );
        expect(status).toBe(204);
      });

      it('삭제 후 슬러그 재조회 시 HTTP 404', async () => {
        const { status } = await httpGet(
          `http://localhost:${port}/pages/bf697-delete-target`,
        );
        expect(status).toBe(404);
      });
    });
  });

  // ── AC3: 슬러그 퍼블릭 조회 ────────────────────────────────────────────────

  describe('AC3: 슬러그 퍼블릭 조회', () => {
    beforeAll(async () => {
      // PUBLISHED 페이지 생성
      await httpPost(
        `http://localhost:${port}/pages`,
        {
          title: '발행된 페이지',
          slug: 'bf697-published-page',
          status: 'PUBLISHED',
        },
        accessToken,
      );

      // DRAFT 페이지 생성 (PageModule 은 DRAFT 도 슬러그 조회 가능)
      await httpPost(
        `http://localhost:${port}/pages`,
        {
          title: '초안 페이지',
          slug: 'bf697-draft-page',
          status: 'DRAFT',
        },
        accessToken,
      );
    });

    it('인증 없이 슬러그로 PUBLISHED 페이지 조회 가능 — HTTP 200', async () => {
      const { status, body } = await httpGet(
        `http://localhost:${port}/pages/bf697-published-page`,
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as { slug: string; status: string };
      expect(parsed.slug).toBe('bf697-published-page');
      expect(parsed.status).toBe('PUBLISHED');
    });

    it('슬러그 조회 응답에 author 정보 포함', async () => {
      const { body } = await httpGet(
        `http://localhost:${port}/pages/bf697-published-page`,
      );
      const parsed = JSON.parse(body) as {
        author: { id: number; email: string; role: string };
      };
      expect(parsed.author).toBeDefined();
      expect(parsed.author.email).toBe(TEST_USER.email);
    });

    it('슬러그 조회 응답에 id/title/slug/content/status/createdAt/updatedAt 필드 존재', async () => {
      const { body } = await httpGet(
        `http://localhost:${port}/pages/bf697-published-page`,
      );
      const parsed = JSON.parse(body) as Record<string, unknown>;
      expect(typeof parsed['id']).toBe('number');
      expect(typeof parsed['title']).toBe('string');
      expect(typeof parsed['slug']).toBe('string');
      expect('content' in parsed).toBe(true); // null 허용
      expect(typeof parsed['status']).toBe('string');
      expect(typeof parsed['createdAt']).toBe('string');
      expect(typeof parsed['updatedAt']).toBe('string');
    });

    it('DRAFT 페이지도 슬러그로 퍼블릭 조회 가능 — HTTP 200 (PostModule 과 다른 PageModule 동작)', async () => {
      // PageService.findBySlug 은 status 필터 없음 — DRAFT 도 반환
      const { status, body } = await httpGet(
        `http://localhost:${port}/pages/bf697-draft-page`,
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as { status: string };
      expect(parsed.status).toBe('DRAFT');
    });

    it('존재하지 않는 슬러그 조회 — HTTP 404 반환', async () => {
      const { status } = await httpGet(
        `http://localhost:${port}/pages/no-such-page-xyz-bf697`,
      );
      expect(status).toBe(404);
    });
  });
});
