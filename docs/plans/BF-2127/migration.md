# BF-2129 · 기존 데이터 마이그레이션 방침

## 1. 문제 정의

TTL 기능 도입 이전에 생성된 `Link` 레코드에는 `expiresAt` 필드 자체가
존재하지 않는다 (`undefined`/missing). 이 레코드들을 만료 판정·API 응답
경로에서 어떻게 취급할지 정의한다.

## 2. 방침 (MUST) — Lazy Normalize, No Backfill

> **`expiresAt` 필드가 없는(undefined) 레코드는 `expiresAt: null`과
> 동일하게, 즉 "무기한 링크"로 취급한다. 별도의 backfill
> 마이그레이션 스크립트나 배치 작업은 수행하지 않는다.**

- 저장 계층(`store`)에서 레코드를 읽는 시점에 `expiresAt` 필드가
  `undefined`이면 도메인 계층 진입 전에 `null`로 정규화한다.
  (`implementation-plan.md` §3의 store/domain 경계에 따라, store는 원본을
  그대로 넘기고 domain의 `Link` 생성/파싱 지점에서 정규화해도 무방하다.
  단, 판정 함수 `isExpired`에 도달하는 시점에는 반드시 `null`로 정규화되어
  있어야 한다.)
- `ExpirationPolicy.isExpired`는 `expiresAt === null`일 때 항상 `false`를
  반환하므로, 정규화만 되면 별도 분기 없이 기존 레코드가 자동으로 무기한
  링크로 동작한다.
- `stats` 응답(`contract-changes.md` §3)에서도 `expiresAt` 필드는 항상
  명시적으로 내려간다 — 필드 누락(`undefined`)이 아니라 `null` 값으로
  직렬화한다.

## 3. Backfill을 하지 않는 이유

- BF-2123에서 도입된 `MemoryLinkStore`는 인메모리 저장소로, 프로세스
  재시작 시 상태가 초기화되므로 "기존 데이터"가 영속되지 않는다 —
  backfill 대상 자체가 없다.
- 향후 영속 저장소(DB 등)를 도입하더라도, "필드 없음 = 무기한"이라는
  규칙은 read-path에서 항상 안전하게 적용 가능하므로 별도 스키마
  마이그레이션(컬럼 추가 + 기존 행 UPDATE) 없이도 하위호환이 보장된다.
  스키마 자체에 `expiresAt` 컬럼을 nullable로 추가하는 것으로 충분하다.

## 4. 롤백 방침

- TTL 기능을 롤백(비활성화)하더라도 저장된 `expiresAt` 값은 무시되고 모든
  링크가 무기한으로 동작하도록 설계한다 — 즉 "필드 없음 = 무기한" 규칙과
  대칭적으로, "판정 로직 비활성화 = 무기한"도 안전하다.
- 롤백 시 별도의 데이터 삭제/복구 작업이 필요하지 않다 (`expiresAt` 값은
  그대로 두어도 무해함 — 판정 로직만 호출되지 않으면 됨).

## 5. Developer 체크리스트

- [ ] store에서 읽은 레코드의 `expiresAt`이 `undefined`인 경우 `null`로
      정규화하는 지점이 정확히 한 곳(domain 경계)에 있는지 확인.
- [ ] `stats` 응답 직렬화 시 `expiresAt` 필드가 누락되지 않고 항상
      `null` 또는 ISO 8601 문자열로 내려가는지 확인.
- [ ] 별도 backfill 스크립트/마이그레이션 파일을 추가하지 않았는지 확인
      (이번 스코프의 non-goal).
