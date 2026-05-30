/**
 * Next.js 설정 (ESM)
 *
 * ⚠️ Next.js 14 는 `next.config.ts` (TypeScript 설정) 를 지원하지 않는다.
 *    `.ts` 로 두면 `next dev`/`next build` 가 "Configuring Next.js via
 *    'next.config.ts' is not supported" 로 즉시 종료되어 프론트엔드 진입이
 *    불가능했다 (BF-719). 따라서 `.mjs` 로 작성한다.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // NestJS 백엔드 API 프록시 설정 (개발 환경)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/:path*',
      },
    ]
  },
}

export default nextConfig
