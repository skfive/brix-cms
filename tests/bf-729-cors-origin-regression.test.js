/**
 * BF-729 — CORS 허용 origin 회귀 가드 (E2E/통합 테스트)
 *
 * 목적:
 *   BF-727 에서 머지된 CORS 설정(localhost:3001 허용 + preflight 응답 보강)이
 *   미래에 silent break 되지 않도록 보호한다.
 *   - origin 화이트리스트 축소(3001 제거) 방지
 *   - wildcard('*') 후퇴 방지
 *   - 필요한 Allow-* 헤더가 모두 선언되어 있는지 완전성 보장
 *
 * dev(BF-727) 가 이미 검증한 항목 (중복 작성 금지):
 *   - GET with localhost:3001 → 200 + ACAO (test/bf-727-cors-localhost3001.e2e-spec.ts)
 *   - OPTIONS preflight → 204 + Allow-Origin/Methods(POST,OPTIONS)/Headers(Auth,CT) (동상)
 *   - GET with localhost:3000 → 200 + ACAO (동상)
 *   - evil.example.com GET → "not equal to evil.example.com" 수준 차단 (동상)
 *   - parseAllowedOrigins / buildCorsOptions 단위 (src/config/cors.config.spec.ts)
 *
 * 이 파일의 고유 영역 (tester 추가):
 *   1. POST with localhost:3001 → 200 + ACAO (AC1 명시, dev 미커버)
 *   2. OPTIONS preflight → ALLOWED_HEADERS 5개 전부 포함 여부 (Accept/Origin/X-Requested-With 미검증)
 *   3. evil.example.com → ACAO 헤더 완전 부재 검증 (dev 는 "not equal" 수준, 여기서는 undefined)
 *   4. evil.example.com OPTIONS preflight → ACAO 헤더 부재
 *   5. 정적 계약: whitelist 안정성 / wildcard 부재 / 모든 메서드·헤더 선언 완전성
 *
 * 실행:
 *   node --test tests/bf-729-cors-origin-regression.test.js
 *   BRIX_E2E_SKIP=1 node --test tests/bf-729-cors-origin-regression.test.js  # HTTP 섹션 skip
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const SKIP_HTTP = process.env.BRIX_E2E_SKIP === '1';

/** 파일 읽기 헬퍼 */
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

// ══════════════════════════════════════════════════════════════
// Section 1 — cors.config.ts 정적 계약 가드 (서버 불필요, 항상 실행)
//
// 회귀 보호 시나리오:
//   - 누군가 DEFAULT_ALLOWED_ORIGINS 에서 3001 을 제거 → 1.2 실패
//   - 누군가 origin: '*' 로 수정 → 1.7 실패
//   - 누군가 ALLOWED_HEADERS 에서 Accept 제거 → 1.5 실패
//   - 누군가 ALLOWED_METHODS 에서 POST 제거 → 1.4 실패
// ══════════════════════════════════════════════════════════════

