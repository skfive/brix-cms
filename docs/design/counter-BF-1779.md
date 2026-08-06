# 카운터 미니 페이지 — 시각 명세 (BF-1779)

> 본 문서는 designer(BF-1780) 산출물로, planner(BF-1782)가 동결한
> `ui-contract@v1`(sha256:29b23b51…)과 `docs/plans/BF-1779/implementation-plan.md`의
> **frozen 계약을 시각 명세로 렌더**한 것입니다.
> **selector·token·상태·접근성·반응형 계약을 변경하거나 재정의하지 않습니다(additive).**
> 본 task의 수용 기준상 **런타임 HTML/CSS/JS는 생성하지 않으며**, mockup은 아래
> §7에 이 명세 안에서 시각적으로 기술합니다.
> 실제 런타임 파일(`isolation-check-milestone/counter/{index.html,counter.js,counter.test.js}`)은
> developer(BF-1781) 소유입니다.

---

## 1. 시안 개요

- **변경 범위**: 정수 카운터를 증가/감소/리셋할 수 있는 **vanilla-static** 미니 페이지의
  시각(UI) 명세. 값 표시 영역 1개 + 조작 버튼 3개(증가/감소/리셋)로 구성된 단일 화면.
- **사용자 경험 목표**
  1. 현재 카운트 값을 **크고 명확하게**(48px) 화면 중앙에서 즉시 읽을 수 있다.
  2. 증가/감소/리셋 조작 결과가 **즉시** 값에 반영된다(지연·전환 없음).
  3. **색상만이 아니라 텍스트·접근성 이름**으로 각 control과 상태를 식별할 수 있다.
  4. **320px** 이상 어떤 뷰포트에서도 가로 스크롤·잘림 없이 온전히 보인다.
  5. 외부 의존 없이 `file://` 로 열어도 시각/조작이 자족적으로 동작한다.

---

## 2. 컬러 팔레트

색상은 **반드시 frozen 디자인 토큰(CSS 커스텀 프로퍼티)을 통해서만** 참조합니다.
아래 표에서 **[frozen]** 은 계약상 값·이름 고정(변경 금지), **[권장]** 은 중립값에 대한
비구속 가이드(dev 재량 허용, 새 필수 토큰 아님)입니다.

| 역할 | HEX | 출처 |
| --- | --- | --- |
| **primary** (버튼 배경·강조) | `#2563eb` | **[frozen]** `--counter-color-primary` |
| **on-primary** (버튼 위 텍스트) | `#ffffff` | [권장] 대비 확보용, 토큰화 불필요 |
| **background** (페이지 배경) | `#ffffff` | [권장] vanilla-static 기본 |
| **text** (값·라벨 텍스트) | `#0f172a` | [권장] 고대비 본문색 |
| **secondary / accent** | — | 계약 미정의. 필요 시 primary 파생(hover 등)만 사용, 새 토큰 도입 금지 |

- **primary 접근성**: `#2563eb` on `#ffffff` 명도 대비 ≈ 5.17:1 → WCAG AA(일반 텍스트 4.5:1) 충족.
- **금지**: primary 색을 리터럴 `#2563eb` 로 하드코딩하지 말고 항상 `var(--counter-color-primary)` 참조.
- **상태 구분은 색상 단독 금지**(§6). 색상은 강조 보조 수단이며 식별 근거가 아니다.

---

## 3. 타이포그래피

외부 폰트 import 금지(vanilla-static, 네트워크 의존 금지). **system font stack** 사용.

권장 스택: `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif`

| 역할 | font-size | weight | line-height | 비고 |
| --- | --- | --- | --- | --- |
| **카운트 값**(`counter__display`) | `48px` **[frozen]** `--counter-font-size` | 700 | 1.0 | 숫자 가독 최우선, 중앙 정렬 |
| **버튼 라벨**(`counter__button`) | 20px | 600 | 1.2 | `+` / `−` / `리셋` 텍스트 |
| **caption / 보조 텍스트** | 14px | 400 | 1.4 | 필요 시(현재 계약상 필수 아님) |

- 값 표시 폰트 크기는 **반드시 `var(--counter-font-size)`** 를 통해 참조(값 `48px` 고정).
- 숫자 폭 흔들림 방지 권장: `font-variant-numeric: tabular-nums`(비구속 가이드).

---

## 4. 레이아웃

### 4.1 구조

단일 화면. 루트 컨테이너 `.counter` 안에 **세로 스택**:

