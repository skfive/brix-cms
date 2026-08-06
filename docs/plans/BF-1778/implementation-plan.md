# 인사말 페이지 구현 설계 (BF-1778)

> planner: 박기획 · task: BF-1787
> 이 문서는 frozen `ui-contract@v1` / `planning-contract@v1` 을 실행 가능한 계획으로 렌더링한 것이다.
> **frozen blueprint 가 파일·소유자·상태·후조건의 유일한 권위다.** 이 문서는 그 계약을 설명할 뿐,
> 새 파일·새 역할·계약 밖 요구사항을 추가하지 않는다. designer/developer 는 selector 와 token 을
> 변경하거나 재정의하지 않는다 (additive only).

---

## 1. 목표 (Objective)

사용자가 이름을 입력하고 버튼을 누르면 인사말을 출력하는 단일 인사말 페이지를 구현한다.
PM 이 분해한 Story 를 designer 와 developer 가 그대로 따를 수 있는 실행 설계와 동결 UI 계약으로
구체화하는 것이 본 문서의 역할이다.

---

## 2. 사용자 시나리오 (User Scenario)

- 방문자가 인사말 페이지에 진입하면 이름 입력창과 "인사말 생성" 버튼, 빈 출력 영역이 보인다 (idle).
- 방문자가 이름을 입력하고 버튼을 누르면 출력 영역에 인사말이 표시된다 (success).
- 방문자가 이름을 비운 채 버튼을 누르면 출력 영역에 오류 안내가 표시되고 (error),
  이름을 입력해 다시 제출하면 정상 흐름으로 복귀한다.

---

## 3. Exact UI 계약 (Frozen — 변경·재정의 금지)

### 3.1 산출물 파일 및 소유자 (owner)

| 파일 경로 | 소유 역할 | 정책 |
| --- | --- | --- |
| `docs/design/greeting-BF-1778.md` | designer | additive |
| `isolation-check-milestone/greeting/index.html` | developer | additive |
| `isolation-check-milestone/greeting/app.js` | developer | additive |
| `isolation-check-milestone/greeting/tests/greeting.test.js` | developer | additive |

- 위 파일 소유권은 frozen blueprint 가 유일한 권위이며 본 문서는 이를 재정의하지 않는다.
- 각 파일은 additive 정책만 허용한다 — 계약 selector·token 을 제거하거나 다시 정의하지 않는다.
- 본 planner 문서(`docs/plans/BF-1778/implementation-plan.md`)는 planner 소유이며 downstream producer 가
  참조할 구현 설계 문서다.

### 3.2 DOM ID

| ID | 요소 | 용도 |
| --- | --- | --- |
| `greeting-name-input` | `<input>` | 사용자 이름 입력 |
| `greeting-submit` | `<button>` | 인사말 생성 제출 (주 실행 control) |
| `greeting-output` | 출력 영역 | idle/success/error 상태 텍스트 표시 |

### 3.3 CSS 클래스

| 클래스 | 대상 |
| --- | --- |
| `greeting` | 페이지 루트 컨테이너 |
| `greeting__input` | `#greeting-name-input` |
| `greeting__submit` | `#greeting-submit` |
| `greeting__output` | `#greeting-output` |

### 3.4 디자인 토큰 / CSS 변수 (exact 값)

| 변수 | 값 | 용도 |
| --- | --- | --- |
| `--color-action-primary` | `#2563eb` | 주 실행 버튼(`greeting__submit`) 색상 |
| `--space-control-gap` | `12px` | 입력창·버튼·출력 영역 간 간격 |

- 위 두 토큰은 exact 값으로 고정한다. 값을 변경하거나 다른 이름으로 재정의하지 않는다.

### 3.5 상태 (states)

세 가지 상태만 존재하며, 각 상태는 **색상만으로 구분하지 않고 상태명을 화면 텍스트와 접근성 이름으로
노출**한다.

| 상태 | 진입 조건 | `#greeting-output` 표시 | submit 버튼 |
| --- | --- | --- | --- |
| `idle` | 초기 진입, 그리고 error 복원 후 | 출력 비어 있음(또는 초기 안내), 상태명 idle | 활성(enabled) |
| `success` | 이름이 채워진 상태로 제출 | 인사말 텍스트 + 상태명 success | 활성(enabled) |
| `error` | 빈 이름으로 제출 | 오류 안내 텍스트 + 상태명 error | 재활성(enabled) |

### 3.6 접근성 (accessibility)

- `#greeting-name-input` 은 연결된 `<label>` 을 가진다 (`for="greeting-name-input"`).
- `#greeting-submit` 은 명시적 `aria-label="인사말 생성"` 을 가진다.
- error 상태 메시지는 `role="status"` 로 스크린리더에 전달된다.
- 모든 상태(idle/success/error)는 색상만으로 구분하지 않고 상태명을 화면 텍스트와 접근성 이름으로
  노출한다.

