# 인사말 페이지 시각 명세 (BF-1778)

> designer: 이디자인 · task: BF-1785
> 이 문서는 planner 가 동결한 `ui-contract@v1` / `planning-contract@v1` 을 **시각 명세**로 렌더링한 것이다.
> **frozen blueprint(파일·소유자·selector·token·상태·후조건)가 유일한 권위다.** 본 문서는 그 계약을
> 시각적으로 설명할 뿐, selector·token 을 변경하거나 재정의하지 않으며 새 파일·새 요구사항을 추가하지
> 않는다 (additive only).
>
> 근거 계약 문서: `docs/plans/BF-1778/implementation-plan.md` (planner 소유)

---

## 0. 범위 및 산출물 정책 (Scope)

- 본 task(BF-1785)의 산출물은 **이 markdown 파일 1개** 뿐이다.
- frozen work packet 의 acceptance criteria 에 따라 **런타임 HTML/CSS/JS 를 생성하지 않는다.**
  따라서 별도 mockup HTML 파일(`docs/design/mockups/…html`)은 만들지 않고, 시각 mockup 은 본 문서 내부의
  ASCII wireframe(§7)으로 설명한다 — deliverable 정의가 "시각 명세 및 mockup **설명**" 이기 때문이다.
- 실제 `index.html` / `app.js` / `greeting.test.js` 는 developer 소유이며 본 문서는 그 selector·token 을
  **그대로 인용**할 뿐 재정의하지 않는다.

---

## 1. 시안 개요 (Overview)

- **변경 범위**: 사용자가 이름을 입력하고 "인사말 생성" 버튼을 누르면 인사말을 출력하는 단일 인사말 페이지.
- **사용자 경험 목표**:
  - 진입 즉시 무엇을 해야 하는지 명확히 인지(입력창 + 버튼 + 빈 출력 영역).
  - 성공/오류 상태를 **색상뿐 아니라 화면 텍스트·접근성 이름**으로 항상 구분 가능.
  - 320px 소형 뷰포트에서도 가로 스크롤 없이 세로로 자연스럽게 흐르는 레이아웃.
- **구성 요소**: 이름 입력창 1 · 제출 버튼 1 · 출력 영역 1 (세로 스택).

---

## 2. 컬러 팔레트 (Color Palette)

frozen 토큰(§4)은 그대로 사용하고, 명세 완결성을 위한 **부수 색상(중립/상태 힌트)** 만 additive 로 제안한다.
아래 "추가 제안" 색상은 계약 토큰이 아니며 developer 가 판단해 반영 여부를 정할 수 있는 시각 가이드다.

| 역할 | HEX | 비고 |
| --- | --- | --- |
| primary (action) | `#2563eb` | **frozen 토큰 `--color-action-primary`** — 제출 버튼 배경 |
| primary text-on | `#ffffff` | 파란 버튼 위 텍스트 대비 확보 (제안) |
| background | `#ffffff` | 페이지 배경 (제안) |
| surface | `#f8fafc` | 출력 영역 배경 (제안) |
| text | `#0f172a` | 본문 기본 텍스트 (제안) |
| text-muted | `#475569` | 라벨·보조 텍스트 (제안) |
| border | `#cbd5e1` | 입력창·출력 영역 테두리 (제안) |
| success-hint | `#15803d` | success 상태 텍스트 강조 (제안 — 텍스트와 **병행**, 색상 단독 아님) |
| error-hint | `#b91c1c` | error 상태 텍스트 강조 (제안 — 텍스트와 **병행**, 색상 단독 아님) |

> ⚠️ **접근성 원칙(§6)**: success-hint / error-hint 색상은 반드시 상태명 텍스트와 **함께** 쓰며,
> 색상만으로 상태를 구분해서는 안 된다.

---

## 3. 타이포그래피 (Typography)

계약에 폰트 토큰이 없으므로 system font stack 을 기본으로 제안한다(additive). 값은 시각 가이드다.

| 역할 | font-family | size | weight | line-height |
| --- | --- | --- | --- | --- |
| heading (페이지 제목) | system-ui, -apple-system, "Segoe UI", sans-serif | 24px | 700 | 1.3 |
| label (입력 라벨) | 〃 | 14px | 600 | 1.4 |
| body / input text | 〃 | 16px | 400 | 1.5 |
| button text | 〃 | 16px | 600 | 1.5 |
| output text | 〃 | 16px | 400 | 1.5 |
| state name (상태명) | 〃 | 13px | 700 | 1.4 |

