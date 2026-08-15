# admin 페이지 시안 명세 — BF-2096 (link-shortener)

> 이 문서는 [implementation-plan.md](../../plans/BF-2095/implementation-plan.md) §6 에서
> planner 가 동결한 `ui-contract@v1` 을 재정의하지 않고, 그 값을 그대로 시각 명세로
> 구현한 것이다. DOM ID/class·상태·토큰·접근성·반응형 항목은 frozen 값이며 변경 금지.
> mockup 참조: [admin-page-mockup.html](./admin-page-mockup.html)

## 1. 시안 개요

- **변경 범위**: link-shortener 서비스의 admin 인덱스 페이지 1개 — 단축 링크 생성
  폼(`url`, `customSlug`)과 생성 결과/오류 표시 영역.
- **사용자 경험 목표**: 운영자가 원본 URL(과 선택적으로 원하는 slug)을 입력해 즉시
  단축 링크를 발급받는다. 제출 중에는 진행 상태를, 성공 시에는 짧은 URL을, 실패 시에는
  원인을 알 수 있는 문구를 화면과 스크린리더 양쪽에 동일하게 노출한다. 실패 후에도
  입력값을 유지한 채 바로 재시도할 수 있어야 한다.
- **API 근거**: `POST /api/links` (`{ url, customSlug? }` → `201 { slug, shortUrl,
  originalUrl, createdAt }`), 에러 400/409/500. 상세는
  [implementation-plan.md §2–3](../../plans/BF-2095/implementation-plan.md) 참고.
- **기술 스택**: vanilla-static — 외부 의존성 0건, system font, CSS 변수 자체 정의
  (shadcn/ui·design-tokens.json 미적용 대상).

## 2. 컬러 팔레트

### 2-1. Frozen 토큰 (재정의 금지, planner 동결)

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--color-action-primary` | `#2563eb` | 제출 버튼 배경, 포커스 링, 링크 강조 |
| `--color-error` | `#dc2626` | 에러 상태 텍스트/보더/아이콘 |
| `--space-control-gap` | `12px` | 폼 컨트롤 간 간격 |
| `--radius-control` | `6px` | 입력/버튼 모서리 반경 |

### 2-2. 추가 토큰 (본 명세에서 정의 — vanilla-static, 자체 CSS 변수)

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--color-bg` | `#f8fafc` | 페이지 배경 |
| `--color-surface` | `#ffffff` | 카드(폼/결과) 배경 |
| `--color-border` | `#e2e8f0` | 카드·입력 테두리 |
| `--color-text-primary` | `#0f172a` | 본문 텍스트 |
| `--color-text-secondary` | `#475569` | 라벨/캡션 텍스트 |
| `--color-text-on-primary` | `#ffffff` | 제출 버튼 위 텍스트 |
| `--color-success` | `#16a34a` | 성공 상태 텍스트/보더/아이콘 |
| `--color-success-bg` | `#f0fdf4` | 성공 결과 카드 배경 |
| `--color-error-bg` | `#fef2f2` | 에러 결과 카드 배경 |

## 3. 타이포그래피

- **font-family**: system stack — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
  "Helvetica Neue", Arial, sans-serif` (외부 웹폰트 로드 금지, vanilla-static 원칙).
- **heading** (`h1`, 페이지 제목): `20px` / `weight 700` / `line-height 1.3`
- **body** (라벨, 입력, 버튼, 본문 텍스트): `15px` / `weight 400` / `line-height 1.5`
  (버튼 텍스트는 `weight 600`)
- **caption** (결과 카드 보조 텍스트, 상태 라벨): `13px` / `weight 500` / `line-height 1.4`

## 4. 레이아웃

- **컨테이너**: `.link-app` — 페이지 전체 래퍼. `max-width: 480px`, 좌우 중앙 정렬,
  상하 패딩 `32px`(`--space-xl` 상당), 좌우 패딩 `16px`.
- **섹션 구조**: `.link-app` 내부에 `h1` 제목 → `.link-form`(카드) → `#link-result`(카드,
  결과/에러 표시) 순서로 세로 배치.
- **spacing**: 폼 내부 필드 간 간격은 frozen 토큰 `--space-control-gap`(12px) 사용.
  카드 내부 패딩 `24px`(`.link-form`, `#link-result` 공통), 제목과 폼 카드 사이
  `16px`.
- **breakpoint 별 동작**:
  - **320px ~**: `.link-app` 좌우 패딩 `16px`으로 축소, 카드 폭은 뷰포트 전체
    (`width: 100%`)를 채움. 폼(`.link-form`)과 결과 카드(`#link-result`)는 항상
    세로로 스택되며 가로 스크롤(`overflow-x`)이 발생하지 않는다 — frozen 반응형
    규칙.
  - **480px ~**: `.link-app` 좌우 패딩 `24px`로 확대. 레이아웃 구조(세로 스택)는
    동일하게 유지 — 다단(2열) 레이아웃으로 전환하지 않는다.
  - 모든 구간에서 입력(`input`)과 버튼(`button`)은 `width: 100%`로 카드 폭을
    채운다.