```
┌──────────────── .counter (중앙 정렬) ────────────────┐
│                                                      │
│              ┌────────────────────┐                  │
│              │   .counter__display │  ← id=counter-value
│              │        0            │     (48px, aria-live=polite)
│              └────────────────────┘                  │
│                                                      │
│   [   −   ]   [   +   ]   [   리셋   ]                │
│  decrement    increment   reset                      │
│  (버튼 3개, 가로 배치, gap = 12px)                    │
└──────────────────────────────────────────────────────┘
```

- **버튼 순서(화면 좌→우)**: 감소(`counter-decrement`) · 증가(`counter-increment`) · 리셋(`counter-reset`).
  (DOM 순서는 dev 재량이나 시각 순서는 위를 권장. selector/id 는 §5 고정.)
- **정렬**: 값·버튼 모두 수평 중앙. 값 아래 버튼 행.

### 4.2 spacing

- 값 표시와 버튼 행 사이 세로 간격, 버튼 사이 가로 간격 모두 **`--counter-space-gap`(`12px`)** 사용.
- 컨테이너 내부 여백은 gap 배수(예: `24px = 2×gap`)로 권장하여 리듬 일관성 유지(비구속).

### 4.3 breakpoint 별 동작

| 뷰포트 | 동작 |
| --- | --- |
| **≥ 320px (frozen 하한)** | 가로 스크롤·잘림 **없음**. 버튼 행이 폭을 넘으면 `flex-wrap: wrap` 으로 줄바꿈 허용. |
| 일반 데스크톱/모바일 | 중앙 정렬 유지, 값 48px 유지. 최대 폭은 콘텐츠 기준(고정 폭 불필요). |

- **overflow 방지 규칙**: 컨테이너 `max-width: 100%`, 버튼 `flex-wrap: wrap`, 가로 고정폭 금지.
- 320px 에서 버튼 3개가 한 줄에 안 들어가면 자연 줄바꿈(우선순위: overflow 미발생 > 한 줄 배치).

---

## 5. 컴포넌트 명세

selector(id/class)는 **frozen — 변경·재정의 금지**.

### 5.1 루트 컨테이너 — `.counter`

| 항목 | 값 |
| --- | --- |
| class | `counter` |
| 역할 | 값 표시 + 버튼 그룹을 감싸는 루트, 중앙 정렬·세로 스택 |
| 레이아웃 | `display: flex; flex-direction: column; align-items: center; gap: var(--counter-space-gap);` |

### 5.2 값 표시 — `#counter-value` / `.counter__display`

| 항목 | 값 |
| --- | --- |
| id | `counter-value` |
| class | `counter__display` |
| 텍스트 | 정수 문자열(초기 `'0'`) |
| 접근성 | `aria-live="polite"` — 값 갱신을 스크린리더에 polite 로 안내 |
| 스타일 | `font-size: var(--counter-font-size); font-weight: 700; text-align: center;` |
| 상태 | 표시만 담당. 조작 결과가 **즉시** 텍스트에 반영 |

### 5.3 증가 버튼 — `#counter-increment` / `.counter__button`

| 항목 | 값 |
| --- | --- |
| id | `counter-increment` |
| class | `counter__button` |
| 라벨(화면) | `+` |
| 접근성 | `aria-label="증가"` |
| 인터랙션 | 조작 시 값 `n → n+1` 즉시 갱신 |
| 상태 | 항상 활성(enabled) |

### 5.4 감소 버튼 — `#counter-decrement` / `.counter__button`

| 항목 | 값 |
| --- | --- |
| id | `counter-decrement` |
| class | `counter__button` |
| 라벨(화면) | `−` |
| 접근성 | `aria-label="감소"` |
| 인터랙션 | 조작 시 값 `n → n-1` 즉시 갱신. **음수 허용(하한 없음)** |
| 상태 | 항상 활성(enabled) |

### 5.5 리셋 버튼 — `#counter-reset` / `.counter__button.counter__button--reset`

| 항목 | 값 |
| --- | --- |
| id | `counter-reset` |
| class | `counter__button counter__button--reset` |
| 라벨(화면) | `리셋` |
| 접근성 | `aria-label="리셋"` |
| 인터랙션 | 조작 시 값 `'0'` 으로 복원, 세 버튼 모두 활성 유지 |
| 변형(modifier) | `counter__button--reset` 로 시각 구분(예: outline/보조 스타일). 색상 단독 구분 금지 → 라벨 `리셋` 텍스트로도 식별 |

