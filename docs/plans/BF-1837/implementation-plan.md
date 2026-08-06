# BF-1837 배지 페이지 구현 설계 (implementation-plan)

> 본 문서는 planner(박기획)가 동결한 실행 설계이자 handoff 계약입니다.
> designer(BF-1838)와 developer(BF-1839)는 아래 frozen UI 계약을
> **selector·token 변경 없이 그대로** 구현합니다.
> 본 문서는 frozen blueprint의 파일·소유자·상태·후조건을 **재정의하지 않고 그대로 설명**하며,
> 새 파일이나 새 역할을 추가하지 않습니다.

## 1. 목표 (Objective)

PM 분해(BF-1837)를 구현 가능한 실행 계획과 handoff 계약으로 구체화한다.
배지(badge) 상태 표시 정적 페이지의 UI 계약을 동결하여 designer와 developer가
병렬로 일관되게 작업할 수 있도록 한다.

## 2. 사용자 시나리오 (User Scenario)

- 운영자/사용자가 배지 페이지에 접속하면, **성공·경고·오류** 3종 상태 배지가
  한 목록(`#badge-list`) 안에 표시된다.
- 각 배지는 색상뿐 아니라 **상태명 텍스트**('성공'/'경고'/'오류')를 함께 노출하여
  색각 이상 사용자도 상태를 구분할 수 있다.
- 320px 이상 좁은 뷰포트에서도 3종 배지가 content overflow 없이 표시된다.

## 3. Acceptance Criteria (Given/When/Then)

### AC-1 — 3종 배지 상태 표시
- **Given** 사용자가 `iteration-check2/badge.html` 을 연다
- **When** 페이지가 렌더링되면
- **Then** `#badge-list` 안에 `#badge-success`, `#badge-warning`, `#badge-error`
  3개의 배지가 각각 `badge--success`, `badge--warning`, `badge--error` 상태 클래스로 표시된다.

### AC-2 — 색상+텍스트 이중 표기 (접근성)
- **Given** 각 배지가 렌더링된 상태에서
- **When** 사용자가 배지를 본다
- **Then** 각 배지는 `.badge__label` 안에 '성공'/'경고'/'오류' 텍스트 라벨을 표시하고,
  `role="status"` 를 가지며, 배경/텍스트 대비는 WCAG AA(4.5:1) 이상이다.
- **And** 상태는 색상만으로 구분하지 않고 상태명을 화면 텍스트와 접근성 이름으로 노출한다.

### AC-3 — 반응형
- **Given** 뷰포트 폭이 320px 이상인 환경에서
- **When** 페이지가 렌더링되면
- **Then** 배지 3종이 content overflow 없이 표시된다.

### AC-4 — additive 정책
- **Given** 신규 경로 `iteration-check2/badge.html`, `docs/design/badge-BF-1837.md`
- **When** designer/developer가 작업한다
- **Then** 기존 파일은 미수정하고, 신규 경로만 additive 로 추가한다.

## 4. Frozen UI 계약 (ui-contract@v1 — 변경 금지)

> 아래 값은 frozen blueprint의 권위값입니다. designer/developer는 selector와 token을
> 변경하거나 재정의하지 않습니다.

### 4.1 파일 및 소유자 (file owner — blueprint 권위)
| 파일 | 소유 역할 | 정책 |
| --- | --- | --- |
| `docs/design/badge-BF-1837.md` | designer | additive (신규) |
| `iteration-check2/badge.html` | developer | additive (신규) |

### 4.2 DOM ID
- `badge-list` — 3종 배지를 담는 컨테이너
- `badge-success` — 성공 배지
- `badge-warning` — 경고 배지
- `badge-error` — 오류 배지

### 4.3 CSS 클래스
- `badge` — 배지 공통 base 클래스
- `badge__label` — 배지 텍스트 라벨(BEM element)
- `badge--success` — 성공 상태 modifier
- `badge--warning` — 경고 상태 modifier
- `badge--error` — 오류 상태 modifier

### 4.4 상태 (states)
- `success` (성공)
- `warning` (경고)
- `error` (오류)

### 4.5 Design Token / CSS 변수
| 변수 | 값 | 용도 |
| --- | --- | --- |
| `--color-badge-success` | `#16a34a` | 성공 배지 배경 |
| `--color-badge-warning` | `#d97706` | 경고 배지 배경 |
| `--color-badge-error` | `#dc2626` | 오류 배지 배경 |
| `--color-badge-text` | `#ffffff` | 배지 텍스트(모든 상태 공통) |
| `--space-badge-gap` | `12px` | 배지 간 간격 |

### 4.6 접근성 (accessibility)
- 각 배지는 색상뿐 아니라 '성공'/'경고'/'오류' 텍스트 라벨을 표시한다.
- 각 배지는 `role="status"` 를 가지고 배경/텍스트 대비는 WCAG AA(4.5:1) 이상이다.
- 모든 상태는 색상만으로 구분하지 않고 상태명을 화면 텍스트와 접근성 이름으로 노출한다.

### 4.7 반응형 (responsive)
- 320px 이상 뷰포트에서 배지 3종이 content overflow 없이 표시된다.

### 4.8 초기화/실패 후조건
- 초기화·취소·실패 뒤에는 상태와 진행 표시를 초기값으로 되돌리고
  주 실행 control을 다시 사용할 수 있어야 한다. (정적 페이지 특성상 초기 렌더 상태가 곧 초기값)

## 5. 산출물 경로 (Deliverables)
- `docs/design/badge-BF-1837.md` — designer 시각 명세 (신규, additive)
- `iteration-check2/badge.html` — developer 정적 페이지 구현 (신규, additive)

## 6. 아키텍처 / 제약 (Architecture & Constraints)
- 순수 정적 HTML + CSS. 별도 JS 런타임/빌드 산출물 없음.
- CSS 변수는 `:root` 에 선언하고 `.badge--*` modifier가 참조한다.
- 기존 파일 미수정, 신규 경로만 additive.
- selector(DOM ID/class)와 design token은 frozen 계약이며 재정의 금지.

## 7. Edge / 실패 케이스
- **좁은 뷰포트(320px)**: `--space-badge-gap` 유지하며 wrap 허용, overflow 금지.
- **색상 미표시 환경(고대비/색각 이상)**: 텍스트 라벨 + `role="status"` 로 상태 전달.
- **상태 클래스 누락**: base `.badge` 만으로는 상태 식별 불가 → 반드시 `badge--*` 동반.

## 8. Handoff 계약 (planning-contract@v1 / ui-contract@v1)
- **producer**: planner(본 문서)
- **consumer**: designer(BF-1838), developer(BF-1839)
- **invariant**: designer와 developer는 승인된 실행 설계를 따르고, selector와 token을
  변경하거나 재정의하지 않는다.
- **invariant**: 파일 소유권과 상태 계약은 frozen blueprint가 유일한 권위이며
  본 planner 문서는 이를 재정의하지 않는다.
