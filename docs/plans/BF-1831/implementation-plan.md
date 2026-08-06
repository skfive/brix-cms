# km↔mile 변환기 구현 설계 (BF-1831)

> 본 문서는 **frozen Execution Blueprint** 를 designer/developer 가 그대로 구현하도록
> 실행 설계와 UI 계약을 렌더링한 것입니다. 아래 파일·소유자·상태·후조건은 blueprint 가
> 유일한 권위이며, 본 문서는 이를 **재정의하지 않고 그대로 설명**합니다. 새로운 파일이나
> 역할, blueprint 밖 요구사항을 추가하지 않습니다.

- Jira: BF-1831 (Story) / planner task: BF-1834
- 대상 저장소: brix-cms
- 산출물 경로(본 문서): `docs/plans/BF-1831/implementation-plan.md`

---

## 1. 목적 (Objective)

킬로미터(km)와 마일(mile)을 양방향으로 변환하는 단일 화면 변환기를 구현한다.
사용자는 km 또는 mile 값을 입력해 반대 단위 값을 즉시 확인하고, 초기화 버튼으로
입력과 결과를 초기 상태(idle)로 되돌릴 수 있다.

## 2. 파일 · 소유자 계약 (Ownership — frozen, 재정의 금지)

| 파일 | 소유 역할 | 정책 |
| --- | --- | --- |
| `docs/design/units-BF-1831.md` | designer | additive |
| `iteration-check2/units.html` | developer | additive |
| `iteration-check2/units.js` | developer | additive |
| `iteration-check2/units.test.js` | developer | additive |

- 위 selector·token·상태 계약은 designer/developer 가 **변경하거나 재정의하지 않는다.**
- 각 파일은 **additive** 정책이다. 기존 내용을 파괴하지 말고 가산적으로만 보강한다.
- 파일 소유권과 상태 계약의 권위는 frozen blueprint 이며, 본 planner 문서는 이를 설명만 한다.

## 3. UI 계약 (UI Contract — frozen)

### 3.1 DOM 구조 (ID / class)

루트 컨테이너 `#converter-root` 아래에 km 필드, mile 필드, 결과 영역, 초기화 버튼,
오류 영역을 배치한다.

- **DOM ID**
  - `converter-root` — 변환기 루트 컨테이너
  - `km-input` — 킬로미터 입력 필드
  - `mile-input` — 마일 입력 필드
  - `km-result` — km 기준 변환 결과 표시 영역
  - `mile-result` — mile 기준 변환 결과 표시 영역
  - `reset-button` — 입력 초기화 버튼
- **CSS class**
  - `converter` — 루트 레이아웃
  - `converter__field` — 입력 필드 래퍼
  - `converter__result` — 결과 표시 영역
  - `converter__reset` — 초기화 버튼
  - `converter__error` — 오류(invalid) 메시지 영역

### 3.2 디자인 토큰 (Design Tokens)

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--color-action-primary` | `#2563eb` | 주 실행 control(초기화 버튼 등) 강조색 |
| `--space-control-gap` | `12px` | control 간 간격 |
| `--color-error-text` | `#dc2626` | invalid-input 오류 텍스트 색 |
| `--color-result-text` | `#111827` | 변환 결과 텍스트 색 |

토큰 값과 selector 는 designer/developer 가 변경·재정의하지 않는다.

### 3.3 접근성 (Accessibility)

- `#km-input` 은 `aria-label="킬로미터 입력"` 을 가진다.
- `#mile-input` 은 `aria-label="마일 입력"` 을 가진다.
- `#reset-button` 은 `aria-label="입력 초기화"` 를 가지며 **키보드로 포커스·실행 가능**하다.
- 모든 상태는 **색상만으로 구분하지 않고**, 상태명을 화면 텍스트와 접근성 이름으로 노출한다.

### 3.4 반응형 (Responsive)

- **320px 이상** 뷰포트에서 입력 필드와 결과 영역에 **가로 overflow 가 발생하지 않는다.**
- **480px 미만** 에서는 필드를 **세로로 쌓아** 배치한다.

## 4. 상태 모델 (State Model — frozen)

상태는 정확히 4개이며, 각 상태는 화면 텍스트와 접근성 이름으로 상태명이 노출된다.

| 상태 | 진입 조건 | 화면 표시 |
| --- | --- | --- |
| `idle` | 초기 로드, 또는 초기화 후 | 입력 비어 있음, 결과·오류 영역 비어 있음 |
| `km-converted` | `#km-input` 에 유효 숫자 입력 → mile 로 변환 | `#mile-result` 에 변환값 표시 |
| `mile-converted` | `#mile-input` 에 유효 숫자 입력 → km 로 변환 | `#km-result` 에 변환값 표시 |
| `invalid-input` | 숫자가 아니거나 허용 범위 밖 입력 | `.converter__error` 에 오류 메시지 표시 |

### 4.1 상태 전이 (State Transitions)

- `idle` → `km-converted`: `#km-input` 에 유효 숫자 입력.
- `idle` → `mile-converted`: `#mile-input` 에 유효 숫자 입력.
- 임의 상태 → `invalid-input`: 유효하지 않은 값 입력.
- 임의 상태 → `idle`: `#reset-button` 실행(초기화) — 입력·결과·오류를 모두 비운다.

### 4.2 초기화 · 실패 후조건 (Postcondition)