- input 폰트 size 는 16px 이상 권장 — 모바일 자동 확대(zoom) 방지.

---

## 4. 디자인 토큰 / CSS 변수 (Frozen — 재정의 금지)

아래 두 토큰은 planner 가 동결한 **exact 값**이다. 이름·값을 변경하거나 다른 이름으로 재정의하지 않는다.

| 변수 | 값 | 용도 |
| --- | --- | --- |
| `--color-action-primary` | `#2563eb` | 주 실행 버튼(`.greeting__submit`) 색상 |
| `--space-control-gap` | `12px` | 입력창·버튼·출력 영역 간 세로 간격 |

```css
:root {
  --color-action-primary: #2563eb; /* frozen */
  --space-control-gap: 12px;       /* frozen */
}
```

---

## 5. 레이아웃 (Layout)

### 5.1 구조 (frozen selector 인용 — 재정의 아님)

세로 단일 컬럼 스택. 루트 컨테이너는 `.greeting`, 자식은 순서대로 라벨 → 입력창 → 버튼 → 출력 영역.

| 요소 | frozen selector | 클래스 |
| --- | --- | --- |
| 페이지 루트 컨테이너 | — | `greeting` |
| 이름 입력창 | `#greeting-name-input` | `greeting__input` |
| 제출 버튼 (주 실행 control) | `#greeting-submit` | `greeting__submit` |
| 출력 영역 | `#greeting-output` | `greeting__output` |

### 5.2 spacing

- 자식 요소 사이 세로 간격 = **`--space-control-gap` (12px)** 로 통일 (`gap` 또는 `margin`).
- 컨테이너 좌우 패딩 16px 권장(제안), 최대 폭 480px 권장(제안, 중앙 정렬).

### 5.3 breakpoint 별 동작 (반응형)

| 뷰포트 | 동작 |
| --- | --- |
| **≥ 320px (최소)** | 입력창·버튼·출력 영역에 **가로 overflow 발생 금지**. 세로 스택 유지, 요소 폭 100%. |
| ~ 480px | 컨테이너가 뷰포트 폭에 맞춰 유동(fluid), 좌우 패딩 유지. |
| ≥ 480px | 컨테이너 max-width 480px 로 고정 후 중앙 정렬(제안). |

- overflow 방지: 입력창/버튼 `width: 100%`, `box-sizing: border-box`, 긴 출력 텍스트는 `word-break`/`overflow-wrap` 로 줄바꿈.

---

## 6. 접근성 (Accessibility — Frozen 요구사항)

계약(§3.6)을 그대로 시각 명세로 옮긴다. 아래는 **필수** 이며 additive 축소 불가.

1. `#greeting-name-input` 은 연결된 `<label for="greeting-name-input">` 을 가진다 — 라벨은 입력창 위에 노출.
2. `#greeting-submit` 은 명시적 `aria-label="인사말 생성"` 을 가진다(버튼 표면 텍스트와 병행).
3. **error 상태 메시지**를 담는 영역은 `role="status"` 로 스크린리더에 전달된다(보통 `#greeting-output`).
4. **모든 상태(idle/success/error)는 색상만으로 구분하지 않는다** — 상태명을 화면 텍스트와 접근성 이름으로 노출.
   - 예: 출력 영역 안에 상태 뱃지 텍스트 `상태: idle` / `상태: success` / `상태: error` 를 함께 표기.
5. 대비: 파란 버튼(`#2563eb`) 위 텍스트는 흰색(`#ffffff`)으로 WCAG AA 대비 확보(제안).
6. 포커스 표시: 입력창·버튼에 가시적 focus outline 유지(브라우저 기본 제거 금지, 제안).

---

## 7. 상태별 시각 명세 + mockup 설명 (State Visuals)

프로젝트 규약상 별도 mockup HTML 을 만들지 않으므로, 각 상태를 **ASCII wireframe** 으로 시각화한다.
selector·token 은 인용일 뿐 재정의가 아니다.

### 7.1 idle (초기 진입 · error 복원 후)