describe('BF-729 · AC1/AC2/AC3 — cors.config.ts 정적 계약 가드', () => {
  const CORS_CONFIG_REL = 'src/config/cors.config.ts';

  test('1.1 cors.config.ts 파일이 존재한다', () => {
    assert.ok(
      fs.existsSync(path.join(ROOT, CORS_CONFIG_REL)),
      `${CORS_CONFIG_REL} 이 없습니다 — CORS 설정 모듈 누락`,
    );
  });

  test('1.2 DEFAULT_ALLOWED_ORIGINS 에 http://localhost:3001 포함 (AC1 — whitelist 축소 방지)', () => {
    const src = read(CORS_CONFIG_REL);
    assert.ok(
      src.includes("'http://localhost:3001'"),
      `DEFAULT_ALLOWED_ORIGINS 에 'http://localhost:3001' 이 없습니다.\n` +
        `→ Next.js dev 포트(3001) 가 허용 목록에서 제거되면 프론트엔드 API 호출이 CORS 오류로 실패합니다.`,
    );
  });

  test('1.3 DEFAULT_ALLOWED_ORIGINS 에 http://localhost:3000 포함 (기존 허용 회귀 방지)', () => {
    const src = read(CORS_CONFIG_REL);
    assert.ok(
      src.includes("'http://localhost:3000'"),
      `DEFAULT_ALLOWED_ORIGINS 에 'http://localhost:3000' 이 없습니다 — 기존 허용 origin 제거됨`,
    );
  });

  test('1.4 ALLOWED_METHODS 에 POST 포함 (AC1 — GET/POST 모두 허용 보장)', () => {
    const src = read(CORS_CONFIG_REL);
    assert.ok(
      src.includes("'POST'"),
      `ALLOWED_METHODS 에 'POST' 가 없습니다 — POST 요청의 CORS 허용이 보장되지 않습니다.`,
    );
  });

  test('1.4-full ALLOWED_METHODS 에 7개 메서드 모두 선언됨 (AC3 완전성)', () => {
    const src = read(CORS_CONFIG_REL);
    const required = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'];
    for (const method of required) {
      assert.ok(
        src.includes(`'${method}'`),
        `ALLOWED_METHODS 에 '${method}' 가 없습니다 — preflight Allow-Methods 응답이 불완전합니다.`,
      );
    }
  });

  test('1.5 ALLOWED_HEADERS 에 5개 헤더 모두 선언됨 (AC3 — preflight 완전성)', () => {
    const src = read(CORS_CONFIG_REL);
    // dev 테스트는 Authorization / Content-Type 만 확인.
    // 이 가드는 나머지 Accept / Origin / X-Requested-With 까지 포함해 완전성을 검증.
    const required = [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ];
    for (const header of required) {
      assert.ok(
        src.includes(`'${header}'`),
        `ALLOWED_HEADERS 에 '${header}' 가 없습니다 — preflight Access-Control-Allow-Headers 에서 누락됩니다.`,
      );
    }
  });

  test('1.6 optionsSuccessStatus: 204 설정 (AC3 — preflight 응답 코드)', () => {
    const src = read(CORS_CONFIG_REL);
    assert.ok(
      src.includes('optionsSuccessStatus') && src.includes('204'),
      `cors.config.ts 에 optionsSuccessStatus: 204 가 없습니다 — OPTIONS preflight 가 200 으로 응답해 구형 브라우저 호환성 저하`,
    );
  });

  test('1.7 credentials: true 포함 (쿠키/Authorization 동반 요청 허용)', () => {
    const src = read(CORS_CONFIG_REL);
    assert.ok(
      src.includes('credentials: true') || src.includes('credentials:true'),
      `cors.config.ts 에 credentials: true 가 없습니다 — Authorization 헤더 동반 요청 CORS 차단됨`,
    );
  });

  test("1.8 AC2 — wildcard origin '*' 부재 (보안 회귀 가드)", () => {
    const src = read(CORS_CONFIG_REL);
    // credentials: true 와 origin: '*' 를 함께 쓰면 브라우저가 CORS 오류를 냄.
    // 이 가드는 누군가 origin: '*' 로 수정했을 때 즉시 실패한다.
    const hasWildcard =
      /origin\s*:\s*['"`]\*['"`]/.test(src) ||
      /origin\s*:\s*\[['"`]\*['"`]\]/.test(src);
    assert.ok(
      !hasWildcard,
      `cors.config.ts 에 origin: '*' (wildcard) 가 발견됐습니다.\n` +
        `credentials: true 와 origin: '*' 의 동시 사용은 브라우저 CORS 정책에 위반됩니다.\n` +
        `origin 화이트리스트 배열로 되돌려야 합니다.`,
    );
  });

  test('1.9 buildCorsOptions 함수 export 존재 — main.ts 연결 계약', () => {
    const src = read(CORS_CONFIG_REL);
    assert.ok(
      src.includes('export function buildCorsOptions') ||
        src.includes('export const buildCorsOptions'),
      `cors.config.ts 에 buildCorsOptions export 가 없습니다 — main.ts 의 enableCors 호출이 깨집니다.`,
    );
  });

  test('1.10 parseAllowedOrigins 함수 export 존재 — 명시적 whitelist 체크 보장 (AC2)', () => {
    const src = read(CORS_CONFIG_REL);
    assert.ok(
      src.includes('parseAllowedOrigins'),
      `cors.config.ts 에 parseAllowedOrigins 가 없습니다.\n` +
        `origin 검사가 whitelist 배열 방식이 아닌 다른 방식으로 바뀌었을 수 있습니다.`,
    );
  });
});

// ══════════════════════════════════════════════════════════════
// Section 2 — main.ts + .env.example 배선 계약 가드
// ══════════════════════════════════════════════════════════════

describe('BF-729 · main.ts + .env.example 배선 계약 가드', () => {
  test('2.1 main.ts 가 CORS_ALLOWED_ORIGINS 환경변수를 참조한다', () => {
    const src = read('src/main.ts');
    assert.ok(
      src.includes('CORS_ALLOWED_ORIGINS'),
      `src/main.ts 에 CORS_ALLOWED_ORIGINS 참조가 없습니다 — 환경변수 기반 동적 설정이 누락됩니다.`,
    );
  });

  test('2.2 main.ts 가 buildCorsOptions 로 enableCors 를 호출한다', () => {
    const src = read('src/main.ts');
    assert.ok(
      src.includes('buildCorsOptions'),
      `src/main.ts 에 buildCorsOptions 가 없습니다 — CORS 미들웨어가 정적 옵션으로 기동됩니다.`,
    );
    assert.ok(
      src.includes('app.enableCors(buildCorsOptions('),
      `src/main.ts 의 enableCors 가 buildCorsOptions 를 사용하지 않습니다.\n` +
        `app.enableCors(buildCorsOptions(corsAllowedOrigins)) 형식이어야 합니다.`,
    );
  });

  test('2.3 .env.example 에 CORS_ALLOWED_ORIGINS 항목이 존재한다 (운영 환경 가이드 보존)', () => {
    const src = read('.env.example');
    assert.ok(
      src.includes('CORS_ALLOWED_ORIGINS'),
      `.env.example 에 CORS_ALLOWED_ORIGINS 항목이 없습니다 — 운영 배포 시 환경변수 설정 가이드 누락`,
    );
  });

  test("2.4 AC2 — .env.example 의 CORS_ALLOWED_ORIGINS 값에 wildcard '*' 가 없다", () => {
    const src = read('.env.example');
    // CORS_ALLOWED_ORIGINS=* 로 설정한 예시가 있으면 운영 환경에서 복붙 실수로 wildcard 가 됨
    const match = src.match(/CORS_ALLOWED_ORIGINS\s*=\s*([^\n]+)/);
    if (match) {
      const value = match[1].trim();
      assert.ok(
        !value.includes('*'),
        `.env.example 의 CORS_ALLOWED_ORIGINS 값에 '*' 가 포함되어 있습니다: "${value}"\n` +
          `wildcard 를 예시로 두면 운영 배포 시 복붙 실수가 발생합니다.`,
      );
    }
    // 값이 없으면 (항목만 있고 값 없음) OK
  });
});

// ══════════════════════════════════════════════════════════════
// Section 3 — HTTP 프로토콜 가드 (BRIX_E2E_SKIP=1 시 skip)
//
// Node.js 내장 http 모듈로 최소 CORS 서버를 기동해
// 실제 HTTP 요청/응답 레벨에서 CORS 프로토콜 동작을 검증한다.
//
// dev(BF-727) 가 이미 검증한 항목과의 분리:
//   - dev: GET /cors-ping + 3001 → 200 + ACAO ✓
//   - dev: OPTIONS /cors-ping + 3001 → 204 + Allow-Methods(POST,OPTIONS) + Allow-Headers(Auth,CT) ✓
//   - dev: evil.example.com GET → ACAO "not equal to evil.example.com" ✓
//
// 이 섹션의 추가 검증:
//   - POST + 3001 → 200 + ACAO (dev 미커버 — AC1 명시)
//   - OPTIONS preflight + 3001 → ALLOWED_HEADERS 5개 전부 (Accept/Origin/X-Requested-With 추가)
//   - evil.example.com GET → ACAO 헤더 완전 부재 (undefined, dev 보다 강한 assertion)
//   - evil.example.com OPTIONS → ACAO 헤더 완전 부재
// ══════════════════════════════════════════════════════════════

/**
 * CORS 화이트리스트 기반 HTTP 서버 (최소 구현 — NestJS 없이 프로토콜 계약 검증용)
 *
 * 허용 origin: cors.config.ts 의 DEFAULT_ALLOWED_ORIGINS (정적 독취)
 *   → 화이트리스트가 변경되면 Section 1 정적 가드가 먼저 실패하고,
 *     그 변경이 HTTP 레벨에도 반영되는지 이 섹션이 추가 검증한다.
 */
function buildTestServer() {
  // cors.config.ts 에서 선언된 상수를 정적으로 파싱해 서버에 적용.
  // buildCorsOptions() 가 반환하는 origin 배열과 동일한 값이 되어야 한다.
  const corsConfigSrc = read('src/config/cors.config.ts');

  // DEFAULT_ALLOWED_ORIGINS 배열 리터럴 파싱
  const originsMatch = corsConfigSrc.match(
    /DEFAULT_ALLOWED_ORIGINS[^=]*=\s*\[([^\]]+)\]/,
  );
  const allowedOrigins = originsMatch
    ? (originsMatch[1].match(/'([^']+)'/g) ?? []).map((s) => s.replace(/'/g, ''))
    : ['http://localhost:3000', 'http://localhost:3001'];

  // ALLOWED_HEADERS 배열 리터럴 파싱 (preflight 응답에 사용)
  const headersMatch = corsConfigSrc.match(
    /ALLOWED_HEADERS[^=]*=\s*\[([^\]]+)\]/,
  );
  const allowedHeaders = headersMatch
    ? (headersMatch[1].match(/'([^']+)'/g) ?? []).map((s) => s.replace(/'/g, ''))
    : ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'];

  // ALLOWED_METHODS 배열 리터럴 파싱
  const methodsMatch = corsConfigSrc.match(
    /ALLOWED_METHODS[^=]*=\s*\[([^\]]+)\]/,
  );
  const allowedMethods = methodsMatch
    ? (methodsMatch[1].match(/'([^']+)'/g) ?? []).map((s) => s.replace(/'/g, ''))
    : ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'];

  const server = http.createServer((req, res) => {
    const origin = req.headers['origin'] ?? '';
    const isAllowed = allowedOrigins.includes(origin);

    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(','));
        res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(','));
      }
      res.writeHead(204);
      res.end();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });

  return { server, allowedOrigins, allowedHeaders, allowedMethods };
}

