# BF-2109 · link-shortener 결함 3건 원인 분석 및 수정 설계

> 대상 코드: `link-shortener/` (독립 Express 패키지, 루트 tsconfig 모노레포와 무관)
> 목적: developer가 재현 테스트(RED)부터 착수할 수 있도록 결함별 원인·재현 절차·최소 수정 방침·영향 범위를 확정한다.
> 원칙: 신규 기능 추가·리팩토링 확장 금지. 각 결함은 독립적으로, 최소 변경으로 수정한다.

---

## 결함 1 — slug 예측 가능성 (Insecure Randomness)

### 원인
`link-shortener/src/slug.js`의 `generateSlug()`가 `Math.random()`으로 base62 문자를 뽑는다.

```js
const index = Math.floor(Math.random() * BASE62_ALPHABET.length);
```

`Math.random()`은 암호학적으로 안전하지 않은 PRNG(V8 xorshift128+)로, 소수의 출력값만 관찰해도 내부 상태를 추정해 향후 값을 예측할 수 있다(CWE-338). slug는 `GET /:slug`(리다이렉트)와 `GET /api/links/:slug/stats`(비인증 통계 조회)에서 사실상 유일한 접근 키로 쓰이므로, 예측 가능한 slug는 타인의 단축 링크를 추측·열거해 원본 URL과 클릭 통계를 노출시키는 위험으로 이어진다. 무차별 대입(62^7 조합)의 문제가 아니라 **PRNG 예측 가능성** 자체가 근본 원인이다.

### 재현 절차
1. `link-shortener/src/slug.js`의 `generateSlug` 구현을 확인한다 — `Math.random()` 사용을 코드 레벨에서 직접 확인 가능(런타임 예외 없이 항상 재현되는 설계 결함).
2. `generateSlug()`를 다수 호출해 각 문자 선택이 `Math.random()`에서만 파생됨을 확인 — Node.js `crypto` 모듈 등 CSPRNG 경로가 전혀 없음을 정적으로 검증한다.
3. (선택) 동일 프로세스 내에서 `Math.random()` 시퀀스를 관찰한 뒤 `generateSlug()` 출력과 상관관계가 있음을 보여 예측 가능성을 실증한다.

### 최소 수정 방침
- `generateSlug()` 내부의 난수 소스만 Node 내장 `crypto` 모듈(`crypto.randomInt`) 기반으로 교체한다.
- `SLUG_LENGTH`, `BASE62_ALPHABET`, 함수 시그니처, 반환 형식(7자 base62 문자열)은 그대로 유지 — 호출부(`generateUniqueSlug`, `routes/links.js`)는 수정 불필요.
- 신규 의존성 추가 금지(`crypto`는 Node 내장 모듈).

### 영향 범위
- 파일: `link-shortener/src/slug.js` (`generateSlug` 함수 내부만)
- 호출부 영향 없음: `generateUniqueSlug`, `routes/links.js`는 인터페이스 불변이므로 무수정
- 기존 테스트(`test/slug.test.js`)의 길이/패턴 검증은 그대로 통과해야 함 — 형식 불변, 난수 소스만 교체

---

## 결함 2 — 오류 로깅 소실 (Silent Error Swallowing)

### 원인
`link-shortener/src/routes/links.js`의 4개 라우트 핸들러(`POST /api/links`, `GET /api/links/:slug/stats`, `DELETE /api/links/:slug`, `GET /:slug`) 모두 다음 패턴을 사용한다:

```js
} catch (err) {
  internalError(res, '...중 오류가 발생했습니다.');
}
```

`err`를 응답 메시지 생성에도 쓰지 않고, `console.error` 등 어떤 로깅도 호출하지 않은 채 폐기한다. `link-shortener/src/app.js`의 중앙 오류 미들웨어도 동일하다:

```js
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') { ... }
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', ... } });
});
```

여기서도 일반 500 분기에서 `err`를 로깅하지 않는다. 더구나 라우트 핸들러들은 `catch(err)`에서 직접 응답을 만들 뿐 `next(err)`를 호출하지 않으므로, 이 중앙 미들웨어는 애플리케이션 오류에 대해 사실상 도달하지 않고 body-parser의 JSON 파싱 오류(400)에서만 실행된다. 결과적으로 스토어 I/O 실패, 예외 등 500 오류가 발생해도 프로세스 stdout/stderr에 아무 흔적이 남지 않아 운영 중 장애 원인 추적이 불가능하다.

### 재현 절차
1. 테스트에서 `store.create`(또는 다른 store 메서드)가 예외를 던지도록 스텁한다(예: `FileLinkStore`를 감싸 특정 slug에서 `Error`를 throw).
2. 해당 store를 사용하는 `createApp({ store })`로 서버를 띄우고 대응 엔드포인트를 호출해 500 응답을 받는다.
3. 같은 시점의 프로세스 stdout/stderr를 캡처(`console.error`/`console.log` 스파이)해 아무 로그도 기록되지 않았음을 확인한다 — 이것이 RED 상태(로그가 있어야 하는데 없음)다.

### 최소 수정 방침
- `link-shortener/src/routes/links.js`의 4개 `catch (err)` 블록 각각에 `console.error(err)` 한 줄을 추가한다(응답 로직·상태 코드·메시지는 변경하지 않음).
- `link-shortener/src/app.js`의 중앙 오류 미들웨어 중 일반 500 분기(`entity.parse.failed`가 아닌 경우)에도 `console.error(err)`를 추가한다.
- 로깅 프레임워크 도입, 에러 핸들링 구조 통합(예: 모든 라우트가 `next(err)`로 위임하도록 리팩토링)은 이번 범위에서 제외 — 최소 변경 원칙에 따라 각 catch 지점에 로깅만 추가한다.

