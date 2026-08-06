# 인사말 페이지 시각 명세 (BF-1813)

> designer: 이디자인 · task: BF-1814
> 이 문서는 planner 가 동결한 `ui-contract@v1` / `planning-contract@v1` 을 **시각 명세**로 렌더링한 것이다.
> **frozen blueprint(파일·소유자·selector·token·상태·후조건)가 유일한 권위다.** 본 문서는 그 계약을
> 시각적으로 설명할 뿐, selector·token 을 변경하거나 재정의하지 않으며 새 파일·새 요구사항을 추가하지
> 않는다 (additive only).
>
> 근거 계약 문서: `docs/plans/BF-1813/implementation-plan.md` (planner 소유)

---

## 0. 범위 및 산출물 정책 (Scope)

- 본 task(BF-1814)의 산출물은 **이 markdown 파일 1개** 뿐이다.
- frozen work packet 의 acceptance criteria 에 따라 **런타임 HTML/CSS/JS 를 생성하지 않는다.**
  따라서 별도 mockup HTML 파일(`docs/design/mockups/…html`)은 만들지 않고, 시각 mockup 은 본 문서 내부의
  ASCII wireframe(§7)으로 설명한다 — deliverable 정의가 "시각 명세 및 mockup **을 포함**" 이기 때문이다.
- 실제 `iteration-check2/greeting.html` / `iteration-check2/greeting.test.js` 는 developer 소유이며,
  본 문서는 그 selector·token 을 **그대로 인용**할 뿐 재정의하지 않는다.

---

## 1. 시안 개요 (Overview)

- **변경 범위**: 오늘 날짜와 함께 한 줄 인사말을 표시하는 **정적 인사말 페이지**. 입력·버튼은 없다.
- **사용자 경험 목표**:
  - 진입 즉시 인사말 자리표시자가 보여 페이지가 살아 있음을 인지(initial).
  - 인사말 한 줄과 오늘 날짜(YYYY-MM-DD)가 명확히 구분되어 표시(loaded).
  - 날짜 계산 실패 시에도 **색상뿐 아니라 화면 텍스트·접근성 이름**으로 상태를 항상 구분(date-error).
  - 320px 소형 뷰포트에서도 가로 스크롤(overflow) 없이 세로로 자연스럽게 흐르는 레이아웃.
- **구성 요소**: 인사말 메시지 1(제목) · 날짜 표시 1 (세로 스택). 상호작용 control 없음.

---

## 2. 컬러 팔레트 (Color Palette)

frozen 토큰(§4)은 그대로 사용하고, 명세 완결성을 위한 **부수 색상(중립/상태 힌트)** 만 additive 로 제안한다.
아래 "추가 제안" 색상은 계약 토큰이 아니며 developer 가 판단해 반영 여부를 정할 수 있는 시각 가이드다.

| 역할 | HEX | 비고 |
| --- | --- | --- |
| text (인사말/날짜) | `#1f2937` | **frozen 토큰 `--color-greeting-text`** — 인사말/날짜 텍스트 색 |
| background | `#ffffff` | 페이지 배경 (제안) |
| text-muted | `#6b7280` | 날짜·보조 텍스트 (제안, `--color-greeting-text` 와 병행) |
| error-hint | `#b91c1c` | date-error 상태 텍스트 강조 (제안 — 상태명 텍스트와 **병행**, 색상 단독 아님) |

> ⚠️ **접근성 원칙(§6)**: error-hint 색상은 반드시 상태 안내 텍스트와 **함께** 쓰며,
> 색상만으로 상태를 구분해서는 안 된다. 기본 텍스트는 frozen 토큰 `--color-greeting-text(#1f2937)` 를 사용한다.

---

## 3. 타이포그래피 (Typography)

계약에 폰트 토큰이 없으므로 system font stack 을 기본으로 제안한다(additive). 값은 시각 가이드다.

| 역할 | font-family | size | weight | line-height |
| --- | --- | --- | --- | --- |
| heading (인사말 = h1) | system-ui, -apple-system, "Segoe UI", sans-serif | 28px | 700 | 1.3 |
| date (날짜 = time) | 〃 | 16px | 400 | 1.5 |
| state name (상태 안내) | 〃 | 14px | 600 | 1.4 |

- 인사말은 h1 heading role(§6) 이므로 시각적으로도 가장 큰 위계를 가진다.
- 긴 인사말도 줄바꿈되도록 `overflow-wrap: anywhere` 권장(§5.3).

---

## 4. 디자인 토큰 / CSS 변수 (Frozen — 재정의 금지)

아래 두 토큰은 planner 가 동결한 **exact 값**이다. 이름·값을 변경하거나 다른 이름으로 재정의하지 않는다.

