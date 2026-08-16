# BF-2150 · 링크 저장소 스키마 v2 마이그레이션 설계

## 배경

`src/links/stores/fileLinkStore.js` 는 slug 를 key 로 하는 flat JSON 파일에 링크
레코드를 저장한다. `src/links/expiry.js` 의 `normalizeLink()` 로 확인한 v1 레코드는
`slug`, `hits`, `expiresAt` 필드를 가지며, `schemaVersion` · `createdAt` · `tags`
개념이 존재하지 않는다. 본 문서는 이 v1 레코드를 v2 스키마로 안전하게 전환하기
위한 필드 매핑, 정규화 경계, 실패 시 상태 전이를 규정한다.

## 1. v1 → v2 필드 매핑표

| v1 상태 | v2 필드 | 타입 | 채우는 규칙 |
| --- | --- | --- | --- |
| 없음 | `schemaVersion` | number | 상수 `2` 로 설정. v1 레코드는 이 필드 자체가 없으므로 **필드 부재 = v1** 을 버전 판별 기준으로 삼는다 |
| 없음 | `createdAt` | string (ISO 8601) | 원본에 생성 시각 정보가 없으므로 **마이그레이션 실행 시각**(`new Date().toISOString()`)으로 backfill 한다. 실제 최초 생성 시각의 근사치이며 정확한 복원이 불가능함을 마이그레이션 로그에 남긴다 |
| 없음 | `tags` | string[] | 기본값 `[]`. v1 에는 태그 개념이 없다 |
| `slug`, `hits`, `expiresAt` 등 기존 필드 | 동일 필드명 유지 | — | 값 그대로 복사, 파괴적 변경 금지 |

정규화는 **순수 함수**로 구현하며 (`src/storage/schemaV2.js`), 이미 v2 인 레코드를
입력하면 값 변경 없이 그대로 반환해야 한다 (idempotent).

## 2. lazy 정규화 vs migrate:v2 일괄 변환 경계

### lazy 정규화 (읽기 시점)
- 저장소에서 레코드를 읽어 API/도메인 레이어로 반환하기 **직전**, 메모리 상에서만
  v1 → v2 shape 으로 정규화해 응답한다.
- **저장 파일(JSON)은 절대 rewrite 하지 않는다** — 디스크 상태는 불변이다.
- `migrate:v2` 를 아직 실행하지 않은 환경에서도 서비스가 v2 shape 을 일관되게
  반환하도록 하는 backward-compat 읽기 계층이다.

### migrate:v2 일괄 변환 (쓰기 시점, `scripts/migrate-v2.js`)
- 명시적으로 실행하는 배치 스크립트로, 저장 파일 전체를 읽어 v2 shape 으로 변환한
  뒤 **저장 상태 자체를 v2 로 바꾸는 유일한 경로**다.
- 원본을 직접 덮어쓰지 않고 반드시 `백업 생성 → temp 파일에 변환 결과 기록 →
  temp 파일 무결성 검증 → 검증 통과 시에만 atomic rename 으로 원본 교체` 순서를
  따른다 (자세한 순서는 3절).

### 경계 원칙
lazy 정규화가 존재해도 `migrate:v2` 실행이 불필요해지는 것은 아니다 (매 요청마다
정규화 오버헤드 발생 + 저장 포맷 불일치 지속). 반대로 `migrate:v2` 실행 전에도
서비스가 깨지지 않아야 하므로 lazy 정규화 경로는 `migrate:v2` 실행 이후에도 계속
유지한다 (이미 v2 인 레코드에 대해서는 idempotent no-op).

## 3. 실패 시나리오별 상태 전이

상태: `PRE_MIGRATION → BACKUP_CREATED → MIGRATING → VALIDATING → COMMITTED(SUCCESS)`
정상 경로 외에 아래 3가지 실패 분기를 갖는다.

### 3.1 백업 실패 (원본 백업 생성 자체가 실패 — 디스크 공간 부족, 권한 오류 등)
- 전이: `PRE_MIGRATION → BACKUP_FAILED` (터미널 상태)
- 원본 파일에는 어떤 쓰기도 수행하지 않는다 (백업 이전이므로 원본 불변은 자동 보장)
- **exit code: 비0**
- 롤백 대상 자체가 없으므로 자동 롤백은 수행하지 않는다 — 재시도 가능한 상태로 종료

### 3.2 부분 변환 실패 (레코드 다건 중 일부에서 변환 도중 예외 — 손상된 JSON 값, 예기치 않은 타입 등)
- 전이: `MIGRATING → PARTIAL_FAILURE → AUTO_ROLLBACK → ROLLED_BACK`
- 변환은 all-or-nothing: 부분적으로 변환된 결과를 원본 경로에 **절대 커밋하지 않는다**
  (temp 파일 단계에서 폐기하므로 원본은 애초에 아직 안 바뀐 상태)
- 자동 롤백: 3.1에서 만든 백업 파일을 원본 경로로 복원 (temp 파일이 아직 rename
  되지 않았다면 이 단계는 사실상 no-op 확인용 재검증이 된다)
- **exit code: 비0**
- 롤백 자체가 실패하면 (예: 디스크 오류) → `ROLLBACK_FAILED` 로 전이, 비0 exit +
  백업 파일 경로를 명시한 에러 로그 출력 후 종료 (사람 개입 필요, 이 경우만 예외적으로
  자동 복구를 포기한다)

### 3.3 무결성 검증 실패 (변환 완료 후, temp 파일에 대해 레코드 수 불일치 · 필수 필드
누락 · JSON 파싱 불가 등을 검증 단계에서 발견)
- 설계상 **원본 교체 전에 temp 파일에 대해 검증**하므로(쓰기 전 검증), 검증
  실패 시점에는 원본이 아직 바뀌지 않은 상태다.
- 전이: `VALIDATING → INTEGRITY_FAILURE` (terminal, 원본 불변이므로 롤백 불필요)
- 처리: temp 파일 삭제, 원본 파일은 그대로 유지
- **exit code: 비0**

> 설계 결정: "쓰기 후 검증" 대신 "temp 파일 + atomic rename" 방식을 채택해
> 무결성 실패 시 롤백 자체가 필요 없도록 설계한다. 이는 developer 가 재정의할 수
> 없는 frozen 설계 결정이다.

## 4. developer 소유 파일 (BF-2149 구현 범위)

| 경로 | 역할 |
| --- | --- |
| `scripts/migrate-v2.js` | 일괄 변환 CLI 진입점: 인자 파싱, `src/storage/migrate.js` 호출, 상태별 exit code 결정 |
| `scripts/migrate-rollback.js` | 사후 수동 롤백 CLI: 백업 파일 경로를 인자로 받아 원본을 복원 |
| `src/storage/migrate.js` | 백업 생성 · temp 파일 변환 · 무결성 검증 · atomic rename · 상태 전이 오케스트레이션 (2, 3절 로직) |
| `src/storage/schemaV2.js` | v1 → v2 순수 정규화 함수 (1절 매핑표 구현). lazy 정규화 읽기 경로와 `migrate:v2` 배치 변환이 이 함수를 공유 |
| `test/migrate.test.js` | 성공 / 백업 실패 / 부분 변환 실패 / 무결성 검증 실패 / 롤백, 각 케이스의 상태 전이·exit code·원본 불변성 검증 |
| `test/schemaV2.test.js` | 정규화 순수 함수 단위 테스트: 매핑표대로의 필드 채움, 기존 필드 보존, idempotency |

developer 는 위 필드 매핑표(1절)와 상태 전이 설계(3절)를 재정의하지 않고 그대로
구현한다.
