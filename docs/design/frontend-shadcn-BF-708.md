# brix-CMS 프론트엔드 디자인 명세 (BF-708)

> **Epic**: shadcn/ui 기반 전체 디자인 명세  
> **담당**: 이디자인 (designer 페르소나)  
> **작성일**: 2026-05-29  
> **대상 범위**: 가입/로그인/로그아웃, Post 관리, Pages 관리

---

## 1. 시안 개요

### 변경 범위
brix-CMS 백엔드(NestJS + Prisma)와 연동되는 프론트엔드 관리자 UI 전체 화면을 shadcn/ui 컴포넌트 시스템 기반으로 설계한다.

### 대상 화면
| 화면 | 경로 | 인증 |
|------|------|------|
| 로그인 | `/login` | 퍼블릭 |
| 가입 | `/register` | 퍼블릭 |
| 대시보드 | `/dashboard` | 필요 |
| 포스트 목록 | `/posts` | 필요 |
| 포스트 작성 | `/posts/new` | 필요 |
| 포스트 편집 | `/posts/[id]/edit` | 필요 |
| 페이지 목록 | `/pages` | 필요 |
| 페이지 작성 | `/pages/new` | 필요 |
| 페이지 편집 | `/pages/[id]/edit` | 필요 |

### 사용자 경험 목표
1. **효율성**: 콘텐츠 관리자가 최소 클릭으로 포스트/페이지 작성·발행
2. **명확성**: 발행 상태(DRAFT/PUBLISHED/ARCHIVED)를 색상 배지로 즉시 인식
3. **일관성**: shadcn/ui 디자인 언어를 모든 화면에 적용 (Zinc 팔레트 기준)
4. **반응성**: 모바일(375px) ~ 데스크탑(1280px+) 전 구간 대응

---

## 2. 컬러 팔레트

shadcn/ui **Zinc** 테마 기반 CSS 변수. `dark:` 클래스 지원.

### 라이트 모드

| 토큰 변수 | HEX (approximation) | HSL 값 | 용도 |
|-----------|---------------------|---------|------|
| `--background` | `#FFFFFF` | `0 0% 100%` | 페이지 배경 |
| `--foreground` | `#09090B` | `240 10% 3.9%` | 기본 텍스트 |
| `--card` | `#FFFFFF` | `0 0% 100%` | 카드 배경 |
| `--card-foreground` | `#09090B` | `240 10% 3.9%` | 카드 텍스트 |
| `--primary` | `#18181B` | `240 5.9% 10%` | 주요 버튼·액션 |
| `--primary-foreground` | `#FAFAFA` | `0 0% 98%` | primary 위 텍스트 |
| `--secondary` | `#F4F4F5` | `240 4.8% 95.9%` | 보조 버튼 배경 |
| `--secondary-foreground` | `#18181B` | `240 5.9% 10%` | 보조 버튼 텍스트 |
| `--muted` | `#F4F4F5` | `240 4.8% 95.9%` | 비활성·보조 영역 |
| `--muted-foreground` | `#71717A` | `240 3.8% 46.1%` | 플레이스홀더·설명 |
| `--accent` | `#F4F4F5` | `240 4.8% 95.9%` | hover 하이라이트 |
| `--destructive` | `#EF4444` | `0 84.2% 60.2%` | 삭제·오류 |
| `--border` | `#E4E4E7` | `240 5.9% 90%` | 테두리 |
| `--input` | `#E4E4E7` | `240 5.9% 90%` | 입력 필드 테두리 |
| `--ring` | `#18181B` | `240 5.9% 10%` | 포커스 링 |

### 상태 배지 컬러

| 상태 | 배경 | 텍스트 | 설명 |
|------|------|--------|------|
| DRAFT | `#F4F4F5` | `#71717A` | 임시저장 — Zinc muted |
| PUBLISHED | `#DCFCE7` | `#16A34A` | 발행됨 — Green-100 / Green-600 |
| ARCHIVED | `#FEF9C3` | `#CA8A04` | 보관됨 — Yellow-100 / Yellow-600 |

---

## 3. 타이포그래피

