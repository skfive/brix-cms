# BF-2095 구현 계획 — API 명세 및 서버 구조

> BF-2098 · 기획(plan) 산출물. designer(BF-2096)와 developer(BF-2097)는 본 문서의
> 엔드포인트/에러코드/서버 구조/UI 계약을 그대로 따르며 재정의하지 않는다.

## 1. 개요

link-shortener 서비스의 REST API 4종(생성/리다이렉트/통계/삭제)과, NestJS·Next.js
루트 tsconfig 관례([CLAUDE.md](../../../CLAUDE.md) 참고)와 무관한 독립 Express 서버의
`createApp`/서버 시작 분리 구조를 정의한다. 저장 계층(LinkStore/FileLinkStore) 설계는
[storage-design.md](./storage-design.md)를 참고한다.

## 2. API 엔드포인트 명세

| Method | Path | 설명 | Request Body | 성공 응답 |
| --- | --- | --- | --- | --- |
| POST | `/api/links` | 신규 단축 링크 생성 (customSlug 선택) | `{ "url": string, "customSlug"?: string }` | `201` `{ slug, shortUrl, originalUrl, createdAt }` |
| GET | `/:slug` | 단축 링크로 원본 URL 리다이렉트, 클릭수 증가 | - | `302` Redirect (`Location: originalUrl`) |
| GET | `/api/links/:slug/stats` | 단축 링크 통계 조회 | - | `200` `{ slug, originalUrl, shortUrl, clicks, createdAt }` |
| DELETE | `/api/links/:slug` | 단축 링크 삭제 | - | `204` No Content |

## 3. 에러 코드 표

| 코드 | 발생 조건 | 응답 바디 |
| --- | --- | --- |
| 400 | `url` 누락/형식 오류, `customSlug` 형식 위반(허용 문자 범위 밖) | `{ "error": { "code": "BAD_REQUEST", "message": string } }` |
| 404 | `slug`에 해당하는 링크 없음 (`GET /:slug`, `GET stats`, `DELETE`) | `{ "error": { "code": "NOT_FOUND", "message": string } }` |
| 409 | 사용자가 지정한 `customSlug`가 이미 사용 중 (`POST /api/links`) | `{ "error": { "code": "SLUG_CONFLICT", "message": string } }` |
| 500 | 자동 생성 slug 재시도 5회 소진, 파일 저장소 I/O 실패 | `{ "error": { "code": "INTERNAL_ERROR", "message": string } }` |

slug 재시도 로직 상세는 [storage-design.md §5](./storage-design.md#5-slug-생성-및-재시도-정책-최대-5회)를 참고한다.

## 4. createApp / 서버 시작 분리 설계

- `src/app.js`: `function createApp({ store }) { ... return app }` — Express 인스턴스를
  생성하고 `src/routes/links.js`를 마운트한다. **`app.listen()`을 호출하지 않는다.**
- `src/server.js`: 유일한 엔트리포인트. `FileLinkStore` 인스턴스를 만들고
  `createApp({ store })`로 앱을 조립한 뒤 `app.listen(PORT)`를 호출한다.
- 이유: `test/app.test.js`가 supertest로 `createApp()`의 반환값을 직접 import해
  포트 바인딩 없이 라우트를 테스트할 수 있다.

## 5. TDD 작성 순서

1. `test/slug.test.js` — slug 생성 규칙(길이/허용 문자), `customSlug` 형식 검증
2. `test/store.test.js` — `LinkStore` 인터페이스 계약(생성/조회/삭제/클릭 증가) +
   `FileLinkStore` 동시 쓰기 직렬화
3. `test/app.test.js` — 라우트 통합 (POST/GET/GET stats/DELETE, 400/404/409/500 에러코드)

## 6. UI 계약 (frozen)

아래 값은 상위 blueprint에서 이미 동결된 `ui-contract@v1`을 그대로 옮긴 것이며,
본 문서는 렌더링만 한다 — designer/developer는 selector·token을 재정의하지 않는다.

- **산출물 경로**: `docs/design/BF-2095/admin-page-contract.md`,
  `docs/design/BF-2095/admin-page-mockup.html` (designer) /
  `link-shortener/public/index.html`, `public/app.js`, `public/styles.css` (developer)
- **DOM ID**: `link-form`, `link-url-input`, `link-custom-slug-input`, `link-submit-btn`,
  `link-result`, `link-result-short-url`, `link-result-error`
- **CSS class**: `link-app`, `link-form`, `link-form__field`, `link-form__label`,
  `link-form__submit`, `link-result`, `link-result--success`, `link-result--error`
- **상태**: `idle`, `submitting`, `success`, `error`
- **디자인 토큰**: `--color-action-primary: #2563eb;` `--color-error: #dc2626;`
  `--space-control-gap: 12px;` `--radius-control: 6px;`
- **접근성**:
  - `#link-submit-btn` 은 `aria-label="단축 링크 생성"`
  - `#link-result` 은 `aria-live="polite"` 로 생성 결과/오류를 스크린리더에 알림
  - `url`·`customSlug` 입력 필드는 각각 연결된 `<label for>` 를 가짐
  - 모든 상태는 색상만으로 구분하지 않고 상태명을 화면 텍스트와 접근성 이름으로 노출
- **반응형**: 320px 이상 뷰포트에서 폼과 결과 카드가 세로로 스택되며 가로 스크롤이
  발생하지 않음

## 7. 산출물 경로 및 소유권 요약

| 경로 | 소유 페르소나 |
| --- | --- |
| `docs/plans/BF-2095/implementation-plan.md`, `storage-design.md` | planner |
| `docs/design/BF-2095/admin-page-contract.md`, `admin-page-mockup.html` | designer |
| `link-shortener/src/**`, `public/**`, `test/**` | developer |
| `link-shortener/package.json`, `package-lock.json` | 공통(canonical work packet owner) |
