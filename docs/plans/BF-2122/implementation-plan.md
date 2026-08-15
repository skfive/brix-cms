# BF-2124 — 저장 계층 확장 실행 설계

## 0. 컨텍스트 및 확인된 사실

- `link-shortener/src/store/` 에는 이미 `LinkStore.js`(계약 정의로 추정)와
  `FileLinkStore.js`(파일 기반 단일 구현체)가 존재함을 디렉터리 목록으로 확인했다.
- 이번 Run 의 context-widening 예산(maxCalls=3) 이 디렉터리 목록 조회 단계에서
  소진되어 두 파일의 **정확한 메서드 시그니처는 직접 확인하지 못했다.**
  아래 설계는 "두 파일이 이미 어떤 계약(예: `get/set/list/delete` 류의
  비동기 메서드 집합)을 통해 상호 교체 가능하다"는 전제 위에서 **기존 계약
  메서드 이름·시그니처를 절대 변경하지 않는다**는 제약만으로 구성했다.
  developer 는 구현 착수 전 `LinkStore.js` 실제 내용을 먼저 확인하고, 아래
  설계의 "계약 메서드" 부분을 실제 메서드 목록으로 그대로 치환해 적용한다.
  (계약 메서드 이름 자체를 바꾸는 결정은 이 설계의 범위 밖이다.)

## 1. 목표

`FileLinkStore` 단일 구현 구조를 유지한 채, 같은 `LinkStore` 계약을 만족하는
`MemoryLinkStore` 를 추가하고, 두 구현을 환경에 따라 선택할 수 있는
`createStore` 팩토리를 도입한다. `createApp` 의 주입 인터페이스는 변경하지
않는다.

## 2. 목표 아키텍처

### 2.1 `createStore` 팩토리 시그니처

```js
// link-shortener/src/store/createStore.js
function createStore({ kind = process.env.LINK_STORE || 'file', ...options } = {}) {
  switch (kind) {
    case 'file':
      return new FileLinkStore(options);
    case 'memory':
      return new MemoryLinkStore(options);
    default:
      throw new Error(`Unknown LINK_STORE kind: ${kind}`);
  }
}

module.exports = { createStore };
```

- `kind` 는 `'file' | 'memory'` 만 허용한다. 그 외 값은 즉시 예외를 던진다
  (조용히 `file` 로 폴백하지 않는다 — 잘못된 env 설정을 조기에 드러내기 위함).
- `options` 는 각 구현체 생성자에 그대로 전달한다 (예: `FileLinkStore` 의
  파일 경로 옵션). 팩토리는 옵션의 의미를 해석하지 않는다.
- 반환값은 항상 `LinkStore` 계약을 만족하는 인스턴스이며, 호출부는 반환된
  인스턴스가 `file` 구현인지 `memory` 구현인지 알 필요가 없다.

### 2.2 `LINK_STORE` 환경변수 처리 위치

- **`createStore` 팩토리 내부에서만** `process.env.LINK_STORE` 를 읽는다
  (기본값 `'file'`). `createApp` 이나 서버 엔트리포인트, 그 외 다른 위치에서
  `process.env.LINK_STORE` 를 직접 참조하지 않는다 — env 처리 지점을 한 곳으로
  고정해 나중에 store 종류가 늘어나도 변경 지점이 하나로 유지되게 한다.
- 호출부에서 `kind` 를 명시적으로 넘기면 그 값이 env 보다 우선한다
  (함수 인자가 환경변수보다 우선하는 일반 규칙을 따름).

### 2.3 `createApp` 주입 인터페이스 불변 방안

- **불변식: `createApp` 의 파라미터 시그니처(예: `createApp(store, ...)`)는
  이번 리팩토링 전후로 완전히 동일하게 유지한다.** `createApp` 은 자신에게
  주입된 인자가 `LinkStore` 계약을 만족하는 객체라는 것만 신뢰하고, 그 인자가
  `FileLinkStore` 인스턴스인지 `MemoryLinkStore` 인스턴스인지, 혹은
  `createStore(...)` 를 거쳐 만들어졌는지 여부를 알거나 검사하지 않는다.
- 서버 엔트리포인트(현재 `FileLinkStore` 를 직접 `new` 해서 `createApp` 에
  넘기는 코드)만 `new FileLinkStore(...)` 호출을 `createStore({ kind: ... })`
  호출로 교체한다. `createApp` 함수 정의 자체는 한 줄도 수정하지 않는다.
- 이 불변식을 지키면 테스트 코드에서 `createApp(createStore({ kind: 'memory' }))`
  형태로 실제 파일 I/O 없이 앱을 구성할 수 있게 된다 (이번 확장의 핵심 동기).

## 3. 파일 배치

| 경로 | 상태 | 역할 |
| --- | --- | --- |
| `link-shortener/src/store/LinkStore.js` | 기존, 무변경 | `LinkStore` 계약 정의 |
| `link-shortener/src/store/FileLinkStore.js` | 기존, 무변경 | 파일 기반 구현체 |
| `link-shortener/src/store/memoryLinkStore.js` | 신규 | 인메모리 구현체 (`Map` 기반, 프로세스 생명주기 동안만 유지) |
| `link-shortener/src/store/createStore.js` | 신규 | `kind`/env 분기 팩토리 |
| `link-shortener/test/linkStore.contract.test.js` | 신규 | `FileLinkStore` · `MemoryLinkStore` 공용 계약 테스트 스위트 |
| `docs/adr/0001-link-store-extensibility.md` | 신규 (developer 또는 후속 담당이 작성) | 이번 결정의 배경/대안/트레이드오프 기록 |

