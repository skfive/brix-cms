# km↔mile 변환기 — 시각 명세 (BF-1831)

> 본 문서는 designer(BF-1832) 산출물로, planner(BF-1834)가 동결한
> `ui-contract@v1`(sha256:e7957d17…)과 `docs/plans/BF-1831/implementation-plan.md`의
> **frozen 계약을 시각 명세로 렌더**한 것입니다.
> **selector·token·상태·접근성·반응형 계약을 변경하거나 재정의하지 않습니다(additive).**
> 본 task의 수용 기준상 **런타임 HTML/CSS/JS는 생성하지 않으며**, mockup은 아래
> §7에 이 명세 안에서 시각적으로 기술합니다.
> 실제 런타임 파일(`iteration-check2/{units.html,units.js,units.test.js}`)은
> developer 소유입니다.

---

## 1. 시안 개요

- **변경 범위**: 킬로미터(km)와 마일(mile)을 **양방향** 변환하는 단일 화면 변환기의
  시각(UI) 명세. 입력 필드 2개(km / mile) + 결과 표시 영역 2개 + 초기화 버튼 1개 +
  오류 메시지 영역 1개로 구성된 단일 화면.
- **사용자 경험 목표**
  1. km 또는 mile 값을 입력하면 반대 단위 결과를 **즉시** 읽을 수 있다(지연·전환 없음).
  2. 잘못된 값(문자·음수 등)은 **오류 텍스트**로 즉시 사유를 알 수 있다(색상 단독 표시 금지).
  3. 초기화 버튼으로 입력·결과·오류를 **초기값(idle)** 으로 되돌려 다시 사용할 수 있다.
  4. **색상만이 아니라 텍스트·접근성 이름**으로 각 control과 상태를 식별할 수 있다.
  5. **320px** 이상 어떤 뷰포트에서도 가로 스크롤·잘림 없이 온전히 보이고,
     **480px 미만** 에서는 필드가 세로로 쌓여 좁은 화면에서도 편히 조작된다.

---

## 2. 컬러 팔레트

색상은 **반드시 frozen 디자인 토큰(CSS 커스텀 프로퍼티)을 통해서만** 참조합니다.
아래 표에서 **[frozen]** 은 계약상 값·이름 고정(변경 금지), **[권장]** 은 중립값에 대한
비구속 가이드(dev 재량 허용, 새 필수 토큰 아님)입니다.

| 역할 | HEX | 출처 |
| --- | --- | --- |
| **action-primary** (초기화 버튼 등 주 실행 control 강조) | `#2563eb` | **[frozen]** `--color-action-primary` |
| **result-text** (변환 결과 텍스트) | `#111827` | **[frozen]** `--color-result-text` |
| **error-text** (invalid-input 오류 텍스트) | `#dc2626` | **[frozen]** `--color-error-text` |
| **on-primary** (버튼 위 텍스트) | `#ffffff` | [권장] 대비 확보용, 토큰화 불필요 |
| **background** (페이지 배경) | `#ffffff` | [권장] 기본 배경 |
| **secondary / accent** | — | 계약 미정의. 필요 시 action-primary 파생(hover 등)만 사용, 새 토큰 도입 금지 |

- **대비 검증(WCAG AA, 일반 텍스트 4.5:1 기준)**
  - result-text `#111827` on `#ffffff` ≈ 16.9:1 → 충족.
  - error-text `#dc2626` on `#ffffff` ≈ 4.53:1 → 충족.
  - action-primary `#2563eb` on `#ffffff` ≈ 5.17:1 → 버튼 배경 위 흰 텍스트(반전 대비 동일) 충족.
- **금지**: 위 색을 리터럴 HEX로 하드코딩하지 말고 항상 `var(--color-*)` 로 참조.
- **상태 구분은 색상 단독 금지**(§6). 색상은 강조 보조 수단이며 식별 근거가 아니다.
  오류는 빨강 색뿐 아니라 **오류 텍스트 + 상태명**으로, 결과는 색뿐 아니라 **값+단위 텍스트**로 식별.

---

## 3. 타이포그래피

외부 폰트 import는 비권장(네트워크 의존 최소화). **system font stack** 사용.

권장 스택: `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif`