| 변수 | 값 | 용도 |
| --- | --- | --- |
| `--color-greeting-text` | `#1f2937` | 인사말/날짜 텍스트 색 |
| `--space-greeting-gap` | `8px` | 메시지-날짜 간 세로 간격 |

```css
:root {
  --color-greeting-text: #1f2937; /* frozen */
  --space-greeting-gap: 8px;      /* frozen */
}
```

---

## 5. 레이아웃 (Layout)

### 5.1 구조 (frozen selector 인용 — 재정의 아님)

세로 단일 컬럼 스택. 루트 컨테이너는 `.greeting`, 자식은 순서대로 인사말 메시지 → 날짜.

| 요소 | frozen DOM ID | frozen 클래스 | 역할 |
| --- | --- | --- | --- |
| 페이지 루트 컨테이너 | `greeting-root` | `greeting` | 페이지 루트 |
| 인사말 메시지 | `greeting-message` | `greeting__message` | 인사말 한 줄 (h1) |
| 날짜 표시 | `greeting-date` | `greeting__date` | 오늘 날짜 (time) |

### 5.2 spacing

- 메시지-날짜 사이 세로 간격 = **`--space-greeting-gap` (8px)** 로 통일 (`gap` 또는 `margin`).
- 컨테이너 좌우 패딩 16px 권장(제안), 최대 폭 480px 권장(제안, 중앙 정렬).

### 5.3 breakpoint 별 동작 (반응형)

| 뷰포트 | 동작 |
| --- | --- |
| **≥ 320px (최소)** | 인사말·날짜에 **가로 overflow 발생 금지**. 세로 스택 유지, 요소 폭 100%. |
| ~ 480px | 컨테이너가 뷰포트 폭에 맞춰 유동(fluid), 좌우 패딩 유지. |
| ≥ 480px | 컨테이너 max-width 480px 로 고정 후 중앙 정렬(제안). |

- overflow 방지: 컨테이너 `box-sizing: border-box`, 긴 인사말 텍스트는 `overflow-wrap: anywhere`/`word-break` 로 줄바꿈.

---

## 6. 접근성 (Accessibility — Frozen 요구사항)

계약(§4.4)을 그대로 시각 명세로 옮긴다. 아래는 **필수** 이며 additive 축소 불가.

1. `#greeting-message` 는 **h1 heading role** 로 노출된다 — 시각적으로도 페이지의 주 제목.
2. `#greeting-date` 는 `datetime` 속성을 가진 **`<time>` 요소**로 표기한다
   (예: `<time id="greeting-date" datetime="2026-08-06">2026-08-06</time>`).
3. **모든 상태(initial/loaded/date-error)는 색상만으로 구분하지 않는다** — 상태명을 화면 텍스트와
   접근성 이름으로 노출한다.
4. **date-error 안내**(`날짜를 불러올 수 없습니다`)는 `#greeting-date` 에 화면 텍스트로 노출되어
   스크린리더에 그대로 읽힌다. error-hint 색상은 이 텍스트와 **병행**할 뿐 색상 단독 구분 금지.
5. 대비: 기본 텍스트 `#1f2937` 는 흰 배경 대비 WCAG AA 이상을 만족(제안).

---

## 7. 상태별 시각 명세 + mockup 설명 (State Visuals)

frozen 계약상 별도 mockup HTML 을 만들지 않으므로, 각 상태를 **ASCII wireframe** 으로 시각화한다.
selector·token 은 인용일 뿐 재정의가 아니다.

### 7.1 initial (최초 렌더)

```
┌───────────────────────────────┐  #greeting-root .greeting
│                               │
│   인사말을 불러오는 중…          │  #greeting-message .greeting__message
│                               │  (h1) — 인사말 자리표시자
│        ↕ --space-greeting-gap │
│   ----------                  │  #greeting-date .greeting__date
│                               │  <time> — 날짜 자리표시자
└───────────────────────────────┘
```

- `#greeting-root` 가 렌더되고 인사말 **자리표시자**가 먼저 보인다.
- 상태명 `initial` 을 접근성 이름/화면 텍스트로 인지 가능(색상 단독 아님).

### 7.2 loaded (정상)

```
┌───────────────────────────────┐  #greeting-root .greeting
│                               │
│   안녕하세요! 좋은 하루 되세요.   │  #greeting-message .greeting__message
│                               │  (h1) — 인사말 한 줄
│        ↕ --space-greeting-gap │
│   2026-08-06                  │  #greeting-date .greeting__date
│                               │  <time datetime="2026-08-06">
└───────────────────────────────┘
```

