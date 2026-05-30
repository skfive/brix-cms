# brix-cms

NestJS 기반 블로그 CMS 백엔드 + Next.js 프론트엔드 — Prisma/SQLite + JWT 인증 + shadcn/ui + Docker 배포.

---

## 목차

1. [빠른 시작 (Docker Compose)](#1-빠른-시작-docker-compose)
2. [로컬 개발 환경](#2-로컬-개발-환경)
3. [환경 변수](#3-환경-변수)
4. [개발 명령어](#4-개발-명령어)
5. [프론트엔드 (Next.js + shadcn/ui)](#5-프론트엔드-nextjs--shadcnui)
6. [데모 계정 & 시드](#6-데모-계정--시드)
7. [API 엔드포인트 개요](#7-api-엔드포인트-개요)
8. [알려진 문제 및 해결 방법](#8-알려진-문제-및-해결-방법)
9. [운영자 체크리스트](#9-운영자-체크리스트)
10. [테스트 실행 가이드](#10-테스트-실행-가이드)

---

## 1. 빠른 시작 (Docker Compose)

```bash
# 1) .env 파일 생성 (최초 1회)
cp .env.example .env
# .env 열어 JWT_SECRET 를 임의의 긴 문자열로 교체

# 2) 이미지 빌드 + 컨테이너 기동
docker compose up --build

# 3) 앱 확인
curl http://localhost:3000/health
# → { "status": "ok" }
```

> **주의** — `docker compose up` 전에 반드시 `.env` 파일이 존재해야 합니다.  
> 없으면 `JWT_SECRET` 환경변수 미설정으로 앱이 즉시 종료됩니다.

---

## 2. 로컬 개발 환경

### 사전 요구사항

| 도구 | 버전 |
|------|------|
| Node.js | 20.x |
| pnpm | 10.x (`corepack enable` 으로 활성화) |
| Docker / Docker Compose | 24.x 이상 권장 |

### 설치 및 실행

```bash
# 의존성 설치
pnpm install

# Prisma 클라이언트 생성 (최초 1회 또는 schema 변경 시)
pnpm prisma generate

# DB 마이그레이션 적용
pnpm prisma migrate dev

# 개발 서버 기동 (watch 모드)
pnpm start:dev
```

---

## 3. 환경 변수

`.env.example` 를 복사해 `.env` 를 만들고 값을 채웁니다.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3000` | HTTP 리스닝 포트 |
| `DATABASE_URL` | `file:./dev.db` | SQLite 파일 경로 (Docker 에서는 `/data/dev.db` 로 override) |
| `JWT_SECRET` | **(필수 변경)** | JWT 서명 시크릿. `openssl rand -base64 32` 로 생성 권장 |

```bash
# JWT_SECRET 생성 예시
openssl rand -base64 32
```

---

## 4. 개발 명령어

```bash
# lint 검사 (위반 시 0이 아닌 exit code)
pnpm lint

# TypeScript 타입 검사
pnpm typecheck

# 빌드
pnpm build

# 단위 테스트
pnpm test

# 전체 검증 (lint + typecheck + build + test)
pnpm verify

# 코드 포맷 자동 수정
pnpm format

# Prisma Studio (DB GUI)
pnpm prisma studio
```

---

## 5. 프론트엔드 (Next.js + shadcn/ui)

brix-CMS 관리자 UI 는 Next.js 14+ (App Router) + shadcn/ui (Zinc 테마) 로 구성됩니다.

### 화면 목록

| 경로 | 화면 | 인증 |
|------|------|------|
| `/login` | 로그인 | 퍼블릭 |
| `/register` | 가입 | 퍼블릭 |
| `/dashboard` | 대시보드 | 필요 |
| `/posts` | 포스트 목록 | 필요 |
| `/posts/new` | 포스트 작성 | 필요 |
| `/posts/[id]/edit` | 포스트 편집 | 필요 |
| `/pages` | 페이지 목록 | 필요 |
| `/pages/new` | 페이지 작성 | 필요 |
| `/pages/[id]/edit` | 페이지 편집 | 필요 |

### 프론트엔드 개발 서버 시작

```bash
# 의존성 설치 (최초 1회)
pnpm install

# Next.js 개발 서버 (포트 3001)
pnpm dev:next

# NestJS 백엔드와 동시에 실행 시
pnpm start:dev   # 백엔드 포트 3000
pnpm dev:next    # 프론트엔드 포트 3001
```

### 기술 스택

| 역할 | 기술 |
|------|------|
| 프레임워크 | Next.js 14+ (App Router) |
| UI 컴포넌트 | shadcn/ui (Zinc 테마) |
| 스타일 | Tailwind CSS v3 |
| 폼 검증 | react-hook-form + zod |
| 아이콘 | lucide-react |

---

## 6. 데모 계정 & 시드

e2e/API 테스트용 데모 계정은 시드 스크립트로 생성합니다.

### 데모 계정 정보

| 항목 | 값 |
|------|-----|
| **Email** | `demo@brix-cms.local` |
| **Password** | `Demo1234!` |
| **Role** | `user` |

### 시드 실행

```bash
# DB 마이그레이션 후 시드 실행
pnpm prisma migrate dev
pnpm seed

# 또는 prisma db seed (package.json prisma.seed 설정 사용)
pnpm prisma db seed
```

> 시드는 멱등합니다 — 동일한 이메일이 이미 존재하면 upsert 로 갱신합니다.

---

## 7. API 엔드포인트 개요

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/health` | 불필요 | 헬스체크 |
| POST | `/auth/register` | 불필요 | 회원가입 |
| POST | `/auth/login` | 불필요 | 로그인 → JWT 반환 |
| GET/POST | `/posts` | JWT (쓰기) | 포스트 목록·작성 |
| GET/PATCH/DELETE | `/posts/:id` | JWT (수정·삭제) | 포스트 상세·수정·삭제 |
| GET | `/posts/slug/:slug` | 불필요 | 슬러그로 포스트 조회 |
| GET/POST | `/pages` | JWT (쓰기) | 페이지 목록·작성 |
| GET | `/pages/slug/:slug` | 불필요 | 슬러그로 페이지 조회 |
| POST | `/posts/:id/comments` | JWT | 댓글 작성 |
| GET | `/posts/:id/comments` | 불필요 | 댓글 목록 |

> JWT 인증이 필요한 요청은 `Authorization: Bearer <token>` 헤더를 추가하세요.

---

## 8. 알려진 문제 및 해결 방법

### ❌ `docker compose up` 시 Prisma OpenSSL 에러

```
Error: Could not parse schema engine response: SyntaxError: Unexpected token 'E'...
prisma:warn Prisma failed to detect the libssl/openssl version to use...
```

**원인**: `node:20-alpine` 이미지에 `openssl` 패키지가 없어 Prisma query engine 이 로드되지 않음.

**해결 (이미 적용됨 — BF-707)**:
- `Dockerfile` 의 builder/production 스테이지에 `RUN apk add --no-cache openssl` 추가
- `prisma/schema.prisma` 의 generator에 `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` 추가

이미 수정된 코드이므로 `docker compose up --build` 로 이미지를 **재빌드**하면 해결됩니다.

```bash
# 기존 이미지 캐시 제거 후 재빌드
docker compose down
docker compose build --no-cache
docker compose up
```

---

### ❌ `.env` 파일 없어서 앱 즉시 종료

```
Error: Config validation error: JWT_SECRET is missing
```

**해결**: `.env.example` 을 복사해 `.env` 파일을 만들고 `JWT_SECRET` 을 채워넣습니다.

```bash
cp .env.example .env
# .env 를 열어 JWT_SECRET 값을 변경
```

---

## 9. 운영자 체크리스트

Docker Compose 로 서비스를 처음 기동할 때 순서대로 확인하세요.

- [ ] **`.env` 파일 생성**: `cp .env.example .env`
- [ ] **`JWT_SECRET` 교체**: `.env` 에서 `change-me-to-a-random-secret` 를 실제 시크릿으로 변경
  ```bash
  openssl rand -base64 32
  ```
- [ ] **이미지 재빌드** (OpenSSL 픽스가 포함된 최신 이미지 사용):
  ```bash
  docker compose build --no-cache
  ```
- [ ] **서비스 기동**:
  ```bash
  docker compose up
  ```
- [ ] **헬스체크 확인**:
  ```bash
  curl http://localhost:3000/health
  # 기대 응답: {"status":"ok"}
  ```
- [ ] **데이터 영속성 확인**: `db-data` named volume 에 SQLite 파일이 저장되므로, `docker compose down` 후 재기동해도 데이터가 유지됩니다.

---

## 10. 테스트 실행 가이드

> **사전 조건**: `pnpm install` 완료 + `.env` 파일 생성 (`JWT_SECRET` 설정 필요)

### 단위 / 통합 테스트 (NestJS 서비스·컨트롤러)

```bash
pnpm test
```

### E2E 테스트 전체 실행

```bash
pnpm test:e2e
```

모든 `test/*.e2e-spec.ts` 파일을 실행합니다.
테스트별 격리된 SQLite DB (`/tmp/brix-test-*.db`)를 사용하므로 운영 DB 에 영향을 주지 않습니다.

### API 통합 테스트 (demo 계정 인증 흐름 포함)

```bash
pnpm test:api
```

BF-713 기준 E2E 테스트를 실행합니다:
- 가입→로그인→post 작성→로그아웃 전체 시나리오
- `demo@brix-cms.local` / `Demo1234!` 자격증명으로 posts/pages/comments API 전체 커버
- 모든 보호 엔드포인트의 401 인증 실패 케이스 커버

### 테스트 커버리지 리포트

```bash
pnpm test:cov
```

---

## 변경 이력

| BF 티켓 | 내용 |
|---------|------|
| BF-713 | E2E + API 회귀 가드 — 가입/로그인/로그아웃/post/pages + demo 계정 |
| BF-707 | 빌드 타입 에러 수정, ESLint/Prettier 도입, Prisma Alpine OpenSSL 에러 수정 |
| BF-711 | .gitignore 정리, shadcn/ui 도입, Next.js 프론트엔드 전체 페이지 구현, demo 계정 시드 |
| BF-708 | shadcn/ui 기반 프론트엔드 디자인 명세 (designer) |
| BF-707 | 빌드 타입 에러 수정, ESLint/Prettier 도입, Prisma Alpine OpenSSL 에러 수정 |
| BF-705 | Docker Compose 환경 구성 + pnpm 마이그레이션 |
| BF-701 | CommentModule E2E 회귀 가드 |
| BF-699 | CommentModule 구현 |
| BF-695 | PageModule CRUD |
| BF-691 | PostModule CRUD |
