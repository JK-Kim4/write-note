# 002 Frontend Route & Page Scaffold — wireframe 19 surface + 공유 인프라

- 일자: 2026-05-21
- 워크트리 / 브랜치: 메인 / `002-frontend-route-scaffold`
- 관련 PR / 커밋: `a9d6c8d` (구현 일괄) + 본 회고 commit (별도)
- 작업 시간 (대략): 본 세션 (2026-05-20 시작 ~ 2026-05-21 마무리, 단일 워크트리)
- 진입 시점 상태: V1 wireframe + Phase 1A backend foundation (`acd7d3e`) 완료, frontend Next.js 16 스켈레톤만 + PoC 검증용 `/poc/*` 2 페이지

## 1. 무엇을 했는가 (사실)

### Speckit 산출물 (`specs/002-frontend-route-scaffold/`)

- `spec.md` — 4 user story (P1 인증 / P2 메인 / P3 작성 / P4 공유 인프라) + 23 FR + 9 SC + 8 edge case
- `checklists/requirements.md` — spec 단계 quality checklist, 16 항목 PASS
- 5 clarification 박음 (PoC 처리 / 인증 라우팅 구조 / 작성 모드 mechanic / H0 진입점 / 1:1 시각 측정)
- `plan.md` — Technical Context + Constitution Check + Project Structure (frontend `src/app|components|lib|stores|styles|types` 트리)
- `research.md` — 9 결정 (App Router nested route / 작성 단일 URL / H0 동적 변형 / Tailwind 4 토큰 / 다크 모드 직접 구현 / next/font/google / 가드 placeholder / API client / PoC 폐기 / 측정 기준)
- `data-model.md` — 클라이언트 상태 모델 (UI Preferences / Auth Session Placeholder / Transient UI / Server state via React Query)
- `contracts/route-surfaces.md` — 19 surface ↔ wireframe panel/view ↔ React 컴포넌트 트리 1:1 매핑 + 가드 적용 표
- `contracts/api-client.md` — Phase 1A `/api/projects` 호출 contract + envelope unwrap + 임시 X-User-Id swap 정합
- `quickstart.md` — 셋업 → 폐기 → 토큰 → 라우트 → 6 단계 검증 절차
- `tasks.md` — 57 task / 7 phase. 52 자동화 완료 + 5 dogfooding 대기

### Frontend 구현 (`frontend/`)

- 의존성 추가: `@tanstack/react-query@5.100.11`, `zustand@5.0.13`
- 폐기: `frontend/src/app/poc/{tiptap,pwa}/page.tsx` 2 파일 (검증 기록은 `docs/poc/0-1*.md`, `0-3*.md` 영구화)
- 12 인증 nested route 신설 (`app/auth/{login,signup,signup-email,reset-{request,sent,new,done},verify-{pending,done},login-error,signup-error,login-loading}/page.tsx`)
- 6 메인 view + 1 fallback 신설 (`app/page.tsx` H0 동적 변형 / `app/memos/page.tsx` / `app/settings/page.tsx` / `app/not-found.tsx` / `app/write/layout.tsx` / `app/write/page.tsx` 모드 분기 / `app/write/preview/page.tsx`)
- Shared layout 2 신설 (`app/auth/layout.tsx` + `app/write/layout.tsx`)
- Providers wrapper (`app/providers.tsx`) — server/client 경계 분리
- Root layout 갱신 — 폰트 + FOUC 회피 inline script + Providers
- 디자인 시스템 컴포넌트 8 (`components/ui/`)
- 인증 재사용 컴포넌트 7 (`components/auth/`)
- Shell 3 (`components/shell/`) + ThemeToggle 1 (`components/theme/`)
- Stores 3 (`stores/{preferences,authPlaceholder,ui}.ts`)
- Library 4 (`lib/api/{client,projects}.ts` + `lib/auth/guard.ts` + `lib/query/QueryProvider.tsx`)
- 디자인 토큰 (`styles/tokens.css` light/dark scope + `globals.css` Tailwind 4 `@theme inline` 위임)
- 공유 타입 (`types/api.ts`)

### 검증

