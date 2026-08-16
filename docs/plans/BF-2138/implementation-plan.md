# BF-2138 · 링크 단축 서비스 캐시·계측·벤치 구현 설계

- 상위 Epic: BF-2138
- 본 문서 작성 task: BF-2140 (planner)
- 구현 담당 task: BF-2139 (developer)
- 대상 모듈: `src/links/**` (`routes.js`, `expiry.js`, `stores/memoryLinkStore.js`, `stores/fileLinkStore.js`)

## 1. 배경 및 범위

`src/links/routes.js` 는 `createLink` / `resolveLink` / `getStats` / `deleteLink` 4개의
transport-agnostic 함수(`{status, body}` 반환 컨벤션)로 구성되어 있고, `LinkStore` 는
`save` / `get` / `delete` / `incrementHits` 4개 메서드 계약을 `memoryLinkStore.js` /
`fileLinkStore.js` 양쪽이 구현한다 (`test/links/linkStore.contract.test.js` 로 계약 검증).

본 설계는 이 위에 **읽기 우선(read-through) 캐시 레이어**, **계측(metrics) 모듈**,
**벤치 스크립트**를 추가한다. `LinkStore` 인터페이스와 기존 4개 route 함수 시그니처는
변경하지 않는다 (surgical addition — 기존 파일은 최소 wiring 만 추가).

### 범위 제외 (non-goals)
- `memoryLinkStore.js` / `fileLinkStore.js` 자체 로직 변경 — 캐시는 별도 decorator 로 감싼다.
- 별도 "TTL 갱신" API 신설 — 기존 `createLink` 는 동일 slug 재호출 시 `store.save()` 로
  upsert 되므로, "만료 갱신" 쓰기 경로는 이 upsert 경로에 매핑한다 (§2 참고).
- HTTP 서버/라우터(express 등) 신규 도입 — 기존 `routes.js` 와 동일하게 transport-agnostic
  함수로만 구현하고, 실제 HTTP mount 방식은 기존 프로젝트 컨벤션을 따른다.

## 2. 캐시 무효화 규칙 (쓰기 경로별)

캐시는 slug 를 key 로 하는 in-memory `Map` 기반 **write-through** 캐시다. 모든 쓰기는
"store 호출 → 성공 시 캐시 즉시 갱신"을 **같은 await 체인 안에서 동기적으로** 수행하여,
캐시 evict 후 재조회 사이의 stale 윈도우 자체를 만들지 않는다 (invalidate-then-lazy-reload 방식 금지).

| # | 쓰기 경로 | 매핑되는 store 호출 | 캐시 동작 | 후속 `get()` 결과 |
|---|---|---|---|---|
| 1 | 생성 (신규 slug) | `store.save(link)` | 반환값으로 `cache.set(slug, result)` (write-through) | 캐시 hit, 최신 값 |
| 2 | 만료 갱신 (기존 slug 재-`createLink`, upsert) | `store.save(link)` | 생성과 동일하게 `cache.set(slug, result)` — 신규/갱신 분기 없음 | 캐시 hit, 갱신된 `expiresAt` |
| 3 | 삭제 | `store.delete(slug)` | 반환값이 `true` 인 경우에만 `cache.delete(slug)` | 캐시 miss → store 재조회 → `null` |
| 4 | hits 증가 (resolveLink 302 경로) | `store.incrementHits(slug)` | 반환값(최신 레코드)으로 `cache.set(slug, result)` (evict 아님, overwrite) | 캐시 hit, 증가된 `hits` |

- `cache.get(slug)` 는 캐시 miss 시에만 `store.get(slug)` 을 호출해 populate 한다.
- 캐시 엔트리 자체의 TTL(`options.ttlMs`, 기본값 개발자가 상수로 고정 — 예: 30000)은
  "동일 프로세스 내 캐시 인스턴스를 거치지 않은 외부 변경"(예: `fileLinkStore.js` 파일을
  다른 프로세스가 직접 수정)에 대한 방어용 hedge 이며, 위 표의 즉시성 보장과는 무관하다.
  즉, TTL 이 남아있어도 표의 4개 쓰기 경로는 항상 write-through 로 즉시 반영해야 한다.
