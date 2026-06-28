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
- **빈 상태(empty-state) 안내는 화면 컨텍스트 유지 + 오버레이가 default** — 빈 리스트/캔버스/보드의 안내는 그 화면의 컨텍스트(격자·툴바·헤더 등)를 **유지한 채 위에 얹는다**(`pointer-events-none` 컨테이너 + 액션 버튼만 `pointer-events-auto`). "빈 화면 노출 금지" 류 요구를 "화면 전체를 흰 화면으로 가린다"로 해석 금지 — **전체 화면 takeover(별도 페이지처럼 덮기)는 사용자가 명시 요청할 때만**. 회귀: 2026-06-27 044 보드 빈 보드 안내를 1차로 `bg-white inset-0` 전체 takeover 로 만들어 "별도 흰 페이지"가 됨 → 사용자 2회 멈춤("보드 위 안내여야지 새 페이지가 아니다") → 투명 비차단 오버레이로 정정.
- **화면을 덮는 모달/오버레이는 stacking 부모의 자손이 아닌 portal(`createPortal(document.body)`)로 분리** — 모달/시트/풀스크린 오버레이(`fixed inset-0` 등)를 카드·리스트 아이템·`relative`+`z-*`·`transform` 등 stacking context 를 만드는 부모의 자손으로 렌더하면 (a) 자식 `z-index` 가 부모 내부 stacking 에서만 유효해 **형제 요소가 모달을 덮어 클릭이 그 형제로 샌다**(시각상 모달이 위여도), (b) 부모 `transform` 조상이 `fixed` 를 viewport 기준에서 가둔다. 모달 컴포넌트 **자체에 portal 을 내장**해 여러 호출처를 일괄 안전화한다. 클릭이 의도한 요소가 아닌 형제/뒤 요소로 새는 버그는 `stopPropagation` 가드로 1차 시도하되, **재현이 지속되면 stopPropagation 이전에 stacking context(시각상 위여도 형제에 덮였는지)를 관찰로 확인**한다(systematic-debugging — 2회 헛수정 시 추측 중단·관찰).

#### 회귀 사례 — 2026-06-28 047 공유 모달 stacking 누수

- `SharePopover`(작품 카드·시리즈 타일의 자손)가 `PublicWorkPicker`·`AuthorCommentInbox`(`fixed inset-0` 모달)를 자기 JSX 안에 렌더 → 형제 타일이 팝오버 버튼을 덮어 "새 공유 링크 만들기" 클릭이 뒤 카드로 새고(드릴인), 작품 선택 모달 체크박스 토글이 무력화. closest 가드·z-index 로 **2회 헛수정** 후 영상 프레임 관찰로 형제 stacking 확정 → `createPortal(document.body)` 일원화로 근본 해결.
- 회피 가능 시점: 카드/타일 위 풀스크린 모달 설계 시 처음부터 portal. 또는 1차 수정 재현 직후 stacking 관찰(2회 헛수정 정지 신호).
- **커스텀 훅 반환 객체/함수를 `useCallback`/`useEffect` deps 에 직접 넣지 말 것** — 커스텀 훅(예: `useDocumentSession`)이 매 렌더 새 인스턴스를 반환하면, 그것을 deps 로 잡은 `useCallback`/effect 가 매 렌더 새로 생성·실행된다. 반환 함수가 미안정이면 **ref 로 안정화**(`const xRef = useRef(x); useEffect(() => { xRef.current = x; })` 후 `xRef.current` 참조)하거나, 훅이 반환 함수를 `useCallback` 으로 안정화한다. **effect 가 부모 setState 를 호출하는 경우 deps 불안정 = 무한 렌더 → JavaScript heap OOM** 으로 직결된다.

#### 회귀 사례 — 2026-06-14 022 챕터 BChapterEditor 무한루프 OOM