| 역할 | font-size | weight | line-height | 비고 |
| --- | --- | --- | --- | --- |
| **필드 라벨**(km/mile 입력 라벨) | 14px | 600 | 1.3 | 각 입력 필드 위/옆 라벨 |
| **입력 값**(`#km-input` / `#mile-input`) | 16px | 400 | 1.4 | 모바일 확대 방지 위해 16px 권장 |
| **변환 결과**(`.converter__result`) | 20px | 700 | 1.3 | `var(--color-result-text)`, 값+단위 강조 |
| **오류 메시지**(`.converter__error`) | 14px | 600 | 1.4 | `var(--color-error-text)`, 사유 텍스트 |
| **버튼 라벨**(`.converter__reset`) | 16px | 600 | 1.2 | `초기화` 텍스트 |

- 결과 텍스트 색은 **반드시 `var(--color-result-text)`**, 오류 텍스트 색은 **반드시 `var(--color-error-text)`** 로 참조.
- 숫자 폭 흔들림 방지 권장: `font-variant-numeric: tabular-nums`(비구속 가이드).

---

## 4. 레이아웃

### 4.1 구조

단일 화면. 루트 컨테이너 `#converter-root`(class `converter`) 안에 **세로 스택**:

```
┌───────────────── #converter-root .converter ─────────────────┐
│                                                               │
│  ┌─ .converter__field ─────────┐  ┌─ .converter__result ───┐ │
│  │ 킬로미터 입력                 │  │ mile 결과              │ │
│  │ [ #km-input            ]     │  │ #mile-result           │ │
│  └──────────────────────────────┘  └────────────────────────┘ │
│                                                               │
│  ┌─ .converter__field ─────────┐  ┌─ .converter__result ───┐ │
│  │ 마일 입력                     │  │ km 결과                │ │
│  │ [ #mile-input          ]     │  │ #km-result             │ │
│  └──────────────────────────────┘  └────────────────────────┘ │
│                                                               │
│  ┌─ .converter__error ─────────────────────────────────────┐ │
│  │ (invalid-input 일 때만 오류 사유 텍스트 노출)             │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│                 [  #reset-button  초기화  ]                    │
│                    .converter__reset                          │
└───────────────────────────────────────────────────────────────┘
```

- **행 구성(위→아래)**: km 입력+mile 결과 행 · mile 입력+km 결과 행 · 오류 영역 · 초기화 버튼.
  (DOM 순서·행 묶음은 dev 재량이나 시각 순서는 위를 권장. selector/id 는 §5 고정.)
- **정렬**: 컨테이너 중앙 배치, 내부는 좌측 정렬 스택. 초기화 버튼은 하단 중앙/우측 권장.

### 4.2 spacing

- 필드·결과·버튼 등 control 간 간격은 모두 **`--space-control-gap`(`12px`)** 사용.
- 컨테이너 내부 여백은 gap 배수(예: `24px = 2×gap`)로 권장하여 리듬 일관성 유지(비구속).

### 4.3 breakpoint 별 동작

| 뷰포트 | 동작 |
| --- | --- |
| **≥ 480px** | km/mile 필드와 결과를 **가로로 나란히**(입력 ↔ 결과) 배치 가능. 중앙 정렬 유지. |
| **< 480px (frozen)** | 필드·결과를 **세로로 쌓아** 배치. 입력→결과→다음 필드 순 세로 흐름. |
| **≥ 320px (frozen 하한)** | 가로 스크롤·잘림 **없음**. 입력·결과 영역 `max-width:100%`, `box-sizing:border-box`. |

- **overflow 방지 규칙**: 컨테이너·입력 `max-width: 100%`, `box-sizing: border-box`,
  가로 고정폭 금지. 긴 결과 문자열은 줄바꿈 허용(`overflow-wrap: anywhere` 권장).
- **세로 배치 규칙(<480px)**: 필드/결과 래퍼를 `flex-direction: column`(또는 media query로 전환)으로
  세로 스택. 우선순위: **overflow 미발생 + 세로 배치 > 한 줄 배치**.

---

## 5. 컴포넌트 명세

selector(id/class)는 **frozen — 변경·재정의 금지**.

### 5.1 루트 컨테이너 — `#converter-root` / `.converter`

