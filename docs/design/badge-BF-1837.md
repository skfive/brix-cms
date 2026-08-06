# 배지(badge) 상태 표시 시각 명세 (BF-1837 / 구현 BF-1838)

> 본 문서는 designer(이디자인)의 시각 명세이며, planner가 동결한
> **ui-contract@v1** / **planning-contract@v1** 을 selector·token 변경 없이
> 그대로 시각화한다. frozen 계약의 유일한 권위는
> `docs/plans/BF-1837/implementation-plan.md` 이며, 본 문서는 이를 재정의하지 않는다.
> 본 명세는 **런타임 HTML/CSS/JS 를 생성하지 않는다** — 시각 명세 + mockup 참조만 제공한다.
> (실제 정적 페이지 `iteration-check2/badge.html` 은 developer(BF-1839) 소유.)

---

## 1. 시안 개요

### 변경 범위
- **성공 · 경고 · 오류** 3종 상태 배지를 한 목록(`#badge-list`) 안에 나열하는
  정적 상태 표시 UI 의 시각 명세.
- 신규 additive 산출물만 정의하며 기존 파일은 미수정한다.

### 사용자 경험 목표
- 사용자가 배지 페이지에서 3종 상태를 **한눈에** 구분한다.
- **색상 + 상태명 텍스트 이중 표기**로 색각 이상 사용자도 상태를 판별한다.
- 320px 이상 좁은 뷰포트에서도 content overflow 없이 3종이 모두 보인다.

---

## 2. 컬러 팔레트

> 아래 색상 값은 frozen design token 이다. **변경 금지.**

| 토큰(CSS 변수) | HEX | 역할 | 대비(vs `--color-badge-text` `#ffffff`) |
| --- | --- | --- | --- |
| `--color-badge-success` | `#16a34a` | 성공 배지 배경 | 약 **3.30:1** |
| `--color-badge-warning` | `#d97706` | 경고 배지 배경 | 약 **3.19:1** |
| `--color-badge-error` | `#dc2626` | 오류 배지 배경 | 약 **4.83:1** |
| `--color-badge-text` | `#ffffff` | 배지 텍스트(모든 상태 공통) | — |

### 대비 및 WCAG AA 준수 방식 (중요)
- 접근성 계약(AC-2)은 **WCAG AA 4.5:1 이상**을 요구한다.
- `#dc2626`(오류)는 일반 텍스트 기준 4.5:1 을 **만족**한다.
- `#16a34a`(성공, 3.30:1) · `#d97706`(경고, 3.19:1) 는 일반 텍스트 4.5:1 에
  **미달**하지만, token 은 frozen 이라 재정의할 수 없다.
- **해결(디자이너 권한 = 타이포그래피 정의):** 배지 라벨을 **large text**
  (WCAG 대형 텍스트 정의: 18.66px/14pt **bold** 이상 또는 24px/18pt 이상)로 규정하면
  large-text AA 임계값 **3:1** 을 모든 상태가 초과한다(성공 3.30, 경고 3.19, 오류 4.83).
  따라서 §3 타이포그래피에서 `.badge__label` 을 **`font-weight:700` + `font-size:16px`(=12pt bold)**
  → 실측 large-text 임계 충족을 위해 **최소 `font-size:18.66px` bold** 로 규정한다.
- ⚠️ **모호함 flag → planner/운영자 결정 필요:**
  "일반 크기(작은) 텍스트 배지" 를 요구한다면 frozen token 만으로는
  성공·경고 상태가 4.5:1 을 만족할 수 없다. 이 경우 token 조정은
  planner/운영자의 frozen 계약 변경 사안이며, designer 가 임의로 변경하지 않는다.
  본 명세는 계약 위반 없이 AA 를 달성하기 위해 **large-text bold** 경로를 채택한다.

---

## 3. 타이포그래피

> vanilla-static tech-stack — 외부 폰트 의존성 0건, system font stack 사용.

| 요소 | font-family | size | weight | line-height |
| --- | --- | --- | --- | --- |
| 페이지 제목(mockup 참고용) | system-ui stack | 24px | 700 | 1.3 |
| `.badge__label` (배지 라벨) | system-ui stack | **18.66px (≈14pt) 이상** | **700 (bold)** | 1.2 |

- **system font stack (권장 CSS 값):**
  `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`
- `.badge__label` 은 **large-text AA(3:1)** 경로를 확보하기 위해
  반드시 **bold(700) + 18.66px 이상** 을 유지한다(§2 참조). 이 값을 낮추면
  성공·경고 배지의 대비가 AA 미달이 되므로 **하향 금지**.

---

## 4. 레이아웃

### 섹션 구조
```
#badge-list  (컨테이너 — 3종 배지를 담음)
 ├─ #badge-success  .badge .badge--success   → .badge__label "성공"
 ├─ #badge-warning  .badge .badge--warning   → .badge__label "경고"
 └─ #badge-error    .badge .badge--error     → .badge__label "오류"
```

### spacing
- 배지 간 간격: `--space-badge-gap` = **12px** (frozen token).
- 배지 내부 padding 권장: 세로 6px / 가로 12px (라벨이 잘리지 않도록 여유 확보).
- 배지 모서리 권장: `border-radius: 6px` (시각 일관성용, 계약 외 가산 옵션).

### breakpoint 별 동작
- **≥ 320px (필수 대응 최소 폭):** `#badge-list` 를 `display:flex; flex-wrap:wrap;
  gap: var(--space-badge-gap)` 로 구성해 좁은 폭에서 자연스럽게 줄바꿈(wrap)하며
  **content overflow 를 발생시키지 않는다**(AC-3).