```
┌───────────────────────────────┐  .greeting
│  인사말 생성                    │  (heading)
│                               │
│  이름                          │  <label for="greeting-name-input">
│  ┌─────────────────────────┐  │
│  │                         │  │  #greeting-name-input .greeting__input
│  └─────────────────────────┘  │
│        ↕ --space-control-gap  │
│  ┌─────────────────────────┐  │
│  │      인사말 생성          │  │  #greeting-submit .greeting__submit
│  └─────────────────────────┘  │  bg: --color-action-primary (#2563eb)
│        ↕ --space-control-gap  │  aria-label="인사말 생성" (활성)
│  ┌─────────────────────────┐  │
│  │ 상태: idle              │  │  #greeting-output .greeting__output
│  │ (출력 없음 / 초기 안내)  │  │  role="status"
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

- 출력 영역: 비어 있음 또는 초기 안내. 상태명 `idle` 을 텍스트로 노출.
- submit 버튼: **활성(enabled)**.

### 7.2 success (이름 입력 후 제출)

```
│  ┌─────────────────────────┐  │  #greeting-name-input
│  │ 홍길동                   │  │
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │  #greeting-submit (활성)
│  │      인사말 생성          │  │
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │  #greeting-output role="status"
│  │ 상태: success           │  │  ← 상태명 텍스트 (색상 단독 아님)
│  │ 안녕하세요, 홍길동님!     │  │  ← 인사말 텍스트
│  └─────────────────────────┘  │
```

- `#greeting-output` 에 인사말 텍스트 + 상태명 `success` 노출.
- submit 버튼: **활성 유지**.
- success-hint 색상(`#15803d`)은 상태명 텍스트와 **병행**해 강조(선택).

### 7.3 error (빈 이름 / 공백만 입력 후 제출)

```
│  ┌─────────────────────────┐  │  #greeting-name-input (빈 값 또는 공백)
│  │                         │  │
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │  #greeting-submit (재활성 — 계속 enabled)
│  │      인사말 생성          │  │
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │  #greeting-output role="status"
│  │ 상태: error             │  │  ← 상태명 텍스트 (색상 단독 아님)
│  │ 이름을 입력해 주세요.     │  │  ← 오류 안내 텍스트
│  └─────────────────────────┘  │
```

- 인사말을 생성하지 않고 오류 안내 텍스트 + 상태명 `error` 노출, `role="status"` 로 전달.
- submit 버튼: **재활성(enabled) 유지** — error 화면에 고정되지 않는다.
- error-hint 색상(`#b91c1c`)은 상태명 텍스트와 **병행**(선택), 색상 단독 구분 금지.

### 7.4 상태 전이 (State Flow)

```
        [진입]
          │
          ▼
      ┌────────┐   빈/공백 이름 제출    ┌────────┐
      │  idle  │ ───────────────────▶ │ error  │
      └────────┘                       └────────┘
          │  ▲                             │
 유효 이름 제출│  │ 유효 이름 재입력 후 제출      │
          ▼  └─────────────────────────────┘
      ┌─────────┐
      │ success │
      └─────────┘
```

- **초기화·취소·실패 뒤에는 상태·진행 표시를 초기값(idle)으로 되돌리고 주 실행 control(`#greeting-submit`)을
  다시 사용할 수 있어야 한다** (frozen 후조건). error 후에도 submit 은 계속 활성이며, 유효한 이름 재입력 후
  제출이 정상 처리되어 success 로 복귀한다.

---

## 8. 컴포넌트 명세 (Component Spec)

각 컴포넌트의 selector·상태·인터랙션. **selector·token 은 계약 인용 — 재정의 아님.**

### 8.1 이름 입력창 — `#greeting-name-input` / `.greeting__input`

| 항목 | 값 |
| --- | --- |
| 요소 | `<input type="text">` |
| 연결 라벨 | `<label for="greeting-name-input">이름</label>` (필수) |
| placeholder | "이름을 입력하세요" (제안) |
| 폭 | `width: 100%`, `box-sizing: border-box` (320px overflow 방지) |
| 인터랙션 | 입력 변경 시 별도 부작용 없음. 제출 시점에 trim 후 빈 문자열 판정. |

### 8.2 제출 버튼 — `#greeting-submit` / `.greeting__submit`