| 항목 | 값 |
| --- | --- |
| id | `converter-root` |
| class | `converter` |
| 역할 | 입력·결과·오류·버튼을 감싸는 루트, 세로 스택·중앙 배치 |
| 레이아웃 | `display: flex; flex-direction: column; gap: var(--space-control-gap); max-width: 100%;` |

### 5.2 km 입력 — `#km-input` (래퍼 `.converter__field`)

| 항목 | 값 |
| --- | --- |
| id | `km-input` |
| 래퍼 class | `converter__field` |
| 화면 라벨 | `킬로미터(km)` |
| 접근성 | `aria-label="킬로미터 입력"` |
| 인터랙션 | 유효 숫자 입력 시 상태 `km-converted` 로 전이 → `#mile-result` 갱신 |
| 타입 권장 | `inputmode="decimal"` (숫자 키패드 유도, 비구속) |

### 5.3 mile 입력 — `#mile-input` (래퍼 `.converter__field`)

| 항목 | 값 |
| --- | --- |
| id | `mile-input` |
| 래퍼 class | `converter__field` |
| 화면 라벨 | `마일(mile)` |
| 접근성 | `aria-label="마일 입력"` |
| 인터랙션 | 유효 숫자 입력 시 상태 `mile-converted` 로 전이 → `#km-result` 갱신 |
| 타입 권장 | `inputmode="decimal"` (비구속) |

### 5.4 mile 결과 — `#mile-result` / `.converter__result`

| 항목 | 값 |
| --- | --- |
| id | `mile-result` |
| class | `converter__result` |
| 텍스트 | `km-converted` 시 `값 + " mile"`(소수 2자리, 예: `6.21 mile`). idle 시 비움 |
| 접근성 | `aria-live="polite"` 권장 — 결과 갱신을 스크린리더에 안내 |
| 스타일 | `color: var(--color-result-text); font-weight: 700;` |

### 5.5 km 결과 — `#km-result` / `.converter__result`

| 항목 | 값 |
| --- | --- |
| id | `km-result` |
| class | `converter__result` |
| 텍스트 | `mile-converted` 시 `값 + " km"`(소수 2자리, 예: `16.09 km`). idle 시 비움 |
| 접근성 | `aria-live="polite"` 권장 |
| 스타일 | `color: var(--color-result-text); font-weight: 700;` |

### 5.6 오류 영역 — `.converter__error`

| 항목 | 값 |
| --- | --- |
| class | `converter__error` |
| 텍스트 | `invalid-input` 시 오류 사유 텍스트(예: `숫자를 입력하세요`, `0 이상의 값을 입력하세요`). 그 외 상태에서는 비움 |
| 접근성 | `role="alert"` 또는 `aria-live="assertive"` 권장 — 오류 발생을 즉시 안내. **상태명("invalid-input"/"입력 오류")을 텍스트/접근성 이름으로 노출** |
| 스타일 | `color: var(--color-error-text); font-weight: 600;` |
| 규칙 | **색상 단독 금지** — 반드시 오류 사유 텍스트를 함께 노출 |

### 5.7 초기화 버튼 — `#reset-button` / `.converter__reset`

| 항목 | 값 |
| --- | --- |
| id | `reset-button` |
| class | `converter__reset` |
| 라벨(화면) | `초기화` |
| 접근성 | `aria-label="입력 초기화"`, **키보드 포커스·실행 가능**(`<button>` 시맨틱, `:focus-visible` ring) |
| 인터랙션 | 실행 시 `#km-input`·`#mile-input`·`#km-result`·`#mile-result`·`.converter__error` 모두 비움 → `idle` 복원 |
| 스타일 | `background: var(--color-action-primary); color: #ffffff;` |

### 5.8 상호작용 상태(시각)

색상만으로 상태를 구분하지 않으며, 아래는 시각 보조입니다.

| 상태 | 시각 표현(권장) |
| --- | --- |
| 버튼 default | action-primary 배경(`--color-action-primary`) + 흰 텍스트 |
| 버튼 `:hover` | 명도 약간 하강(예: darken) — 비구속 |
| 버튼 `:focus-visible` | 명확한 focus ring(2px outline) — 키보드 접근성 위해 **권장 유지** |
| 입력 `:focus-visible` | 필드 테두리 강조(action-primary) — 비구속 |
| 오류 표시 | 오류 영역에 error-text 색 **+ 사유 텍스트 + 상태명**(색 단독 금지) |

