import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * BF-727 — CORS 설정 빌더
 *
 * dev 환경에서 Next.js 프론트엔드(`next dev -p 3001`)와 추가 클라이언트가
 * NestJS 백엔드 API 를 cross-origin 으로 호출할 수 있도록 CORS 미들웨어 옵션을
 * 생성한다. allowed origins 화이트리스트는 `CORS_ALLOWED_ORIGINS` 환경변수
 * (comma-separated)로 동적 지정 가능하며, 미지정 시 dev 기본값을 사용한다.
 *
 * credentials: true 인 경우 `Access-Control-Allow-Origin` 을 `*` 로 둘 수 없어
 * 화이트리스트 기반 origin 반사(reflection) 방식을 사용한다.
 */

/** dev 환경 기본 허용 origin (env 미지정 시 fallback) */
export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = [
  'http://localhost:3000',
  'http://localhost:3001',
];

/** preflight(OPTIONS) 및 실제 요청에 허용할 HTTP 메서드 */
export const ALLOWED_METHODS: readonly string[] = [
  'GET',
  'HEAD',
  'PUT',
  'PATCH',
  'POST',
  'DELETE',
  'OPTIONS',
];

/** preflight 에 허용할 요청 헤더 (JWT 인증 Authorization 포함) */
export const ALLOWED_HEADERS: readonly string[] = [
  'Content-Type',
  'Authorization',
  'Accept',
  'Origin',
  'X-Requested-With',
];

/**
 * 환경변수 문자열(comma-separated)을 origin 배열로 파싱한다.
 * 빈 문자열/undefined 면 dev 기본값을 반환한다.
 */
export function parseAllowedOrigins(raw?: string): string[] {
  if (!raw || raw.trim() === '') {
    return [...DEFAULT_ALLOWED_ORIGINS];
  }
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * NestJS `app.enableCors()` 에 전달할 CORS 옵션을 생성한다.
 *
 * @param raw `CORS_ALLOWED_ORIGINS` 환경변수 값 (comma-separated, 선택)
 */
export function buildCorsOptions(raw?: string): CorsOptions {
  return {
    origin: parseAllowedOrigins(raw),
    methods: [...ALLOWED_METHODS],
    allowedHeaders: [...ALLOWED_HEADERS],
    credentials: true,
    // preflight 성공 시 204 No Content (구형 브라우저 호환 위해 명시)
    optionsSuccessStatus: 204,
  };
}