- `pnpm lint` GREEN (EXIT=0)
- `pnpm build` GREEN — Next.js 16.2.6 Turbopack 21 static page 생성
- 디자인 토큰 grep — 9 토큰 모두 매핑
- 라우트 가드 적용 확인 — `requireAnon` (auth/layout) / `requireAuth` (home, memos, settings, write layout)

### 문서 갱신

- `docs/plan/02-progress.md` — 002 산출물 + 5 clarification 결정 + dogfooding 5 영역 + 다음 진입점 트랙 A/B 박음
- `AGENTS.md` + `CLAUDE.md` SPECKIT 마커 — 002 plan 으로 갱신

### Commit

- `a9d6c8d feat: 002 frontend route scaffold — wireframe 19 surface + 공유 인프라`

## 2. 어떻게 했는가 (접근)

- speckit 워크플로우 (`specify → clarify → plan → tasks → implement`) 직렬 진행
- Phase 단위로 분리하되, 본 spec 의 frontend scaffold 특성상 도메인 로직이 거의 없어 phase 별 일괄 작성 + 검증 cadence
- 추측 위험 영역 (다크 모드 mechanism / 폰트 subsets / Next.js 16 server-client 경계) 은 본 시점에 코드/메타데이터 직접 확인 후 결정 — `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json` 정독 등
- `subagent-delegation-cost.md` 의 게이트 적용 → 본 spec 작업이 단일 BC + 단일 워크트리 + 사용자가 단계별 진행 의지 → orchestrator 직접 구현 (subagent dispatch X) — 정합
- 각 Phase 종료마다 `pnpm lint` + `pnpm build` 검증 → 다음 phase 진입 결정
- 사용자 컨펌 cadence: phase 진입 직전 옵션 송출 + default 명시 → 사용자가 letter 또는 "진행" 응답
- 5 dogfooding task 는 사용자 환경 (브라우저 / iOS / Android / 육안) 영역으로 명시 분리 → 자동화 영역만 본 turn 완료

## 3. 잘 된 점

1. **Clarification 5 질문 모두 SoT 인용 + 검증된 정보로 권장 옵션 박음** — 도구 syntax 추측 위험을 메타데이터 직접 확인 (`font-data.json` / wireframe.html grep / DESIGN.md 인용) 후 옵션 표 구성. 5 질문 모두 사용자가 권장 옵션 그대로 채택 → 정보 비대칭 회피.

2. **Phase 단위 검증 cadence 가 build/lint fail 1 건만 발생시킴** — Phase 3 진입 후 `pnpm build` 시 Next.js 16 의 server→client `onSubmit` 차단 발견 → 즉시 form 컴포넌트 4 종에 `'use client'` 추가 → 다음 build GREEN. fail 발견 시점이 즉시 였고 root cause 명확 (Next.js 16 docs 정독으로 사전 차단 가능했음).

3. **공유 인프라 (Phase 2) 가 모든 후속 phase 의 boilerplate 회피** — Stores / API client / Theme / Providers 가 Phase 2 에 박힘 → Phase 3~5 의 page 들이 import 1 줄로 사용. dependency 순서 의도 정합.

4. **dogfooding 영역과 자동화 영역 명시 분리** — Phase 6 / Phase 7 의 5 task 가 사용자 환경 (브라우저 / iOS / 시스템 외관) 영역임을 식별 → 본 turn 에서 무리 안 함 + 사용자에게 명시 인계 + tasks.md 에 🔵 마킹 + 02-progress 트랙 A 로 박음.

## 4. 어긋난 점

### 4-1. 사용자 멈춤 신호 — 0회

본 세션 전반 (specify 부터 implement 마무리까지) 사용자 stop 신호 (`잠깐만 / 왜 ~ 했어? / step N 다시 봐 / ~ 인거 맞아?`) 0 회. 사용자 letter 응답 / 진행 / 디폴트 응답으로 단계 진행. 단정 단계 회귀 없음.

### 4-2. `frontend/AGENTS.md` 경고와 실제 패키지 구조 불일치 — 회피 가능했던 시점