**Font Stack**: `"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif`

> Next.js 프로젝트에서 `next/font/google` 로 Inter 로드 권장.

| 레벨 | font-size | font-weight | line-height | 용도 |
|------|-----------|-------------|-------------|------|
| `h1` | `2.25rem` (36px) | 700 | 1.2 | 페이지 제목 |
| `h2` | `1.875rem` (30px) | 700 | 1.25 | 섹션 제목 |
| `h3` | `1.5rem` (24px) | 600 | 1.35 | 카드 제목 |
| `h4` | `1.25rem` (20px) | 600 | 1.4 | 하위 섹션 |
| `body-lg` | `1rem` (16px) | 400 | 1.5 | 본문 큰 |
| `body` | `0.875rem` (14px) | 400 | 1.5 | 기본 본문 |
| `caption` | `0.75rem` (12px) | 400 | 1.5 | 메타·라벨 |

---

## 4. 레이아웃

### 그리드 시스템
- **컨테이너 최대 너비**: 1280px (xl breakpoint)
- **좌우 패딩**: mobile: 1rem / tablet: 1.5rem / desktop: 2rem

### Breakpoints

| 이름 | 최소 너비 | Tailwind 접두사 |
|------|-----------|----------------|
| mobile | 0px | (base) |
| sm | 640px | `sm:` |
| md | 768px | `md:` |
| lg | 1024px | `lg:` |
| xl | 1280px | `xl:` |

### 관리자 셸(Admin Shell) 레이아웃

```
+-------------------------+------------------------------+
|  Sidebar (240px fixed)  |  Main Content (flex-1)       |
|                         |  +-- Header (56px) --------+ |
|  [Logo]  brix-CMS       |  | Breadcrumb / Title       | |
|                         |  +---------------------------+ |
|  Navigation             |                              |
|   Dashboard             |  Page Body (p-6)             |
|   Posts                 |                              |
|   Pages                 |                              |
|                         |                              |
|  [User]  [Logout]       |                              |
+-------------------------+------------------------------+
```

- **Sidebar 너비**: 240px (desktop), drawer on mobile
- **Header 높이**: 56px
- **Content padding**: 1.5rem all sides

### Auth 레이아웃

```
+------------------------------------------+
|        (배경: --muted/40, full screen)    |
|   +-------------------------------+       |
|   | Card (max-w: 400px)           |       |
|   | - Logo / App Name             |       |
|   | - Form Fields                 |       |
|   | - Action Button               |       |
|   | - Switch Link                 |       |
|   +-------------------------------+       |
+------------------------------------------+
```

---

## 5. 컴포넌트 명세

### 5.1 Button

| variant | 사용처 | 스타일 |
|---------|--------|--------|
| `default` | 주요 CTA (로그인, 저장, 발행) | `--primary` bg |
| `secondary` | 보조 액션 (취소) | `--secondary` bg |
| `destructive` | 삭제 확인 | `--destructive` bg |
| `outline` | 임시저장 | `--border` 1px |
| `ghost` | 네비 hover | transparent |
| `link` | 텍스트 링크 | underline |

**Props**:
```ts
interface ButtonProps {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'
  size?: 'sm' | 'default' | 'lg' | 'icon'
  disabled?: boolean
  isLoading?: boolean
  asChild?: boolean
}
```

---

### 5.2 Input / Textarea

**Props**:
```ts
interface InputProps {
  label?: string
  placeholder?: string
  error?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  type?: 'text' | 'email' | 'password'
}
```

**상태별 스타일**:
- default: `border-input bg-background`
- focus: `ring-2 ring-ring ring-offset-2`
- error: `border-destructive` + 하단 오류 텍스트
- disabled: `opacity-50 cursor-not-allowed bg-muted`

---

### 5.3 Badge (상태 표시)

**Props**:
```ts
interface BadgeProps {
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}
```

| status | className |
|--------|-----------|
| DRAFT | `bg-zinc-100 text-zinc-500 border border-zinc-200` |
| PUBLISHED | `bg-green-100 text-green-700 border border-green-200` |
| ARCHIVED | `bg-yellow-100 text-yellow-700 border border-yellow-200` |

