# BF-2145 — 결함별 위협 시나리오 및 수정 범위 명세

## 대상 결함 3건
1. **Open Redirect** — `targetUrl` 스킴 미검증
2. **Rate Limit 부재** — 링크 API 요청 빈도 제한 없음
3. **슬러그 열거(Slug Enumeration)** — 무제한 요청으로 유효 슬러그 정찰 가능

현재 구현 근거: `src/links/routes.js`(createLink/resolveLink/getStats/deleteLink),
`src/links/expiry.js`(TTL 판정), `src/links/cache/linkCache.js`(read-through 캐시),
`src/links/metrics/linkMetrics.js`(302/404/410 계측). 이 문서는 위 파일들의 **기존 동작을
변경하지 않는 범위**에서 3건의 수정 범위를 정의한다.

---

## 결함 1: Open Redirect

### 위협 시나리오
공격자가 링크 생성 API(`createLink`)에 `targetUrl=javascript:alert(document.cookie)`,
`data:text/html,...`, 또는 `//evil.com`(protocol-relative) 같은 값을 등록한다.
`resolveLink`는 검증 없이 해당 값을 그대로 302 응답 본문(`{ targetUrl }`)으로 반환하므로,
클라이언트가 이를 그대로 리다이렉트 대상으로 사용하면 스크립트 실행이나 신뢰 도메인을
가장한 피싱으로 이어진다.

### 근본 원인
`src/links/routes.js`의 `createLink`(9~25행)가 `targetUrl`에 대해 어떤 스킴 검증도
수행하지 않는다. `resolveLink`(27~43행) 역시 반환 시점에 검증하지 않는다.

### 수정 범위
- `createLink`가 **저장 전**에 스킴을 검증한다(아래 "스킴 검증 규칙" 참조).
- 검증은 슬러그 생성/예약보다 먼저 수행해 무효 요청이 슬러그 공간을 소모하지 않게 한다.
- 이미 저장된 링크에 대한 소급 검증·마이그레이션은 범위 밖.
- `resolveLink`/302/404/410 응답 스키마는 변경하지 않는다.

---

## 결함 2: Rate Limit 부재

### 위협 시나리오
공격자가 짧은 시간에 대량 요청을 보내 (a) 생성 API 남용으로 스토리지를 고갈시키거나
(b) 해석(resolve/redirect) API를 무제한 호출해 슬러그 전수조사의 기반을 마련한다.

### 근본 원인
저장소 전체에 rate limiting 계층이 존재하지 않는다(`rateLimit` 관련 코드 0건 확인).

### 수정 범위
- 신규 순수 로직 모듈 `src/lib/rateLimiter.js` + HTTP 어댑터
  `src/middleware/rateLimitMiddleware.js` 추가(아래 "Rate Limit 알고리즘" 참조).
- 링크 API(생성/조회/해석·redirect/삭제) 전체에 IP 단위로 적용한다.
- 차단된(429) 요청은 `store`/`link-cache`/`link-metrics`를 전혀 거치지 않도록
  rate limiter를 요청 처리 파이프라인의 최전단에 둔다.

---

## 결함 3: 슬러그 열거(Slug Enumeration)

### 위협 시나리오
슬러그는 7자리 base62 랜덤(`slug.js`, 62^7 ≈ 3.5조 조합)이라 이론적 전수조사는
비현실적이지만, 요청 빈도에 제한이 없으면 자동화 스캔으로 유효 슬러그의 존재 여부를
대량으로 확인하거나(정찰), 404/410/302 응답 차이로 슬러그 상태(없음/만료/유효)를
구분해 정보를 얻을 수 있다.

### 근본 원인
결함 2와 동일 — 요청 빈도 제한 부재. 슬러그 자체의 예측 가능성 문제는 아니다.

### 수정 범위
- 결함 2에서 추가하는 rate limiter를 해석(resolve) 엔드포인트에도 반드시 적용해
  자동화 스캔의 처리량을 IP당 분당 30회로 제한한다. **이번 작업에서 슬러그 열거에
  대해 추가하는 완화는 이것이 유일하다.**
- **범위 밖**: 404와 410 응답 본문의 스키마 통일, 응답 타이밍 완화(상수 시간 응답)는
  이번 작업에서 다루지 않는다(아래 "범위 밖" 절 참조).

---

## 스킴 검증 규칙 (Open Redirect 수정)

### 규칙
`targetUrl`이 다음 정규식을 만족하지 않으면 저장을 거부한다.

```
/^(https?):\/\//i
```

- `^` 앵커로 인해 스킴 앞 공백·제어문자가 있으면 자동으로 거부된다(별도 trim 없음).
- `i` 플래그로 대소문자 변형(`HTTPS://`, `HtTpS://`)은 허용하되, 스킴 자체가
  `http`/`https`가 아니면 대소문자와 무관하게 거부한다.
- 실패 시 응답: `400 { "error": { "code": "INVALID_TARGET_SCHEME" } }`
- 검증 위치: `createLink` 저장 로직 진입 시점, 슬러그 생성 이전.