- 만료 판정(`isExpired`)은 캐시 레이어가 소유하지 않는다. 캐시는 저장된 `link` 레코드
  그대로(만료 여부와 무관하게)를 반환하고, `routes.js` 가 매 요청마다 `clock` 기준으로
  `isExpired()` 를 재계산한다 (기존 동작 유지).

## 3. `GET /api/metrics` 노출 필드 정의

응답 body(JSON) 스키마 — 아래 필드명·타입을 정확히 사용한다:

```json
{
  "requestsTotal": 0,
  "statusCounts": { "302": 0, "404": 0, "410": 0 },
  "resolveLatencyMs": { "p50": 0, "p95": 0 },
  "cache": { "hits": 0, "misses": 0 }
}
```

| 필드 | 타입 | 정의 |
|---|---|---|
| `requestsTotal` | `integer` | `createLink`/`resolveLink`/`getStats`/`deleteLink` 호출 총 합산 카운트 |
| `statusCounts["302"]` | `integer` | `resolveLink` 가 302 를 반환한 누적 횟수 |
| `statusCounts["404"]` | `integer` | 4개 함수 전체에서 404 를 반환한 누적 횟수 합산 |
| `statusCounts["410"]` | `integer` | `resolveLink` 가 410(LINK_EXPIRED) 을 반환한 누적 횟수 |
| `resolveLatencyMs.p50` | `number` (ms, float) | `resolveLink` 호출 소요 시간의 50번째 백분위수 |
| `resolveLatencyMs.p95` | `number` (ms, float) | `resolveLink` 호출 소요 시간의 95번째 백분위수 |
| `cache.hits` | `integer` | 캐시 레이어 `get()` 이 store 를 거치지 않고 반환한 누적 횟수 |
| `cache.misses` | `integer` | 캐시 레이어 `get()` 이 store 를 호출해 populate 한 누적 횟수 |

- `resolveLatencyMs` 는 최근 N개(개발자가 고정 상수로 정함 — 예: 최근 1000개) 표본의
  정렬 기반 백분위수로 계산한다 (스트리밍 근사 알고리즘 불필요 — 표본 수가 작아 단순
  정렬로 충분).
- `statusCounts` 에 없는 상태 코드(201/204/400)는 `requestsTotal` 에는 포함되지만
  `statusCounts` 세부 항목에는 포함하지 않는다 (AC 범위: 302/404/410만 세부 카운트).

## 4. Stale 읽기 금지 시나리오 (쓰기 직후 즉시 읽기)

아래 시나리오는 모두 **같은 캐시 인스턴스**를 통해 순서대로 호출했을 때, 캐시가
store 의 최신 상태와 어긋난 값을 반환하면 안 됨을 명시한다.

| # | 시나리오 (호출 순서) | 기대 동작 | 위반 시 증상 |
|---|---|---|---|
| 1 | `createLink(slug=X)` → 즉시 `resolveLink(X)` | 302, `targetUrl` 이 방금 생성한 값과 일치 | 캐시 미스로 처리되어도 무방하나, 캐시가 이전(존재하지 않던) 상태를 잘못 캐싱해 404 를 반환하면 안 됨 |
| 2 | `resolveLink(X)` 를 N회 반복 호출 → 즉시 `getStats(X)` | `getStats` 응답의 `hits === N` | `incrementHits` 캐시 갱신 누락 시 `hits` 가 0 또는 1로 고정되는 stale 버그 |
| 3 | `deleteLink(X)` → 즉시 `resolveLink(X)` | 404 | 캐시 evict 누락 시 삭제된 링크가 여전히 302 로 응답(가장 심각한 stale 케이스) |
| 4 | `createLink(slug=X, ttlSeconds=T1)` → `createLink(slug=X, ttlSeconds=T2)` (만료 갱신) → 즉시 `getStats(X)` | `expiresAt` 이 `T2` 기준 값 | 캐시가 `T1` 기준 이전 `expiresAt` 을 반환하면 TTL 갱신이 무효화된 것처럼 보임 |
| 5 | `deleteLink(X)` → 즉시 `createLink(slug=X)` (동일 slug 재생성) | `resolveLink(X)` 가 새 레코드 기준으로 302 | 캐시가 삭제 이전 값을 evict 하지 않고 남겨두면, 재생성 이후에도 이전 `targetUrl` 이 반환될 수 있음 |

