# Implementation Plan: Frontend Route & Page Scaffold

**Branch**: `002-frontend-route-scaffold` | **Date**: 2026-05-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-frontend-route-scaffold/spec.md`

## Summary

Phase 1A 백엔드 위에 V1 wireframe 전체의 진입 가능한 프론트 라우트 골격을 박는다. 산출물: 12 인증 패널 (nested route + shared layout) + 6 메인 view (홈 동적변형 / 작성 단일 URL / 미리보기 자식 route / 메모 inbox / 설정) + H0 빈 홈 상태 + 공유 인프라 (디자인 토큰 / 다크 모드 / React Query / Zustand / fetch 기반 API client + Phase 1A 의 임시 `X-User-Id` 헤더 정합). PoC 검증용 page (`/poc/*`) 는 폐기, production PWA 산출물 (manifest + sw-register) 은 유지. 본 spec 은 정적 wireframe 외관 + 라우트 진입 + 공유 인프라 까지로 범위 한정하며, 도메인 동작 (메모/프로젝트 CRUD, 자동 저장, 검색, 자수 카운팅 등) 은 Week 2~6 별도 phase 영역.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.2.4, Next.js 16.2.6 (App Router)

**Primary Dependencies**:
- 기존: `next@16.2.6`, `react@19.2.4`, `react-dom@19.2.4`, `@tiptap/{react,starter-kit,pm}@^3.23.5`, `tailwindcss@^4`, `@tailwindcss/postcss@^4`, `eslint@^9`, `eslint-config-next@16.2.6`
- 신규 (본 spec 진입 시 설치): `@tanstack/react-query` (server state — `docs/plan/00-stack §2-1` 박힘), `zustand` (client UI state — 동일 출처)
- 폰트: `next/font/google` 으로 Noto Serif KR (본문 프로즈) + Nanum Myeongjo (원고지) 로드, SF Pro Display 는 시스템 fallback (`DESIGN.md §디자인 시스템 / 타이포그래피`)

**Storage**:
- 클라이언트 측 영속 preferences: localStorage via `zustand persist` middleware (`theme`, `writingMode`, `manuscriptSize` 박을 store)
- 서버 데이터: Phase 1A `/api/projects` 호출 결과를 React Query 캐시에 보관 (본 spec 은 placeholder 호출 1 건으로 FR-020 검증 — 풀 사용은 Week 2)

**Testing**:
- 빌드 게이트: `next build` GREEN
- 린트 게이트: `pnpm lint` (eslint-config-next 9) GREEN
- 1:1 시각 대응 검증 (Clarification 2026-05-20 §SC-002 박힘): 디자인 토큰 적용 grep + 컴포넌트 구조 매핑 표 + 라이트/다크 양쪽 육안 비교. visual regression 자동화 도구 도입은 본 spec 영역 밖.
- Vitest / Playwright 본격 도입은 Week 7 영역. 본 spec 은 추가 X.

**Target Platform**: Web (Vercel) + PWA (manifest + service worker 유지). 메인 사용 환경: PC + 패드 (`docs/plan/00-stack §1` 박힘).

**Project Type**: Monorepo web application — 본 feature 는 `frontend/` 만 변경. backend / docker-compose / docs/plan 변경 없음.

**Performance Goals**: 메인 view 간 이동 시 깜빡임 없는 shared layout (SC-008 박힘). 정량 CLS (Cumulative Layout Shift) 측정 기준은 본 spec 영역 밖 (plan-blocking 아님으로 deferred 유지).

**Constraints**:
- Next.js 16 breaking change 경고 (`frontend/AGENTS.md`) — `node_modules/next/dist/docs/` 사전 정독 의무. App Router 의 nested layout / dynamic route / middleware / metadata 패턴은 16.x 기준으로만 결정.
- Phase 1A 의 임시 `X-User-Id` ownership header 와 정합. Week 1B-5 에서 authenticated principal 로 교체.
- 외부 데이터 스토어 (DB / redis) 쓰기 직접 호출 없음 (본 spec 은 frontend 전용, backend `/api/projects` 호출만).
- TipTap PoC 산출물 (`/poc/tiptap`) 폐기. production manifest + sw-register 는 유지 (Clarification 2026-05-20 §Q1).
- 도메인 동작 (메모 캡처, 자동 저장, 자수 카운팅 등) 구현 금지 — Week 2~6 영역.

**Scale/Scope**:
- 19 surface — 12 인증 nested route + 6 메인 view + H0 변형 1 개
- 단일 개발자 dogfooding V1. 다중 사용자는 V1 출시 후 Phase 2 영역 (`docs/plan/00-stack §1`)
- 사용자 시각 검증 surface 수 = 19. plan 의 SC-001 측정 단위.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` 는 default placeholder 상태로 비활성. 본 feature 의 effective gates 는 프로젝트 SoT 와 글로벌 룰에서 도출:

- **Context persistence gate**: 본 spec 의 모든 산출물 (spec / plan / research / data-model / contracts / quickstart / checklists) 을 `specs/002-frontend-route-scaffold/` 에 박는다. 루트 `AGENTS.md` / `CLAUDE.md` 의 SPECKIT 마커를 본 plan 으로 갱신.
- **Safety gate**: `.env*` Read X, 시크릿 echo X, 외부 DB/redis 쓰기 직접 호출 X (본 spec 은 frontend 전용으로 자연 우회). `.claude/rules/infra/external-infra-safety.md` 적용.
- **Quality gate**: `next build` + `pnpm lint` GREEN 의무. 1:1 시각 대응은 디자인 토큰 grep + 육안 비교 (Clarification 2026-05-20 §SC-002 박힘).
- **Wireframe SoT gate**: 19 surface 모두 [`DESIGN.md §화면 구성`](../../DESIGN.md), [`DESIGN.md §추가된 13개 패널`](../../DESIGN.md), [`designs/wireframe.html`](../../designs/wireframe.html) 와 1:1 매핑. plan 의 contracts/route-surfaces.md 에 매핑 표 박음.
- **Phase 분해 정합 gate**: 본 spec 은 wireframe 전체 라우트 골격을 한 spec 으로 묶지만 (사용자 C-2 결정), 도메인 동작은 Week 2~6 phase 분해 정합 유지. plan 의 Project Structure 에서 후속 phase 가 채울 영역을 placeholder 로 명시.
- **Next.js 16 docs 정독 gate**: `frontend/AGENTS.md` 의 breaking change 경고 적용. App Router 의 nested layout / route handler / middleware / metadata 사용 시 `node_modules/next/dist/docs/` 사전 정독 의무.
- **Scope gate**: 인증 실제 동작 (OAuth2 / JWT / 5회 실패 정책 / 이메일 발송) 은 Week 1B-1~6 백엔드 + 본 spec 의 클라이언트 폼 보강 영역. 메모 캡처·큐레이션·자동 저장은 Week 4~5. 본 plan 은 placeholder 형태로 정적 외관만 박는다.

**Initial gate status: PASS**. Complexity Tracking 위반 없음.

## Project Structure

### Documentation (this feature)

```text
specs/002-frontend-route-scaffold/
├── spec.md                  # /speckit-specify + /speckit-clarify 결과
├── plan.md                  # 본 파일 (/speckit-plan)
├── research.md              # Phase 0 결정 사항
├── data-model.md            # Phase 1 — 클라이언트 측 상태 모델
├── quickstart.md            # Phase 1 — 셋업 + 검증 명령
├── contracts/
│   ├── route-surfaces.md    # 19 surface ↔ wireframe panel/view 1:1 매핑
│   └── api-client.md        # Phase 1A `/api/projects` 호출 contract (Result<T> envelope unwrap + 임시 X-User-Id)
└── checklists/
    └── requirements.md      # /speckit-specify 단계 산출
```

### Source Code (repository root)

```text
frontend/
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── next.config.ts
├── postcss.config.mjs
├── AGENTS.md                  # Next.js 16 breaking change 경고 (변경 없음)
├── CLAUDE.md                  # `@AGENTS.md` 1 줄 (변경 없음)
├── public/
│   └── icons/                 # PWA 아이콘 (기존)
└── src/
    ├── app/
    │   ├── layout.tsx                       # Root layout — providers (QueryClient, theme, store) + 폰트 + 메타
    │   ├── globals.css                      # 디자인 토큰 CSS variables + Tailwind 4 @theme directive
    │   ├── manifest.ts                      # PWA manifest (기존, 유지)
    │   ├── sw-register.tsx                  # Service worker 등록 (기존, 유지)
    │   ├── page.tsx                         # 홈 — 동적 변형 (프로젝트 0 → H0, 1+ → 일반 홈)
    │   ├── not-found.tsx                    # 임의 URL fallback
    │   ├── auth/
    │   │   ├── layout.tsx                   # 인증 공통 shell (브랜드 블록 + 카드 컨테이너)
    │   │   ├── login/page.tsx
    │   │   ├── signup/page.tsx              # 메서드 선택 step-1
    │   │   ├── signup-email/page.tsx        # 이메일 폼 step-2
    │   │   ├── reset-request/page.tsx
    │   │   ├── reset-sent/page.tsx
    │   │   ├── reset-new/page.tsx
    │   │   ├── reset-done/page.tsx
    │   │   ├── verify-pending/page.tsx
    │   │   ├── verify-done/page.tsx
    │   │   ├── login-error/page.tsx
    │   │   ├── signup-error/page.tsx
    │   │   └── login-loading/page.tsx
    │   ├── write/
    │   │   ├── layout.tsx                   # top bar (프로젝트 타이틀 / 진행 ring / 미리보기 / 사이드 토글) + 사이드 패널 골격
    │   │   ├── page.tsx                     # 작성 — 설정 모드 따라 manuscript vs editor layout 분기
    │   │   └── preview/page.tsx             # 미리보기 (sticky footer + 편집 복귀)
    │   ├── memos/
    │   │   └── page.tsx                     # 메모 inbox (필터 칩 + 카드 expand 큐레이션 폼 정적 외관)
    │   └── settings/
    │       └── page.tsx                     # 설정 (작성 / 일반 / 계정 3 그룹)
    ├── components/
    │   ├── ui/                              # wireframe 컴포넌트 1:1 매핑
    │   │   ├── BrandBlock.tsx
    │   │   ├── SuccessBlock.tsx
    │   │   ├── AlertError.tsx
    │   │   ├── FormError.tsx
    │   │   ├── FormInput.tsx
    │   │   ├── SubmitLoading.tsx
    │   │   ├── EmptyHero.tsx                # H0 + 빈 inbox 공용
    │   │   └── HintCard.tsx
    │   ├── shell/
    │   │   ├── TopBar.tsx
    │   │   ├── SidePanel.tsx
    │   │   └── ProgressRing.tsx
    │   ├── auth/
    │   │   └── PanelLink.tsx                # 패널 간 인라인 해결 경로 링크 (예: `이미 가입된 이메일입니다. 로그인하기 →`)
    │   └── theme/
    │       └── ThemeToggle.tsx              # 라이트 / 다크 / 시스템 따라가기
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts                    # fetch wrapper + Result<T> envelope unwrap + 임시 X-User-Id header 주입
    │   │   └── projects.ts                  # `/api/projects` placeholder query 1 건 (FR-020 검증용)
    │   ├── auth/
    │   │   └── guard.ts                     # 라우트 가드 placeholder (인증 여부 신호만, Week 1B 에서 JWT 로 swap)
    │   └── query/
    │       └── QueryProvider.tsx            # React Query QueryClientProvider (`'use client'`)
    ├── stores/
    │   ├── preferences.ts                   # Zustand persist — theme, writingMode, manuscriptSize
    │   └── ui.ts                            # Zustand — transient UI state (sidePanelOpen 등)
    ├── styles/
    │   └── tokens.css                       # 디자인 토큰 CSS variables (globals.css 에서 import) — 색상/타이포/radius/spacing
    └── types/
        └── api.ts                           # Result<T> / ErrorInfo / Page<T> (Phase 1A backend contract 와 정합)
```

**Structure Decision**: 본 spec 은 monorepo 의 `frontend/` 만 변경하며, Next.js 16 App Router 의 file-system routing convention 을 따른다. 인증은 `app/auth/<panel>/page.tsx` 12 개 자식 route + `app/auth/layout.tsx` 공통 shell (Clarification §Q2). 작성은 `app/write/page.tsx` 단일 URL + `app/write/preview/page.tsx` 자식 route (Clarification §Q3). 빈 홈 (H0) 은 `app/page.tsx` 의 동적 변형 (Clarification §Q4). PoC 검증용 page (`app/poc/*`) 폐기. production PWA 산출물 유지.

`components/` 와 `lib/` 와 `stores/` 와 `styles/` 와 `types/` 는 본 spec 신설. wireframe 디자인 컴포넌트는 `components/ui/`, 공유 shell 은 `components/shell/`. API 클라이언트·Auth 가드·React Query provider 는 `lib/`.

## Complexity Tracking

위반 / 복잡성 예외 없음.

## Phase 0: Research

See [research.md](./research.md). 본 plan 의 핵심 결정:

- `frontend/AGENTS.md` 의 Next.js 16 breaking change 경고에 따라 App Router 의 nested layout / dynamic route / middleware / metadata API 는 `node_modules/next/dist/docs/` 정독 후 결정.
- 다크 모드 mechanism 은 직접 구현 (CSS variables + `class="dark"` toggle + Zustand persist) 우선. `next-themes` 는 SSR FOUC 회피 패턴이 검증된 경우 옵션으로 채택.
- 폰트 로딩은 `next/font/google` 로 Noto Serif KR + Nanum Myeongjo, SF Pro Display 는 시스템 fallback (cost / license 안전).
- Tailwind 4 의 `@theme` directive 로 디자인 토큰 정의 (CSS variables 와 일관).
- 인증 가드 placeholder 는 client-side `useEffect` 기반 redirect 로 시작 (middleware 도입은 Week 1B 실제 JWT 후).
- API client 는 `lib/api/client.ts` 의 fetch wrapper + `types/api.ts` 의 `Result<T>` envelope unwrap. 임시 `X-User-Id` header 는 Zustand placeholder store 에서 주입.
- `frontend/src/app/poc/*` (TipTap, PWA) 검증용 page 폐기 (Clarification §Q1).

## Phase 1: Design & Contracts

설계 산출물:

- [data-model.md](./data-model.md) — 클라이언트 측 상태 모델 (UI Preferences / Auth Session placeholder / Transient UI state / Server state via React Query). 새 도메인 entity 없음.
- [contracts/route-surfaces.md](./contracts/route-surfaces.md) — 19 surface 의 URL ↔ wireframe panel/view 1:1 매핑 + 공유 shell ↔ 자식 컴포넌트 위계.
- [contracts/api-client.md](./contracts/api-client.md) — Phase 1A `/api/projects` 호출 contract. `Result<T>` envelope unwrap + 임시 `X-User-Id` header 주입 + Week 1B 에서 swap 명시.
- [quickstart.md](./quickstart.md) — 의존성 설치 / 디자인 토큰 적용 / 다크 모드 토글 / 19 surface 진입 확인 / `next build` + `pnpm lint` GREEN 검증.
- 루트 `AGENTS.md` 와 `CLAUDE.md` 의 SPECKIT 마커를 본 plan 으로 갱신.

**Post-design gate status: PASS**.

본 plan 은 인증 실제 동작 / 메모 캡처·큐레이션 / 자동 저장 / 자수 카운팅 / 검색 / 새 프로젝트 만들기 모달 / 세션 종료 모달 / 빠른 입력 모달 / 등장인물·메타 관리 페이지 / E2E 골든패스 / 프로덕션 배포 / PWA 캐시 전략 / visual regression 자동화 도구 도입 — 모두 본 spec 영역 밖으로 deferred. 박힌 deferred 항목들은 [`docs/plan/01-phase-breakdown.md`](../../docs/plan/01-phase-breakdown.md) Week 1B~7 phase 분해에 정합.