- **초기화·취소·실패 뒤에는 상태와 진행 표시를 초기값(idle)으로 되돌리고**, 주 실행
  control(입력 필드·초기화 버튼)을 **다시 사용할 수 있어야 한다.**
- `invalid-input` 에서 유효한 값을 다시 입력하면 해당 방향의 converted 상태로 복귀한다.
- 초기화 시 `#km-input`, `#mile-input`, `#km-result`, `#mile-result`, `.converter__error`
  가 모두 초기값으로 비워진다.

## 5. 변환 규칙 (Conversion Rules)

### 5.1 변환 공식

- **km → mile**: `mile = km × 0.621371`
- **mile → km**: `km = mile × 1.609344`

### 5.2 소수 표시 규칙

- 변환 결과는 **소수점 이하 2자리** 로 표시한다(예: `10 km → 6.21 mile`).
- 정수로 떨어져도 자리수를 고정해 일관되게 표시한다(예: `1.609344 km 기준 1 mile → 1.61 km`).
- 결과 텍스트는 값과 단위를 함께 노출한다(예: `6.21 mile`, `16.09 km`).

### 5.3 입력 유효성 (invalid-input 판정)

- 입력이 **숫자로 파싱되지 않으면**(빈 문자열 제외, 문자·기호 등) `invalid-input`.
- 입력이 **음수** 이면 `invalid-input`(거리 값은 0 이상).
- 빈 입력으로 되돌아가면 `idle` 로 복원한다.
- `invalid-input` 상태에서는 `.converter__error` 에 오류 사유를 텍스트로 노출하고,
  상태명을 접근성 이름으로도 노출한다.

## 6. 수용 기준 (Acceptance Criteria — Given/When/Then)

### AC-1 km→mile 변환
- **Given** `idle` 상태에서
- **When** `#km-input` 에 `10` 을 입력하면
- **Then** 상태가 `km-converted` 로 전이하고 `#mile-result` 에 `6.21 mile` 이 표시된다.

### AC-2 mile→km 변환
- **Given** `idle` 상태에서
- **When** `#mile-input` 에 `10` 을 입력하면
- **Then** 상태가 `mile-converted` 로 전이하고 `#km-result` 에 `16.09 km` 가 표시된다.

### AC-3 invalid-input 처리
- **Given** 임의 상태에서
- **When** 숫자가 아니거나 음수인 값을 입력하면
- **Then** 상태가 `invalid-input` 으로 전이하고 `.converter__error` 에 오류 메시지가
  텍스트로 노출된다(색상 단독 표시 금지).

### AC-4 초기화 후 idle 복원
- **Given** `km-converted` / `mile-converted` / `invalid-input` 중 하나에서
- **When** `#reset-button` 을 클릭하거나 키보드로 실행하면
- **Then** 입력·결과·오류가 모두 비워지고 상태가 `idle` 로 복원되며 control 을 다시 사용할 수 있다.

### AC-5 접근성
- **Given** 변환기가 렌더링된 상태에서
- **When** 스크린리더/키보드로 접근하면
- **Then** `#km-input`(`킬로미터 입력`), `#mile-input`(`마일 입력`), `#reset-button`(`입력 초기화`)
  의 접근성 이름이 노출되고, `#reset-button` 은 키보드 포커스·실행이 가능하다.

### AC-6 반응형
- **Given** 뷰포트 폭이 320px 이상일 때
- **When** 변환기를 표시하면
- **Then** 입력·결과 영역에 가로 overflow 가 없고, 480px 미만에서는 필드가 세로로 쌓인다.

## 7. Edge case · 실패 케이스

- **빈 입력**: 입력을 지워 빈 값이 되면 `invalid-input` 이 아니라 `idle` 로 복원한다.
- **음수 입력**: `invalid-input` 으로 처리하고 오류 텍스트를 노출한다.
- **문자/기호 입력**: 숫자 파싱 실패 → `invalid-input`.
- **동시 입력 필드**: 한 방향 필드에 입력해 converted 상태가 되면 해당 방향 결과만 갱신한다.
- **초기화 반복**: 이미 `idle` 인 상태에서 초기화해도 오류 없이 `idle` 을 유지한다.
- **소수 반올림 경계**: 소수 2자리 반올림으로 표시 값이 결정된다(예: `1 km → 0.62 mile`).

## 8. 후속 역할 실행 계약 (Frozen Execution Blueprint 요약)

| packet | 역할 | 선행(blocked_by) | 산출물 |
| --- | --- | --- | --- |
| `plan` | planner | (없음) | 본 문서 `docs/plans/BF-1831/implementation-plan.md` |
| `design` | designer | `plan` | `docs/design/units-BF-1831.md` |
| `develop` | developer | `plan` | `iteration-check2/units.html`, `units.js`, `units.test.js` |
| `review` | reviewer | `design`, `develop` | 검토 verdict |
| `test` | tester | `review` | E2E/단위 검증 결과 |

- designer 는 위 UI 계약(selector·token·상태·접근성·반응형)을 `docs/design/units-BF-1831.md`
  에 시각 명세로 확정한다. selector·token 을 변경·재정의하지 않는다.
- developer 는 `iteration-check2/units.html`·`units.js` 로 위 계약을 구현하고
  `units.test.js` 로 변환 공식·상태 전이·유효성·초기화 복원을 검증한다.
- 두 역할 모두 **승인된 본 실행 설계를 따르며**, 파일·소유자·상태 계약을 재정의하지 않는다.
