/**
 * BF-701 — CommentModule E2E 회귀 가드
 *
 * dev·기존 테스트에서 이미 검증된 케이스 (중복 금지):
 *   - test/comment.e2e-spec.ts (BF-699)
 *       : 비인증 POST → HTTP 401
 *       : 인증 POST → HTTP 201 + CommentResponse shape (id/content/postId/createdAt)
 *       : 응답 AuthorSummary (id, email, role) 포함
 *       : content 누락 → HTTP 400 (ValidationPipe)
 *       : 존재하지 않는 postId POST → HTTP 404
 *       : GET 댓글 목록 — 비인증 200 + array
 *       : 목록 각 댓글 AuthorSummary 포함 (id/email/role 타입)
 *       : 목록 모든 댓글 postId 소속
 *       : 존재하지 않는 postId GET → HTTP 404
 *       : AppModule 부팅 성공 (CommentModule 간접 등록 확인)
 *   - src/comment/comment.service.spec.ts
 *       : create() / findByPostId() 단위 로직 (Prisma mocked)
 *       : NotFoundException — 포스트 없음 (mocked)
 *       : 빈 배열 반환 (mocked)
 *       : findMany orderBy 파라미터 전달 (mocked)
 *
 * BF-701 tester 고유 회귀 가드:
 *   AC1: 소스 계약 — comment.controller.ts 에 POST 에만 @UseGuards(JwtAuthGuard), GET 은 퍼블릭
 *   AC1: 소스 계약 — comment.module.ts 에 AuthModule import + CommentService exports 존재
 *   AC1: 소스 계약 — app.module.ts 에 CommentModule 등록
 *   AC1: 소스 계약 — comment.service.ts 에 author include 쿼리 + toCommentResponse author 매핑
 *   AC2: 댓글 없는 포스트 → 빈 배열 [] 반환 (E2E 실 DB — BF-699 미커버)
 *   AC2: 포스트 간 댓글 격리 — postA 댓글이 postB 목록에 미포함 (BF-699 미커버)
 *   AC2: 다중 사용자 AuthorSummary 정확성 — 두 사용자 댓글의 author.email 각각 정확
 *   AC2: 목록 createdAt 오름차순 정렬 — 비감소 순서 보장 (BF-699 미커버, service.spec 은 mocked)
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

function httpGet(url: string, token?: string): Promise<HttpResponse> {
  return httpRequest('GET', url, undefined, token);
}

// ── AC1: 소스 계약 가드 (정적) ────────────────────────────────────────────────
// 목적: CommentModule 의 핵심 보안·구조 코드가 silent 삭제/변경되지 않도록 fact 박제

describe('[BF-701] AC1 — CommentModule 소스 계약 가드', () => {
  const readSrc = (relPath: string): string =>
    fs.readFileSync(path.join(PROJECT_ROOT, relPath), 'utf-8');

  // ── comment.controller.ts — 엔드포인트 인증 계약 ──────────────────────────

  describe('comment.controller.ts — 엔드포인트 인증 가드 계약', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/comment/comment.controller.ts');
    });

    test('JwtAuthGuard import 존재 — 인증 의존성 보존', () => {
      expect(src).toContain('JwtAuthGuard');
    });

    test('@UseGuards(JwtAuthGuard) 가 1회 이상 존재 — POST 엔드포인트 보호됨', () => {
      const matches = src.match(/@UseGuards\(JwtAuthGuard\)/g) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    test('GET 엔드포인트(findByPostId) 에 @UseGuards 없음 — 퍼블릭 조회 보장', () => {
      // @Get() 선언 이후 async findByPostId 직전 블록에 @UseGuards 없음 검증
      const getIdx = src.indexOf('@Get()');
      const findByPostIdIdx = src.indexOf('async findByPostId(', getIdx);
      expect(getIdx).toBeGreaterThan(-1);
      expect(findByPostIdIdx).toBeGreaterThan(getIdx);
      const block = src.slice(getIdx, findByPostIdIdx);
      expect(block).not.toContain('@UseGuards');
    });
  });

  // ── comment.module.ts — 모듈 구성 계약 ───────────────────────────────────

  describe('comment.module.ts — 모듈 구성 계약', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/comment/comment.module.ts');
    });

    test('AuthModule import 존재 — JwtAuthGuard 의존성 보존', () => {
      expect(src).toContain('AuthModule');
    });

    test('CommentController 등록 존재 — 라우트 노출 보장', () => {
      expect(src).toContain('CommentController');
    });

    test('exports 배열에 CommentService 존재 — 외부 모듈 사용 가능성 보장', () => {
      const moduleBlock = src.slice(
        src.indexOf('@Module('),
        src.indexOf('export class CommentModule'),
      );
      expect(moduleBlock).toContain('CommentService');
    });
  });

  // ── app.module.ts — CommentModule 등록 계약 ──────────────────────────────

  describe('app.module.ts — CommentModule 등록 계약', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/app.module.ts');
    });

    test('CommentModule import 선언 존재 — 파일 경로 계약', () => {
      expect(src).toContain("from './comment/comment.module'");
    });

    test('@Module imports 배열에 CommentModule 포함', () => {
      const moduleBlock = src.slice(
        src.indexOf('@Module('),
        src.indexOf('export class AppModule'),
      );
      expect(moduleBlock).toContain('CommentModule');
    });
  });

  // ── comment.service.ts — author include 쿼리 + AuthorSummary 매핑 계약 ──

  describe('comment.service.ts — author include 쿼리 + AuthorSummary 매핑 계약', () => {
    let src: string;
    beforeAll(() => {
      src = readSrc('src/comment/comment.service.ts');
    });

    test('AUTHOR_SELECT 상수 존재 — author 필드 선택 계약 보존', () => {
      expect(src).toContain('AUTHOR_SELECT');
    });

    test('create 메서드에 author include 쿼리 존재 — AuthorSummary 응답 보장', () => {
      const createStart = src.indexOf('async create(');
      const createEnd = src.indexOf('\n  }', createStart);
      expect(createStart).toBeGreaterThan(-1);
      const createBody = src.slice(createStart, createEnd);
      expect(createBody).toContain('include');
      expect(createBody).toContain('author');
    });

    test('findByPostId 메서드에 author include 쿼리 존재 — 목록 AuthorSummary 보장', () => {
      const methodStart = src.indexOf('async findByPostId(');
      const methodEnd = src.indexOf('\n  }', methodStart);
      expect(methodStart).toBeGreaterThan(-1);
      const methodBody = src.slice(methodStart, methodEnd);
      expect(methodBody).toContain('include');
      expect(methodBody).toContain('author');
    });

    test('toCommentResponse 함수에 author 필드 매핑 존재 — AuthorSummary 직렬화 계약', () => {
      const fnStart = src.indexOf('function toCommentResponse(');
      const fnEnd = src.indexOf('\n}', fnStart);
      expect(fnStart).toBeGreaterThan(-1);
      const fnBody = src.slice(fnStart, fnEnd);
      expect(fnBody).toContain('author:');
    });

    test('AuthorSummary 타입 import 존재 — 공유 타입 의존성 보존', () => {
      expect(src).toContain('AuthorSummary');
    });
  });
});

// ── AC2: E2E 회귀 가드 — 포스트 격리·다중 사용자·빈 목록·정렬 ─────────────────
// BF-699 가 커버하지 않는 4가지 케이스를 실 DB + NestJS 앱 전체 흐름에서 고정한다.

describe('[BF-701] AC2 — CommentModule E2E 회귀 가드', () => {
  const TEST_DB = '/tmp/brix-test-bf701-ac2.db';
  let app: INestApplication;
  let port: number;
  let tokenA: string;
  let tokenB: string;
  let postIdA: number;
  let postIdB: number;

  const USER_A = {
    email: 'bf701-userA@example.com',
    password: 'testpass8',
  };
  const USER_B = {
    email: 'bf701-userB@example.com',
    password: 'testpass8',
  };

  beforeAll(async () => {
    process.env['DATABASE_URL'] = `file:${TEST_DB}`;
    process.env['JWT_SECRET'] = 'bf701-comment-regression-jwt-secret-32chars!!';

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

    // User A 등록 + 토큰
    await httpPost(`http://localhost:${port}/auth/register`, USER_A);
    const loginA = await httpPost(
      `http://localhost:${port}/auth/login`,
      USER_A,
    );
    tokenA = (JSON.parse(loginA.body) as { access_token: string }).access_token;

    // User B 등록 + 토큰
    await httpPost(`http://localhost:${port}/auth/register`, USER_B);
    const loginB = await httpPost(
      `http://localhost:${port}/auth/login`,
      USER_B,
    );
    tokenB = (JSON.parse(loginB.body) as { access_token: string }).access_token;

    // 포스트 A (격리·다중 사용자 테스트용)
    const postARes = await httpPost(
      `http://localhost:${port}/posts`,
      { title: 'BF-701 포스트 A', slug: 'bf701-post-a' },
      tokenA,
    );
    postIdA = (JSON.parse(postARes.body) as { id: number }).id;

    // 포스트 B (격리 검증 대상 — 댓글 없는 상태 유지)
    const postBRes = await httpPost(
      `http://localhost:${port}/posts`,
      { title: 'BF-701 포스트 B', slug: 'bf701-post-b' },
      tokenA,
    );
    postIdB = (JSON.parse(postBRes.body) as { id: number }).id;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  // ── 1. 댓글 없는 포스트 → 빈 배열 [] 반환 ──────────────────────────────────
  // BF-699: 댓글이 이미 존재하는 상태에서만 GET 목록 검증.
  // comment.service.spec.ts: Prisma mocked 단위만 — 실 DB E2E 미커버.
  // postB 는 beforeAll 이후 댓글 미생성 상태로 시작.

  describe('댓글 없는 포스트 — 빈 배열 [] 반환 (실 DB E2E)', () => {
    test('댓글 없는 포스트 GET 목록 → HTTP 200 + [] 반환', async () => {
      const { status, body } = await httpGet(
        `http://localhost:${port}/posts/${postIdB}/comments`,
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as unknown[];
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(0);
    });
  });

  // ── 2. 포스트 간 댓글 격리 ───────────────────────────────────────────────
  // BF-699: "목록의 모든 댓글은 해당 postId 소속" 을 단일 포스트 내에서만 검증.
  // 이 가드는 postA 에 작성한 댓글이 postB 목록에 절대 나타나지 않음을 고정한다.

  describe('포스트 간 댓글 격리 — postA 댓글이 postB 목록에 미포함', () => {
    let commentAId: number;

    beforeAll(async () => {
      const res = await httpPost(
        `http://localhost:${port}/posts/${postIdA}/comments`,
        { content: 'postA 전용 댓글 — 격리 가드' },
        tokenA,
      );
      commentAId = (JSON.parse(res.body) as { id: number }).id;
    });

    test('postA 댓글이 postA 목록에 존재', async () => {
      const { body } = await httpGet(
        `http://localhost:${port}/posts/${postIdA}/comments`,
      );
      const parsed = JSON.parse(body) as { id: number }[];
      const ids = parsed.map((c) => c.id);
      expect(ids).toContain(commentAId);
    });

    test('postA 댓글이 postB 목록에 미포함', async () => {
      const { body } = await httpGet(
        `http://localhost:${port}/posts/${postIdB}/comments`,
      );
      const parsed = JSON.parse(body) as { id: number }[];
      const ids = parsed.map((c) => c.id);
      expect(ids).not.toContain(commentAId);
    });

    test('postB 목록은 여전히 빈 배열 — postA 댓글 격리 확인', async () => {
      const { body } = await httpGet(
        `http://localhost:${port}/posts/${postIdB}/comments`,
      );
      const parsed = JSON.parse(body) as unknown[];
      expect(parsed).toHaveLength(0);
    });
  });

  // ── 3. 다중 사용자 AuthorSummary 정확성 ────────────────────────────────────
  // BF-699: 단일 사용자(TEST_USER) 의 author 만 검증.
  // 이 가드는 User A / B 가 같은 포스트에 댓글 작성 시 각 author.email 이 정확히 매핑됨을 고정한다.

  describe('다중 사용자 — author.email 격리 (AuthorSummary 정확성)', () => {
    beforeAll(async () => {
      // User A 댓글
      await httpPost(
        `http://localhost:${port}/posts/${postIdA}/comments`,
        { content: 'User A 의 댓글 — author 가드' },
        tokenA,
      );
      // User B 댓글
      await httpPost(
        `http://localhost:${port}/posts/${postIdA}/comments`,
        { content: 'User B 의 댓글 — author 가드' },
        tokenB,
      );
    });

    test('User A 댓글의 author.email 이 USER_A.email 과 일치', async () => {
      const { body } = await httpGet(
        `http://localhost:${port}/posts/${postIdA}/comments`,
      );
      const parsed = JSON.parse(body) as {
        content: string;
        author: { email: string };
      }[];
      const commentA = parsed.find(
        (c) => c.content === 'User A 의 댓글 — author 가드',
      );
      expect(commentA).toBeDefined();
      expect(commentA!.author.email).toBe(USER_A.email);
    });

    test('User B 댓글의 author.email 이 USER_B.email 과 일치', async () => {
      const { body } = await httpGet(
        `http://localhost:${port}/posts/${postIdA}/comments`,
      );
      const parsed = JSON.parse(body) as {
        content: string;
        author: { email: string };
      }[];
      const commentB = parsed.find(
        (c) => c.content === 'User B 의 댓글 — author 가드',
      );
      expect(commentB).toBeDefined();
      expect(commentB!.author.email).toBe(USER_B.email);
    });

    test('User A 댓글의 author.email 이 USER_B.email 이 아님 — 교차 오염 없음', async () => {
      const { body } = await httpGet(
        `http://localhost:${port}/posts/${postIdA}/comments`,
      );
      const parsed = JSON.parse(body) as {
        content: string;
        author: { email: string };
      }[];
      const commentA = parsed.find(
        (c) => c.content === 'User A 의 댓글 — author 가드',
      );
      expect(commentA!.author.email).not.toBe(USER_B.email);
    });
  });

  // ── 4. 목록 createdAt 오름차순 정렬 ──────────────────────────────────────
  // BF-699: 정렬 검증 없음.
  // comment.service.spec.ts: orderBy 파라미터 전달만 검증(mocked) — 실 정렬 결과 미검증.
  // 이 가드는 실 DB 에서 반환되는 createdAt 값이 비감소 순서임을 고정한다.

  describe('목록 createdAt 오름차순 정렬 (실 DB E2E)', () => {
    let postIdC: number;

    beforeAll(async () => {
      const postCRes = await httpPost(
        `http://localhost:${port}/posts`,
        { title: 'BF-701 포스트 C — 정렬 가드', slug: 'bf701-post-c' },
        tokenA,
      );
      postIdC = (JSON.parse(postCRes.body) as { id: number }).id;

      // 3개 댓글 순서대로 삽입 — await 으로 직렬 보장
      await httpPost(
        `http://localhost:${port}/posts/${postIdC}/comments`,
        { content: '댓글 01 — 정렬 가드' },
        tokenA,
      );
      await httpPost(
        `http://localhost:${port}/posts/${postIdC}/comments`,
        { content: '댓글 02 — 정렬 가드' },
        tokenA,
      );
      await httpPost(
        `http://localhost:${port}/posts/${postIdC}/comments`,
        { content: '댓글 03 — 정렬 가드' },
        tokenA,
      );
    });

    test('3개 댓글이 createdAt 비감소 순서로 반환됨', async () => {
      const { status, body } = await httpGet(
        `http://localhost:${port}/posts/${postIdC}/comments`,
      );
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as { createdAt: string }[];
      expect(parsed.length).toBeGreaterThanOrEqual(3);

      for (let i = 1; i < parsed.length; i++) {
        const prev = new Date(parsed[i - 1].createdAt).getTime();
        const curr = new Date(parsed[i].createdAt).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });

    test('id 가 오름차순 — 삽입 순서대로 id 증가', async () => {
      const { body } = await httpGet(
        `http://localhost:${port}/posts/${postIdC}/comments`,
      );
      const parsed = JSON.parse(body) as { id: number }[];
      for (let i = 1; i < parsed.length; i++) {
        expect(parsed[i].id).toBeGreaterThan(parsed[i - 1].id);
      }
    });
  });
});