### 5.6 버튼 상호작용 상태(시각)

색상만으로 상태를 구분하지 않으며, 아래는 시각 보조입니다.

| 상태 | 시각 표현(권장) |
| --- | --- |
| default | primary 배경(`--counter-color-primary`) + on-primary 텍스트 |
| `:hover` | 명도 약간 하강(예: primary 90% 불투명/darken) — 비구속 |
| `:focus-visible` | 명확한 focus ring(2px outline) — 키보드 접근성 위해 **권장 유지** |
| `:active` | 눌림 피드백(약한 scale/음영) — 비구속 |
| reset 변형 | 위 default 대비 outline 계열로 시각 차별화 + `리셋` 텍스트 |

---

## 6. 상태별 화면 텍스트 & 레이아웃 (states)

각 상태의 **`#counter-value` 화면 텍스트**와 버튼 활성 여부를 명세합니다.
(frozen 상태 계약 §4.3 렌더)

| 상태 | `#counter-value` 화면 텍스트 | 세 버튼 | 레이아웃 변화 |
| --- | --- | --- | --- |
| **초기값** | `0` | 모두 활성 | 기준 레이아웃(§4). 값 중앙, 버튼 행 하단 |
| **증가** | 직전값 `n` → `n+1` 즉시 갱신(예: `0`→`1`→`2`) | 모두 활성 | 변화 없음(텍스트만 갱신) |
| **감소** | 직전값 `n` → `n-1` 즉시 갱신, **음수 허용**(예: `0`→`-1`→`-2`) | 모두 활성 | 변화 없음. 음수 부호 포함해도 중앙 정렬·overflow 없음 |
| **리셋** | `0` 으로 복원 | 모두 활성 유지 | 초기값 레이아웃으로 복귀 |

**후조건(초기화·취소·실패 후)**: 어떤 경로로든 값 표시는 초기값(`0`)로 되돌릴 수 있고,
주 실행 control(세 버튼)은 다시 활성/사용 가능해야 합니다. 리셋 반복 시 항상 `0` 유지·버튼 활성 유지.

**접근성 노출**: 위 모든 상태 변화는 `aria-live="polite"` 값 영역을 통해 스크린리더로 안내되며,
각 control 은 `aria-label`(증가/감소/리셋)로 식별됩니다. **상태는 색상만으로 구분되지 않습니다.**

---

## 7. mockup 참조 (이 명세 내 시각 표현)

> 본 task 수용 기준(§상단)에 따라 **별도 런타임/ mockup HTML 파일을 생성하지 않고**,
> 이 절에서 시각 시뮬레이션을 텍스트/레퍼런스로 제공합니다.
> 아래 스니펫은 **dev 참조용 spec 예시**이며 픽셀 단위 일치 의무는 없습니다.
> 실제 런타임 마크업/스타일은 developer(BF-1781) 가 `index.html` 에 구현합니다.

### 7.1 상태별 화면 스케치

```
[초기값]              [증가 2회]            [감소 3회]            [리셋]
   0                     2                    -3                   0
[ − ][ + ][리셋]     [ − ][ + ][리셋]     [ − ][ + ][리셋]     [ − ][ + ][리셋]
```

### 7.2 마크업 참조 (구조 예시 — 런타임 아님)

```html
<!-- 참조용 spec 스니펫. 실제 파일은 developer 소유(index.html). -->
<div class="counter">
  <div id="counter-value" class="counter__display" aria-live="polite">0</div>
  <div class="counter__buttons">
    <button id="counter-decrement" class="counter__button" aria-label="감소">−</button>
    <button id="counter-increment" class="counter__button" aria-label="증가">+</button>
    <button id="counter-reset" class="counter__button counter__button--reset" aria-label="리셋">리셋</button>
  </div>
</div>
```

### 7.3 토큰·스타일 참조 (예시 — 런타임 아님)

```css
/* frozen 토큰 3종은 이름·값 고정. 아래는 참조용 예시. */
.counter {
  --counter-color-primary: #2563eb;
  --counter-space-gap: 12px;
  --counter-font-size: 48px;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--counter-space-gap);
  max-width: 100%;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif;
}
.counter__display {
  font-size: var(--counter-font-size);
  font-weight: 700;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.counter__buttons {
  display: flex;
  gap: var(--counter-space-gap);
  flex-wrap: wrap;            /* 320px overflow 방지 */
  justify-content: center;
}
.counter__button {
  font-size: 20px;
  font-weight: 600;
  padding: 8px 16px;
  color: #ffffff;
  background: var(--counter-color-primary);
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.counter__button:focus-visible {
  outline: 2px solid var(--counter-color-primary);
  outline-offset: 2px;
}
.counter__button--reset {
  color: var(--counter-color-primary);
  background: #ffffff;
  border: 1px solid var(--counter-color-primary);  /* 색+테두리+텍스트로 구분 */
}
```