- `BChapterEditor` 의 `handleReload`/`handleOverwrite` `useCallback` deps 에 `session`(`useDocumentSession` 반환, 매 렌더 새 객체)을 넣음 → 그 핸들러가 매 렌더 새 함수 → `onConflict` effect(deps `[session.conflict, handleReload, handleOverwrite]`)가 매 렌더 실행 → page `setConflictHandlers`(매번 새 객체) 무한 → 재렌더 무한 → 전체 vitest 가 `ERR_IPC_CHANNEL_CLOSED`/heap OOM 으로 죽음. (A형 `ChapterEditor` 는 conflict 를 내부 렌더라 무한 없음.)
- 해결: `session` 을 ref 로 안정화하고 두 핸들러의 deps 에서 제거 → `onConflict` effect 가 `session.conflict` 변경 시에만 실행. 회피 가능 시점: 컴포넌트 작성 시 훅 반환값의 deps 안정성 점검(특히 effect 가 부모 setState 를 호출할 때).

### Next.js 16 App Router server/client component 경계 (HARD-GATE)

- **이벤트 핸들러 prop 을 가진 컴포넌트는 `'use client'` 의무** — `onClick`, `onSubmit`, `onChange`, `onInput`, `onBlur`, `onFocus` 등. server component 가 client component 로 이벤트 핸들러를 prop 으로 직접 전달 시 build fail (`Event handlers cannot be passed to Client Component props`)
- **Hook 호출 컴포넌트는 `'use client'` 의무** — `useState` / `useEffect` / `useRouter` / `useSearchParams` / Zustand `use*` store / React Query `useQuery` / 본 프로젝트 `useAuthGuard`, `useThemeEffect`
- **`<form onSubmit={...}>` 패턴은 폼 컴포넌트가 client 강제** — 정적 외관 placeholder 라도 `<form>` 에 인라인 핸들러가 있으면 client 의무
- **검증 시점**: page 작성 직후 `pnpm build` 실행 (lint 만으로는 RSC 경계 위반 미검출)

#### 회귀 사례 — 2026-05-21 002 frontend route scaffold Phase 3

- form 컴포넌트 4 종 (`LoginForm`, `SignupEmailForm`, `ResetRequestForm`, `ResetNewForm`) 에 `'use client'` 누락 → Phase 3 build 시 `Event handlers cannot be passed to Client Component props` 발견 → 4 파일에 `'use client'` 추가 후 GREEN
- 회피 가능했던 시점: 컴포넌트 작성 시점에 본 룰 active recall — `<form onSubmit>` 또는 `onClick` prop 가 있으면 즉시 `'use client'` 박음

### 라우트 구조 변경 후 typecheck — 빌드 캐시 재생성 (HARD-GATE)

정적 타입 검증이 빌드 산출물 캐시에 의존하는 빌드 시스템(Next.js `.next/types`)에서는, **라우트 파일(`page.tsx`·`layout.tsx` 등)을 제거·이동한 뒤 typecheck 전에 빌드 캐시를 재생성**한다(`rm -rf .next` 또는 `pnpm build`). 캐시의 `validator.ts` 가 사라진 라우트의 생성 타입을 참조해 **거짓 typecheck 실패**가 난다. dev 서버가 떠 있으면 먼저 중지(캐시 동시 접근 혼선).

#### 회귀 사례 — 2026-06-24 037 settings 라우트 제거

- `settings/page.tsx` 제거(마이페이지로 흡수) 후 `.next/types/validator.ts` 가 `'.../(main)/settings/page.js'` 를 참조 → typecheck 거짓 실패 2회. `rm -rf .next`+build 로 해소.
- 회피 가능했던 시점: 라우트 파일 제거 직후 typecheck 전 `.next` 재생성.

## 에러 / 옵션 / 주석

- `Result<T, E>` 또는 discriminated union 으로 에러 표현 — throw 남용 X
- `?.` + `??` 활용 — `??` 는 null/undefined 만 (`||` 와 구분)
- 주석은 "why" 만. 공개 API 는 TSDoc. 임시 코드 `TODO(이슈번호)` + *"임시 — {언제} swap"*

