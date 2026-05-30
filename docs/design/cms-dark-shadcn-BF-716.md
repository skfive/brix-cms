# brix-CMS 다크 모드 전문 CMS 디자인 명세 (BF-716 / BF-717)

> **Epic**: BF-716 — shadcn/ui 다크 모드 전문 CMS
> **Task**: BF-717 — 다크 모드 CMS 디자인 명세 + mockup
> **담당**: 이디자인 (designer 페르소나)
> **작성일**: 2026-05-30
> **tech-stack**: `nextjs` (Next.js App Router + Tailwind v3 + shadcn/ui, Zinc 베이스)
> **대상 범위**: 전문 CMS 관리자 셸 — 사이드바·헤더·통계 카드·데이터 테이블(정렬/페이지네이션)·폼·다이얼로그

---

## 1. 시안 개요

### 변경 범위
brix-CMS 관리자 UI 를 **다크 모드 우선(dark-first)** 전문 CMS 룩으로 정제한다.
BF-708 에서 정의한 shadcn/ui Zinc 토큰 체계를 계승하되, 본 명세는 **`.dark` 토큰**을
기준 팔레트로 삼아 콘텐츠 운영자가 장시간 작업해도 눈의 피로가 적은 저대비-깊은배경
인터페이스를 설계한다.

> ⚠️ BF-708 명세는 **삭제·대체 대상이 아님**. 본 명세는 BF-708 의 화면 흐름(로그인/포스트/페이지)
> 위에 **다크 모드 셸·컴포넌트 레이어**를 가산(加算)한다. 라이트 모드 토큰은 그대로 유지된다.

### 사용자 경험 목표
1. **전문성**: 깊은 Zinc-950 배경 + 미묘한 border 구분으로 "관리 도구" 다운 밀도 확보
2. **가독성**: foreground/muted-foreground 2단 텍스트 위계로 정보 우선순위 표현
3. **명확성**: 발행 상태(DRAFT/PUBLISHED/ARCHIVED)를 다크 대응 배지 색으로 즉시 인식
4. **일관성**: 모든 컴포넌트가 동일한 토큰·간격·radius 규칙을 공유
5. **접근성**: 본문 텍스트 대비 WCAG AA 충족 (Zinc-50 on Zinc-950 ≈ 18:1)

### 대상 화면 / 컴포넌트
| 영역 | 구성 |
|------|------|
| 관리자 셸 | 좌측 사이드바(고정 240px) + 상단 헤더(56px) + 본문 |
| 대시보드 | 통계 카드 4종 + 최근 콘텐츠 데이터 테이블 |
| 콘텐츠 목록 | 데이터 테이블(정렬 토글·행 hover·페이지네이션) |
| 콘텐츠 편집 | 폼 카드(Input/Textarea/Select) + 액션 바 |
| 삭제 플로우 | AlertDialog(오버레이 + 카드) |

---

## 2. 컬러 팔레트 (다크 모드 기준)

shadcn/ui **Zinc** 테마의 `.dark` CSS 변수. mockup 의 `:root` 는 이 다크 토큰을 직접 채택한다.
HEX 는 HSL 의 근사값이며 **구현 기준은 HSL 변수**다.

### 코어 토큰