### 판정 예시 (exact)
| `targetUrl` | 판정 |
| --- | --- |
| `http://example.com` | 허용 |
| `HTTPS://example.com` | 허용 |
| `HtTpS://example.com` | 허용 |
| `javascript:alert(1)` | 거부 |
| `JAVASCRIPT:alert(1)` | 거부 |
| `" javascript:alert(1)"` (앞 공백) | 거부 |
| `" http://example.com"` (앞 공백만) | 거부 |
| `"http ://example.com"` (스킴 내부 공백) | 거부 |
| `data:text/html,...` | 거부 |
| `//evil.com` (protocol-relative) | 거부 |
| `ftp://example.com` | 거부 |
| `""` / `null` / `undefined` / 비문자열 | 거부 |

---

## Rate Limit 알고리즘

### 파라미터
- 한도: **IP당 분당 30회**
- 윈도: **60,000ms 슬라이딩 윈도** (고정 윈도 아님)
- 저장소: **인메모리, 단일 프로세스 한정**(Redis 등 영속/분산 저장소는 범위 밖)
- clock: **주입 가능**, 기존 저장소 관례(`linkMetrics.js`의 `defaultClock`)와 동일한
  `{ now: () => Date }` 형태로 통일

### 알고리즘 (sliding window log)
IP별로 요청 타임스탬프(ms) 배열을 보관한다. 요청마다:
1. `now = clock.now().getTime()`
2. 해당 IP 배열에서 `now - windowMs`보다 오래된 타임스탬프를 제거한다(lazy cleanup).
3. 남은 개수가 `limit`(30) 이상이면 거부: `{ allowed: false, retryAfterSeconds }`.
   - `retryAfterSeconds = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000))`
4. 미만이면 `now`를 배열에 push하고 허용: `{ allowed: true }`.

### 공개 API 계약 (구현 파일 배치와 무관하게 고정)
```
createRateLimiter({ limit = 30, windowMs = 60000, clock }) 
  -> { check(ip: string): { allowed: boolean, retryAfterSeconds?: number } }
```
- 순수 로직: `src/lib/rateLimiter.js` (위 계약 구현, Express 비의존)
- HTTP 어댑터: `src/middleware/rateLimitMiddleware.js` (req/res 연결, 429 응답 작성)
- **구현 참고**: 현재 링크 라우트 로직(`src/links/routes.js`)은 Express 미들웨어가
  아닌 순수 함수 형태다. Express 미들웨어로 감쌀지, 함수 호출 지점에서 직접
  `check(ip)`를 호출할지는 개발자 재량이나, 위 `rateLimiter` 공개 API 계약과
  아래 응답 계약은 고정이다.

### 초과 시 응답
- `429`
- 본문: `{ "error": { "code": "RATE_LIMITED" } }`
- 헤더: `Retry-After: <초 단위 정수>` (위 계산식)

### 적용 대상
링크 생성/조회(getStats)/해석(resolve·redirect)/삭제 API 전체. 해석 엔드포인트
포함이 슬러그 열거(결함 3) 완화의 근거다.

---

## 범위 밖 (Non-Goals)

- 404/410 응답 본문 스키마 통일(현재 404는 `{error:{code}}`, 410은
  `{error, slug, expiredAt}`로 서로 다른 shape — 정렬 작업은 별도 티켓).
- 응답 타이밍 완화(constant-time response) — 슬러그 존재 여부의 타이밍 사이드채널 방지.
- 기존에 저장된 링크의 `targetUrl` 소급 검증/마이그레이션.
- `X-Forwarded-For` 등 프록시 헤더 기반 클라이언트 IP 신뢰 체계 구축(요청 객체가
  제공하는 IP를 그대로 사용).
- `link-metrics`의 `TRACKED_STATUS_CODES`에 `429` 추가(계측 확장은 별도 작업).
- 분산/영속 rate limit 저장소.

---

## 비회귀 계약 (기존 302/404/410 · hits · TTL · 캐시 · 계측)

| 대상 | 계약 | 근거 |
| --- | --- | --- |
| 302 | 유효 링크 해석 시 `{status:302, body:{targetUrl}}` 불변. 스킴 검증은 생성 시점에만 적용되어 이미 저장된 유효 링크의 redirect에 영향 없음. | `routes.js:42` |
| 404 | `{status:404, body:{error:{code:'NOT_FOUND'}}}` shape 불변(스키마 통일은 범위 밖). | `routes.js:30,48,61` |
| 410 | `{status:410, body:{error:'LINK_EXPIRED', slug, expiredAt}}` shape 불변. | `routes.js:37` |
| hits | `resolveLink` 성공(302) 시에만 `store.incrementHits` 호출 유지. rate limiter가 차단(429)한 요청은 `incrementHits`를 호출하지 않는다. | `routes.js:41` |
| TTL | `computeExpiresAt`/`isExpired` 로직·순서 변경 없음. 스킴 검증·rate limit 모두 만료 판정 이전 단계(요청 유효성)에 위치. | `expiry.js` |
| 캐시 | `linkCache`의 `save`/`get` read-through 계약 변경 없음. rate limiter가 차단한 요청은 캐시 계층에 도달하지 않아 히트/미스 카운터가 오염되지 않는다(rate limiter는 캐시보다 앞단에 위치). | `linkCache.js` |
| 계측 | `TRACKED_STATUS_CODES=['302','404','410']` 목록에 `429`를 추가하지 않는다(범위 밖). `recordRequest`/`recordResolveLatency` 호출 시점·인자 계약 변경 없음. 차단된 요청은 `resolveLink`에 도달하지 않으므로 latency 샘플에도 포함되지 않는다. | `linkMetrics.js` |
