# TypeScript 코드 퀄리티

본 프로젝트 프론트 (Next.js 16 App Router + TypeScript + React 19) 룰. 출처: Google gts + TypeScript Style Guide (mkosir).

## 타입 안전성

- `any` 금지. 모호한 타입은 `unknown` + 타입 가드
- `as` 단언 / non-null `!` 최소화 — 타입 정의로 해결
- `@ts-ignore` 금지, 불가피하면 `@ts-expect-error` + 사유
- `tsconfig.json` strict 의무 (`strictNullChecks`, `noImplicitAny` 등)
- 타입 정의 `type` 우선, `interface` 는 declaration merging 시만
- 상수 `as const`, 부합 검증은 `as const satisfies Type`
- 명시 타입은 타입을 좁힐 때만, 그 외 inference 신뢰

## 네이밍

| 대상 | 컨벤션 |
|---|---|
| 변수 / 함수 | camelCase |
| Boolean | `is` / `has` / `should` / `can` / `will` prefix |
| 상수 | UPPER_SNAKE_CASE |
| 타입 / 인터페이스 | PascalCase |
| Generic | `T` prefix (`TRequest`) |
| 컴포넌트 / Props 타입 | PascalCase / `{Component}Props` |
| 콜백 prop / 핸들러 구현 | `on*` / `handle*` |
| Hooks / State 쌍 | `use*` / symmetric `[value, setValue]` |

- 약어는 단어 취급 (`FaqList` X `FAQList`, `generateUrl` X `generateURL`)
- 무의미한 이름 금지 — `data`, `result`, `temp`

## 함수

- 단일 책임 + 무상태 + 일관 출력. Pure function 우선
- 위치 인자 6개 초과 → 객체 1개로 묶기. Optional 최소화 — required 우선
- Optional 가짓수 많으면 discriminated union 으로 분기
- Public API 반환 타입 명시, 내부는 inference

## 변수 / 불변성

- `const` 기본, `let` 은 재할당 시만, `var` 금지. 상수에 `as const`
- `ReadonlyArray<T>` / `Readonly<T>` 적극 사용. 데이터 처리는 새 객체 반환 > mutation
- `null` = 명시 "값 없음", `undefined` = 누락
- **`enum` 회피** — 런타임 코드 생성. literal union / `as const` 객체로 대체

## Import / Export

- Named export 의무. Default export 금지 (예외: Next.js page / layout)
- Type-only import 분리: `import type { Foo } from './foo'`
- 멀리는 absolute (`@/...`), 같은 feature 는 relative. 자동 정렬 (`prettier-plugin-sort-imports`)
- Barrel file 신중 — 빌드 시간 / circular dep

## React / Next.js

- Props 는 함수 파라미터에 직접 타입. `React.FC<Props>` 금지
- Props → state 동기 금지 (불가피 시 `initial*` prefix). Prop drilling 회피 — composition / context / URL state
- 데이터 fetching 은 container / page 레벨, 표시 컴포넌트는 props 만
- Server state = React Query, Local UI = Zustand / `useState` (docs/plan §2-1)
- `react-hooks/exhaustive-deps` 활성

## 에러 / 옵션 / 주석

- `Result<T, E>` 또는 discriminated union 으로 에러 표현 — throw 남용 X
- `?.` + `??` 활용 — `??` 는 null/undefined 만 (`||` 와 구분)
- 주석은 "why" 만. 공개 API 는 TSDoc. 임시 코드 `TODO(이슈번호)` + *"임시 — {언제} swap"*

## 도구 / 검증

- ESLint (룰) + Prettier (포매팅), `eslint-config-prettier` extends 마지막
- `tsc --noEmit` 빌드 게이트. Pre-commit: lint-staged + Husky
- `pnpm lint && pnpm typecheck && pnpm test`

## 테스트 (글로벌 `testing-strategy.md`)

- Vitest (단위), Playwright (E2E 골든패스 1건 — docs/plan §2-1)
- RTL: 행위 (`getByRole`, `getByText`) > 구현 (`getByTestId` 최소)
- Mock 은 시스템 경계만 (HTTP `msw`, 시계, 난수). 매핑 / 상태 전이는 TDD HARD-GATE

## 출처

- [Google gts](https://github.com/google/gts) / [TS Style Guide (mkosir)](https://mkosir.github.io/typescript-style-guide/) / [AWS TS Best Practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/best-practices-cdk-typescript-iac/typescript-best-practices.html)