| 토큰 변수 | HSL | HEX (approx) | 용도 |
|-----------|-----|--------------|------|
| `--background` | `240 10% 3.9%` | `#09090B` | 앱 최하위 배경 (Zinc-950) |
| `--foreground` | `0 0% 98%` | `#FAFAFA` | 기본 텍스트 (Zinc-50) |
| `--card` | `240 10% 3.9%` | `#09090B` | 카드 배경 |
| `--card-foreground` | `0 0% 98%` | `#FAFAFA` | 카드 텍스트 |
| `--popover` | `240 10% 3.9%` | `#09090B` | 팝오버·드롭다운 배경 |
| `--popover-foreground` | `0 0% 98%` | `#FAFAFA` | 팝오버 텍스트 |
| `--primary` | `0 0% 98%` | `#FAFAFA` | 주요 버튼 배경 (다크에선 밝은 색) |
| `--primary-foreground` | `240 5.9% 10%` | `#18181B` | primary 위 텍스트 (어두움) |
| `--secondary` | `240 3.7% 15.9%` | `#27272A` | 보조 버튼·표면 (Zinc-800) |
| `--secondary-foreground` | `0 0% 98%` | `#FAFAFA` | 보조 표면 텍스트 |
| `--muted` | `240 3.7% 15.9%` | `#27272A` | 비활성·보조 영역 |
| `--muted-foreground` | `240 5% 64.9%` | `#A1A1AA` | 설명·플레이스홀더 (Zinc-400) |
| `--accent` | `240 3.7% 15.9%` | `#27272A` | hover 하이라이트 표면 |
| `--accent-foreground` | `0 0% 98%` | `#FAFAFA` | accent 위 텍스트 |
| `--destructive` | `0 62.8% 30.6%` | `#7F1D1D` | 삭제·오류 (다크 대응 딥레드) |
| `--destructive-foreground` | `0 0% 98%` | `#FAFAFA` | destructive 위 텍스트 |
| `--border` | `240 3.7% 15.9%` | `#27272A` | 테두리·구분선 (Zinc-800) |
| `--input` | `240 3.7% 15.9%` | `#27272A` | 입력 필드 테두리 |
| `--ring` | `240 4.9% 83.9%` | `#D4D4D8` | 포커스 링 (Zinc-300) |

### 상태 배지 컬러 (다크 대응)

라이트 모드의 옅은 파스텔 대신, **반투명 배경 + 채도 높은 텍스트**로 다크 위 가독성을 확보한다.

| 상태 | 배경 | 텍스트 | 권장 className |
|------|------|--------|----------------|
| DRAFT | `#27272A` (Zinc-800) | `#A1A1AA` (Zinc-400) | `bg-zinc-800 text-zinc-400 border border-zinc-700` |
| PUBLISHED | `rgba(34,197,94,.15)` | `#4ADE80` (Green-400) | `bg-green-500/15 text-green-400 border border-green-500/30` |
| ARCHIVED | `rgba(234,179,8,.15)` | `#FACC15` (Yellow-400) | `bg-yellow-500/15 text-yellow-400 border border-yellow-500/30` |

---

## 3. 타이포그래피

**Font Stack**: `"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif`
(Next.js: `next/font/google` 로 Inter 로드 → `--font-inter` 변수 주입)

| 레벨 | font-size | weight | line-height | letter-spacing | 용도 |
|------|-----------|--------|-------------|----------------|------|
| `display` | `1.875rem` (30px) | 700 | 1.2 | `-0.02em` | 페이지 타이틀 |
| `h2` | `1.5rem` (24px) | 600 | 1.3 | `-0.01em` | 섹션 제목 |
| `h3` | `1.125rem` (18px) | 600 | 1.4 | normal | 카드 제목 |
| `body` | `0.875rem` (14px) | 400 | 1.5 | normal | 기본 본문·테이블 셀 |
| `body-medium` | `0.875rem` (14px) | 500 | 1.5 | normal | 라벨·내비 |
| `caption` | `0.75rem` (12px) | 400 | 1.4 | normal | 메타·헬퍼 텍스트 |
| `mono` | `0.8125rem` (13px) | 400 | 1.4 | normal | slug·코드값 (`ui-monospace`) |

> 본문 색은 `foreground`, 보조·메타는 `muted-foreground` 로 위계를 둔다.

---

## 4. 디자인 토큰 — 간격 · radius · 그림자

### 간격 스케일 (4 / 8 / 12 / 16 / 24)

Tailwind spacing 단위 기준. 본 CMS 는 아래 5단계만 사용해 리듬을 통일한다.