### 공용 fetch 래퍼 status 분기 — error.code 기준 (HARD-GATE)

공용 HTTP 클라이언트(`client.ts` 등)에서 HTTP status(409 / 400 등)로 분기할 때, **같은 status 에 여러 도메인 에러코드가 공존**하므로 status 단독 분기 금지 — 응답 `error.code` 로 분기한다. 신규 status 분기 추가 시 **해당 status 를 쓰는 기존 에러코드 grep 의무**(`docs/plan/03-backend-requirements.md` §3-1 에러 코드 매트릭스 확인).

#### 회귀 사례 — 2026-05-31 006 US1 client.ts 409 오분류

- `client.ts` 에 자동저장 충돌용 409 분기를 추가하며 **모든 409 를 `DOCUMENT_VERSION_CONFLICT`(ConflictError) 로 던짐**
- 그러나 409 는 `EMAIL_ALREADY_REGISTERED` / `KAKAO_ALREADY_LINKED` 도 공유 → 이메일 중복 회원가입(`SignupEmailForm`)이 깨짐
- fix: 409 분기를 `error.code === "DOCUMENT_VERSION_CONFLICT"` 일 때만 ConflictError, 그 외는 기존 `ApiError(code, message)` 흐름 복원
- 회피 가능했던 시점: 409 분기 작성 시 03-backend 에러 매트릭스의 409 행(3개 코드) grep

### 자동저장 dirty 판정 — 직렬화 왕복 idempotence (HARD-GATE)

에디터 모델 ↔ 저장 포맷(예: ProseMirror JSON) **양방향 변환**을 자동저장의 dirty 판정(`body !== serverBody`)에 쓸 때, **왕복이 비정규화면 로드 즉시 거짓 dirty** 가 난다 — 사용자가 타자 치기 전부터 baseline 이 이탈해 거짓 저장이 나가고, 다른 결함(stale flush 등)과 겹치면 작성분 유실로 번진다. 변환을 **idempotent** 하게 만들거나, baseline(`serverBody`)을 **현재 body 와 동일한 변환으로 정규화**해 맞춘다.

#### 회귀 사례 — 2026-06-15 024 자체 에디터 저장 유실

- `pmJsonToModel(modelToPmJson(...))` 왕복이 **빈 문서 `{"content":[]}` 를 `{"content":[{"paragraph"}]}` 로 비정규화** → 프레시 챕터 로드 즉시 `body !== serverBody` 거짓 dirty → 자동저장이 baseline 을 빈 문서에서 밀어냄.
- 거기에 셸의 stale 빈본문 flush(전환 시)가 겹쳐 작성분이 빈 draft 로 덮임 → 복귀 시 유실.
- fix: `serverBody` 를 `modelToPmJson(pmJsonToModel(doc.bodyJson))` 로 정규화해 baseline 과 body 를 같은 형태로 → 로드 시 not-dirty.
- 회피 가능했던 시점: BCustomChapterEditor 결선 시 "왕복이 idempotent 인가 / baseline 을 같은 변환으로 정규화했는가" 점검(결정론적 왕복 테스트 1회).

### 이탈/언로드 flush — 경로별 보장 차등 + 멱등 백스톱 (HARD-GATE)

화면 이탈/페이지 언로드 시 미동기화 비동기 작업(자동저장 등)을 **flush** 해야 할 때, 모든 이탈 경로를 한 방식으로 동기화하려 하면 race·헤더·캐시 갭이 누적된다. 경로를 **await 가능성**으로 갈라 보장을 차등한다:

- **await 가능 경로**(앱 내 버튼/링크/프로그램 네비) — 이탈 직전 flush 완료를 **await 한 뒤 네비**한다. 정상 저장 경로(공용 client)를 타 보안 헤더·응답 기반 캐시 갱신을 함께 얻는다(강한 보장).
- **await 불가 경로**(브라우저 뒤로가기/탭닫기/`pagehide`) — 동기 보장이 불가하므로 **best-effort flush + 멱등 백스톱**으로 수렴시킨다. 백스톱 = **자기 동작이 만든 상태 변화를 진짜 충돌로 오인하지 않는 화해**(예: 낙관적 동시성에서 저장 충돌 시 서버 현재값이 내가 보낸 값과 같으면 = 내 flush 가 먼저 안착한 것 → 다이얼로그 대신 토큰 조용히 채택). 로컬 보존(draft 등)이 항상 안전망으로 남아야 한다.