- `#greeting-message` 에 인사말 한 줄, `#greeting-date` 에 오늘 날짜(**YYYY-MM-DD**) 표시.
- `#greeting-date` 는 `datetime` 속성을 가진 `<time>` 요소로 노출(§6-2).
- 텍스트 색은 `var(--color-greeting-text)` = `#1f2937`, 간격은 `var(--space-greeting-gap)` = `8px`.

### 7.3 date-error (날짜 계산 실패)

```
┌───────────────────────────────┐  #greeting-root .greeting
│                               │
│   안녕하세요! 좋은 하루 되세요.   │  #greeting-message .greeting__message (유지)
│                               │
│        ↕ --space-greeting-gap │
│   날짜를 불러올 수 없습니다       │  #greeting-date .greeting__date
│                               │  ← 상태 안내 텍스트 (색상 단독 아님)
└───────────────────────────────┘
```

- 날짜 계산 실패 시 `#greeting-date` 에 **`날짜를 불러올 수 없습니다`** 텍스트를 표시한다(frozen 문구).
- 상태명이 화면 텍스트·접근성 이름으로 노출되며, error-hint 색상은 텍스트와 병행(선택).

### 7.4 상태 전이 (State Flow)

```
        [진입]
          │
          ▼
      ┌─────────┐   날짜 계산 성공   ┌─────────┐
      │ initial │ ───────────────▶ │ loaded  │
      └─────────┘                   └─────────┘
          │                              ▲
 날짜 계산 실패│                              │ 재시도/초기화 성공
          ▼                              │
      ┌───────────┐  ────────────────────┘
      │ date-error│
      └───────────┘
```

- **초기화·취소·실패 뒤에는 상태·진행 표시를 초기값(initial)으로 되돌리고, 정상 경로(loaded)로 다시
  진입할 수 있어야 한다** (frozen 후조건). date-error 이후에도 페이지는 고정되지 않고, 날짜 계산이
  다시 성공하면 loaded 로 복귀한다.

---

## 8. 컴포넌트 명세 (Component Spec)

각 컴포넌트의 selector·상태·표시 내용. **selector·token 은 계약 인용 — 재정의 아님.**

### 8.1 루트 컨테이너 — `#greeting-root` / `.greeting`

| 항목 | 값 |
| --- | --- |
| 요소 | 페이지 루트 컨테이너 (`<main>`/`<div>` 등) |
| 레이아웃 | 세로 스택. 자식 순서: message → date |
| 간격 | 자식 간 세로 간격 `var(--space-greeting-gap)` = `8px` |
| 반응형 | `box-sizing: border-box`, 320px 에서 가로 overflow 0 |

### 8.2 인사말 메시지 — `#greeting-message` / `.greeting__message`

| 항목 | 값 |
| --- | --- |
| 요소 | `<h1>` (h1 heading role, frozen) |
| 표시 내용 | initial: 인사말 자리표시자 · loaded: 인사말 한 줄 |
| 텍스트색 | `var(--color-greeting-text)` = `#1f2937` (frozen) |
| 줄바꿈 | 긴 텍스트 `overflow-wrap: anywhere` 로 가로 overflow 방지 |

### 8.3 날짜 표시 — `#greeting-date` / `.greeting__date`

| 항목 | 값 |
| --- | --- |
| 요소 | `<time>` (frozen), 성공 시 `datetime="YYYY-MM-DD"` 속성 |
| 표시 내용 | initial: 날짜 자리표시자 · loaded: 오늘 날짜(YYYY-MM-DD) · date-error: `날짜를 불러올 수 없습니다` |
| 텍스트색 | `var(--color-greeting-text)` = `#1f2937` (frozen) — date-error 시 error-hint 병행 가능 |
| 상태명 노출 | 모든 상태를 화면 텍스트·접근성 이름으로 노출(색상 단독 금지) |

---

## 9. dev 구현 가이드 (Developer Guide)

developer(BF-1815, `iteration-check2/greeting.html` · `iteration-check2/greeting.test.js`)가 plan §4 및 본 문서를
따라 구현할 때 참고할 지침. **아래는 계약 selector·token 을 그대로 사용하라는 안내이며 새 selector/token 을 만들지 않는다.**

1. `:root` 에 frozen 토큰 2개 정의: `--color-greeting-text: #1f2937`, `--space-greeting-gap: 8px`.
2. 루트 컨테이너에 `id="greeting-root" class="greeting"`. 자식 순서: message → date.
3. 인사말: `<h1 id="greeting-message" class="greeting__message">` (h1 heading role 유지).
4. 날짜: `<time id="greeting-date" class="greeting__date">`. loaded 시 `datetime="YYYY-MM-DD"` 속성과
   화면 텍스트 YYYY-MM-DD 를 함께 설정.