| 토큰 | px | Tailwind | 주 사용처 |
|------|----|---------|-----------|
| `space-1` | 4px | `gap-1` / `p-1` | 아이콘-텍스트 간격, 배지 내부 |
| `space-2` | 8px | `gap-2` / `p-2` | 버튼 내부 좌우, 인접 컨트롤 |
| `space-3` | 12px | `gap-3` / `p-3` | 폼 필드 간 세로 간격, 테이블 셀 패딩 |
| `space-4` | 16px | `gap-4` / `p-4` | 카드 내부 패딩, 섹션 내 블록 |
| `space-6` | 24px | `gap-6` / `p-6` | 본문 컨테이너 패딩, 섹션 간 간격 |

### radius

`--radius: 0.5rem` (8px) 기준. shadcn 파생값 그대로.

| 토큰 | 값 | 사용처 |
|------|----|--------|
| `radius-lg` | `0.5rem` (8px) | 카드·다이얼로그·버튼 |
| `radius-md` | `calc(0.5rem - 2px)` (6px) | Input·Select·배지 |
| `radius-sm` | `calc(0.5rem - 4px)` (4px) | 작은 태그·체크박스 |
| `radius-full` | `9999px` | 아바타·상태 점 |

### 그림자 (다크 모드)

다크 배경에서는 drop-shadow 가 거의 보이지 않으므로, **깊이는 border + 표면 명도차**로 표현한다.

| 토큰 | 정의 | 사용처 |
|------|------|--------|
| `elev-0` | border 만 (`1px solid --border`) | 카드·테이블 컨테이너 |
| `elev-1` | `0 1px 2px rgba(0,0,0,.4)` + border | 드롭다운·hover 카드 |
| `elev-overlay` | `0 16px 48px rgba(0,0,0,.6)` | 다이얼로그·팝오버 |

---

## 5. 아이콘 규칙

- **라이브러리**: `lucide-react` (`components.json` 의 `iconLibrary: lucide`)
- **기본 크기**: 16px (`w-4 h-4`) — 내비·버튼·테이블 액션
- **사이드바 항목**: 16px, 텍스트와 `gap-3`(12px)
- **stroke-width**: 2 (lucide 기본) — 강조 아이콘만 1.5 로 가늘게
- **색상**: 기본 `muted-foreground`, active/hover 시 `foreground`
- **정렬 토글**: `ArrowUpDown`(중립) → `ArrowUp`/`ArrowDown`(활성 정렬 방향)

| 용도 | lucide 아이콘 |
|------|--------------|
| 대시보드 | `LayoutDashboard` |
| 포스트 | `FileText` |
| 페이지 | `File` |
| 미디어 | `Image` |
| 설정 | `Settings` |
| 검색 | `Search` |
| 새로 만들기 | `Plus` |
| 정렬 (중립/오름/내림) | `ArrowUpDown` / `ArrowUp` / `ArrowDown` |
| 행 액션 | `MoreHorizontal` |
| 페이지네이션 | `ChevronLeft` / `ChevronRight` |
| 삭제 | `Trash2` |
| 로그아웃 | `LogOut` |

---

## 6. 레이아웃

### 관리자 셸 구조

```
+---------------------------+----------------------------------------+
| Sidebar (240px, fixed)    | Main (flex-1, bg-background)           |
| bg-card, border-r border  | +-- Header (56px, border-b) --------+ |
|                           | |  [Breadcrumb / Title]   [Search]  | |
| [◆] brix-CMS  (로고)      | |                         [Avatar]  | |
|                           | +-----------------------------------+ |
| ── 메뉴 ──                | Page Body (p-6, space-y-6)            |
| [▣] 대시보드  (active)    |                                        |
| [▤] 포스트                |  [통계 카드 그리드]                    |
| [▢] 페이지                |  [데이터 테이블]                       |
| [▥] 미디어                |                                        |
|                           |                                        |
| ── 하단 ──                |                                        |
| [user] admin@brix         |                                        |
| [⎋] 로그아웃              |                                        |
+---------------------------+----------------------------------------+
```

- **Sidebar**: 240px 고정 / `bg-card` / `border-r border-border` / 모바일은 drawer 전환
- **Header**: 56px / `border-b border-border` / 좌측 타이틀·우측 검색+아바타
- **Body**: `p-6 space-y-6` / 최대 콘텐츠 폭 제한 없음(테이블 가변)