---

## 6. 상태별 화면 텍스트 & 레이아웃 (states)

frozen 상태 계약(4개)을 화면 텍스트·색상·초기화 복원 관점에서 명세합니다.

| 상태 | `#km-input` | `#mile-input` | `#km-result` | `#mile-result` | `.converter__error` | 색상 |
| --- | --- | --- | --- | --- | --- | --- |
| **idle** | 비움 | 비움 | 비움 | 비움 | 비움 | 기본(강조 없음) |
| **km-converted** | 입력값(예 `10`) | 비움 | 비움 | `6.21 mile` | 비움 | 결과 텍스트 `--color-result-text` |
| **mile-converted** | 비움 | 입력값(예 `10`) | `16.09 km` | 비움 | 비움 | 결과 텍스트 `--color-result-text` |
| **invalid-input** | 잘못된 값(그대로 유지) | — | 비움 | 비움 | 오류 사유 텍스트(예 `숫자를 입력하세요`) + 상태명 | 오류 텍스트 `--color-error-text` |

- **소수 표시**: 결과는 **소수점 이하 2자리** 고정(예 `1 km → 0.62 mile`, `10 mile → 16.09 km`).
  값과 단위를 함께 노출(`6.21 mile`, `16.09 km`).
- **한 방향만 갱신**: km 입력 시 `#mile-result` 만, mile 입력 시 `#km-result` 만 갱신.

### 6.1 상태 전이 & 초기화 복원 (postcondition)

| 전이 | 트리거 | 화면 결과 |
| --- | --- | --- |
| `idle` → `km-converted` | `#km-input` 에 유효 숫자 | `#mile-result` 에 `값 mile` 표시 |
| `idle` → `mile-converted` | `#mile-input` 에 유효 숫자 | `#km-result` 에 `값 km` 표시 |
| 임의 → `invalid-input` | 문자·기호·음수 입력 | `.converter__error` 에 오류 사유+상태명 표시 |
| `invalid-input` → converted | 유효 숫자 재입력 | 해당 방향 결과 표시, 오류 영역 비움 |
| 임의 → `idle` | `#reset-button` 실행 | 입력·결과·오류 **모두 비움** |
| `invalid-input`/converted → `idle` | 입력을 지워 **빈 값** | idle 복원(빈 입력은 오류 아님) |

- **후조건(초기화·실패 후)**: 어떤 경로로든 상태·표시를 **초기값(idle)** 으로 되돌릴 수 있고,
  주 실행 control(입력 필드·초기화 버튼)은 **다시 포커스·사용 가능**해야 합니다.
- **초기화 반복**: 이미 `idle` 인 상태에서 초기화해도 오류 없이 `idle` 유지.
- **빈 입력**: 입력을 지워 빈 값이 되면 `invalid-input` 이 아니라 `idle` 로 복원.

### 6.2 접근성 노출(상태)

- 결과 영역은 `aria-live="polite"`, 오류 영역은 `role="alert"`/`aria-live="assertive"` 로
  상태 변화를 스크린리더에 안내.
- **모든 상태는 색상만으로 구분하지 않고**, 상태명(예 `입력 오류`)과 결과/오류 사유를
  **화면 텍스트 + 접근성 이름**으로 노출.
- 각 control은 `aria-label`(킬로미터 입력/마일 입력/입력 초기화)로 식별.

---

## 7. mockup 참조 (이 명세 내 시각 표현)

> 본 task 수용 기준에 따라 **별도 런타임/mockup HTML 파일을 생성하지 않고**,
> 이 절에서 시각 시뮬레이션을 텍스트/레퍼런스로 제공합니다.
> 아래 스니펫은 **dev 참조용 spec 예시**이며 픽셀 단위 일치 의무는 없습니다.
> 실제 런타임 마크업/스타일은 developer 가 `iteration-check2/units.html` 에 구현합니다.

### 7.1 상태별 화면 스케치 (≥480px, 가로 배치)