| 항목 | 값 |
| --- | --- |
| 요소 | `<button type="button">` (표면 텍스트 "인사말 생성") |
| aria-label | `"인사말 생성"` (필수, frozen) |
| 배경색 | `var(--color-action-primary)` = `#2563eb` (frozen) |
| 텍스트색 | `#ffffff` (대비 확보, 제안) |
| 상태 | idle/success/error 전 구간 **활성(enabled) 유지** — 비활성화 금지 |
| :hover | 배경 약간 어둡게(예: `#1d4ed8`, 제안) |
| :focus | 가시적 focus outline 유지 |

### 8.3 출력 영역 — `#greeting-output` / `.greeting__output`

| 항목 | 값 |
| --- | --- |
| 요소 | 출력 컨테이너 (`<div>`/`<p>` 등), `role="status"` |
| 표시 내용 | idle: 상태명 + (빈/초기 안내) · success: 상태명 + 인사말 · error: 상태명 + 오류 안내 |
| 상태명 노출 | 항상 화면 텍스트로 `상태: <idle|success|error>` 노출 (색상 단독 금지) |
| 줄바꿈 | 긴 텍스트 `overflow-wrap: anywhere` / `word-break` 로 가로 overflow 방지 |

---

## 9. dev 구현 가이드 (Developer Guide)

developer(`isolation-check-milestone/greeting/*`)가 §3~§4(plan) 및 본 문서를 따라 구현할 때 참고할 지침.
**아래는 계약 selector·token 을 그대로 사용하라는 안내이며 새 selector/token 을 만들지 않는다.**

1. `:root` 에 frozen 토큰 2개 정의: `--color-action-primary: #2563eb`, `--space-control-gap: 12px`.
2. 루트 컨테이너에 `class="greeting"`. 자식 순서: label → input → button → output.
3. 입력창: `id="greeting-name-input" class="greeting__input"`, 연결 라벨 `<label for="greeting-name-input">`.
4. 버튼: `id="greeting-submit" class="greeting__submit" type="button" aria-label="인사말 생성"`,
   배경 `var(--color-action-primary)`.
5. 출력: `id="greeting-output" class="greeting__output" role="status"`.
6. 요소 간 세로 간격은 `var(--space-control-gap)` 로 통일(`gap`/`margin`).
7. 상태 로직(app.js):
   - 제출 시 `input.value.trim()` 이 빈 문자열 → **error**(인사말 생성 안 함, 오류 안내 + `상태: error`).
   - 비어 있지 않으면 → **success**(인사말 텍스트 + `상태: success`).
   - 어떤 경우에도 submit 버튼은 계속 enabled, 유효 이름 재입력 후 제출 시 success 복귀.
   - 상태명 텍스트를 출력 영역에 항상 함께 렌더(색상 단독 구분 금지).
8. 반응형: input/button `width:100%; box-sizing:border-box`, 320px 에서 가로 overflow 0.
9. 테스트(greeting.test.js): selector 존재, 빈/공백 이름 error, role="status", 유효 이름 success 복귀,
   submit 지속 활성, 상태명 텍스트 노출을 가드(plan §5 AC).

---

## 10. mockup 참조 (Mockup Reference)

- 본 task 는 frozen 계약상 **런타임 HTML/CSS/JS 및 별도 mockup HTML 을 생성하지 않는다.**
- 시각 mockup 은 본 문서 **§7 ASCII wireframe** 으로 대체한다(deliverable = "시각 명세 및 mockup 설명").
- developer 의 실제 화면 산출물은 `isolation-check-milestone/greeting/index.html` (developer 소유)이다.

---

## 11. 계약 준수 확인 (Contract Compliance)

- [x] frozen DOM ID 3개(`greeting-name-input`, `greeting-submit`, `greeting-output`) 그대로 인용, 재정의 없음.
- [x] frozen CSS 클래스 4개(`greeting`, `greeting__input`, `greeting__submit`, `greeting__output`) 그대로 인용.
- [x] frozen 토큰 2개(`--color-action-primary=#2563eb`, `--space-control-gap=12px`) 값·이름 유지.
- [x] 상태 3종(idle/success/error) 시각화 + 색상 단독 구분 금지 명시.
- [x] 접근성 4항목(label 연결 / aria-label / role="status" / 상태명 텍스트) 명시.
- [x] 반응형 320px 가로 overflow 금지 명시.
- [x] 산출물은 이 markdown 1개 — 런타임 HTML/CSS/JS 미생성, additive.
