# ADR 0001 — 저장 계층 확장 구조 (LinkStore 팩토리)

## 상태

승인됨 (BF-2123)

## 배경

`link-shortener/src/store/LinkStore.js` 는 `create` / `findBySlug` / `exists` /
`incrementClicks` / `remove` 5 개의 비동기 메서드로 이루어진 계약을 정의하고,
`link-shortener/src/store/FileLinkStore.js` 가 이 계약을 파일 기반(JSON,
쓰기 큐 직렬화)으로 구현하는 유일한 구현체였다.

`FileLinkStore` 단일 구현 구조는 테스트 시 실제 파일 I/O(임시 디렉터리 생성,
정리)를 요구해 테스트 격리·속도에 제약이 있었고, 향후 다른 백엔드(예: 원격
스토리지)를 추가하려면 `FileLinkStore` 를 직접 `new` 하는 모든 호출부를
찾아 수정해야 하는 구조였다.

## 결정

`FileLinkStore` 구현은 그대로 유지한 채, 같은 `LinkStore` 계약을 만족하는
`MemoryLinkStore`(`link-shortener/src/store/memoryLinkStore.js`)를
`Map` 기반으로 추가하고, 두 구현을 선택하는 `createStore` 팩토리
(`link-shortener/src/store/createStore.js`)를 도입했다.

```js
function createStore({ kind = process.env.LINK_STORE || 'file', ...options } = {}) {
  switch (kind) {
    case 'file':
      return new FileLinkStore(options.filePath);
    case 'memory':
      return new MemoryLinkStore();
    default:
      throw new Error(`Unknown LINK_STORE kind: ${kind}`);
  }
}
```

- `kind` 는 `'file' | 'memory'` 만 허용하며, 그 외 값은 즉시 예외를 던진다
  (잘못된 `LINK_STORE` 설정을 조용히 `file` 로 폴백하지 않고 조기에 드러낸다).
- `process.env.LINK_STORE` 는 **`createStore` 내부에서만** 읽는다. 호출부가
  `kind` 를 명시적으로 넘기면 그 값이 env 보다 우선한다.
- `FileLinkStore` 의 생성자 시그니처(`new FileLinkStore(filePath)`)는 변경하지
  않았으므로, `createStore` 는 `options.filePath` 를 그대로 전달한다.
- `createApp` 의 주입 인터페이스(파라미터 시그니처)는 이번 변경으로 전혀
  손대지 않았다. `createApp` 은 인자가 `LinkStore` 계약을 만족하는 객체라는
  것만 신뢰하며, 그 인자가 `FileLinkStore` 인지 `MemoryLinkStore` 인지, 혹은
  `createStore(...)` 를 거쳐 만들어졌는지 알거나 검사하지 않는다. 이 불변식
  덕분에 테스트 코드에서 `createApp(new MemoryLinkStore())` 형태로 실제 파일
  I/O 없이 앱을 구성할 수 있다.
- `link-shortener/test/linkStore.contract.test.js` 는 동일한 계약 테스트
  케이스(`create`/`findBySlug`/`exists`/`incrementClicks`/`remove` 의 정상·예외
  경로)를 함수로 추출해 `FileLinkStore` · `MemoryLinkStore` 양쪽에 대해
  반복 실행하며, `createStore` 의 `kind`/env 분기·우선순위·예외 동작도 같은
  파일에서 검증한다. `FileLinkStore` 케이스는 `node:test` 의 `t.after` 훅으로
  임시 디렉터리를 정리해 테스트 잔존물을 남기지 않는다.

## 대안

- **(A) 호출부마다 `if (env === 'test') ... else ...` 조건 분기를 하드코딩**
  — 분기 지점이 여러 곳으로 흩어져 유지보수 비용이 증가한다. 기각.
- **(B) `FileLinkStore` 를 상속해 `MemoryLinkStore` 를 만듦** — 파일 I/O 관련
  구현 세부사항(쓰기 큐, `_persist`, 임시 파일 rename 등)이 인메모리
  구현에 새어 들어갈 위험이 있고, 계약(인터페이스) 기반 설계보다 결합도가
  높아진다. 기각.
- **(C) 별도 DI 컨테이너 도입** — 현재 프로젝트 규모 대비 과도한 추상화이며
  Simplicity First 원칙에 어긋난다. 기각.
- **(D, 채택) 팩토리 함수 + 공용 계약 테스트** — `createStore` 가 유일한 분기
  지점이 되고, `LinkStore` 계약을 만족하는 구현체가 몇 개로 늘어나든
  `createApp` 이나 다른 호출부를 건드리지 않는다.

## 트레이드오프

팩토리라는 간접 호출 계층이 한 단계 추가되지만, 그 대가로 (1) 테스트에서
파일 I/O 없이 `MemoryLinkStore` 로 앱을 구성할 수 있고, (2) 향후 세 번째
구현체가 추가돼도 변경 지점이 `createStore.js` 하나로 국한된다.
