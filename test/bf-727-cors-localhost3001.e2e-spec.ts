/**
 * BF-727 — CORS localhost:3001 origin 허용 + preflight E2E 회귀 가드
 *
 * 목적: dev 환경에서 Next.js 프론트엔드(localhost:3001) 및 localhost:3000 이
 *       NestJS 백엔드 API 를 cross-origin 으로 호출할 때 CORS 차단되지 않도록
 *       보호. 실제 HTTP 서버를 부팅해 cors 미들웨어 동작을 검증한다.
 *
 * 단위 테스트(중복 금지): src/config/cors.config.spec.ts → buildCorsOptions 순수 함수
 *
 * 이 파일의 고유 영역:
 *   1. 실제 HTTP 서버 부팅 + Origin 헤더 동반 요청 → Access-Control-Allow-Origin 반사
 *   2. OPTIONS preflight → 204 + Allow-Methods/Allow-Headers/Allow-Credentials
 *   3. 미허용 origin 은 반사하지 않음 (보안 회귀 가드)
 *   4. main.ts 정적 contract 가드 (enableCors 가 buildCorsOptions 로 설정됨)
 */

import { Controller, Get, Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import type { AddressInfo } from 'net';

import { buildCorsOptions } from '../src/config/cors.config';

const PROJECT_ROOT = path.resolve(__dirname, '..');

// ─── 최소 테스트용 Nest 앱 (Prisma/DB 의존 없이 CORS 미들웨어만 검증) ──────────
@Controller()
class CorsPingController {
  @Get('cors-ping')
  ping(): { pong: boolean } {
    return { pong: true };
  }
}

@Module({ controllers: [CorsPingController] })
class CorsTestModule {}

// ─── HTTP 요청 헬퍼 (supertest 미설치 — Node.js 내장 http 모듈 사용) ──────────
interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function httpRequest(options: http.RequestOptions): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk: string) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body,
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('[BF-727] CORS localhost:3001 origin E2E 회귀 가드', () => {
  let app: INestApplication;
  let port: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CorsTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // main.ts 와 동일한 옵션으로 CORS 활성화
    app.enableCors(buildCorsOptions());
    await app.init();
    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;
  });

  afterAll(async () => {
    await app.close();
  });

  // AC1: localhost:3001 에서 fetch/XHR → Access-Control-Allow-Origin 반사
  describe('AC1: localhost:3001 origin 실제 요청', () => {
    it('GET 응답에 Access-Control-Allow-Origin: localhost:3001 포함', async () => {
      const res = await httpRequest({
        host: 'localhost',
        port,
        path: '/cors-ping',
        method: 'GET',
        headers: { Origin: 'http://localhost:3001' },
      });
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:3001',
      );
    });

    it('credentials 허용 헤더 동반(Access-Control-Allow-Credentials: true)', async () => {
      const res = await httpRequest({
        host: 'localhost',
        port,
        path: '/cors-ping',
        method: 'GET',
        headers: { Origin: 'http://localhost:3001' },
      });
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  // AC2: OPTIONS preflight → 204 + Allow-Methods/Allow-Headers
  describe('AC2: OPTIONS preflight 응답', () => {
    it('preflight 상태코드 204 반환', async () => {
      const res = await httpRequest({
        host: 'localhost',
        port,
        path: '/cors-ping',
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3001',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization,content-type',
        },
      });
      expect(res.status).toBe(204);
    });

    it('preflight 응답에 Allow-Origin / Allow-Methods / Allow-Headers 포함', async () => {
      const res = await httpRequest({
        host: 'localhost',
        port,
        path: '/cors-ping',
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3001',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,content-type',
        },
      });
      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:3001',
      );
      const allowMethods = res.headers['access-control-allow-methods'] ?? '';
      expect(allowMethods).toContain('POST');
      expect(allowMethods).toContain('OPTIONS');
      const allowHeaders = res.headers['access-control-allow-headers'] ?? '';
      expect(allowHeaders).toContain('Authorization');
      expect(allowHeaders).toContain('Content-Type');
    });
  });

  // AC3: 기존 허용 origin(localhost:3000) 회귀 없음
  describe('AC3: localhost:3000 origin 회귀 가드', () => {
    it('GET 응답에 Access-Control-Allow-Origin: localhost:3000 반사', async () => {
      const res = await httpRequest({
        host: 'localhost',
        port,
        path: '/cors-ping',
        method: 'GET',
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      );
    });
  });

  // 보안 가드: 화이트리스트 밖 origin 은 반사하지 않음
  describe('보안: 미허용 origin 차단', () => {
    it('허용되지 않은 origin 은 Access-Control-Allow-Origin 에 반사되지 않는다', async () => {
      const res = await httpRequest({
        host: 'localhost',
        port,
        path: '/cors-ping',
        method: 'GET',
        headers: { Origin: 'http://evil.example.com' },
      });
      expect(res.headers['access-control-allow-origin']).not.toBe(
        'http://evil.example.com',
      );
    });
  });
});

// ─── 정적 contract 가드 (main.ts 가 CORS 옵션을 명시적으로 설정하는지 보장) ────
describe('[BF-727] main.ts CORS 설정 contract 가드', () => {
  const readSrc = (relPath: string): string =>
    fs.readFileSync(path.join(PROJECT_ROOT, relPath), 'utf-8');

  it('main.ts 가 buildCorsOptions 로 enableCors 를 호출한다', () => {
    const src = readSrc('src/main.ts');
    expect(src).toContain('buildCorsOptions');
    expect(src).toContain('app.enableCors(buildCorsOptions(');
  });

  it('main.ts 가 CORS_ALLOWED_ORIGINS 환경변수를 참조한다', () => {
    const src = readSrc('src/main.ts');
    expect(src).toContain('CORS_ALLOWED_ORIGINS');
  });

  it('.env.example 에 CORS_ALLOWED_ORIGINS 항목이 존재한다', () => {
    const src = readSrc('.env.example');
    expect(src).toContain('CORS_ALLOWED_ORIGINS');
  });
});