### Breakpoints

| 이름 | 최소 너비 | Tailwind | 셸 동작 |
|------|-----------|----------|---------|
| mobile | 0 | (base) | 사이드바 → drawer, 통계 카드 1열 |
| sm | 640px | `sm:` | 통계 카드 2열 |
| md | 768px | `md:` | 사이드바 고정 노출 시작 |
| lg | 1024px | `lg:` | 통계 카드 4열, 테이블 전체 컬럼 |
| xl | 1280px | `xl:` | 본문 여백 확대 |

---

## 7. 컴포넌트 명세

### 7.1 Sidebar (Navigation)

**구조**: 로고 → 메뉴 그룹 → 하단 사용자 영역

**메뉴 항목**:
| 아이콘 | 레이블 | href |
|--------|--------|------|
| `LayoutDashboard` | 대시보드 | `/dashboard` |
| `FileText` | 포스트 | `/posts` |
| `File` | 페이지 | `/pages` |
| `Image` | 미디어 | `/media` |
| `Settings` | 설정 | `/settings` |

**Props**:
```ts
interface SidebarItemProps {
  icon: LucideIcon
  label: string
  href: string
  active?: boolean
}
```

**상태별 스타일**:
- default: `text-muted-foreground` / 투명 배경
- hover: `bg-accent text-foreground`
- active: `bg-accent text-foreground font-medium` + 좌측 `2px` `--primary` 인디케이터

---

### 7.2 Header

- 높이 `56px` (`h-14`), `border-b border-border`, `px-6`
- **좌측**: 페이지 타이틀(`h2`) 또는 Breadcrumb
- **우측**: 검색 Input(`w-64`, `Search` 아이콘 prefix) + Avatar(드롭다운 트리거)

```ts
interface HeaderProps {
  title: string
  breadcrumb?: { label: string; href?: string }[]
  user: { email: string; avatarUrl?: string }
}
```

---

### 7.3 StatCard (대시보드 통계 카드)

**Props**:
```ts
interface StatCardProps {
  label: string          // "전체 포스트"
  value: string | number // "128"
  delta?: string         // "+12 이번 주"
  trend?: 'up' | 'down' | 'neutral'
  icon: LucideIcon
}
```

**스타일**:
- 컨테이너: `bg-card border border-border rounded-lg p-4`
- label: `caption text-muted-foreground`
- value: `display(30px) font-bold text-foreground`
- delta: `caption` — up=`text-green-400`, down=`text-red-400`, neutral=`text-muted-foreground`
- icon: 우상단 16px `text-muted-foreground`

---

### 7.4 DataTable (정렬 + 페이지네이션)

shadcn/ui `Table` 기반. 다크 모드 표면 위 행 구분.

**컬럼 정의** (예: 포스트):
| 필드 | 표시명 | 너비 | 정렬 | sortable |
|------|--------|------|------|----------|
| `title` | 제목 | flex-1 | 좌 | ✅ |
| `slug` | 슬러그 | 180px | 좌 (mono) | ❌ |
| `status` | 상태 | 120px | 가운데 | ✅ |
| `author` | 작성자 | 160px | 좌 | ❌ |
| `updatedAt` | 수정일 | 140px | 좌 | ✅ |
| `actions` | 액션 | 64px | 가운데 | ❌ |

**스타일**:
- 헤더 행: `bg-muted/50 text-muted-foreground caption uppercase` / `border-b border-border`
- 데이터 행: `border-b border-border` / hover 시 `bg-muted/40`
- 셀 패딩: `px-4 py-3` (space-4 / space-3)

**정렬 토글 UX**:
- sortable 헤더에 `ArrowUpDown`(중립) 표시 → 클릭 시 `ArrowUp`(asc) → 재클릭 `ArrowDown`(desc)
- 활성 정렬 컬럼명은 `text-foreground`, 나머지는 `text-muted-foreground`