- AGENTS.md (이전 PoC 시점 작성) 이 `node_modules/next/dist/docs/` 정독을 의무화했으나 본 시점 install 결과에 그 디렉토리 **없음** (compiled docs 가 다른 위치로 이동됐거나 패키지에서 빠짐)
- 본 spec implement 진입 직후 발견 → 별도 트랙으로 surfacing (02-progress 의 dogfooding 영역 외 별도)
- **회피 가능했던 시점**: speckit-specify / plan 단계에서 frontend/AGENTS.md 의 경고를 검증 하는 task 가 박혀있었더라면 본 implement 진입 전 발견 가능
- **본 spec 영역에서 미해결** — Phase 7 polish 또는 별도 회고 트랙

### 4-3. 한국어 폰트 subset 메타데이터 한계 — dogfooding 영역으로 위임

- `next/font/google` 의 `Noto Serif KR` 메타데이터에 `korean` subset 명시 미지원 (`["cyrillic", "latin", "latin-ext", "vietnamese"]` 만)
- `subsets: ['latin']` 박고 진행 → 폰트 파일 자체의 한국어 글리프에 의존
- **회피 가능했던 시점**: research.md 작성 시점에 메타데이터를 정독했더라면 명시적으로 "korean subset 미지원 — fallback chain 필수" 박을 수 있었음
- 실제로는 implement 진입 후 발견 → research.md 의 §"폰트 로딩" 결정 사항에 후속 보강 가능

### 4-4. Next.js 16 server-client 경계 사전 차단 실패

- 본 spec 의 form 컴포넌트 (LoginForm / SignupEmailForm / ResetRequestForm / ResetNewForm) 작성 시 `'use client'` 누락
- `pnpm build` 시 `Event handlers cannot be passed to Client Component props` 에러 발견 → 4 파일에 `'use client'` 추가
- **회피 가능했던 시점**: Next.js 16 의 server-client 분리 규칙 정독 (실제로는 frontend/AGENTS.md 가 의무화 / §4-2 와 연결) 또는 plan 단계 research.md 에 "form 컴포넌트는 client component 강제" 박았더라면 차단 가능
- 비용: build 1 회 추가 + edit 4 회. 작은 비용이라 본 spec 진행 차단 X

### 4-5. wireframe.html 의 정확한 HTML/CSS 구조 정독 미수행

- 본 spec 의 컴포넌트 외관은 props 시그니처 + 디자인 토큰 + 일반적인 UI 패턴 기반 placeholder
- wireframe.html 의 정확한 layout (px / gap / radius / margin) 1:1 매핑은 본 spec implement 영역에서 미수행
- **회피 가능했던 시점**: Phase 별 컴포넌트 작성 시점에 wireframe.html 의 해당 영역 grep 후 inline CSS 정확화 가능. 단 비용 큼 (wireframe 3000+ 줄)
- **본 spec 영역에서 의도 deferred** — T053 (19 surface 1:1 시각 비교) 의 사용자 dogfooding 영역에서 보강 결정

### 4-6. 토큰 비용 / 시간 — 정량 검토 없음

- 본 세션 누적 도구 호출 횟수 / 토큰 / 시간 정량 측정 미수행
- subagent dispatch 0 회 → 위임 비용 ~25,000 토큰 × N 절약. 단 orchestrator 직접 진행이라 메인 컨텍스트 누적 큼
- **추정**: 본 회고 산출 시점까지 도구 호출 ~80~100 회 / 토큰 ~150,000~200,000 (추정)
- 다음 동급 작업 시 정량 측정 + 비용 회고 의무

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

1. **frontend spec 진입 시 `node_modules/<framework>/docs/` 또는 패키지 메타데이터 실제 존재 검증 task 박기** — frontend/AGENTS.md 같은 사전 경고와 실제 패키지 구조 불일치 회피.
2. **Next.js 16 App Router 의 form/event handler/server-client 경계 룰을 본 프로젝트 룰 파일 (`.claude/rules/typescript/`) 에 박기** — 본 회고의 §4-4 회귀 차단.
3. **한국어 폰트 / IME 영역은 dogfooding 검증 trigger 의무화** — `next/font/google` 의 메타데이터 한계, TipTap 한국어 IME 회귀, 시스템 fallback chain 등 한 영역에 집중 검증 cadence 박기.
4. **본 spec 의 dogfooding 5 영역 (다크 모드 19 surface / 시스템 테마 / placeholder query / wireframe 1:1 / PWA) 종료 후 본 spec close** — 자동화 검증만으로 close 시 spec 의 SC-001~009 일부 (시각 1:1 / PWA 정합 / 다크 모드 일관 / placeholder 동작) 검증 부족.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