---

### 5.4 DataTable (포스트/페이지 목록)

shadcn/ui Table 기반.

**컬럼 정의**:

| 필드 | 표시명 | 너비 | 정렬 |
|------|--------|------|------|
| `title` | 제목 | flex-1 | 좌 |
| `slug` | 슬러그 | 160px | 좌 |
| `status` | 상태 | 120px | 가운데 |
| `author.email` | 작성자 | 180px | 좌 |
| `createdAt` | 작성일 | 140px | 좌 |
| `actions` | 액션 | 100px | 가운데 |

**페이지네이션**:
- 페이지 크기: 10 / 25 / 50
- 현재 페이지 / 전체 표시: `1-10 of 43`

---

### 5.5 Form (포스트·페이지 편집)

| 필드 | 컴포넌트 | 검증 규칙 |
|------|----------|-----------|
| title | `Input` | 필수, 1-200자 |
| slug | `Input` | 옵션, 자동 생성, 200자 이하 |
| content | `Textarea` (min-h: 320px) | 옵션 |
| status | `Select` | 필수 (DRAFT/PUBLISHED/ARCHIVED) |

**Slug 자동 생성 UX**:
- title 입력 시 실시간 slug 미리보기
- 직접 편집 시 자동 생성 해제

---

### 5.6 Dialog (삭제 확인)

AlertDialog 기준:
- 제목: "삭제 확인"
- 본문: "포스트 '[제목]'을 삭제합니다. 이 작업은 되돌릴 수 없습니다."
- 버튼: [취소] / [삭제하기 (destructive)]

---

### 5.7 Toast

| 유형 | 색상 | 메시지 예시 |
|------|------|------------|
| success | Green | "포스트가 저장되었습니다." |
| error | Destructive | "저장에 실패했습니다." |
| warning | Yellow | "슬러그가 이미 사용 중입니다." |

---

### 5.8 Navigation (Sidebar)

| 아이콘 | 레이블 | href |
|--------|--------|------|
| `LayoutDashboard` | 대시보드 | `/dashboard` |
| `FileText` | 포스트 | `/posts` |
| `File` | 페이지 | `/pages` |

**Active 상태**: `bg-accent font-medium` + 좌측 2px primary 선

---

## 6. 페이지별 레이아웃 명세

### 6.1 로그인 (`/login`)

**레이아웃**: Auth 카드 중앙 배치

```
Card (max-w: 400px)
  brix-CMS  (h3, 굵게)
  "계정에 로그인하세요" (muted-foreground)

  [이메일 Input]
  [비밀번호 Input, type=password]

  [로그인] (w-full, default)

  "계정이 없으신가요? 가입하기" (link)
```

**오류**: Card 상단 `Alert destructive` — "이메일 또는 비밀번호가 올바르지 않습니다."

**API**: `POST /auth/login` → JWT 저장 → `/dashboard`

---

### 6.2 가입 (`/register`)

```
Card (max-w: 400px)
  brix-CMS  (로고)
  "새 계정을 만드세요" (muted-foreground)

  [이메일 Input]
  [비밀번호 Input] (min 8자 안내)
  [비밀번호 확인 Input]

  [가입하기] (w-full)

  "이미 계정이 있으신가요? 로그인" (link)
```

**검증**: 이메일 형식, 비밀번호 8자+, 확인 일치 (클라이언트 즉시)

**API**: `POST /auth/register` → JWT → `/dashboard`

---

### 6.3 로그아웃

- Sidebar 하단 "로그아웃" 버튼 클릭
- AlertDialog 확인 후 JWT 클리어 → `/login`

---

### 6.4 포스트 목록 (`/posts`)

```
[Page Header]
  제목: "포스트"          [새 포스트 Button]
  [상태 필터 Select]  [검색 Input]

[DataTable]
  제목 | 슬러그 | 상태 | 작성자 | 작성일 | 액션

[Pagination]
```

---

### 6.5 포스트 작성/편집 (`/posts/new`, `/posts/[id]/edit`)