```ts
type SortDir = 'asc' | 'desc' | null
interface SortState { column: string; dir: SortDir }
interface ColumnDef {
  key: string
  header: string
  width?: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  mono?: boolean
}
```

**페이지네이션** (테이블 하단, `border-t border-border px-4 py-3`):
- 좌측: `caption text-muted-foreground` — `"1–10 / 전체 43"`
- 우측: 페이지 크기 Select(10/25/50) + `ChevronLeft`·페이지 번호·`ChevronRight`
- 현재 페이지 버튼: `bg-accent text-foreground`, 나머지 `ghost`

```ts
interface PaginationProps {
  page: number
  pageSize: 10 | 25 | 50
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}
```

---

### 7.5 StatusBadge

```ts
interface StatusBadgeProps {
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}
```

| status | className |
|--------|-----------|
| DRAFT | `bg-zinc-800 text-zinc-400 border border-zinc-700` |
| PUBLISHED | `bg-green-500/15 text-green-400 border border-green-500/30` |
| ARCHIVED | `bg-yellow-500/15 text-yellow-400 border border-yellow-500/30` |

- 공통: `inline-flex items-center rounded-md px-2 py-0.5 caption font-medium`
- 좌측 `6px` 상태 점(`rounded-full`) 옵션

---

### 7.6 Form (콘텐츠 편집)

**필드**:
| 필드 | 컴포넌트 | 검증 |
|------|----------|------|
| title | `Input` | 필수, 1–200자 |
| slug | `Input` (mono) | 옵션, 자동 생성, ≤200자 |
| status | `Select` | 필수 (DRAFT/PUBLISHED/ARCHIVED) |
| excerpt | `Textarea` (min-h 96px) | 옵션, ≤300자 |
| content | `Textarea` (min-h 320px) | 옵션 |

**Input/Textarea 상태**:
- default: `bg-background border border-input rounded-md px-3 py-2 text-foreground`
- placeholder: `text-muted-foreground`
- focus: `ring-2 ring-ring ring-offset-2 ring-offset-background outline-none`
- error: `border-destructive` + 하단 `caption text-red-400`
- disabled: `opacity-50 cursor-not-allowed bg-muted`

**필드 레이아웃**: 세로 스택 `space-y-3`, 라벨 `body-medium` + 필드 + 헬퍼 `caption`

**액션 바** (폼 카드 하단, `border-t border-border pt-4 flex justify-end gap-2`):
- `[취소]`(ghost) · `[임시저장]`(outline) · `[저장하기]`(default/primary)

```ts
interface FieldProps {
  label: string
  name: string
  required?: boolean
  error?: string
  helperText?: string
}
```

---

### 7.7 Button

| variant | 다크 스타일 | 사용처 |
|---------|-------------|--------|
| `default` | `bg-primary text-primary-foreground` (밝은 버튼) | 주요 CTA |
| `secondary` | `bg-secondary text-secondary-foreground` | 보조 |
| `outline` | `border border-input bg-transparent hover:bg-accent` | 임시저장 |
| `ghost` | `hover:bg-accent hover:text-foreground` | 취소·내비 |
| `destructive` | `bg-destructive text-destructive-foreground` | 삭제 확정 |

**Props**:
```ts
interface ButtonProps {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
  size?: 'sm' | 'default' | 'lg' | 'icon'
  disabled?: boolean
  isLoading?: boolean
}
```

---

### 7.8 AlertDialog (삭제 확인)

- **오버레이**: `bg-black/80` 전체 화면 (다크에서도 추가 어둡게)
- **패널**: `bg-popover border border-border rounded-lg elev-overlay max-w-md p-6`
- **제목**(`h3`): "삭제 확인"
- **본문**(`body text-muted-foreground`): "포스트 '〈제목〉'을 삭제합니다. 이 작업은 되돌릴 수 없습니다."
- **액션**(`flex justify-end gap-2`): `[취소]`(ghost) · `[삭제하기]`(destructive)

```ts
interface AlertDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string      // 기본 "삭제하기"
  onConfirm: () => void
  onCancel: () => void
}
```