```
[ idle ]                              [ km-converted ]  (#km-input=10)
 킬로미터(km) [        ]  mile 결과 →   킬로미터(km) [ 10  ]  mile 결과 → 6.21 mile
 마일(mile)   [        ]  km 결과   →   마일(mile)   [     ]  km 결과   →
 (오류 영역 비움)                       (오류 영역 비움)
        [ 초기화 ]                             [ 초기화 ]

[ mile-converted ]  (#mile-input=10)   [ invalid-input ]  (#km-input="abc" 또는 -5)
 킬로미터(km) [     ]  mile 결과 →       킬로미터(km) [ abc ]  mile 결과 →
 마일(mile)   [ 10  ]  km 결과   → 16.09 km  마일(mile) [   ]  km 결과   →
 (오류 영역 비움)                       ⚠ 입력 오류: 숫자를 입력하세요  ← error-text
        [ 초기화 ]                             [ 초기화 ]
```

### 7.2 반응형 스케치 (<480px, 세로 스택 / ≥320px overflow 없음)

```
┌───────────────┐  ← 폭 320~479px, 가로 스크롤 없음
│ 킬로미터(km)   │
│ [ 10        ] │
│ mile 결과      │
│ 6.21 mile      │  ← --color-result-text
│                │
│ 마일(mile)     │
│ [           ] │
│ km 결과        │
│                │
│ ⚠ (오류 시)    │  ← --color-error-text + 사유 텍스트
│                │
│ [   초기화   ] │
└───────────────┘
```

### 7.3 마크업 참조 (구조 예시 — 런타임 아님)

```html
<!-- 참조용 spec 스니펫. 실제 파일은 developer 소유(iteration-check2/units.html). -->
<div id="converter-root" class="converter">
  <div class="converter__field">
    <label for="km-input">킬로미터(km)</label>
    <input id="km-input" aria-label="킬로미터 입력" inputmode="decimal" />
  </div>
  <div id="mile-result" class="converter__result" aria-live="polite"></div>

  <div class="converter__field">
    <label for="mile-input">마일(mile)</label>
    <input id="mile-input" aria-label="마일 입력" inputmode="decimal" />
  </div>
  <div id="km-result" class="converter__result" aria-live="polite"></div>

  <div class="converter__error" role="alert"></div>

  <button id="reset-button" class="converter__reset" aria-label="입력 초기화">초기화</button>
</div>
```

### 7.4 토큰·스타일 참조 (예시 — 런타임 아님)

```css
/* frozen 토큰 4종은 이름·값 고정. 아래는 참조용 예시. */
.converter {
  --color-action-primary: #2563eb;
  --space-control-gap: 12px;
  --color-error-text: #dc2626;
  --color-result-text: #111827;

  display: flex;
  flex-direction: column;
  gap: var(--space-control-gap);
  max-width: 100%;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif;
}
.converter__field { display: flex; flex-direction: column; gap: 4px; }
.converter__field input {
  font-size: 16px;
  max-width: 100%;
  box-sizing: border-box;   /* 320px overflow 방지 */
}
.converter__result {
  color: var(--color-result-text);
  font-size: 20px;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.converter__error {
  color: var(--color-error-text);
  font-size: 14px;
  font-weight: 600;
}
.converter__reset {
  background: var(--color-action-primary);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}
.converter__reset:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}
/* <480px: 세로 스택(기본 column 유지). ≥480px: 입력↔결과 가로 배치 허용 */
@media (min-width: 480px) {
  /* 예: 필드+결과를 가로로 묶는 래퍼에 flex-direction: row 적용(비구속) */
}
```

---

## 8. dev 구현 가이드 (developer 대상)

frozen 계약 준수 체크리스트. **selector·token 은 그대로**, 아래를 additive 로 충족하세요.

1. **DOM id 6개 그대로**: `converter-root`, `km-input`, `mile-input`, `km-result`,
   `mile-result`, `reset-button`.
2. **CSS class 5개 그대로(BEM)**: `converter`, `converter__field`, `converter__result`,
   `converter__reset`, `converter__error`.
3. **디자인 토큰 4개 그대로(이름·값 고정)**: `--color-action-primary:#2563eb`,
   `--space-control-gap:12px`, `--color-error-text:#dc2626`, `--color-result-text:#111827`.
   색상은 반드시 변수로 참조.
