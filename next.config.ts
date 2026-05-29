import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