본 회고에서 surfacing 한 룰 갱신 후보. **사용자 컨펌 전까지 룰 파일 수정 금지.**

#### 후보 1 — TypeScript 코드 퀄리티 룰에 Next.js 16 server-client 경계 박기

- **갱신 대상**: `.claude/rules/typescript/code-quality.md` (본 프로젝트 룰)
- **추가 룰 본문**:
  > ### Next.js 16 server/client component 경계
  > - 이벤트 핸들러 (`onClick`, `onSubmit`, `onChange` 등) prop 을 가지는 컴포넌트는 `'use client'` 의무
  > - `form` 안에 `onSubmit={...}` 가 있으면 그 컴포넌트는 client. server component 가 prop 으로 직접 전달 시 build fail
  > - Hooks (`useState`, `useEffect`, `useRouter`, Zustand `use*` store) 호출 컴포넌트도 client 의무
- **근거 회귀 사례**: 본 회고 §4-4 — 002 spec implement Phase 3 후 build fail 발견 → 4 파일에 `'use client'` 추가

#### 후보 2 — 프로젝트 본질 정의 문서 정합성 검증 룰 박기

- **갱신 대상**: `.claude/rules/shared/agent-workflow-discipline.md` (본 프로젝트 룰)
- **추가 섹션 (§5)**:
  > ### 5. 프로젝트 본질 정의 문서의 실제 정합성 검증
  > spec / implement 진입 시 본질 정의 문서 (`AGENTS.md`, `CLAUDE.md`, framework-specific 경고 등) 가 실제 코드베이스 / 패키지 구조와 정합한지 검증 후 진행 의무.
  > - 검증 가능 영역: 명시된 파일 경로 / 메서드 / 패키지 docs 실제 존재 여부
  > - 불일치 발견 시 즉시 별도 트랙 (정정 / 후속 회고) 박음
- **근거 회귀 사례**: 본 회고 §4-2 — `frontend/AGENTS.md` 의 `node_modules/next/dist/docs/` 경고와 실제 install 결과 불일치

#### 후보 3 — 한국어 폰트 / IME 영역 dogfooding trigger 의무화 룰

- **갱신 대상**: 본 프로젝트 `CLAUDE.md` 또는 `.claude/rules/typescript/code-quality.md`
- **추가 룰 본문**:
  > ### 한국어 영역 검증 cadence
  > - `next/font/google` / 시스템 폰트 fallback chain 변경 시 dogfooding 검증 의무 (라이트/다크 양쪽 + iOS/Android + 한국어 본문 1 문단)
  > - TipTap 한국어 IME 회귀 검증은 PoC 0-1 패턴 (4 케이스: 빠른 타자 / 조합 중 mark / 한자 변환 / Backspace 분해) 재사용 의무
- **근거 회귀 사례**: 본 회고 §4-3 — `Noto Serif KR` / `Nanum Myeongjo` subsets 메타데이터 한계, dogfooding 시점에 fallback chain 동작 검증 필요

---

## 메타 — 다음 세션 진입 가이드

다음 세션 진입 시 본 회고 + [`docs/plan/02-progress.md`](../plan/02-progress.md) + [`specs/002-frontend-route-scaffold/plan.md`](../../specs/002-frontend-route-scaffold/plan.md) + [`CLAUDE.md`](../../CLAUDE.md) 정독으로 컨텍스트 복원.

**즉시 결정 영역:**

1. 002 dogfooding 5 task 진행 (트랙 A) vs Week 1B 인증 백엔드 진입 (트랙 B) — 사용자 결정
2. 본 회고 §5-2 의 3 룰 갱신 후보 컨펌 — 사용자가 채택 결정 시 룰 파일 수정 진행
3. `frontend/AGENTS.md` 갱신 (node_modules/next/dist/docs/ 경고 정정) 트랙 — 별도 작업 단위