- **넓은 뷰포트:** 3종 배지가 한 줄에 12px 간격으로 나열된다.
- 배지 라벨은 `white-space: nowrap` 로 라벨 자체는 줄바꿈하지 않되, 배지 단위로 wrap 한다.

---

## 5. 컴포넌트 명세

### 5.1 컨테이너 — `#badge-list`
| 항목 | 값 |
| --- | --- |
| DOM ID | `badge-list` (frozen) |
| 역할 | 3종 배지 컨테이너 |
| 레이아웃 | `display:flex; flex-wrap:wrap; gap:var(--space-badge-gap)` |
| 상태 | 정적 — 초기 렌더 상태가 곧 초기값(§7) |

### 5.2 배지 공통 — `.badge`
| 항목 | 값 |
| --- | --- |
| base 클래스 | `badge` (frozen) |
| 필수 자식 | `.badge__label` (상태명 텍스트, frozen BEM element) |
| 필수 속성 | `role="status"` (frozen 접근성 계약) |
| 공통 스타일 | 텍스트 색 `var(--color-badge-text)`, padding, `border-radius:6px`, `.badge__label` bold+large |
| 주의 | base `.badge` 단독으로는 상태 식별 불가 → 반드시 `badge--*` modifier 동반 |

### 5.3 상태별 배지 (states: success / warning / error)

| DOM ID | 상태 클래스 | 배경 token | `.badge__label` 텍스트 | `role` |
| --- | --- | --- | --- | --- |
| `badge-success` | `badge badge--success` | `--color-badge-success` `#16a34a` | **성공** | `status` |
| `badge-warning` | `badge badge--warning` | `--color-badge-warning` `#d97706` | **경고** | `status` |
| `badge-error` | `badge badge--error` | `--color-badge-error` `#dc2626` | **오류** | `status` |

- 각 배지는 **색상만으로 구분하지 않는다** — `.badge__label` 의 화면 텍스트
  ('성공'/'경고'/'오류')가 곧 접근성 이름(accessible name)이 된다.
- `role="status"` 로 상태 영역임을 보조기술에 노출한다.

### 5.4 상태/인터랙션
- 정적 상태 표시 컴포넌트로 **hover/active/focus 인터랙션 없음**(클릭 대상 아님).
- 동적 상태 전환 없음 — 각 배지는 렌더 시점 상태로 고정.

---

## 6. dev 구현 가이드 (developer / BF-1839 대상)

> developer 소유 파일 `iteration-check2/badge.html` 에 아래를 additive 로 구현.
> selector·token 은 frozen — **이름/값 변경 금지**.

1. **CSS 변수 선언** — `:root` 에 5개 token 선언:
   ```css
   :root {
     --color-badge-success: #16a34a;
     --color-badge-warning: #d97706;
     --color-badge-error:   #dc2626;
     --color-badge-text:    #ffffff;
     --space-badge-gap:     12px;
   }
   ```
2. **컨테이너** — `<ul id="badge-list">` 또는 `<div id="badge-list">`.
   `display:flex; flex-wrap:wrap; gap:var(--space-badge-gap)`.
3. **배지 3종** — 각각 아래 구조(마크업 예시):
   ```html
   <span id="badge-success" class="badge badge--success" role="status">
     <span class="badge__label">성공</span>
   </span>
   ```
   (`badge-warning`/`경고`, `badge-error`/`오류` 동일 패턴)
4. **공통 스타일** `.badge`:
   ```css
   .badge {
     color: var(--color-badge-text);
     padding: 6px 12px;
     border-radius: 6px;
     display: inline-flex;
   }
   .badge__label { font-weight: 700; font-size: 18.66px; line-height: 1.2; white-space: nowrap; }
   ```
5. **상태 modifier** — 배경만 token 참조:
   ```css
   .badge--success { background: var(--color-badge-success); }
   .badge--warning { background: var(--color-badge-warning); }
   .badge--error   { background: var(--color-badge-error); }
   ```
6. **접근성 필수** — 각 배지에 `role="status"`, `.badge__label` 에 상태명 텍스트.
   `.badge__label` 은 **bold + 18.66px 이상 유지**(대비 AA large-text 경로, §2·§3).
7. **반응형** — viewport `width=device-width` meta 설정, 320px 에서 wrap 확인.

---

## 7. 초기화 / 실패 후조건

- 정적 페이지 특성상 **초기 렌더 상태가 곧 초기값**이다.
- 별도 초기화·취소·실패 상태 전환이 없으므로, 페이지 재로드 시 항상 동일한
  3종 배지 초기 상태로 복귀한다(진행 표시/주 실행 control 개념은 본 정적 페이지에 없음).

---

## 8. AC 매핑

| AC | 요구 | 본 명세 반영 위치 |
| --- | --- | --- |
| AC-1 | `#badge-list` 안 3종 배지 + 상태 클래스 | §4 레이아웃, §5.3, §6-2·3 |
| AC-2 | 색상+텍스트 이중표기, `role="status"`, AA 4.5:1 | §2 대비, §5.3, §6-6 (AA 는 large-text 경로로 충족) |
| AC-3 | 320px overflow 없음 | §4 breakpoint, §6-7 |
| AC-4 | additive(기존 미수정) | 본 문서 전체 — 신규 경로만 정의 |

---

## 9. mockup 참조

- **시각 mockup HTML:** `docs/design/mockups/badge-BF-1837.html`
- 위 mockup 은 본 명세의 컬러/타이포/레이아웃을 그대로 시각화한 self-contained
  단일 HTML(외부 의존성 0건)이다. developer 산출물이 아니며 **시안 시각화 전용**이다.
- developer 는 mockup 을 참조 가이드로 사용하되 픽셀 단위 일치 의무는 없다.
