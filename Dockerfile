# ────────────────────────────────────────────────────────────
# Stage 1: builder — 전체 의존성 설치 + NestJS 빌드
# ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Alpine 에서 Prisma query engine 빌드·generate 에 openssl 필요
RUN apk add --no-cache openssl

WORKDIR /app

# lockfile 기반으로 의존성 캐시 레이어 최적화
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ────────────────────────────────────────────────────────────
# Stage 2: production — 런타임 이미지
# ────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Alpine 에서 Prisma migrate deploy / query engine 실행에 openssl 필요
# 없으면 "Prisma failed to detect the libssl/openssl version" 에러 발생
RUN apk add --no-cache openssl

WORKDIR /app

# 프로덕션 의존성만 설치
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod

# 빌드 산출물 복사
COPY --from=builder /app/dist ./dist

# Prisma 스키마 + 마이그레이션 복사 (migrate deploy 런타임 실행 필요)
COPY prisma ./prisma

# Prisma CLI 복사 (devDep 이지만 migrate deploy 에 필요)
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

# 시작 시 DB 마이그레이션 적용 후 앱 기동
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]
