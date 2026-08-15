# BF-2129 · TTL 만료 기능 실행 설계

## 1. 배경 및 목표

링크 단축 서비스(BF-2097)에 TTL(Time To Live) 기반 만료 기능을 추가한다.
링크 생성 시 `ttlSeconds`를 지정하면 서버가 만료 시각(`expiresAt`)을 계산해
저장하고, 만료된 링크에 대한 접근은 명확한 에러 응답(410)으로 처리한다.

이 문서는 developer(BF-2128)가 TDD로 바로 구현할 수 있도록 만료 의미론,
아키텍처, 계층 책임을 확정한다. 계약 변경표는 `contract-changes.md`,
기존 데이터 하위호환 방침은 `migration.md`를 참조한다.

## 2. 만료 의미론 (Semantics)

### 2.1 TTL 지정과 expiresAt 계산

- `ttlSeconds`는 optional 입력이며 **양의 정수**(초 단위)만 허용한다.
- `ttlSeconds`가 주어지면 서버가 `expiresAt = createdAt + ttlSeconds`를
  계산해 저장한다. 클라이언트가 `expiresAt`을 직접 지정하는 경로는 없다.
- `ttlSeconds`를 지정하지 않으면 `expiresAt = null`(무기한 링크)이다.
- `ttlSeconds <= 0` 이거나 정수가 아니면 요청은 `400 Bad Request`
  (`INVALID_TTL`)로 거부되고 링크는 생성되지 않는다.

### 2.2 경계값 — 만료 판정 규칙 (MUST)

> **`now >= expiresAt` 이면 만료로 간주한다. 즉 만료 시각 정각 그 순간부터
> 이미 만료 상태이며, "정확히 만료 시각"은 유효(available)가 아니라
> 만료(expired) 쪽에 포함된다.**

- 판정 함수는 `isExpired(link, now) = link.expiresAt !== null && now >= link.expiresAt`
  형태의 순수 함수로 구현한다 (`>=`이지 `>`가 아님에 유의).
- `expiresAt`이 `null`인 링크는 항상 `isExpired === false` (무기한).
- 판정은 **lazy(조회 시점) 방식**만 사용한다. 배치/cron 기반 물리 삭제는
  이번 스코프의 non-goal이다.

### 2.3 시각 처리 표준

- 서버는 단일 시각 소스(`Date.now()` 등 서버 클럭)만 사용한다. 클라이언트가
  제공하는 시각 값은 만료 판정에 신뢰하지 않는다.
- `expiresAt`은 UTC 기준 ISO 8601 문자열(예: `2026-08-15T10:00:00.000Z`)로
  저장·직렬화한다.

### 2.4 존재하지 않음 vs 만료의 우선순위

- 링크가 아예 존재하지 않으면 `404`를 반환하고 만료 판정을 수행하지 않는다.
- 링크가 존재하고 만료 상태이면 `410`을 반환한다.
- 즉 우선순위는 **404(미존재) > 410(만료)** 이다.

### 2.5 삭제와 만료의 관계

- 만료된 링크는 자동으로 삭제되지 않는다. 통계 조회(`stats`)는 만료 여부와
  무관하게 계속 가능해야 한다 (2.6, `contract-changes.md` §3 참고).
- `DELETE`는 만료 여부와 무관하게 항상 명시적으로 호출 가능한 별도 동작이다
  (`contract-changes.md` §4).

### 2.6 stats 노출 방침

- `stats` 응답은 만료된 링크도 계속 조회 가능해야 한다 (404로 막지 않는다).
- 응답에는 `expiresAt`과, 응답 시점 기준으로 계산한 `isExpired`(boolean)를
  포함한다. `isExpired`는 저장된 값이 아니라 매 요청마다 재계산한다.

## 3. 아키텍처 — 도메인 계층 vs 저장 계층 분리 (MUST)

만료 판정 로직이 저장 계층에 섞이면 저장소 구현체(BF-2123 `MemoryLinkStore`
및 향후 영속 저장소)마다 판정 로직이 중복/분기될 위험이 있다. 이를 막기
위해 계층을 다음과 같이 분리한다.

| 계층 | 위치 | 책임 | 만료 판정 포함 여부 |
| --- | --- | --- | --- |
| Domain | `src/links/domain/` | `Link` 엔티티 타입, `ExpirationPolicy.isExpired(link, now)` 순수 함수, `expiresAt` 계산 함수 | **포함** (유일한 판정 지점) |
| Service | `src/links/service/` | `createLink` / `resolveLink` / `getStats` / `deleteLink` 유스케이스 조합. domain의 계산·판정 함수를 호출하고 store에는 raw CRUD만 위임 | 미포함 (domain 위임) |
| Store | `src/links/store/` (BF-2123 저장소 팩토리 활용) | `Link` 레코드의 get/save/delete만 수행하는 순수 CRUD | **미포함** |
| API Route | 기존 Next.js App Router route handler (`app/api/**`, 경로는 기존 BF-2097 구현 유지) | 요청 검증(zod 등) 후 service 호출, HTTP 상태 코드 매핑 | 미포함 |

원칙:
- **Store는 만료를 모른다.** 저장소는 `Link` 레코드를 있는 그대로
  읽고 쓸 뿐, `expiresAt`이 지났는지 판단하지 않는다.
- **판정은 항상 domain의 `isExpired`를 통해서만 수행한다.** service, API
  route 어디에서도 `now >= expiresAt` 비교를 직접 재구현하지 않는다.
- 이 분리 덕분에 BF-2123에서 구축한 저장소 팩토리(계약 테스트 포함)를
  변경 없이 재사용할 수 있다 — TTL은 순수하게 domain/service 계층의
  추가 로직으로 도입된다.

## 4. API별 처리 흐름

- **POST /api/links**: 요청 검증 → (`ttlSeconds` 있으면) `expiresAt` 계산 →
  `store.save` → `expiresAt` 포함 응답. 상세: `contract-changes.md` §1.
- **GET /:slug**: `store.get` → 없으면 404 → 있으면
  `ExpirationPolicy.isExpired` 판정 → 만료면 410, 아니면 302 리다이렉트 +
  히트 카운트 증가. 상세: `contract-changes.md` §2.
- **GET stats**: `store.get` → 없으면 404 → 있으면 `expiresAt`/`isExpired`를
  포함해 응답 (만료 여부와 무관하게 200). 상세: `contract-changes.md` §3.
- **DELETE /:slug**: 만료 여부와 무관하게 삭제 수행, idempotent.
  상세: `contract-changes.md` §4.

## 5. Non-goals (이번 스코프 제외)

- 만료된 링크의 배치/cron 기반 물리 삭제 (lazy 판정만 사용).
- 만료 임박 알림, TTL 연장(갱신) API.
- 영속 저장소(DB) 신규 도입 — BF-2123의 저장소 팩토리 인터페이스를 그대로
  사용하며 구현체 교체는 이번 스코프가 아니다.

## 6. 관련 문서

- 요청/응답 계약 변경표: `contract-changes.md`
- 기존 데이터 하위호환/마이그레이션 방침: `migration.md`
