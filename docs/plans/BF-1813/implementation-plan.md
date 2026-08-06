# 인사말 페이지 구현 설계 (BF-1813)

> 작성: planner (박기획) · BF-1816
> 이 문서는 frozen blueprint 의 UI 계약(`ui-contract@v1`)과 실행 설계(`planning-contract@v1`)를
> 구현 가능한 형태로 렌더한 것입니다. **파일 소유권·상태 계약의 유일한 권위는 frozen blueprint** 이며,
> 본 문서는 이를 재정의하지 않고 그대로 설명합니다. 새 파일·새 역할·계약 밖 요구사항을 추가하지 않습니다.

## 1. 목표 (Objective)

오늘 날짜와 함께 한 줄 인사말을 표시하는 정적 인사말 페이지를 구현한다.
designer 와 developer 는 아래 동결된 selector·token·상태 계약을 **변경·재정의 없이** 그대로 따른다.

## 2. 산출물 파일 · 소유자 (frozen — 변경 금지)

| 파일 | 소유자 (role) | artifact-policy |
| --- | --- | --- |
| `docs/design/greeting-BF-1813.md` | designer | additive |
| `iteration-check2/greeting.html` | developer | additive |
| `iteration-check2/greeting.test.js` | developer | additive |

- planner 본 문서(`docs/plans/BF-1813/implementation-plan.md`)는 위 파일을 생성·수정하지 않는다.
- artifact-policy `additive`: 기존 파일이 있으면 파괴적 변경 없이 가산적으로만 보강한다.

## 3. 사용자 시나리오 (User Scenario)

1. 사용자가 인사말 페이지를 연다.
2. 페이지가 렌더되며 인사말 자리표시자가 먼저 보인다(initial).
3. 인사말 한 줄과 오늘 날짜(YYYY-MM-DD)가 표시된다(loaded).
4. 날짜 계산이 실패하면 날짜 영역에 오류 안내 문구가 표시된다(date-error).

## 4. UI 계약 (frozen — selector/token 변경 금지)

### 4.1 DOM 구조 (ID / class)

| 요소 | DOM ID | CSS class | 역할 |
| --- | --- | --- | --- |
| 루트 컨테이너 | `greeting-root` | `greeting` | 페이지 루트 |
| 인사말 메시지 | `greeting-message` | `greeting__message` | 인사말 한 줄 |
| 날짜 표시 | `greeting-date` | `greeting__date` | 오늘 날짜 |

### 4.2 상태 (States)

| 상태 | 조건 | 표시 내용 |
| --- | --- | --- |
| `initial` | 최초 렌더 | `greeting-root` 가 렌더되고 인사말 자리표시자가 보인다 |
| `loaded` | 정상 | `greeting-message` 에 인사말 한 줄, `greeting-date` 에 오늘 날짜(YYYY-MM-DD) |
| `date-error` | 날짜 계산 실패 | `greeting-date` 에 `날짜를 불러올 수 없습니다` 텍스트 표시 |

- **후조건(초기화·취소·실패)**: 초기화·취소·실패 뒤에는 상태와 진행 표시를 초기값으로 되돌리고
  주 실행 control 을 다시 사용할 수 있어야 한다.
- 모든 상태는 색상만으로 구분하지 않고 **상태명을 화면 텍스트와 접근성 이름으로 노출**한다.

### 4.3 디자인 토큰 (Design Tokens)

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--color-greeting-text` | `#1f2937` | 인사말/날짜 텍스트 색 |
| `--space-greeting-gap` | `8px` | 메시지-날짜 간 간격 |

### 4.4 접근성 (Accessibility)

- `greeting-message` 는 **h1 heading role** 로 노출된다.
- `greeting-date` 는 `datetime` 속성을 가진 **`time` 요소**로 표기한다.
- 모든 상태는 색상만으로 구분하지 않고 상태명을 화면 텍스트와 접근성 이름으로 노출한다.

### 4.5 반응형 (Responsive)

- **320px 이상**에서 content overflow 가 발생하지 않는다.

## 5. Acceptance Criteria (Given/When/Then)

### AC-1 · 정상 렌더 (loaded)
- **Given** 인사말 페이지가 로드되고 날짜 계산이 성공한 상태에서
- **When** 페이지가 렌더되면
- **Then** `#greeting-root`(`.greeting`) 안에 `#greeting-message`(`.greeting__message`) 인사말 한 줄과
  `#greeting-date`(`.greeting__date`) 오늘 날짜(YYYY-MM-DD)가 표시된다.

### AC-2 · 접근성 마크업
- **Given** 페이지가 loaded 상태에서
- **When** 접근성 트리를 확인하면
- **Then** `greeting-message` 는 h1 heading role 로, `greeting-date` 는 `datetime` 속성을 가진 `time` 요소로 노출된다.

### AC-3 · 날짜 실패 (date-error)
- **Given** 날짜 계산이 실패한 상태에서
- **When** 페이지가 렌더되면
- **Then** `#greeting-date` 에 `날짜를 불러올 수 없습니다` 텍스트가 표시되고, 상태명이 화면 텍스트·접근성 이름으로 노출된다.

### AC-4 · 초기화/후조건
- **Given** 실패 또는 취소가 발생한 상태에서
- **When** 초기화되면
- **Then** 상태·진행 표시가 초기값으로 되돌아가고 주 실행 control 을 다시 사용할 수 있다.

### AC-5 · 반응형
- **Given** 뷰포트 폭이 320px 인 상태에서
- **When** 페이지를 렌더하면
- **Then** content overflow 가 발생하지 않는다.

### AC-6 · 토큰 적용
- **Given** 페이지가 렌더된 상태에서
- **When** 스타일을 확인하면
- **Then** 텍스트 색은 `--color-greeting-text=#1f2937`, 메시지-날짜 간격은 `--space-greeting-gap=8px` 토큰을 사용한다.

## 6. Edge case · 실패 케이스

- **날짜 계산 실패**: `greeting-date` 에 `날짜를 불러올 수 없습니다` 노출(date-error). 색상만으로 구분하지 않음.
- **좁은 뷰포트(320px)**: overflow 없이 레이아웃 유지.
- **selector 충돌 회피**: 위 DOM ID/class 는 동결값이므로 재정의·중복 정의 금지.

## 7. 역할별 handoff

| 역할 | 담당 산출물 | 계약 준수 사항 |
| --- | --- | --- |
| designer (BF-1814) | `docs/design/greeting-BF-1813.md` | 위 selector·token·상태·접근성·반응형 계약대로 시각 명세 작성. selector/token 변경 금지 |
| developer (BF-1815) | `iteration-check2/greeting.html`, `iteration-check2/greeting.test.js` | 동결된 DOM ID/class·상태 텍스트·token 그대로 구현. 3개 상태 및 접근성/반응형을 test 로 검증 |

- designer 와 developer 는 **승인된 실행 설계를 따르며 selector·token 을 변경하거나 재정의하지 않는다.**