기존 파일 두 개는 이번 설계에서 **읽기 전용 취급**이며 수정 대상이 아니다
(계약을 그대로 유지하는 것이 이번 확장의 전제 조건).

## 4. 계약 테스트 스위트 구조 및 실행 방식

- `link-shortener/test/linkStore.contract.test.js` 는 `node:test` 기반으로,
  **테스트 케이스를 함수로 추출**해 구현체 배열을 순회하며 동일 테스트를
  두 번(파일/메모리) 실행하는 구조를 취한다:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FileLinkStore } = require('../src/store/FileLinkStore');
const { MemoryLinkStore } = require('../src/store/memoryLinkStore');

const implementations = [
  { name: 'FileLinkStore', create: () => new FileLinkStore({ /* 테스트용 임시 경로 옵션 */ }) },
  { name: 'MemoryLinkStore', create: () => new MemoryLinkStore() },
];

for (const { name, create } of implementations) {
  test(`${name} — LinkStore 계약 준수`, async (t) => {
    const store = create();
    // 기존 LinkStore.js 가 정의하는 계약 메서드를 그대로 호출해 검증한다.
    // (계약 메서드 목록은 developer 가 착수 전 LinkStore.js 를 읽고 확정한다.)
  });
}
```

- **실행 방식**: focused test scope 컨벤션에 맞춰
  `node --test link-shortener/test/linkStore.contract.test.js` 로 단독 실행
  가능해야 하며, 저장소 전체 focused 테스트 러너
  (`node --test tests/link-shortener-*.test.js` 패턴 또는 동등한 module-scoped
  명령)에도 자연스럽게 포함되도록 파일 위치를 `link-shortener/test/` 아래에
  둔다.
- `FileLinkStore` 케이스는 테스트 간 파일 잔존물이 남지 않도록 임시
  디렉터리(예: `node:test` 의 `t.after` 훅에서 정리)를 사용해야 한다. 이
  스위트가 기존 `FileLinkStore` 전용 테스트(존재한다면)를 대체하는 것은
  아니며, "두 구현체가 동일 계약을 만족하는지"만 검증하는 별도 스위트다.

## 5. 마이그레이션 순서 (developer TDD 단계)

1. **선행 확인**: `link-shortener/src/store/LinkStore.js` 를 읽고 실제 계약
   메서드 목록을 확정한다 (§0 에서 명시한 미확인 전제를 해소).
2. **실패하는 계약 테스트 작성**: `linkStore.contract.test.js` 를 작성하되
   `MemoryLinkStore` 는 아직 없으므로 해당 케이스는 실패(또는 스킵)한다.
   `FileLinkStore` 케이스는 이 시점에 통과해야 한다 (기존 계약을 건드리지
   않았음을 보장하는 회귀 가드 역할).
3. **`MemoryLinkStore` 구현**: `Map` 등 인메모리 자료구조로 계약 메서드를
   구현해 계약 테스트를 통과시킨다.
4. **`createStore` 팩토리 구현**: §2.1/§2.2 시그니처대로 구현하고, 팩토리
   자체에 대한 단위 테스트(`kind` 미지정 시 env 사용, 잘못된 `kind` 예외 등)를
   추가한다.
5. **엔트리포인트 교체**: 서버 엔트리포인트의 `new FileLinkStore(...)` 를
   `createStore({ kind: 'file', ...기존옵션 })` 로 교체한다. `createApp` 함수
   정의는 수정하지 않는다 (§2.3 불변식).
6. **회귀 확인**: 기존 `link-shortener` focused 테스트 전체와 신규 계약
   테스트가 모두 통과하는지 확인한다.
7. **ADR 작성**: `docs/adr/0001-link-store-extensibility.md` 를 §6 개요에
   따라 작성한다.

## 6. ADR(`docs/adr/0001-link-store-extensibility.md`) 작성 개요

- **결정 배경**: `FileLinkStore` 단일 구현은 테스트 시 실제 파일 I/O 를
  요구해 테스트 격리·속도에 제약이 있고, 향후 다른 백엔드(예: 원격 스토리지)
  추가 시 호출부 곳곳을 수정해야 하는 구조였다.
- **대안 비교**:
  - (A) 호출부마다 `if (env === 'test') ... else ...` 조건 분기를 하드코딩 →
    분기 지점이 여러 곳으로 흩어져 유지보수 비용 증가, 기각.
  - (B) `FileLinkStore` 를 상속해 `MemoryLinkStore` 를 만듦 → 파일 I/O 관련
    구현 세부사항이 인메모리 구현에 새어 들어갈 위험, 계약(인터페이스) 기반
    설계보다 결합도가 높아짐, 기각.
  - (C) 별도 DI 컨테이너 도입 → 현재 프로젝트 규모 대비 과도한 추상화,
    Simplicity First 원칙 위반, 기각.
  - **(D, 채택) 팩토리 함수 + 공용 계약 테스트**: `createStore` 가 유일한 분기
    지점이 되고, `LinkStore` 계약을 만족하는 구현체는 몇 개가 늘어나든
    `createApp` 이나 다른 호출부를 건드리지 않는다.
- **트레이드오프**: 팩토리라는 간접 호출 계층이 한 단계 추가되지만, 그
  대가로 (1) 테스트에서 파일 I/O 없이 앱을 구성할 수 있고 (2) 향후 세 번째
  구현체가 추가돼도 변경 지점이 `createStore.js` 하나로 국한된다.