### 3.7 반응형 (responsive)

- 320px 이상 뷰포트에서 입력창·버튼·출력 영역에 **가로 overflow 가 발생하지 않는다.**

---

## 4. 상태 전이 및 실패 흐름 (State Flow)

### 4.1 정상(success) 흐름 — Given/When/Then

- **Given** 방문자가 인사말 페이지에 진입해 있고 상태가 `idle` 이다.
- **When** `#greeting-name-input` 에 비어 있지 않은 이름을 입력하고 `#greeting-submit` 을 누른다.
- **Then** `#greeting-output` 에 인사말이 표시되고 상태가 `success` 로 전이한다.
- **And** 상태명 `success` 가 화면 텍스트와 접근성 이름으로 노출된다.

### 4.2 빈 이름 제출(error) 흐름 — Given/When/Then

- **Given** 방문자가 인사말 페이지에 있고 `#greeting-name-input` 이 비어 있다.
- **When** `#greeting-submit` 을 누른다.
- **Then** 인사말을 생성하지 않고 상태가 `error` 로 전이한다.
- **And** `#greeting-output` 에 오류 안내 텍스트(예: "이름을 입력해 주세요")가 표시되고,
  이 메시지는 `role="status"` 로 스크린리더에 전달된다.
- **And** 상태명 `error` 가 화면 텍스트와 접근성 이름으로 노출되며, 색상만으로 구분하지 않는다.

### 4.3 idle 복원 · submit 재활성화 (후조건)

- error 상태 이후 방문자가 `#greeting-name-input` 에 이름을 입력하고 다시 제출하면 정상(success)
  흐름으로 복귀한다.
- **초기화·취소·실패 뒤에는 상태와 진행 표시를 초기값으로 되돌리고 주 실행 control(`#greeting-submit`)을
  다시 사용할 수 있어야 한다.** 즉 error 후에도 submit 버튼은 계속 활성 상태여야 하며, 유효한 이름
  재입력 후 제출이 정상 처리된다.
- 상태 표시는 idle 로 복원 가능해야 한다 (error 화면에 고정되지 않는다).

---

## 5. Acceptance Criteria (검증 가능한 종료 조건)

1. `index.html` 에 `#greeting-name-input`(연결된 `<label>` 포함), `#greeting-submit`
   (`aria-label="인사말 생성"`), `#greeting-output` 이 존재하고 각각 `greeting__input`,
   `greeting__submit`, `greeting__output` 클래스를 가진다. 루트에 `greeting` 클래스가 있다.
2. CSS 변수 `--color-action-primary: #2563eb`, `--space-control-gap: 12px` 가 정의되고 사용된다.
3. 세 상태(idle/success/error)가 모두 상태명을 화면 텍스트로 노출하며 색상만으로 구분하지 않는다.
4. 빈 이름 제출 시 error 상태로 전이하고 `#greeting-output` 에 오류 안내가 `role="status"` 로
   노출되며, 이름 재입력 후 제출 시 success 로 복귀한다 (submit 은 계속 활성).
5. 320px 뷰포트에서 입력창·버튼·출력 영역에 가로 overflow 가 없다.
6. `greeting.test.js` 가 위 selector·상태 전이·빈 이름 error·idle 복원을 검증한다.
7. designer/developer 산출물은 계약 selector·token 을 변경·재정의하지 않고 additive 로만 작성한다.

---

## 6. Edge Case · 실패 케이스

- **빈 이름 제출**: 인사말 생성 안 함, error 상태 + `role="status"` 오류 안내, submit 재활성 유지.
- **공백만 입력**: 빈 이름과 동일하게 error 로 처리(trim 후 빈 문자열 판정 권장).
- **error 후 재제출**: 유효한 이름이면 success 로 정상 복귀, 상태 idle→success 흐름 복원.
- **320px 최소 뷰포트**: 가로 스크롤/overflow 발생 금지 — 레이아웃이 세로로 흐르도록 구성.
- **스크린리더 사용자**: 상태명이 텍스트·접근성 이름으로 노출되어 색상 없이도 상태 구분 가능.

---

## 7. Handoff (역할별 후속 작업)

| packet | role | 산출물 | 선행 |
| --- | --- | --- | --- |
| `design` | designer | `docs/design/greeting-BF-1778.md` | `plan` |
| `develop` | developer | `isolation-check-milestone/greeting/{index.html, app.js, tests/greeting.test.js}` | `plan` |
| `review` | reviewer | (검토) | `design`, `develop` |
| `test` | tester | (E2E/검증) | `review` |

- designer 는 이 문서의 exact UI 계약(§3)을 시각 명세로 옮기되 selector·token 을 재정의하지 않는다.
- developer 는 §3~§4 의 DOM ID/class/token/상태 전이를 그대로 구현하고 §5 AC 를 테스트로 가드한다.
- 새 파일·새 역할·계약 밖 요구사항 추가는 금지된다 (producer_policy: additive render only).
