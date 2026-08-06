# 카운터 미니 페이지 — 구현 설계 (BF-1779)

> 본 문서는 planner(BF-1782)가 작성한 **frozen blueprint 렌더링**입니다.
> `[ROLE_WORK_PACKET_V2]`의 `ui-contract@v1`(sha256:29b23b51…)과 `planning-contract@v1`을
> 그대로 옮긴 것으로, **파일·소유자·상태·후조건을 재정의하지 않습니다.**
> designer(BF-1780)와 developer(BF-1781)는 이 계약의 selector·token을 변경하거나
> 재정의하지 않고 그대로 구현합니다.

## 1. 목표 (Objective)

정수 카운터를 증가/감소/리셋할 수 있는 **vanilla-static** 미니 페이지를 구현한다.
번들러·외부 라이브러리 없이 브라우저에서 `file://` 로 바로 열 수 있어야 한다.

## 2. 실행 제약 (MUST)

- **vanilla-static (file://)**: 로컬 파일 시스템에서 `index.html` 을 더블클릭해
  `file://` 스킴으로 열었을 때 정상 동작해야 한다.
- **외부 라이브러리 금지**: React/Vue/jQuery 등 프레임워크·유틸 라이브러리를 사용하지 않는다.
- **번들러 미사용**: webpack/vite/rollup 등 빌드 도구를 거치지 않는다. `.js` 는 브라우저가
  직접 로드하는 순수 스크립트여야 한다(모듈 번들 산출물 금지).
- **네트워크·서버 의존 금지**: fetch, CDN, 외부 폰트/CSS import 없이 자족적으로 동작한다.

## 3. 산출물 파일·소유권·상태 (frozen — 재정의 금지)

frozen blueprint 가 유일한 권위이며, planner 문서는 이를 설명만 한다.
**새 파일을 추가하거나 소유자를 재배정하지 않는다.**

| 파일 | 소유자(role) | artifact-policy | 역할 |
| --- | --- | --- | --- |
| `docs/design/counter-BF-1779.md` | designer | additive | UI 디자인 명세(본 계약 렌더) |
| `isolation-check-milestone/counter/index.html` | developer | additive | 마크업 + 스타일 진입점 |
| `isolation-check-milestone/counter/counter.js` | developer | additive | 카운터 상태·조작 로직 |
| `isolation-check-milestone/counter/counter.test.js` | developer | additive | 단위 테스트 |

- **artifact-policy: additive** — 위 네 파일은 가산적으로만 작성/보강한다.
- 후속 producer 는 이 계약을 planning artifact 로 렌더한 범위 안에서만 구현하며,
  파일 추가·소유자 재배정·계약 밖 요구사항 도입을 하지 않는다.

## 4. exact UI 계약 (frozen — selector/token 변경 금지)

### 4.1 DOM ID

| DOM ID | 요소 역할 |
| --- | --- |
| `counter-value` | 현재 카운트 값 표시 영역 |
| `counter-increment` | 증가 버튼 |
| `counter-decrement` | 감소 버튼 |
| `counter-reset` | 리셋 버튼 |

### 4.2 CSS class

| CSS class | 용도 |
| --- | --- |
| `counter` | 루트 컨테이너 |
| `counter__display` | 값 표시 영역 스타일 |
| `counter__button` | 공통 버튼 스타일 |
| `counter__button--reset` | 리셋 버튼 변형(modifier) |

BEM 네이밍(`block__element--modifier`)을 그대로 사용한다. **class 명은 변경·재정의 금지.**

### 4.3 상태 (states)

| 상태 | 정의(후조건) |
| --- | --- |
| **초기값** | `counter-value` 에 텍스트 `'0'` 표시, 세 버튼 모두 활성 |
| **증가** | `counter-increment`(+) 조작 시 `counter-value` 텍스트가 즉시 갱신된 정수로 표시 |
| **감소** | `counter-decrement`(-) 조작 시 `counter-value` 텍스트가 즉시 갱신된 정수로 표시(**음수 허용**) |
| **리셋** | `counter-reset` 조작 시 `counter-value` 텍스트가 `'0'` 으로 복원되고 세 버튼 모두 활성 유지 |

**초기화·취소·실패 후조건**: 어떤 경로로든 상태와 진행 표시를 초기값으로 되돌리고,
주 실행 control(세 버튼)을 다시 사용할 수 있어야 한다. 리셋 후 세 버튼은 계속 활성이다.

### 4.4 디자인 토큰 (design tokens)

CSS 커스텀 프로퍼티(변수)로 정의하며 값은 고정한다.

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--counter-color-primary` | `#2563eb` | 주요 색상(버튼 등) |
| `--counter-space-gap` | `12px` | 요소 간 간격 |
| `--counter-font-size` | `48px` | 카운트 값 표시 폰트 크기 |

**토큰 이름·값 변경 금지.** 색상은 반드시 위 변수를 통해 참조한다.

### 4.5 접근성 (accessibility)

- `counter-increment` 는 `aria-label='증가'` 를 가진다.
- `counter-decrement` 는 `aria-label='감소'` 를 가진다.
- `counter-reset` 는 `aria-label='리셋'` 을 가진다.
- `counter-value` 는 `aria-live='polite'` 로 카운트 갱신을 스크린리더에 알린다.
- **모든 상태는 색상만으로 구분하지 않고**, 상태명을 화면 텍스트와 접근성 이름으로 노출한다.

### 4.6 반응형 (responsive)

- **320px 이상** 뷰포트에서 content overflow 가 발생하지 않는다.

## 5. Acceptance Criteria (Given/When/Then)

### AC-1 초기 렌더
- **Given** 사용자가 `index.html` 을 `file://` 로 연다
- **When** 페이지가 로드되면
- **Then** `counter-value` 에 `'0'` 이 표시되고, 증가/감소/리셋 세 버튼이 모두 활성이며,
  각 버튼은 명세된 `aria-label`(증가/감소/리셋)을 가진다.

### AC-2 증가
- **Given** `counter-value` 가 정수 `n` 을 표시하는 상태
- **When** 사용자가 `counter-increment`(+) 를 조작하면
- **Then** `counter-value` 텍스트가 즉시 `n+1` 로 갱신되고, `aria-live='polite'` 로 갱신이 알려진다.

### AC-3 감소(음수 허용)
- **Given** `counter-value` 가 정수 `n` 을 표시하는 상태
- **When** 사용자가 `counter-decrement`(-) 를 조작하면
- **Then** `counter-value` 텍스트가 즉시 `n-1` 로 갱신되며, `n` 이 `0` 이하일 때도 음수로 갱신된다.

### AC-4 리셋
- **Given** `counter-value` 가 `0` 이 아닌 임의 정수를 표시하는 상태
- **When** 사용자가 `counter-reset` 을 조작하면
- **Then** `counter-value` 텍스트가 `'0'` 으로 복원되고 세 버튼은 모두 활성으로 유지된다.

### AC-5 접근성
- **Given** 스크린리더 사용자
- **When** 카운트가 갱신되면
- **Then** `aria-live='polite'` 영역이 갱신을 안내하고, 각 control 은 `aria-label` 로 식별되며,
  상태가 색상만으로 구분되지 않는다.

### AC-6 반응형
- **Given** 폭 320px 뷰포트
- **When** 페이지를 렌더하면
- **Then** content overflow(가로 스크롤/잘림)가 발생하지 않는다.

### AC-7 실행 제약
- **Given** 번들러·외부 라이브러리·네트워크 없이
- **When** `file://` 로 `index.html` 을 열면
- **Then** 위 모든 동작이 자족적으로 정상 수행된다.

## 6. edge case · 실패 케이스

| 케이스 | 기대 동작 |
| --- | --- |
| 감소로 값이 `0` 미만이 될 때 | 음수를 그대로 표시(하한 없음, AC-3) |
| 리셋을 여러 번 반복 | 항상 `'0'` 유지, 버튼 계속 활성 |
| 큰 정수 연속 증가 | JS Number 정수 범위 내에서 정상 갱신(별도 상한 요구 없음) |
| `file://` 환경(네트워크 없음) | 외부 의존 없이 동작(제약 §2) |
| 색상 구분 불가 사용자 | 상태명이 텍스트/접근성 이름으로 노출되어 식별 가능(§4.5) |
| 초기화/실패 후 | 상태·진행 표시가 초기값으로 복귀, 세 버튼 재사용 가능(§4.3 후조건) |

## 7. 데이터 모델

서버·영속 데이터 없음. 상태는 브라우저 메모리 내 **단일 정수 카운트** 하나로,
`counter.js` 안에서 관리한다. 저장/로드·마이그레이션 대상 없음.

## 8. Handoff 계약

- **designer (BF-1780)**: `docs/design/counter-BF-1779.md` 에 본 §4 계약을 디자인 명세로 렌더.
  selector·token 변경 금지, additive.
- **developer (BF-1781)**: `isolation-check-milestone/counter/{index.html,counter.js,counter.test.js}` 구현.
  §4 selector/token/접근성/반응형과 §5 AC 를 그대로 충족. additive.
- **reviewer (BF-review)**: design·develop 완료 후 계약 준수 검토.
- **tester (BF-test)**: `counter.test.js` 기반 단위 검증 및 AC 회귀 확인.

selector·token 은 frozen 이므로 producer 는 이를 **변경하거나 재정의하지 않는다.**