## 5. Developer 파일 경로 계약

developer(BF-2139)는 아래 정확한 경로에 각 모듈을 구현한다. 경로/책임 재정의 금지.

| 경로 | 역할 |
|---|---|
| `src/links/cache/linkCache.js` | `createLinkCache(store, options)` — §2 규칙을 구현하는 write-through 캐시 decorator. `LinkStore` 와 동일한 `{save, get, delete, incrementHits}` 인터페이스를 반환해 `routes.js` 에 drop-in 교체 가능해야 한다. `options.onHit`/`options.onMiss` 콜백(기본 no-op)을 받아 계측 모듈과 결합한다. |
| `src/links/metrics/linkMetrics.js` | `createLinkMetrics()` — §3 스키마를 생성하는 계측 recorder. `recordRequest(status)`, `recordResolveLatency(ms)`, `recordCacheHit()`, `recordCacheMiss()`, `getMetrics()` (§3 JSON 반환), `handleMetricsRequest()` (`{status:200, body: getMetrics()}`, 기존 route 함수와 동일한 반환 컨벤션)를 제공한다. |
| `scripts/bench-links.js` | 벤치 스크립트. 캐시 미적용(raw store) vs 캐시 적용(`linkCache`) 두 조건으로 다수 slug 에 대해 반복 `resolveLink` 를 실행하고, p50/p95 latency 와 캐시 hit/miss 비율을 stdout 에 출력한다. `package.json` 에 `"bench:links": "node scripts/bench-links.js"` 스크립트로 등록한다. |
| `test/links/linkCache.test.js` | §2 표의 4개 쓰기 경로 각각에 대한 캐시 갱신/무효화 단위 테스트. |
| `test/links/linkMetrics.test.js` | §3 필드(요청 수, 상태코드별 카운트, p50/p95, 캐시 hit/miss) 단위 테스트. |
| `test/links/staleRead.test.js` | §4 표의 5개 시나리오를 `routes.js` + `linkCache.js` 조합으로 검증하는 통합 테스트. |

- 신규 테스트는 기존 컨벤션(`node:test` + `node:assert/strict`, `fixedClock` 헬퍼 재사용)을 따른다.
- `linkCache.js` 는 `LinkStore` 계약을 만족하므로, developer 재량으로
  `test/links/linkStore.contract.test.js` 의 `implementations` 배열에 캐시 래핑된 스토어를
  추가해 계약 재사용을 검토할 수 있다 (본 설계의 필수 요구사항은 아님).

## 6. Edge case

- `resolveLink` 가 만료(410)를 반환하는 경우에도 캐시된 레코드 자체는 evict 하지 않는다
  (§2 규칙에 없는 경로 — 만료 판정은 read-time 계산이며 store 상태를 바꾸지 않음).
- `incrementHits(slug)` 가 `null` 을 반환하는 경우(레이스로 그 사이 삭제됨) 캐시를
  갱신하지 않는다 (덮어쓸 최신 레코드가 없음).
- `fileLinkStore` 기반 캐시는 단일 프로세스 내에서만 stale-free 를 보장한다. 여러 프로세스가
  같은 파일을 공유하는 배포 형태는 본 설계 범위 밖이다 (기존 `fileLinkStore.js` 자체도
  다중 프로세스 동시 쓰기를 지원하지 않음).