```
[Page Header]
  ← 목록으로    제목: "새 포스트" / "포스트 편집"

[Form Card]
  [제목 Input]
  [슬러그 Input + "자동생성" 배지]
  [상태 Select]
  [내용 Textarea, min-h: 320px]

  [취소]  [임시저장]  [저장하기]
```

---

### 6.6 페이지 목록 / 작성 / 편집 (`/pages/*`)

포스트와 동일한 패턴. 댓글 섹션 없음.

---

## 7. dev 구현 가이드

### 기술 스택
- **프레임워크**: Next.js 14+ (App Router)
- **스타일**: Tailwind CSS v3 + shadcn/ui (Zinc 테마)
- **폼**: react-hook-form + zod
- **상태**: React Context / Zustand (JWT)
- **API**: fetch native

### CSS 변수 설정 (globals.css)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 5.9% 10%;
  --radius: 0.5rem;
}
```

### shadcn/ui 초기화

```bash
npx shadcn@latest init
# style: default, base color: zinc, CSS variables: yes

npx shadcn@latest add button input textarea select card badge table \
  dialog alert-dialog toast navigation-menu separator avatar \
  dropdown-menu pagination form label
```

### 클래스명 권장 패턴

```tsx
// 상태 배지
const STATUS_BADGE: Record<string, string> = {
  DRAFT:     'bg-zinc-100 text-zinc-500 border border-zinc-200',
  PUBLISHED: 'bg-green-100 text-green-700 border border-green-200',
  ARCHIVED:  'bg-yellow-100 text-yellow-700 border border-yellow-200',
}

// 페이지 컨테이너
<main className="flex-1 p-6 space-y-6">

// 섹션 헤더
<div className="flex items-center justify-between">
  <h1 className="text-2xl font-bold tracking-tight">포스트</h1>
  <Button>새 포스트</Button>
</div>
```

### zod 스키마

```ts
// 로그인
const loginSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
})

// 가입
const registerSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
})

// 포스트·페이지 공통
const contentSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  content: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
})
```

### JWT 인증 흐름

```
로그인 성공 → access_token localStorage 저장
→ 모든 API 요청: Authorization: Bearer <token>
→ 401 응답 시 /login redirect
로그아웃 → localStorage.removeItem('access_token') → /login push
```

---

## 8. mockup 참조

| 화면 | mockup 파일 |
|------|------------|
| 로그인 / 가입 / 로그아웃 | `docs/design/mockups/BF-708/auth.html` |
| 포스트 목록·작성·편집 | `docs/design/mockups/BF-708/posts.html` |
| 페이지 목록·작성·편집 | `docs/design/mockups/BF-708/pages.html` |

---

## 9. 명세 ↔ AC 매핑 표

| AC | 명세 섹션 | mockup 파일 | 상태 |
|----|----------|------------|------|
| `docs/design/frontend-shadcn-BF-708.md` 생성 — 페이지별 레이아웃·컴포넌트·토큰 정의 | §2~§6 전체 | — | ✅ |
| `docs/design/mockups/BF-708/` 에 가입·로그인·로그아웃·post·pages mockup HTML 포함 | §8 | auth.html / posts.html / pages.html | ✅ |
| 명세 말미에 명세-AC 매핑 표 포함 | §9 (본 섹션) | — | ✅ |

---

## Self-critique

| 체크 항목 | 결과 | 비고 |
|----------|------|------|
| AC 매핑 완전성 | ✅ | §9 매핑 표로 3개 AC 전부 커버 |
| dev 구현 가이드 충분성 | ✅ | CSS 변수, shadcn 설치 명령, 클래스명, zod 스키마, JWT 흐름 포함 |
| 기존 백엔드 API 연동 명시 | ✅ | 각 화면에 API endpoint 명시 |
| 컴포넌트 Props 완전성 | ✅ | Button/Input/Badge/DataTable/Form 전부 Props 정의 |
| 모호한 표현 | ⚠️ | 대시보드 독립 mockup 미포함 — posts.html sidebar 에서 시각화. dev 에게 코멘트 안내 권장 |
