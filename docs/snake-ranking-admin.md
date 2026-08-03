# 스네이크 랭킹 관리 화면 (CMS · infra)

CMS 운영자가 스네이크 게임의 상위 점수(랭킹)를 조회하는 관리 화면입니다.
backend 랭킹 API를 소비해 순위 목록을 표로 보여줍니다. (BF-1576)

## 1. 기능

- **랭킹 표**: 순위 · 닉네임 · 점수 · 모드 · 기록 시각 5개 열을 표시합니다.
- **모드 필터**: 특정 게임 모드만 조회하거나 `전체`를 선택합니다. 조회된
  데이터에 등장한 모드가 선택지에 자동으로 추가됩니다.
- **표시 개수**: 10 / 20 / 50 / 100개 중에서 조회할 개수를 선택합니다(기본 20개).
- **상태 처리**: 아래 5가지 상태를 화면 텍스트와 접근성 이름으로 모두 노출합니다
  (색상만으로 구분하지 않음).

| 상태 | 화면 표시 |
| --- | --- |
| `idle` | "준비되었습니다." (초기) |
| `loading` | 진행 표시 + "랭킹을 불러오는 중…" (필터/개수 control 비활성화) |
| `success` | 랭킹 표 렌더링 |
| `empty` | "표시할 랭킹이 없습니다." |
| `error` | "랭킹을 불러올 수 없습니다." (`role="alert"`로 안내) |

> 조회가 끝나면(성공·빈 결과·오류 모두) 진행 표시가 사라지고 모드 필터·표시 개수
> control이 다시 활성화되어 재조회할 수 있습니다.

## 2. 사용법 (화면 조작)

1. 화면에 진입하면 기본값(모드=전체, 표시 개수=20)으로 자동 조회합니다.
2. **모드**를 바꾸면 해당 모드로 즉시 재조회합니다.
3. **표시 개수**를 바꾸면 해당 개수로 즉시 재조회합니다.
4. 데이터가 없으면 "표시할 랭킹이 없습니다."가 표시됩니다.
5. API 오류 시 "랭킹을 불러올 수 없습니다." 경고가 노출되며, 필터/개수를 다시
   조작하면 재조회합니다.

### 접근성 / 반응형

- 모드·표시 개수 select는 명시적 `<label for>`를 가집니다.
- 표는 `<caption>스네이크 랭킹 목록</caption>`으로 목적을 안내합니다.
- 오류는 `role="alert"`로 노출됩니다.
- 320px 이상에서 표는 가로 스크롤 컨테이너로 처리되어 넘침이 없습니다.
- 768px 이상에서 필터 행과 표가 정렬된 레이아웃으로 표시됩니다.

## 3. 설정법 (환경 변수와 두 저장소 연결)

이 화면(infra)은 **backend 저장소의 랭킹 API**를 소비합니다. 두 저장소는
환경 변수 하나로 연결됩니다.

### 환경 변수

| 변수 | 설명 | 기본값 |
| --- | --- | --- |
| `SNAKE_ADMIN_API_BASE_URL` | backend 랭킹 API의 base URL. 라우트가 이 값을 화면(`index.html`)에 주입합니다. | 빈 문자열(= same-origin) |

- 값 미설정 시 화면은 same-origin(`""`)으로 동작하여 화면과 API가 같은 오리진에
  배포된 경우 그대로 동작합니다.
- 후행 슬래시는 자동으로 제거됩니다.

### 소비하는 backend API 계약

planner가 동결한 `GET /api/admin/snake/scores` 계약을 소비합니다.

```
GET {SNAKE_ADMIN_API_BASE_URL}/api/admin/snake/scores?mode=<mode>&limit=<n>
```

- `mode` — 조회할 게임 모드. `전체`(값 `all`) 선택 시 파라미터를 생략합니다.
- `limit` — 표시 개수.
- **응답 200** — JSON `{ "scores": [ Entry, … ] }` (또는 `Entry` 배열).
  `Entry = { rank?, nickname, score, mode, recordedAt }`.
  `rank`가 없으면 목록 순서로 순위를 매깁니다. `recordedAt`이 없으면
  `createdAt` / `timestamp`를 순서대로 사용합니다.
- **비 2xx 응답 또는 네트워크 실패** — `error` 상태로 전환합니다.

### 두 저장소 연결 예시

```bash
# infra (이 저장소) — 관리 화면 서버에 backend API 위치를 알려준다
export SNAKE_ADMIN_API_BASE_URL="https://backend.example.com"
```

- infra 라우트: `src/routes/admin-snake-ranking.js` — `/admin/snake-ranking`
  경로에서 화면(`public/admin/snake-ranking/`)을 제공하고 위 base URL을 주입합니다.
- backend: 동일 계약으로 `GET /api/admin/snake/scores`를 제공합니다(backend 저장소 담당).

## 4. 구성 파일

| 파일 | 역할 |
| --- | --- |
| `public/admin/snake-ranking/index.html` | 화면 HTML entrypoint (frozen 선택자/접근성 마크업) |
| `public/admin/snake-ranking/ranking.css` | 스타일 (frozen design token 적용) |
| `public/admin/snake-ranking/ranking.js` | API fetch · 표 렌더링 · 상태 처리 client |
| `src/routes/admin-snake-ranking.js` | 화면 제공 + API base URL 주입 라우트 |
| `test/admin-snake-ranking.test.js` | 라우트·상태 통합 테스트 (`node --test`) |

## 5. 검증

```bash
node --test test/admin-snake-ranking.test.js
```