원칙: **세션 밖에서 일어나는 저장은 그 세션의 캐시/토큰을 반드시 함께 전진**시킨다. 안 그러면 재진입이 stale 캐시를 읽어 자가 충돌이 난다. raw fetch 로 공용 client 를 우회하면 (a) 보안 헤더 누락, (b) 응답으로 캐시 미갱신 두 함정을 동시에 만든다.

#### 회귀 사례 — 2026-06-23 033 집필실 이탈 유실/충돌

- 1차 시도(전량 롤백): 이탈 시 **세션 밖 raw keepalive PUT** → (a) CSRF 헤더 누락 403, (b) 헤더 추가 후엔 서버 version 만 전진하고 React Query 캐시(staleTime:Infinity)는 미갱신 → 재진입이 stale version 로드 → 다음 저장 **자가 409 충돌**. 같은 증상을 다른 가설로 반복 수정하다 롤백.
- 해결: `flushNow(): Promise<void>`(공용 client 경유, 응답으로 캐시 version 전진)를 만들어 **버튼 이탈은 await-후-네비**, **뒤로가기는 언마운트 best-effort + 거짓충돌 백스톱**(서버 currentBody === 내 본문이면 조용히 채택)으로 수렴. dogfooding 5/5(세 이탈 경로 글자수 즉시 동기 + 재진입 충돌 없음).
- 회피 가능했던 시점: 1차 설계 시 "이탈 저장이 캐시/토큰을 함께 전진시키는가 / await 불가 경로의 자가충돌을 멱등 백스톱으로 닫았는가" 점검. 회고: `~/obsidian/write-note/retrospectives/2026-06-23-autosave-exit-flush-resolution.md`.

### 서버 cascade가 정리하는 자식 행을 프론트가 중복 삭제 금지 (HARD-GATE)

부모 삭제 시 백엔드가 자식 행을 **cascade 정리**(DB FK `ON DELETE CASCADE` 등)한다면, 프론트는 그 자식의 삭제 요청을 **중복으로 보내지 않는다**. 부모 삭제와 자식 삭제가 동시에 발화하면 **racy** — 보통 자식은 이미 사라져 404가 오고 멱등 처리로 가려지나, 드물게 동시삭제 타이밍이 **비-404 transient**를 만들어 거짓 에러를 표면화한다. 자식 삭제는 백엔드 cascade에만 위임하고, 프론트는 로컬 상태만 정리한다(독립적인 자식 단독 삭제 경로는 그대로 삭제 요청).

#### 회귀 사례 — 2026-06-27 046 연결카드 삭제 거짓 토스트

- 보드 카드 삭제 시 React Flow 가 `onNodesDelete`(deleteCard)+`onEdgesDelete`(deleteLink)를 동시 발화. 백엔드는 카드 삭제 시 FK CASCADE 로 연결선을 이미 정리하므로 프론트 deleteLink 는 중복·racy → 보통 404(044 `isNotFoundError` 억제)지만 드물게 비-404 transient 로 거짓 "연결 끊기 실패" 토스트(실제 삭제는 정상, reseed 가 화면 복원). 메인 페이지 미재현·간헐.
- fix: 삭제 중 카드 id ref 기록 + `onEdgesDelete` 마이크로태스크 지연으로 cascade 연결선의 deleteLink 생략(콜백 순서 무관, 백엔드 cascade 에만 위임). `03-ISSUES` ISSUE-052.
- 회피 가능 시점: 낙관 삭제 + 서버 cascade 결합부 설계 시 "프론트가 cascade 자식을 중복 삭제하는가" 점검.

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
