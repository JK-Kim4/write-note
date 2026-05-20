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

### Next.js 16 App Router server/client component 경계 (HARD-GATE)

- **이벤트 핸들러 prop 을 가진 컴포넌트는 `'use client'` 의무** — `onClick`, `onSubmit`, `onChange`, `onInput`, `onBlur`, `onFocus` 등. server component 가 client component 로 이벤트 핸들러를 prop 으로 직접 전달 시 build fail (`Event handlers cannot be passed to Client Component props`)
- **Hook 호출 컴포넌트는 `'use client'` 의무** — `useState` / `useEffect` / `useRouter` / `useSearchParams` / Zustand `use*` store / React Query `useQuery` / 본 프로젝트 `useAuthGuard`, `useThemeEffect`
- **`<form onSubmit={...}>` 패턴은 폼 컴포넌트가 client 강제** — 정적 외관 placeholder 라도 `<form>` 에 인라인 핸들러가 있으면 client 의무
- **검증 시점**: page 작성 직후 `pnpm build` 실행 (lint 만으로는 RSC 경계 위반 미검출)

#### 회귀 사례 — 2026-05-21 002 frontend route scaffold Phase 3

- form 컴포넌트 4 종 (`LoginForm`, `SignupEmailForm`, `ResetRequestForm`, `ResetNewForm`) 에 `'use client'` 누락 → Phase 3 build 시 `Event handlers cannot be passed to Client Component props` 발견 → 4 파일에 `'use client'` 추가 후 GREEN
- 회피 가능했던 시점: 컴포넌트 작성 시점에 본 룰 active recall — `<form onSubmit>` 또는 `onClick` prop 가 있으면 즉시 `'use client'` 박음

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

## 한국어 영역 검증 cadence (HARD-GATE)

본 프로젝트는 한국어 우선 (DESIGN.md 전제 #5). 한국어 렌더링·입력 영역 변경 시 dogfooding 검증 의무.

### 폰트 / 시스템 fallback chain

- `next/font/google` 의 한국어 폰트 (예: `Noto_Serif_KR`, `Nanum_Myeongjo`) 의 메타데이터 (`node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`) 가 한국어 subset 명시를 미지원 — `subsets: ['latin']` 만 가능
- 따라서 폰트 파일 자체의 한국어 글리프 + 시스템 fallback chain (`"Apple SD Gothic Neo", "Noto Sans KR", system-ui` 등) 의 양쪽 의존
- 폰트 추가 / fallback chain 변경 시 검증: 라이트/다크 양쪽 + iOS Safari + Android Chrome + 한국어 본문 1 문단 표시 확인
- 회피 안티패턴: 메타데이터 정독 없이 `subsets: ['korean']` 추측 적용 → build fail

### TipTap 한국어 IME 회귀 검증

- TipTap extension 추가 / mark 신설 / ProseMirror step 처리 변경 시 PoC 0-1 의 4 케이스 재사용 의무:
  1. 빠른 타자 (IME 조합 중 다음 자모 입력)
  2. 조합 중 mark 적용 (bold 토글)
  3. 한자 변환 (조합 완료 직전 한자)
  4. Backspace 분해 (조합 자모 한 글자 삭제)
- 본 4 케이스 통과 회귀 회피는 `docs/poc/0-1-tiptap-korean.md` 가 SoT

#### 회귀 사례 — 2026-05-21 002 frontend route scaffold Phase 1

- `next/font/google` 의 `Noto_Serif_KR` 메타데이터에 `subsets: ['korean']` 미지원 (`["cyrillic", "latin", "latin-ext", "vietnamese"]` 만) 발견
- `subsets: ['latin']` + 시스템 fallback chain 으로 진행, 한국어 렌더 검증은 dogfooding 영역 (T053) 로 위임
- 회피 가능했던 시점: research.md 작성 시점에 메타데이터 정독 후 fallback chain 정합성 명시 박았더라면

## 출처

- [Google gts](https://github.com/google/gts) / [TS Style Guide (mkosir)](https://mkosir.github.io/typescript-style-guide/) / [AWS TS Best Practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/best-practices-cdk-typescript-iac/typescript-best-practices.html)