---

## 8. dev 구현 가이드

### 8.1 다크 모드 활성화

토큰 자체는 BF-708 에서 이미 `app/globals.css` 의 `.dark` 블록에 정의되어 있다(§2 와 동일).
본 명세는 **새 토큰 추가가 아니라** `.dark` 토큰을 셸·컴포넌트에 적용하는 가이드다.

```tsx
// app/layout.tsx — dark-first 적용 (운영자 토글 도입 전 단계)
<html lang="ko" className="dark">
  <body className="bg-background text-foreground font-sans">{children}</body>
</html>
```

> ⚠️ `app/globals.css` 의 토큰 값은 **수정 금지** (운영자 승인 없이 design-tokens 변경 불가).
> 본 task 는 토큰 *값* 을 바꾸지 않는다 — 기존 `.dark` 토큰을 그대로 사용한다.

### 8.2 셸 구현 골격

```tsx
// app/(admin)/layout.tsx
<div className="flex min-h-screen bg-background">
  <Sidebar />                                  {/* w-60 border-r border-border */}
  <div className="flex flex-1 flex-col">
    <Header />                                 {/* h-14 border-b border-border */}
    <main className="flex-1 p-6 space-y-6">{children}</main>
  </div>
</div>
```

### 8.3 권장 클래스 패턴

```tsx
// 통계 카드
<div className="bg-card border border-border rounded-lg p-4">
  <div className="flex items-center justify-between">
    <span className="text-xs text-muted-foreground">전체 포스트</span>
    <FileText className="w-4 h-4 text-muted-foreground" />
  </div>
  <p className="mt-2 text-3xl font-bold tracking-tight">128</p>
  <p className="mt-1 text-xs text-green-400">+12 이번 주</p>
</div>

// 정렬 가능한 테이블 헤더 셀
<th className="px-4 py-3 text-left">
  <button className="inline-flex items-center gap-1 text-xs uppercase
                     text-muted-foreground hover:text-foreground">
    제목 <ArrowUpDown className="w-3.5 h-3.5" />
  </button>
</th>

// 상태 배지
const STATUS_BADGE: Record<string, string> = {
  DRAFT:     'bg-zinc-800 text-zinc-400 border border-zinc-700',
  PUBLISHED: 'bg-green-500/15 text-green-400 border border-green-500/30',
  ARCHIVED:  'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
}
```

### 8.4 shadcn/ui 컴포넌트 설치

```bash
npx shadcn@latest add button input textarea select card badge table \
  dialog alert-dialog dropdown-menu avatar separator pagination \
  label form
```

### 8.5 정렬·페이지네이션 상태 관리

```ts
// 정렬 토글: null → asc → desc → null 순환
function nextSortDir(cur: SortDir): SortDir {
  return cur === null ? 'asc' : cur === 'asc' ? 'desc' : null
}

// 서버 페이지네이션 쿼리 (BF-708 백엔드 연동)
// GET /posts?page=1&pageSize=10&sort=updatedAt&dir=desc
```

---

## 9. mockup 참조

| mockup 파일 | 표현 컴포넌트 |
|-------------|---------------|
| `docs/design/mockups/BF-716/cms-shell.html` | 사이드바 · 헤더 · 통계 카드 · 데이터 테이블(정렬 토글·페이지네이션) |
| `docs/design/mockups/BF-716/form-dialog.html` | 콘텐츠 편집 폼 카드 · 삭제 확인 AlertDialog(오버레이) |

> 두 mockup 모두 `:root` 에 §2 의 **다크 토큰**을 직접 적용하여 다크 모드로 렌더링된다.

---

## 10. 명세 ↔ AC 매핑 표