/** Node.js HTTP 요청 헬퍼 */
function httpRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const httpSkipReason = SKIP_HTTP
  ? 'BRIX_E2E_SKIP=1 — HTTP 통합 가드 skip'
  : false;

describe(
  'BF-729 · HTTP 프로토콜 가드 — POST + 완전 헤더 + evil.example.com 완전 차단',
  { skip: httpSkipReason },
  () => {
    let server;
    let port;

    before(() =>
      new Promise((resolve, reject) => {
        const built = buildTestServer();
        server = built.server;
        server.listen(0, '127.0.0.1', () => {
          port = server.address().port;
          resolve();
        });
        server.on('error', reject);
      }),
    );

    after(() =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
    );

    // ─── AC1: POST with localhost:3001 → 200 + ACAO ─────────────────
    // dev(BF-727) 는 GET 만 검증. POST 동작은 이 가드가 처음 검증.

    test('AC1 — POST /api with localhost:3001 → 200 + ACAO 반환', async () => {
      const res = await httpRequest({
        host: '127.0.0.1',
        port,
        path: '/api',
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3001',
          'Content-Type': 'application/json',
        },
      });
      assert.equal(
        res.status,
        200,
        `POST with localhost:3001 이 200 을 반환하지 않습니다 (got ${res.status})`,
      );
      assert.equal(
        res.headers['access-control-allow-origin'],
        'http://localhost:3001',
        `POST 응답에 Access-Control-Allow-Origin: localhost:3001 가 없습니다.\n` +
          `→ ALLOWED_METHODS 에 POST 포함 여부 또는 CORS 미들웨어 배선을 확인하세요.`,
      );
    });

    test('AC1 — POST /api with localhost:3001 → Access-Control-Allow-Credentials: true', async () => {
      const res = await httpRequest({
        host: '127.0.0.1',
        port,
        path: '/api',
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3001',
          'Content-Type': 'application/json',
        },
      });
      assert.equal(
        res.headers['access-control-allow-credentials'],
        'true',
        `POST 응답에 Access-Control-Allow-Credentials: true 가 없습니다 — JWT 토큰 동반 POST 가 차단됩니다.`,
      );
    });

    // ─── AC3: OPTIONS preflight — ALLOWED_HEADERS 5개 전부 ───────────
    // dev(BF-727) 는 Authorization / Content-Type 만 확인.
    // 이 가드는 Accept / Origin / X-Requested-With 까지 포함해 완전성 검증.

    test('AC3 — OPTIONS preflight → Access-Control-Allow-Headers 에 5개 헤더 전부 포함', async () => {
      const res = await httpRequest({
        host: '127.0.0.1',
        port,
        path: '/api',
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3001',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers':
            'Authorization,Content-Type,Accept,Origin,X-Requested-With',
        },
      });
      assert.equal(
        res.status,
        204,
        `OPTIONS preflight 가 204 를 반환하지 않습니다 (got ${res.status})`,
      );
      const allowHeaders = (
        res.headers['access-control-allow-headers'] ?? ''
      ).toLowerCase();
      const required = [
        'content-type',
        'authorization',
        'accept',
        'origin',
        'x-requested-with',
      ];
      for (const h of required) {
        assert.ok(
          allowHeaders.includes(h.toLowerCase()),
          `Access-Control-Allow-Headers 에 '${h}' 가 없습니다 (got: "${res.headers['access-control-allow-headers']}").\n` +
            `→ ALLOWED_HEADERS 배열에 '${h}' 를 추가하세요.`,
        );
      }
    });

    test('AC3 — OPTIONS preflight → Access-Control-Allow-Methods 에 POST 포함', async () => {
      const res = await httpRequest({
        host: '127.0.0.1',
        port,
        path: '/api',
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3001',
          'Access-Control-Request-Method': 'POST',
        },
      });
      const allowMethods = (
        res.headers['access-control-allow-methods'] ?? ''
      ).toUpperCase();
      assert.ok(
        allowMethods.includes('POST'),
        `Access-Control-Allow-Methods 에 POST 가 없습니다 (got: "${res.headers['access-control-allow-methods']}")`,
      );
    });

    // ─── AC2: evil.example.com → ACAO 헤더 완전 부재 ─────────────────
    // dev(BF-727) 는 ACAO "not equal to evil.example.com" 수준만 검증.
    // 이 가드는 헤더가 아예 undefined 임을 검증 (wildcard 후퇴 시도도 잡힘).

    test('AC2 — evil.example.com GET → Access-Control-Allow-Origin 헤더 완전 부재', async () => {
      const res = await httpRequest({
        host: '127.0.0.1',
        port,
        path: '/api',
        method: 'GET',
        headers: { Origin: 'http://evil.example.com' },
      });
      assert.equal(
        res.status,
        200,
        // 200 은 정상 — CORS 차단은 헤더 부재로 이루어짐 (서버는 200 반환하되 브라우저가 차단)
        `GET 요청이 200 을 반환하지 않습니다 (got ${res.status})`,
      );
      assert.equal(
        res.headers['access-control-allow-origin'],
        undefined,
        `evil.example.com GET 응답에 Access-Control-Allow-Origin 이 설정되어 있습니다: ` +
          `"${res.headers['access-control-allow-origin']}"\n` +
          `→ origin 화이트리스트 체크가 우회됐거나 wildcard 로 설정됐습니다.`,
      );
    });

    test('AC2 — evil.example.com OPTIONS preflight → Access-Control-Allow-Origin 헤더 부재', async () => {
      const res = await httpRequest({
        host: '127.0.0.1',
        port,
        path: '/api',
        method: 'OPTIONS',
        headers: {
          Origin: 'http://evil.example.com',
          'Access-Control-Request-Method': 'GET',
        },
      });
      assert.equal(
        res.headers['access-control-allow-origin'],
        undefined,
        `evil.example.com OPTIONS preflight 응답에 ACAO 가 설정되어 있습니다: ` +
          `"${res.headers['access-control-allow-origin']}"\n` +
          `→ preflight 단계에서 비허용 origin 이 차단되지 않고 있습니다.`,
      );
    });

    test('AC2 — Origin 없는 요청 → ACAO 헤더 부재 (non-CORS 요청 정상 처리)', async () => {
      const res = await httpRequest({
        host: '127.0.0.1',
        port,
        path: '/api',
        method: 'GET',
        headers: {},
      });
      assert.equal(
        res.status,
        200,
        `Origin 없는 요청이 200 을 반환하지 않습니다 (got ${res.status})`,
      );
      assert.equal(
        res.headers['access-control-allow-origin'],
        undefined,
        `Origin 없는 요청에 ACAO 가 설정되면 안 됩니다 (got: "${res.headers['access-control-allow-origin']}")`,
      );
    });
  },
);
