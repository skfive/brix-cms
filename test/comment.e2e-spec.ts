/**
 * BF-699 — CommentModule E2E 테스트
 *
 * AC1: 인증된 사용자가 특정 포스트에 댓글 작성 → 저장 + AuthorSummary 포함 응답
 * AC2: 포스트별 댓글 목록 조회 → 해당 포스트 댓글 + AuthorSummary 반환
 * AC3: 비인증 요청으로 댓글 작성 시도 → HTTP 401
 *       + app.module.ts 에 CommentModule 등록 + e2e 테스트 통과
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
const TEST_DB_PATH = '/tmp/brix-test-bf699-comment-module.db';

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

function httpGet(url: string, token?: string): Promise<HttpResponse> {
  return httpRequest('GET', url, undefined, token);
}

// ── E2E 테스트 ────────────────────────────────────────────────────────────────

describe('[BF-699] CommentModule — 댓글 작성/조회 + AuthorSummary E2E', () => {
  let app: INestApplication;
  let port: number;
  let accessToken: string;
  let postId: number;

  const TEST_USER = {
    email: 'bf699-commenter@example.com',
    password: 'testpass8',
  };

  beforeAll(async () => {
    process.env['DATABASE_URL'] = `file:${TEST_DB_PATH}`;
    process.env['JWT_SECRET'] =
      'bf699-comment-module-test-jwt-secret-min32chars!!';

    // Prisma 마이그레이션 배포
    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
      stdio: 'ignore',
    });

    // NestJS 앱 부팅 (AppModule 에 CommentModule 포함)
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

    // 댓글 테스트용 포스트 생성
    const postRes = await httpPost(
      `http://localhost:${port}/posts`,
      { title: 'BF-699 댓글 테스트 포스트', slug: 'bf699-comment-test-post' },
      accessToken,
    );
    const postBody = JSON.parse(postRes.body) as { id: number };
    postId = postBody.id;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  // ── AC3: 비인증 요청 거부 ────────────────────────────────────────────────────

  describe('AC3: 비인증 댓글 작성 → HTTP 401', () => {
    it('토큰 없이 댓글 작성 시 HTTP 401 반환', async () => {
      const { status } = await httpPost(
        `http://localhost:${port}/posts/${postId}/comments`,
        { content: '비인증 댓글' },
      );
      expect(status).toBe(401);
    });
  });

  // ── AC1: 인증 댓글 작성 + AuthorSummary ────────────────────────────────────

  describe('AC1: 인증된 사용자 댓글 작성 + AuthorSummary 포함 응답', () => {
    it('인증 토큰 있으면 댓글 작성 성공 HTTP 201', async () => {
      const { status, body } = await httpPost(
        `http://localhost:${port}/posts/${postId}/comments`,
        { content: '첫 번째 댓글입니다.' },
        accessToken,
      );
      expect(status).toBe(201);
      const parsed = JSON.parse(body) as {
        id: number;
        content: string;
        postId: number;
        author: { id: number; email: string; role: string };
        createdAt: string;
        updatedAt: string;
      };
      expect(parsed.id).toBeGreaterThan(0);
      expect(parsed.content).toBe('첫 번째 댓글입니다.');
      expect(parsed.postId).toBe(postId);
    });

    it('응답에 author AuthorSummary 포함 (id, email, role)', async () => {
      const { body } = await httpPost(
        `http://localhost:${port}/posts/${postId}/comments`,
        { content: '두 번째 댓글입니다.' },
        accessToken,
      );
      const parsed = JSON.parse(body) as {
        author: { id: number; email: string; role: string };
      };
      expect(parsed.author).toBeDefined();
      expect(parsed.author.id).toBeGreaterThan(0);
      expect(parsed.author.email).toBe(TEST_USER.email);
      expect(parsed.author.role).toBe('user');
    });

    it('content 누락 시 HTTP 400 (ValidationPipe)', async () => {
      const { status } = await httpPost(
        `http://localhost:${port}/posts/${postId}/comments`,
        {},
        accessToken,
      );
      expect(status).toBe(400);
    });

    it('존재하지 않는 postId — HTTP 404 반환', async () => {
      const { status } = await httpPost(
        `http://localhost:${port}/posts/99999/comments`,
        { content: '없는 포스트에 댓글' },
        accessToken,
      );
      expect(status).toBe(404);
    });
  });

  // ── AC2: 포스트별 댓글 목록 조회 ────────────────────────────────────────────

  describe('AC2: 포스트별 댓글 목록 조회 + AuthorSummary 포함', () => {
    it('GET /posts/:postId/comments — 인증 없이 댓글 목록 조회 가능', async () => {
      const { status, body } = await httpGet(
        `http://localhost:${port}/posts/${postId}/comments`,
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as {
        id: number;
        content: string;
        postId: number;
        author: { id: number; email: string; role: string };
      }[];
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    });

    it('목록의 각 댓글에 author AuthorSummary 포함', async () => {
      const { body } = await httpGet(
        `http://localhost:${port}/posts/${postId}/comments`,
      );
      const parsed = JSON.parse(body) as {
        author: { id: number; email: string; role: string };
      }[];
      for (const comment of parsed) {
        expect(comment.author).toBeDefined();
        expect(typeof comment.author.id).toBe('number');
        expect(typeof comment.author.email).toBe('string');
        expect(typeof comment.author.role).toBe('string');
      }
    });

    it('목록의 모든 댓글은 해당 postId 소속', async () => {
      const { body } = await httpGet(
        `http://localhost:${port}/posts/${postId}/comments`,
      );
      const parsed = JSON.parse(body) as { postId: number }[];
      for (const comment of parsed) {
        expect(comment.postId).toBe(postId);
      }
    });

    it('존재하지 않는 postId 목록 조회 — HTTP 404', async () => {
      const { status } = await httpGet(
        `http://localhost:${port}/posts/99999/comments`,
      );
      expect(status).toBe(404);
    });
  });

  // ── AppModule 등록 확인 ─────────────────────────────────────────────────────

  describe('AppModule 에 CommentModule 등록 확인', () => {
    it('CommentModule 등록 — NestJS 앱 부팅 성공 (통합 확인)', () => {
      expect(app).toBeDefined();
      expect(port).toBeGreaterThan(0);
    });
  });
});