## 5. 컴포넌트 명세

### 5-1. DOM 구조 (frozen ID/class)

```html
<div class="link-app">
  <h1>단축 링크 생성</h1>
  <form id="link-form" class="link-form">
    <div class="link-form__field">
      <label class="link-form__label" for="link-url-input">원본 URL</label>
      <input id="link-url-input" name="url" type="url" required
             placeholder="https://example.com/very/long/path" />
    </div>
    <div class="link-form__field">
      <label class="link-form__label" for="link-custom-slug-input">
        사용자 지정 슬러그 (선택)
      </label>
      <input id="link-custom-slug-input" name="customSlug" type="text"
             placeholder="예: my-event" />
    </div>
    <button id="link-submit-btn" type="submit" class="link-form__submit"
            aria-label="단축 링크 생성">
      단축 링크 생성
    </button>
  </form>

  <div id="link-result" class="link-result" aria-live="polite">
    <!-- idle: 비어 있음. success/error 상태일 때만 아래 내용이 채워짐 -->
  </div>
</div>
```

- 성공 시 `#link-result` 내부 구조 (class `link-result--success` 추가):
  ```html
  <div id="link-result" class="link-result link-result--success" aria-live="polite">
    <p class="link-result__status">생성 완료</p>
    <p id="link-result-short-url">
      단축 링크: <a href="{shortUrl}">{shortUrl}</a>
    </p>
  </div>
  ```
- 실패 시 `#link-result` 내부 구조 (class `link-result--error` 추가):
  ```html
  <div id="link-result" class="link-result link-result--error" aria-live="polite">
    <p class="link-result__status">생성 실패</p>
    <p id="link-result-error">{에러 메시지 — §5-3 참고}</p>
  </div>
  ```

### 5-2. 상태(state) 명세

| 상태 | `#link-submit-btn` | 진행 표시 | `#link-result` | 입력 필드 |
| --- | --- | --- | --- | --- |
| `idle` | 활성화, 텍스트 "단축 링크 생성" | 없음 | 비어 있음(내용 없음, `aria-live` 컨테이너만 존재) | 활성화, 빈 값 또는 이전 입력 유지 |
| `submitting` | **비활성화**(`disabled`), 텍스트 "생성 중…", `aria-busy="true"` | 버튼 내부에 인라인 스피너(`.link-form__spinner`, `aria-hidden="true"`) 표시 | 이전 상태 내용 유지(성공/에러 잔상 제거는 하지 않고 새 결과로 교체될 때만 갱신) | 비활성화(재제출 방지) |
| `success` | **재활성화**, 텍스트 "단축 링크 생성"으로 복귀 | 제거(idle과 동일하게 없음) | `link-result--success` 클래스, `#link-result-short-url`에 생성된 `shortUrl` 노출 | 재활성화 |
| `error` | **재활성화**, 텍스트 "단축 링크 생성"으로 복귀 (재시도 가능) | 제거 | `link-result--error` 클래스, `#link-result-error`에 사람이 읽을 수 있는 에러 문구 노출 | 재활성화, **입력값 유지**(초기화하지 않음 — 수정 후 즉시 재시도 가능) |

**재시도(retry) 흐름 (필수)**:
1. `submitting` → 서버 응답 실패(400/409/500) → `error` 상태 전이.
2. `error` 진입 즉시 진행 스피너 제거, `#link-submit-btn`의 `disabled`/`aria-busy` 속성
   제거(재활성화) — 사용자는 별도 새로고침 없이 값을 고쳐 바로 다시 제출 가능.
3. 사용자가 값을 수정하고 다시 제출하면 `submitting` 상태로 재진입 — 스피너와 버튼
   비활성화가 **동일하게 복원**된다(최초 제출과 동일한 진행 표시 로직 재사용, 별도
   "재시도 전용" 상태를 두지 않는다).
4. `success` 이후 다시 폼을 제출하는 경우도 동일한 `submitting` 로직을 재사용한다.

### 5-3. 에러 상태 화면 텍스트 (색상 외 구분 — 서버 에러 코드 매핑)

`#link-result-error`에 노출할 문구는 서버 에러 코드(§3 implementation-plan.md)를
사람이 읽을 수 있는 한국어 문장으로 변환한다. 색상(`--color-error`)만으로 상태를
구분하지 않고, 아래 문구 자체가 원인을 설명한다:

| 서버 에러 코드 | `#link-result-error` 문구 |
| --- | --- |
| `400 BAD_REQUEST` | "원본 URL을 올바른 형식으로 입력해주세요." (customSlug 형식 위반 시: "사용자 지정 슬러그에 사용할 수 없는 문자가 포함되어 있습니다.") |
| `409 SLUG_CONFLICT` | "이미 사용 중인 슬러그입니다. 다른 값을 입력해주세요." |
| `500 INTERNAL_ERROR` | "일시적인 오류로 링크 생성에 실패했습니다. 잠시 후 다시 시도해주세요." |
| 네트워크 오류(응답 없음) | "서버에 연결할 수 없습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요." |

