# ────────────────────────────────────────────────────────────
# Single-stage build — pnpm + Prisma + Alpine
#
# 멀티스테이지 구조에서 발생하는 pnpm 가상 스토어 경로 불일치
# (.prisma/client/default MODULE_NOT_FOUND) 를 방지하기 위해
# 단일 스테이지로 통합한다.
# prisma generate 와 nest build 가 같은 node_modules 를 공유하므로
# 생성된 Prisma 클라이언트가 항상 올바른 경로에 존재함이 보장된다.
# ────────────────────────────────────────────────────────────
FROM node:20-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Alpine(musl) 에서 Prisma query engine / migrate engine 실행에 openssl 필요
RUN apk add --no-cache openssl

WORKDIR /app

# lockfile 기반으로 의존성 캐시 레이어 최적화
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .

# prebuild: prisma generate → nest build 순서로 실행됨
RUN pnpm run build

EXPOSE 3000

# 시작 시 DB 마이그레이션 적용 후 앱 기동
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]
