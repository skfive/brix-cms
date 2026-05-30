# brix-CMS — 프로젝트 가이드라인

brix-CMS 는 **NestJS 백엔드 + Next.js 프론트엔드**가 하나의 패키지에 공존하는
하이브리드 모노레포입니다. 두 프레임워크가 **루트 `tsconfig.json` 을 공유**하므로
TypeScript 설정 변경 시 양쪽 영향도를 반드시 함께 고려해야 합니다.

## tsconfig / JSX 가이드라인 (BF-715)

### 배경 — 왜 이 섹션이 있는가
루트 `tsconfig.json` 하나를 다음 도구들이 모두 사용합니다.

| 도구 | 사용 방식 | 필요한 핵심 옵션 |
| --- | --- | --- |
| NestJS 빌드 | `nest build --path tsconfig.nest.build.json` (루트를 `extends`) | `module: commonjs`, `experimentalDecorators`, `emitDecoratorMetadata` |
| ts-jest (단위/e2e) | 루트 tsconfig 로 트랜스파일 | `module: commonjs` |
| Next.js App Router | `next dev` / `next build` 가 루트 tsconfig 의 `.tsx` 컴파일 | `jsx`, `lib: dom`, `paths: @/*`, `esModuleInterop` |

과거 루트 tsconfig 에 `compilerOptions.jsx` 가 없어, Next.js 의 `app/**/*.tsx`
파일이 JSX 플래그 없이 컴파일되며 **TS17004 (Cannot use JSX unless the '--jsx'
flag is provided)** 빌드에러가 발생했습니다.

### 규칙 (MUST)
1. **`compilerOptions.jsx` 는 `"preserve"` 로 고정 — 임의 변경/삭제 금지.**
   Next.js 13+ App Router 는 `preserve` 를 요구합니다. 값을 바꾸거나 제거하면
   TS17004 가 즉시 재발합니다.
2. **NestJS 핵심 옵션을 절대 끄지 말 것**: `module: "commonjs"`,
   `experimentalDecorators: true`, `emitDecoratorMetadata: true`.
   이 값들이 바뀌면 NestJS 의존성 주입과 ts-jest 트랜스파일이 깨집니다.
3. **Next.js 측 옵션은 가산만, 파괴는 금지**: `jsx`, `lib`(dom 포함),
   `paths`(`@/*`), `esModuleInterop` 는 `.ts` 컴파일에 영향을 주지 않는
   가산적 옵션입니다. `module` 을 `esnext` 로 바꾸는 식의 파괴적 변경 대신
   가산적으로만 보강하세요.
4. **`@/*` 별칭은 `["./*"]` 로 유지** — `components.json`(shadcn) 의 alias 와
   일치해야 합니다.

### 변경 전 확인 절차 (체크리스트)
`tsconfig.json` / `tsconfig.*.json` 을 건드리기 전:

- [ ] 변경이 `jsx`, `module`, `experimentalDecorators`, `emitDecoratorMetadata`
      중 하나에 영향을 주는가? → 그렇다면 **중단하고 영향도 재검토.**
- [ ] 회귀 가드 실행: `node --test test/bf-715-jsx-tsconfig-regression.test.js`
- [ ] (가능하면) `pnpm typecheck` (NestJS src) 와 `pnpm build:next` (Next.js) 양쪽 통과 확인.

### 회귀 가드
`test/bf-715-jsx-tsconfig-regression.test.js` 가 위 규칙을 정적으로 검증합니다.
node_modules 없이도 실행되므로 CI/로컬 어디서나 빠르게 확인할 수 있습니다.