---

## 8. dev 구현 가이드 (developer BF-1781 대상)

frozen 계약 준수 체크리스트. **selector·token 은 그대로**, 아래를 additive 로 충족하세요.

1. **DOM id 4개 그대로**: `counter-value`, `counter-increment`, `counter-decrement`, `counter-reset`.
2. **CSS class 그대로(BEM)**: `counter`, `counter__display`, `counter__button`, `counter__button--reset`.
3. **디자인 토큰 3개 그대로(이름·값 고정)**: `--counter-color-primary:#2563eb`,
   `--counter-space-gap:12px`, `--counter-font-size:48px`. 색상은 반드시 변수로 참조.
4. **상태 후조건**: 초기 `0`, 증가 `n+1`, 감소 `n-1`(음수 허용), 리셋 `0` 복원 + 세 버튼 활성 유지.
   값 갱신은 **즉시**(전환·지연 없음).
5. **접근성**:
   - `counter-increment` → `aria-label="증가"`, `counter-decrement` → `aria-label="감소"`,
     `counter-reset` → `aria-label="리셋"`.
   - `counter-value` → `aria-live="polite"`.
   - 상태를 **색상만으로** 구분하지 말 것(라벨 텍스트/접근성 이름 병행).
   - `:focus-visible` ring 유지 권장(키보드 접근성).
6. **반응형**: 320px 이상 overflow 금지 — 버튼 `flex-wrap: wrap`, 고정 가로폭 금지, `max-width:100%`.
7. **실행 제약(vanilla-static)**: 외부 라이브러리·번들러·네트워크 의존 금지. `file://` 로 동작.
8. **범위**: 위 계약 밖 신규 요구/파일/토큰 도입 금지(additive). 픽셀 단위 일치 의무 없음 — 계약 준수가 기준.

---

## 9. Self-critique (dev 인수 전 자체 검증)

| # | 점검 항목 | 결과 |
| --- | --- | --- |
| 1 | **AC 매핑** | AC-1(초기 `0`·버튼 활성·aria-label)→§5·§6·§8, AC-2(증가)→§6, AC-3(감소·음수)→§6, AC-4(리셋)→§6, AC-5(접근성)→§5·§6·§8, AC-6(320px overflow)→§4.3·§8, AC-7(vanilla-static)→§3·§8 로 각각 매핑 완료 |
| 2 | **dev 구현 가이드** | §8 에 selector/token/상태/접근성/반응형/실행제약을 단계별 지침으로 제공 |
| 3 | **기존 요소 보존** | frozen selector·token·상태·접근성·반응형 계약을 변경 없이 렌더(additive). 신규 필수 토큰·파일 도입 없음 |
| 4 | **컴포넌트 매핑** | id 4개·class 4개를 §5 에서 각 컴포넌트로 1:1 매핑. 런타임 파일은 developer 소유로 명시 |
| 5 | **모호함 flag** | 버튼 **DOM 순서**는 계약 미고정 → 시각 순서만 권장(§4.1), id/selector 는 고정. secondary/accent 색상은 계약 미정의 → 신규 토큰 도입 금지 원칙 명시. 잔여 모호 없음 |

---

## 부록 A. frozen 계약 매핑 표

| frozen 항목 | 값 | 본 명세 반영 위치 |
| --- | --- | --- |
| dom_ids | `counter-value`, `counter-increment`, `counter-decrement`, `counter-reset` | §5, §7.2, §8 |
| css_classes | `counter`, `counter__display`, `counter__button`, `counter__button--reset` | §5, §7, §8 |
| design_tokens | `--counter-color-primary=#2563eb`, `--counter-space-gap=12px`, `--counter-font-size=48px` | §2, §3, §4.2, §7.3, §8 |
| states | 초기값 `0` / 증가 `n+1` / 감소 `n-1`(음수 허용) / 리셋 `0` 복원·버튼 활성 | §6 |
| accessibility | aria-label(증가/감소/리셋), aria-live=polite, 색상 단독 구분 금지 | §5, §6, §8 |
| responsive | 320px+ overflow 없음 | §4.3, §8 |