5. 텍스트 색은 `var(--color-greeting-text)`, 메시지-날짜 간격은 `var(--space-greeting-gap)` 로 통일.
6. 상태 로직:
   - initial: `#greeting-root` 렌더 + 인사말 자리표시자 노출.
   - loaded: 날짜 계산 성공 → `#greeting-message` 인사말 한 줄, `#greeting-date` 오늘 날짜(YYYY-MM-DD) + datetime.
   - date-error: 날짜 계산 실패 → `#greeting-date` 에 정확히 `날짜를 불러올 수 없습니다` 텍스트 표시.
   - 초기화·실패 후에는 상태를 initial 로 되돌리고 정상 경로(loaded)로 재진입 가능해야 한다.
   - 모든 상태명을 화면 텍스트·접근성 이름으로 노출(색상 단독 구분 금지).
7. 반응형: 컨테이너 `box-sizing: border-box`, 320px 에서 가로 overflow 0. 긴 인사말 `overflow-wrap: anywhere`.
8. 테스트(greeting.test.js): selector 3개 존재, loaded 시 인사말+날짜(YYYY-MM-DD) 표시, `#greeting-message`
   h1 role, `#greeting-date` `<time>`+`datetime`, date-error 시 `날짜를 불러올 수 없습니다` 텍스트, 320px overflow 0,
   초기화 후 initial 복귀를 가드(plan §5 AC).

---

## 10. mockup 참조 (Mockup Reference)

- 본 task 는 frozen 계약상 **런타임 HTML/CSS/JS 및 별도 mockup HTML 을 생성하지 않는다.**
- 시각 mockup 은 본 문서 **§7 ASCII wireframe** 으로 대체한다(deliverable = "시각 명세 및 mockup 을 포함").
- developer 의 실제 화면 산출물은 `iteration-check2/greeting.html` (developer 소유)이다.

---

## 11. 계약 준수 확인 (Contract Compliance)

- [x] frozen DOM ID 3개(`greeting-root`, `greeting-message`, `greeting-date`) 그대로 인용, 재정의 없음.
- [x] frozen CSS 클래스 3개(`greeting`, `greeting__message`, `greeting__date`) 그대로 인용.
- [x] frozen 토큰 2개(`--color-greeting-text=#1f2937`, `--space-greeting-gap=8px`) 값·이름 유지.
- [x] 상태 3종(initial/loaded/date-error) 시각화 + 색상 단독 구분 금지 명시.
- [x] date-error 문구 `날짜를 불러올 수 없습니다` frozen 그대로 인용.
- [x] 접근성 3항목(h1 heading role / `<time>`+datetime / 상태명 텍스트 노출) 명시.
- [x] 반응형 320px 가로 overflow 금지 명시.
- [x] 후조건(초기화·실패 후 initial 복귀 + 정상 경로 재진입) 명시.
- [x] 산출물은 이 markdown 1개 — 런타임 HTML/CSS/JS 미생성, additive.

---

## 12. Self-critique

PR 제출 전 designer 자기 점검 5항목.

1. **AC 매핑**: plan §5 의 AC-1~AC-6 을 §7(상태)·§4(토큰)·§6(접근성)·§5.3(반응형)·§7.4(후조건)에 각각 대응.
   누락 없음 — loaded/date-error/접근성/반응형/토큰/후조건 모두 시각 명세에 반영.
2. **dev 구현 가이드**: §9 에 selector·token·상태·접근성·반응형·테스트 가드를 단계별로 제시. developer 가
   추가 추론 없이 따라갈 수 있는 수준.
3. **기존 요소 보존**: 기존 `greeting-BF-1778.md`(다른 feature, 입력+버튼형)를 건드리지 않고 **신규 파일**
   `greeting-BF-1813.md` 로 additive 작성. frozen selector/token 재정의 없음.
4. **컴포넌트 매핑**: frozen DOM ID 3 / class 3 / token 2 / 상태 3 을 §5.1·§8·§11 표로 1:1 매핑.
5. **모호함 flag**:
   - 인사말 문구·자리표시자 텍스트는 계약에 미고정 → placeholder(§7 예시)로 표기, 최종 문구는 developer 재량.
   - "재시도/초기화" 트리거 방식(자동/수동)은 계약에 미정의 → 후조건(initial 복귀 + loaded 재진입 가능)만
     명세하고 구체 트리거는 developer 구현 판단에 위임.
   - 추가 제안 색상(background/text-muted/error-hint)은 frozen 토큰이 아님을 §2 에 명시 — 반영은 dev 재량.
</content>
</invoke>
