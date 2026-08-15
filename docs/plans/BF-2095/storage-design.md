# BF-2095 저장 계층 설계 — LinkStore / FileLinkStore

> BF-2098 · 기획(plan) 산출물. 엔드포인트/에러코드 표는
> [implementation-plan.md](./implementation-plan.md)를 참고한다.

## 1. 개요

link-shortener는 별도 DB 없이 JSON 파일(`links.json`) 기반 저장소를 사용한다.
`LinkStore`는 저장소 구현을 교체 가능하게 만드는 인터페이스 계약이며,
`FileLinkStore`는 그 파일 기반 구현체다.

## 2. LinkStore 인터페이스 계약

`src/store/LinkStore.js` 는 아래 메서드 시그니처를 계약으로 정의한다
(`FileLinkStore`는 이를 구현한다).

```js
class LinkStore {
  async create(record)        // record: {slug, originalUrl, createdAt, clicks: 0}
                               // -> 저장된 record 반환. slug 중복 시 예외 throw
  async findBySlug(slug)      // -> record | null
  async exists(slug)          // -> boolean
  async incrementClicks(slug) // -> 갱신된 record | null (없으면 null)
  async remove(slug)          // -> boolean (삭제 성공 여부)
}
```

## 3. 데이터 레코드 스키마

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `slug` | string | PK, unique |
| `originalUrl` | string | 원본 URL |
| `createdAt` | string (ISO 8601) | 생성 시각 |
| `clicks` | number | 리다이렉트 호출 횟수, 기본값 0 |

## 4. FileLinkStore 동시 쓰기 직렬화 전략

- Node.js 이벤트 루프는 단일 스레드지만 파일 I/O는 비동기이므로, `create`와
  `incrementClicks` 같은 두 변경 연산이 겹치면 read-modify-write 경쟁으로 먼저
  쓴 변경이 유실될 수 있다.
- `FileLinkStore`는 내부에 Promise 체인 기반 쓰기 큐를 유지한다. 모든 변경
  연산(`create`/`incrementClicks`/`remove`)은
  `writeQueue = writeQueue.then(() => 실제쓰기)` 형태로 큐에 등록되어, 파일에
  대한 접근이 항상 순차적으로 실행된다. 즉 동일 프로세스 내 모든 쓰기는 큐
  순서대로 하나씩만 실행되고 절대 겹치지 않는다.
- 읽기 전용 연산(`findBySlug`/`exists`)은 초기 로드 시 파일 전체를 읽어 메모리
  Map으로 캐시하며, 각 쓰기가 완료될 때마다 캐시를 갱신한다.
- 파일 쓰기는 원자적 교체 방식을 사용한다: 임시 파일(`links.json.tmp`)에 전체
  스냅샷을 쓴 뒤 `fs.rename()`으로 원본을 교체한다. 쓰기 도중 프로세스가 종료돼도
  원본 `links.json`은 손상되지 않는다.

## 5. slug 생성 및 재시도 정책 (최대 5회)

- **`customSlug` 미지정 시**: `src/slug.js`의 `generateSlug()`로 랜덤 slug를
  생성한다. 생성 직후 `store.exists(slug)`로 충돌을 확인하고, 충돌 시 재생성해
  **최대 5회까지 재시도**한다. 5회 모두 충돌하면 `500 INTERNAL_ERROR`
  (`"slug 생성 실패 — 재시도 초과"`)로 응답한다.
- **`customSlug` 지정 시**: 재시도 없이 즉시 `exists`를 확인한다. 이미 존재하면
  `409 SLUG_CONFLICT`로 응답한다 — 사용자가 명시적으로 지정한 값이므로 자동으로
  다른 값으로 바꾸지 않는다.