| AC | 충족 근거 | 산출물 |
|----|-----------|--------|
| AC1 — `docs/design/cms-dark-shadcn-BF-716.md` + mockup HTML 이 PR 로 생성 | 본 문서 + mockup 2종 | 이 파일 / §9 mockup |
| AC2 — 다크 배경/전경/border/muted/accent 컬러, 간격(4/8/12/16/24), radius, 타이포 스케일이 토큰표로 명시 | §2 컬러 토큰표 · §3 타이포 스케일 · §4 간격/radius 토큰표 | §2~§4 |
| AC3 — 사이드바·헤더·테이블(정렬/페이지네이션)·카드·기본 폼·다이얼로그가 다크 모드로 렌더링되어 보임 | §7 컴포넌트 명세 + mockup 2종이 전 컴포넌트 시각화 | §7 / mockups/BF-716/* |

---

## 11. Self-critique

| 체크 항목 | 결과 | 비고 |
|----------|------|------|
| AC 매핑 완전성 | ✅ | §10 매핑 표로 AC1~AC3 전부 커버. 토큰표(§2~§4)·컴포넌트(§7)·mockup(§9) 1:1 대응 |
| dev 구현 가이드 충분성 | ✅ | §8 에 셸 골격·클래스 패턴·shadcn 설치·정렬/페이지네이션 상태 로직 포함 |
| 기존 요소 보존 | ✅ | BF-708 명세·라이트 토큰 **삭제 안 함**, `.dark` 토큰 값 **수정 안 함**(§8.1 명시). 가산만 수행 |
| 컴포넌트 ↔ AC3 매핑 | ✅ | AC3 의 6개 컴포넌트(사이드바/헤더/테이블/카드/폼/다이얼로그) 모두 §7 + mockup 에 존재 |
| 모호함 flag | ⚠️ | (1) 다크 모드 **토글 UI** 는 본 task 범위 밖 — §8.1 은 dark-first 클래스 고정으로 처리, 토글 도입은 후속 task 권장. (2) `미디어`·`설정` 메뉴는 셸 완성도용 placeholder — 실제 라우트는 BF-708 범위(posts/pages)만 구현 대상 |

---

<!-- bf:pr-summary -->
## 시안 요약 (BF-717 / Epic BF-716)

shadcn/ui **Zinc `.dark` 토큰** 기준 brix-CMS 전문 CMS 다크 모드 디자인 명세 + mockup 2종.

**산출물**
- `docs/design/cms-dark-shadcn-BF-716.md` — 다크 토큰·간격·타이포·아이콘·컴포넌트 명세
- `docs/design/mockups/BF-716/cms-shell.html` — 사이드바·헤더·통계 카드·데이터 테이블(정렬·페이지네이션)
- `docs/design/mockups/BF-716/form-dialog.html` — 편집 폼 카드·삭제 AlertDialog(오버레이)

**토큰 매핑 (다크 코어)**
| 토큰 | HSL | HEX |
|------|-----|-----|
| `--background` | `240 10% 3.9%` | `#09090B` |
| `--foreground` | `0 0% 98%` | `#FAFAFA` |
| `--border` / `--muted` / `--accent` | `240 3.7% 15.9%` | `#27272A` |
| `--muted-foreground` | `240 5% 64.9%` | `#A1A1AA` |
| `--primary` | `0 0% 98%` | `#FAFAFA` |
| `--ring` | `240 4.9% 83.9%` | `#D4D4D8` |

**간격 스케일**: 4 / 8 / 12 / 16 / 24px · **radius**: lg 8 / md 6 / sm 4px · **타이포**: display 30 → caption 12

> 기존 BF-708 명세·라이트 토큰은 보존(가산). `.dark` 토큰 값은 수정하지 않음.

## Self-critique
- AC1~AC3 → §10 매핑 표로 1:1 충족 (토큰표·컴포넌트 명세·mockup 2종)
- AC3 6개 컴포넌트(사이드바/헤더/테이블/카드/폼/다이얼로그) 전부 §7 + mockup 시각화
- 기존 요소 보존: BF-708·라이트 토큰 미삭제, `.dark` 토큰 값 미수정 (가산만)
- ⚠️ flag: 다크 모드 토글 UI 는 범위 밖(dark-first 고정), `미디어`/`설정` 메뉴는 셸 placeholder
<!-- /bf:pr-summary -->