### 영향 범위
- 파일: `link-shortener/src/routes/links.js`(4개 catch 블록), `link-shortener/src/app.js`(중앙 오류 미들웨어 1곳)
- 응답 바디·상태 코드·기존 테스트(`test/app.test.js`)의 assertion은 변경되지 않음 — 로깅만 추가되는 부가 동작이므로 회귀 위험 낮음

---

## 결함 3 — catch-all 라우트 충돌 (Route Ordering Hazard)

### 원인
`link-shortener/src/routes/links.js`의 `createLinksRouter`는 하나의 Express Router 안에 아래 순서로 라우트를 등록한다.

1. `POST /api/links`
2. `GET /api/links/:slug/stats`
3. `DELETE /api/links/:slug`
4. `GET /:slug` ← 리다이렉트용 catch-all, **파일 최하단**

Express는 라우트를 등록 순서대로 매칭하므로 현재는 구체적 경로(1~3)가 catch-all(4)보다 먼저 등록되어 있어 우연히 충돌 없이 동작한다. 그러나 이 정합성은 **"catch-all이 항상 파일의 마지막 줄에 있어야 한다"는 암묵적 불변식**에만 의존하며, 이를 강제하는 코드 상 가드나 테스트가 전혀 없다. 코드를 이어서 추가할 때 가장 자연스러운 위치는 파일 하단, 즉 현재 catch-all 다음이다 — 그 위치에 단일 세그먼트 `GET` 라우트(예: `GET /health`, `GET /sitemap.xml`)를 추가하면 Express는 그보다 먼저 등록된 `GET /:slug`를 항상 우선 매칭하므로 새 라우트는 영구히 도달 불가능해지고, 대신 "slug를 찾을 수 없습니다"라는 오해의 소지가 있는 404 JSON이 반환된다. 또한 `isValidCustomSlug`(4~32자 영숫자/하이픈)는 `api` 등 예약어를 명시적으로 차단하지 않는다 — 현재 `api`(3자)는 최소 길이 제약에 우연히 걸려 충돌이 없을 뿐, 의도된 예약어 보호가 아니다.

이는 CLAUDE.md에 기록된 BF-715 tsconfig 회귀(암묵적 불변식이 깨져 TS17004 재발)와 동일한 유형의 문제 — **정적으로 강제되지 않는 순서 의존 설계**다.

### 재현 절차
1. `link-shortener/src/routes/links.js`에서 4개 라우트의 등록 순서를 정적으로 확인한다 — `GET /:slug`가 파일 내 마지막 `router.*` 호출임을 검증.
2. (구조적 재현) `GET /:slug` 등록 이후에 임시로 단일 세그먼트 `GET` 라우트(예: `router.get('/health', ...)`)를 추가하고 요청 시 해당 핸들러가 아니라 catch-all이 응답함을 테스트로 보여준다 — 이는 오늘 코드베이스에서 즉시 재현 가능한 구조적 결함이다.
3. `isValidCustomSlug('apis')`처럼 4자 이상 커스텀 슬러그가 예약어 검증 없이 그대로 통과함을 확인한다 — 예약어 보호가 존재하지 않음을 증명.

### 최소 수정 방침
- `link-shortener/src/routes/links.js`의 `GET /:slug` 등록부 바로 위에 "이 라우터에서 반드시 마지막에 위치해야 한다"는 불변식 주석을 추가한다.
- 정적 회귀 가드 테스트를 추가해 `router.get('/:slug', ...)` 등록이 파일 내 다른 모든 `router.*` 등록보다 뒤에 오는지 소스 텍스트 기준으로 검증한다(BF-715 `test/bf-715-jsx-tsconfig-regression.test.js`와 동일한 패턴 — node_modules 없이 정적 파싱만으로 검증).
- 라우터를 `/api` 하위로 분리 마운트하는 구조 변경, 예약어 차단 로직 신설 등은 최소 변경 범위를 초과하므로 이번 결함 수정에서 제외한다.

### 영향 범위
- 파일: `link-shortener/src/routes/links.js`(주석 추가), 신규 회귀 가드 테스트 파일 1개(`link-shortener/test/` 하위)
- 기존 4개 라우트의 동작·응답은 변경되지 않음 — 순서를 강제하는 가드만 추가되므로 회귀 위험 없음

---

## 종합 — 수정 순서 및 검증

| 결함 | 수정 파일 | 위험도 | 비고 |
| --- | --- | --- | --- |
| 1. slug 예측 가능성 | `src/slug.js` | 보안(높음) | 인터페이스 불변, 난수 소스만 교체 |
| 2. 오류 로깅 소실 | `src/routes/links.js`, `src/app.js` | 운영(중간) | 응답 불변, 로깅만 추가 |
| 3. catch-all 라우트 충돌 | `src/routes/links.js` + 신규 가드 테스트 | 유지보수(중간) | 현재 라우트 동작 불변, 회귀 가드만 추가 |

3건은 서로 다른 파일/함수에 국한되어 독립적으로 RED→GREEN 진행 가능하다. 기존 테스트(`test/app.test.js`, `test/slug.test.js`, `test/store.test.js`)는 모두 계속 통과해야 하며, 각 결함마다 최소 1개의 신규 RED 테스트를 추가해 GREEN으로 전환하는 것을 완료 기준으로 한다.