4. **변환 공식·소수 규칙**: `mile = km × 0.621371`, `km = mile × 1.609344`, **소수 2자리 고정**
   (예 `10 km → 6.21 mile`, `10 mile → 16.09 km`). 값+단위 함께 표시.
5. **상태 후조건**: idle(모두 비움) / km-converted(`#mile-result`) / mile-converted(`#km-result`) /
   invalid-input(`.converter__error` 사유 텍스트). 초기화 시 5개 영역 모두 비워 idle 복원 +
   control 재사용 가능. **빈 입력은 idle**, **음수·문자는 invalid-input**. 갱신은 **즉시**.
6. **접근성**:
   - `km-input` → `aria-label="킬로미터 입력"`, `mile-input` → `aria-label="마일 입력"`,
     `reset-button` → `aria-label="입력 초기화"`(키보드 포커스·실행 가능).
   - 결과 영역 `aria-live="polite"`, 오류 영역 `role="alert"`/`aria-live="assertive"` 권장.
   - 상태를 **색상만으로** 구분하지 말 것(상태명·사유 텍스트/접근성 이름 병행).
   - `:focus-visible` ring 유지 권장(키보드 접근성).
7. **반응형**: **320px 이상 overflow 금지**(`max-width:100%`, `box-sizing:border-box`, 고정 가로폭 금지),
   **480px 미만 필드 세로 스택**.
8. **범위**: 위 계약 밖 신규 요구/파일/토큰 도입 금지(additive). 픽셀 단위 일치 의무 없음 — 계약 준수가 기준.

---

## 9. Self-critique (dev 인수 전 자체 검증)

| # | 점검 항목 | 결과 |
| --- | --- | --- |
| 1 | **AC 매핑** | AC-1(km→mile)→§5.4·§6, AC-2(mile→km)→§5.5·§6, AC-3(invalid-input·색 단독 금지)→§5.6·§6·§6.2, AC-4(초기화 후 idle 복원)→§5.7·§6.1, AC-5(접근성 aria-label·키보드)→§5·§6.2·§8, AC-6(320px overflow·480px 세로)→§4.3·§7.2·§8 로 각각 매핑 완료 |
| 2 | **dev 구현 가이드** | §8 에 selector/token/변환공식/상태/접근성/반응형을 단계별 지침으로 제공 |
| 3 | **기존 요소 보존** | frozen selector·token·상태·접근성·반응형 계약을 변경 없이 렌더(additive). 신규 필수 토큰·파일 도입 없음. 런타임 HTML/CSS/JS 미생성 |
| 4 | **컴포넌트 매핑** | id 6개·class 5개를 §5 에서 각 컴포넌트로 1:1 매핑. 런타임 파일은 developer 소유로 명시 |
| 5 | **모호함 flag** | 필드·결과의 **DOM 순서/행 묶음**은 계약 미고정 → 시각 순서만 권장(§4.1), id/selector 는 고정. `aria-live`/`role="alert"` 는 접근성 권장(계약은 "상태명 노출"만 요구) → 권장으로 표기. secondary/accent 색상은 계약 미정의 → 신규 토큰 도입 금지 원칙 명시. 잔여 모호 없음 |

---

## 부록 A. frozen 계약 매핑 표

| frozen 항목 | 값 | 본 명세 반영 위치 |
| --- | --- | --- |
| dom_ids | `converter-root`, `km-input`, `mile-input`, `km-result`, `mile-result`, `reset-button` | §5, §7.3, §8 |
| css_classes | `converter`, `converter__field`, `converter__result`, `converter__reset`, `converter__error` | §5, §7, §8 |
| design_tokens | `--color-action-primary=#2563eb`, `--space-control-gap=12px`, `--color-error-text=#dc2626`, `--color-result-text=#111827` | §2, §3, §4.2, §7.4, §8 |
| states | idle / km-converted / mile-converted / invalid-input | §6, §6.1 |
| accessibility | aria-label(킬로미터 입력/마일 입력/입력 초기화), reset 키보드 실행, 색상 단독 구분 금지·상태명 텍스트 노출 | §5, §6.2, §8 |
| responsive | 320px+ overflow 없음, 480px 미만 세로 배치 | §4.3, §7.2, §8 |