`.link-result__status` 텍스트도 상태명을 그대로 노출한다 — 성공 시 "생성 완료",
실패 시 "생성 실패" (색상 대비뿐 아니라 텍스트로도 상태 구분, §6 접근성 규칙 근거).

### 5-4. 컴포넌트 인터랙션 (정적 표현 — mockup 은 각 상태를 별도 섹션으로 나열)

- **hover** (`#link-submit-btn`, idle 상태에서만): 배경색을 `--color-action-primary`
  대비 약 10% 어둡게(`#1d4ed8`), `cursor: pointer`.
- **focus** (입력/버튼 공통): `outline: 2px solid var(--color-action-primary)`,
  `outline-offset: 2px` — 색상 대비만이 아니라 윤곽선 두께로도 식별 가능.
- **disabled** (`submitting` 상태의 버튼/입력): `opacity: 0.6`, `cursor: not-allowed`.

## 6. 접근성 (frozen — planner 동결, 재정의 금지)

- `#link-submit-btn` 은 항상 `aria-label="단축 링크 생성"`을 가진다(상태와 무관하게
  버튼의 접근성 이름 고정 — 화면 텍스트는 상태별로 바뀌어도 스크린리더 라벨은
  일관 유지).
- `#link-result` 은 `aria-live="polite"` — 생성 결과(성공 `shortUrl`) 또는 오류
  메시지가 채워질 때 스크린리더가 자동으로 읽는다.
- `#link-url-input`, `#link-custom-slug-input` 은 각각 `<label for>` 로 연결된
  라벨을 가진다 (`link-url-input` ↔ "원본 URL" / `link-custom-slug-input` ↔
  "사용자 지정 슬러그 (선택)").
- 모든 상태(성공/실패)는 색상만으로 구분하지 않는다 — `.link-result__status` 텍스트
  ("생성 완료"/"생성 실패")와 `#link-result-error`/`#link-result-short-url`의 실제
  문구로 상태명을 화면 텍스트 및 접근성 이름 양쪽에 노출한다.
- `submitting` 상태의 스피너(`.link-form__spinner`)는 `aria-hidden="true"` —
  진행 상태 자체는 버튼의 `aria-busy="true"` 와 비활성화된 `disabled` 속성으로
  스크린리더에 전달한다(중복 낭독 방지).

## 7. 반응형 (frozen — planner 동결, 재정의 금지)

- **320px 이상 뷰포트**에서 폼(`.link-form`)과 결과 카드(`#link-result`)는 항상
  **세로로 스택**되며, 페이지 전체에서 **가로 스크롤(overflow-x)이 발생하지 않는다**.
- 세부 breakpoint별 여백 조정은 §4 레이아웃 참고(320px/480px) — 레이아웃 구조
  자체(세로 스택)는 두 구간에서 동일하다.

## 8. dev 구현 가이드 (developer 참고 — BF-2097)

1. `link-shortener/public/index.html` 에 §5-1 DOM 구조를 그대로 마크업한다. ID/class는
   frozen 값이므로 임의 변경 금지.
2. `link-shortener/public/styles.css` 의 `:root` 에 §2 의 모든 CSS 변수(frozen 4종 +
   추가 9종)를 정의한다. Frozen 토큰 이름/값은 절대 변경하지 말 것.
3. `link-shortener/public/app.js` 에서 폼 `submit` 이벤트 시 §5-2 상태 표를 그대로
   구현: `submitting` 진입 시 버튼 `disabled=true` + `aria-busy="true"` + 텍스트
   "생성 중…" + 스피너 요소 삽입 → `fetch(POST /api/links)` 응답에 따라 `success`
   (`link-result--success` 클래스 교체, `#link-result-short-url`에 `shortUrl` 삽입) 또는
   `error`(`link-result--error` 클래스 교체, §5-3 매핑 문구를 `#link-result-error`에
   삽입) 상태로 전이한다. 두 경우 모두 버튼의 `disabled`/`aria-busy`를 제거해
   재활성화한다(§5-2 재시도 흐름 4단계 준수).
4. 에러 문구는 서버가 반환하는 `error.code`(`BAD_REQUEST`/`SLUG_CONFLICT`/
   `INTERNAL_ERROR`)를 §5-3 표로 매핑해서 사용한다 — 서버 원문 `message`를 그대로
   노출하지 않는다(사용자 친화적 한국어 문구 고정).
5. 입력 필드는 `error` 상태 진입 시에도 초기화하지 않는다 — 사용자가 입력한 값을
   그대로 두고 재수정 후 재제출할 수 있게 한다.
6. CSS class 이름은 BEM 스타일(`.link-form__field`, `.link-form__label`,
   `.link-form__submit`)을 그대로 따른다 — 신규 클래스 추가는 가능하나 frozen
   class 이름 변경/삭제는 금지.

## 9. mockup 참조

시각 mockup: [`docs/design/BF-2095/admin-page-mockup.html`](./admin-page-mockup.html)
— `idle` / `submitting` / `success` / `error` 4개 상태를 각각 별도 `<section>`으로
정적 시각화한 self-contained HTML 1파일. dev 의 실제 산출물이 아니며 픽셀 단위
일치 의무는 없다.
