---
description: "Task list for Frontend Route & Page Scaffold implementation"
---

# Tasks: Frontend Route & Page Scaffold

**Input**: Design documents from `/specs/002-frontend-route-scaffold/`

**Prerequisites**: spec.md, plan.md (필수), research.md, data-model.md, contracts/route-surfaces.md, contracts/api-client.md, quickstart.md

**Tests**: spec 에 명시적 test 작성 요구 없음. 검증은 `next build` + `pnpm lint` + 디자인 토큰 grep + 라이트/다크 육안 비교 (Clarification 2026-05-20 §SC-002). 자동화 test 추가는 본 spec 영역 밖 (Vitest/Playwright 은 Week 7).

**Organization**: User Story 별 phase. US4 (P4 공유 인프라) 의 기술 산출물은 dependency 순서상 Foundational (Phase 2) 에 합류 + US4 phase 는 가시적 검증 task 만 보유.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일 / 미완 의존 없음 → 병렬 가능
- **[Story]**: 본 task 가 속한 user story (US1~US4). Setup / Foundational / Polish 는 label 없음
- File path 의무 명시 (모두 `frontend/` 기준 상대 경로)

## Path Conventions

- Web app monorepo — 본 spec 은 `frontend/` 만 변경
- 모든 path 는 repo root 기준 (`frontend/src/...`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 의존성 설치 + PoC 폐기 + 폰트·토큰 셋업

- [X] T001 신규 production 의존성 설치 — `cd frontend && pnpm add @tanstack/react-query zustand` (verify: `frontend/package.json` dependencies 에 두 패키지 명시)
- [X] T002 PoC 검증용 page 폐기 — `rm -rf frontend/src/app/poc` (Clarification §Q1, FR-021 정합 — manifest/sw-register 는 유지)
- [X] T003 [P] 디자인 토큰 CSS 변수 셋업 — `frontend/src/styles/tokens.css` 생성 (DESIGN.md §디자인 시스템 의 색상/타이포/radius/hairline/active scale 토큰 박음)
- [X] T004 [P] globals.css 갱신 — `frontend/src/app/globals.css` 에 `@import '../styles/tokens.css'` + Tailwind 4 `@theme` directive 로 토큰 위임 (`--color-accent: var(--w-accent)` 등 다크 모드 toggle 호환)
- [X] T005 [P] 폰트 로딩 셋업 — `frontend/src/app/layout.tsx` 에 `next/font/google` 로 Noto Serif KR + Nanum Myeongjo 로드, SF Pro Display 는 시스템 fallback CSS chain 으로 처리 (DESIGN.md §타이포그래피)

**Checkpoint**: 의존성 설치 + PoC 정리 + 토큰·폰트 인프라 준비 완료

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 user story 의 기반이 되는 공유 인프라 — Providers / API client / Stores / 가드 placeholder / Root layout / 디자인 컴포넌트 (US4 의 기술 산출물은 dependency 순서상 본 phase 에 합류, US4 phase 는 가시적 검증만 보유)

**⚠️ CRITICAL**: 본 phase 완료 전 어떤 user story phase 도 진입 금지

### 공유 타입 + Store

- [X] T006 [P] 공유 API 타입 정의 — `frontend/src/types/api.ts` 에 `Result<T>`, `ErrorInfo`, `Page<T>`, `ProjectResponse` 박음 (Phase 1A backend contract 1:1 정합 — `specs/001-phase-1a-backend-scaffold/contracts/project-api.md`)
- [X] T007 [P] Preferences store 생성 — `frontend/src/stores/preferences.ts` Zustand persist (`theme`, `writingMode`, `manuscriptSize` — localStorage key `writenote.preferences.v1`. data-model.md §1)
- [X] T008 [P] Auth placeholder store 생성 — `frontend/src/stores/authPlaceholder.ts` Zustand persist (`userId: string | null`, localStorage key `writenote.auth.placeholder.v1`. data-model.md §2)
- [X] T009 [P] Transient UI store 생성 — `frontend/src/stores/ui.ts` Zustand (`sidePanelOpen`, `currentWritingScroll` — persist 없음. data-model.md §3)

### API client + Auth guard

- [X] T010 [P] API client wrapper — `frontend/src/lib/api/client.ts` 에 `apiFetch<T>` + `withAuthHeaders` (envelope unwrap + `X-User-Id` 자동 주입 + `ApiError` throw. contracts/api-client.md §4)
- [X] T011 [P] Projects placeholder query — `frontend/src/lib/api/projects.ts` 에 `listProjects` (`/api/projects?page=0&size=20&sort=updatedAt,desc`. contracts/api-client.md §5-1)
- [X] T012 [P] Auth route guard placeholder — `frontend/src/lib/auth/guard.ts` 에 `useAuthGuard()` hook (인증 필요 영역 미인증 시 `/auth/login` redirect, `/auth/*` 인증 상태 시 `/` redirect. research.md §"인증 라우트 가드 placeholder")

### React Query Provider

- [X] T013 [P] React Query Provider — `frontend/src/lib/query/QueryProvider.tsx` `'use client'` 컴포넌트, QueryClient 인스턴스 + QueryClientProvider (research.md §"React Query 5 + React 19")

### 디자인 시스템 컴포넌트 (wireframe 1:1 매핑 기반 — components/ui/)

- [X] T014 [P] BrandBlock 컴포넌트 — `frontend/src/components/ui/BrandBlock.tsx` (펜촉 SVG icon chip + "write-note" wordmark + mode-label. DESIGN.md §추가된 디자인 시스템 컴포넌트)
- [X] T015 [P] SuccessBlock 컴포넌트 — `frontend/src/components/ui/SuccessBlock.tsx` (info/success icon chip + display title + prose desc. DESIGN.md §추가된 디자인 시스템 컴포넌트)
- [X] T016 [P] AlertError + FormError 컴포넌트 — `frontend/src/components/ui/AlertError.tsx`, `frontend/src/components/ui/FormError.tsx` (Apple System Red 토큰 #d70015/#ff453a. DESIGN.md §추가된 디자인 시스템 컴포넌트)
- [X] T017 [P] FormInput 컴포넌트 — `frontend/src/components/ui/FormInput.tsx` (error 변형 포함 — input border)
- [X] T018 [P] SubmitLoading 컴포넌트 — `frontend/src/components/ui/SubmitLoading.tsx` (16px 도넛 spinner + 라벨 변경 + `.panel.is-loading` dim. DESIGN.md §추가된 디자인 시스템 컴포넌트)
- [X] T019 [P] EmptyHero + HintCard 컴포넌트 — `frontend/src/components/ui/EmptyHero.tsx`, `frontend/src/components/ui/HintCard.tsx` (H0 + 빈 inbox 공용. DESIGN.md §추가된 디자인 시스템 컴포넌트)

### 공유 shell + Theme toggle

- [X] T020 [P] TopBar shell — `frontend/src/components/shell/TopBar.tsx` (프로젝트 타이틀 / 진행 ring slot / 미리보기 진입 slot / 사이드 토글 slot — placeholder. DESIGN.md §7 분리 원칙)
- [X] T021 [P] SidePanel shell — `frontend/src/components/shell/SidePanel.tsx` (프로젝트 메타 + 등장인물 + 연결된 메모 placeholder. DESIGN.md §에디터 사이드 패널)
- [X] T022 [P] ProgressRing shell — `frontend/src/components/shell/ProgressRing.tsx` (분량 진행 ring placeholder. DESIGN.md §분량 카운터)
- [X] T023 ThemeToggle 컴포넌트 — `frontend/src/components/theme/ThemeToggle.tsx` (라이트/다크/시스템 3 모드. `preferences.theme` 갱신 + `:root.dark` class toggle. research.md §"다크 모드 mechanism", FR-013/014/015)

### Root layout

- [X] T024 Root layout 갱신 — `frontend/src/app/layout.tsx` 에 QueryProvider + 폰트 클래스 + theme 적용 script (SSR FOUC 회피용 inline blocking) + sw-register 유지. 모든 자식 route 가 본 layout 상속

**Checkpoint**: 공유 인프라 준비 완료 — US1~US3 user story 진입 가능. US4 (P4) 의 가시적 검증은 본 phase 산출물 위에서 진행

---

## Phase 3: User Story 1 - 인증 진입 surface 골격 (Priority: P1) 🎯 MVP

**Goal**: 12 인증 패널이 모두 `/auth/<panel>` 라우트로 진입 가능 + wireframe panel toggle 외관 1:1 재현 + 인라인 해결 경로 링크 동작.

**Independent Test**: `pnpm dev` 후 12 패널 URL 모두 진입 → wireframe.html 의 "로그인" 탭의 12 panel toggle 상태와 시각 1:1 대응 + 패널 간 인라인 링크 클릭 시 도착 패널 진입.

### auth layout + 패널 간 링크 컴포넌트

- [X] T025 [P] [US1] Auth shared layout — `frontend/src/app/auth/layout.tsx` (BrandBlock + 카드 컨테이너 + child slot. Clarification §Q2 + contracts/route-surfaces.md §1-1)
- [X] T026 [P] [US1] PanelLink 컴포넌트 — `frontend/src/components/auth/PanelLink.tsx` (인라인 해결 경로 링크 — Next.js `Link` wrapper + accent 토큰 적용. DESIGN.md §핵심 인증 UX 결정 §6, contracts/route-surfaces.md §1-2)

### 12 인증 page (모두 [P] — 다른 파일)

- [X] T027 [P] [US1] Login page — `frontend/src/app/auth/login/page.tsx` (이메일 + 비번 + Kakao CTA + "회원가입" link + "비밀번호 재설정" link. wireframe.html 2678 줄 1:1)
- [X] T028 [P] [US1] Signup method picker — `frontend/src/app/auth/signup/page.tsx` (Kakao 가입 + 이메일 가입 카드 — Entry→Wizard step 1. wireframe.html 2716 줄)
- [X] T029 [P] [US1] Signup email form — `frontend/src/app/auth/signup-email/page.tsx` (이메일 + 비번 + 비번 확인 + 약관 + 가입 CTA. wireframe.html 2738 줄)
- [X] T030 [P] [US1] Reset request — `frontend/src/app/auth/reset-request/page.tsx` (이메일 입력 폼. wireframe.html 2773 줄)
- [X] T031 [P] [US1] Reset sent — `frontend/src/app/auth/reset-sent/page.tsx` (SuccessBlock info + 다시 보내기. wireframe.html 2800 줄)
- [X] T032 [P] [US1] Reset new — `frontend/src/app/auth/reset-new/page.tsx` (새 비번 + 확인. wireframe.html 2825 줄)
- [X] T033 [P] [US1] Reset done — `frontend/src/app/auth/reset-done/page.tsx` (SuccessBlock success + 로그인 CTA. wireframe.html 2858 줄)
- [X] T034 [P] [US1] Verify pending — `frontend/src/app/auth/verify-pending/page.tsx` (SuccessBlock info "메일로 마지막 단계 보냈습니다". wireframe.html 2876 줄)
- [X] T035 [P] [US1] Verify done — `frontend/src/app/auth/verify-done/page.tsx` (SuccessBlock success "환영합니다" + 홈 진입 CTA. wireframe.html 2901 줄)
- [X] T036 [P] [US1] Login error — `frontend/src/app/auth/login-error/page.tsx` (Login page + AlertError "남은 시도 N 회 / 5 회 실패 시 30분 제한". wireframe.html 2919 줄)
- [X] T037 [P] [US1] Signup error — `frontend/src/app/auth/signup-error/page.tsx` (Signup email form + FormError 이메일 중복 + 비번 약함 + 인라인 로그인 링크 + disabled CTA. wireframe.html 2965 줄)
- [X] T038 [P] [US1] Login loading — `frontend/src/app/auth/login-loading/page.tsx` (SubmitLoading + 폼 dim. wireframe.html 3001 줄. Kakao 는 full redirect 라 본 surface 미적용 — DESIGN.md §핵심 인증 UX 결정 §5)

### 가드 + 검증

- [X] T039 [US1] `/auth/*` 가드 동작 검증 — `useAuthGuard` hook 을 `app/auth/layout.tsx` 에 적용해 인증 상태에서 `/auth/*` 진입 시 `/` redirect (FR-010). 수동 검증: `authPlaceholder.userId` 설정 후 `/auth/login` 직접 진입 → `/` 이동 확인

**Checkpoint**: US1 완료 시 인증 진입 surface 13 패널 모두 진입 가능 + 인라인 링크 + 가드 동작. 본 spec 의 MVP 가치 (인증 surface 진입) 충족

---

## Phase 4: User Story 2 - 메인 진입 surface 골격 (Priority: P2)

**Goal**: 홈 (H0 동적 변형 포함) + 메모 inbox + 설정 라우트 진입 가능 + wireframe 1:1 외관 + 인증 가드 적용.

**Independent Test**: `pnpm dev` 후 `/`, `/memos`, `/settings`, `/some-random-path` 진입 → wireframe.html 의 "홈" / "홈 (빈)" / "메모 inbox" / "설정" 탭과 1:1 대응 + 임의 URL 은 not-found fallback 표시.

### Home (동적 변형) + Memos + Settings + not-found

- [X] T040 [P] [US2] Home page — `frontend/src/app/page.tsx` (`useQuery` 로 `useProjects` 호출 → `totalElements === 0` → EmptyHero (H0 외관: 환영 + 첫 프로젝트 만들기 CTA + 모바일/⌘+N HintCard 2 개) / `> 0` → 프로젝트 카드 + 지난 세션 hero 인용 + 최근 활동 + 보관함 placeholder. Clarification §Q4, contracts/route-surfaces.md §2-1)
- [X] T041 [P] [US2] Memos inbox page — `frontend/src/app/memos/page.tsx` (MemosTopBar + FilterChips overlap 카운트 placeholder + MemoCard placeholder × N — 정적 외관만. wireframe.html "메모 inbox" 탭 1:1. 큐레이션 동작은 Week 4)
- [X] T042 [P] [US2] Settings page — `frontend/src/app/settings/page.tsx` (SettingsGroup × 3: "작성" 작성 모드 카드 (manuscript/editor) + 원고지 크기 (200/400/1000), "일반" 테마 토글 + 폰트 placeholder, "계정" 이메일 + 로그아웃 placeholder. 모드/크기/테마 선택 → preferences store 갱신. DESIGN.md §7 분리 원칙)
- [X] T043 [P] [US2] not-found page — `frontend/src/app/not-found.tsx` (BrandBlock + "찾을 수 없는 페이지" 메시지 + 홈 진입 CTA. FR-011, contracts/route-surfaces.md §3)
- [X] T044 [US2] 메인 라우트 가드 적용 — `app/page.tsx`, `app/memos/page.tsx`, `app/settings/page.tsx` 에 `useAuthGuard` hook (미인증 시 `/auth/login` redirect. FR-009)

**Checkpoint**: US2 완료 시 메인 view 3 종 (홈 + 메모 + 설정) + H0 빈 홈 변형 + not-found fallback 진입 가능. 라우트 가드 동작 확인

---

## Phase 5: User Story 3 - 작성 진입 surface 골격 (Priority: P3)

**Goal**: `/write` 단일 URL → `preferences.writingMode` 에 따라 manuscript / editor layout 분기 + `/write/preview` 자식 route + 편집 복귀.

**Independent Test**: 설정에서 작성 모드를 manuscript 로 → `/write` 진입 → wireframe.html "작성 — 원고지" 탭 외관 / editor 로 → wireframe.html "작성 — 에디터" 탭 외관. 작성 화면에서 미리보기 진입 → wireframe.html "미리보기" 탭 외관 → "편집으로 돌아가기" 로 복귀.

### Write layout + page (모드 분기) + Preview

- [X] T045 [P] [US3] Write shared layout — `frontend/src/app/write/layout.tsx` (TopBar 적용 + SidePanel 골격 + 미리보기 진입 버튼 slot + 사이드 토글. contracts/route-surfaces.md §2-2)
- [X] T046 [P] [US3] Write page (모드 분기) — `frontend/src/app/write/page.tsx` (`preferences.writingMode === 'manuscript'` → ManuscriptGrid placeholder (200/400/1000 격자 + 컬럼 마커 + 행 번호 정적 외관) / `'editor'` → EditorToolbar placeholder + EditorBody (TipTap placeholder editor 1 건 — `@tiptap/react` 사용). Clarification §Q3, DESIGN.md §화면 구성)
- [X] T047 [P] [US3] Preview page — `frontend/src/app/write/preview/page.tsx` (PreviewBody 페이지 break placeholder + PreviewStickyFooter (진행률 + 페이지 + 목차 + prev/next + "편집으로 돌아가기" CTA → `router.push('/write')`). FR-008, contracts/route-surfaces.md §2-2)
- [X] T048 [US3] `/write*` 라우트 가드 적용 — `app/write/layout.tsx` 에 `useAuthGuard` hook (미인증 시 `/auth/login` redirect. FR-009)

**Checkpoint**: US3 완료 시 작성-원고지 / 작성-에디터 / 미리보기 3 surface 진입 가능 + 모드 분기 동작 + 미리보기 복귀 동작

---

## Phase 6: User Story 4 - 공유 인프라 가시적 검증 (Priority: P4)

**Goal**: US4 의 기술 산출물 (Phase 2 에 박힘) 의 가시적 동작 검증. 라이트↔다크 토글이 19 surface 일관 적용 + placeholder query 동작 + 토큰 적용 확인.

**Independent Test**: 다크 모드 토글이 19 surface 모두에 깜빡임 없이 적용 + surface 간 이동 시 다크 선호 유지 + 시스템 테마 변경 자동 따라가기 (theme='system' 시) + `useProjects` placeholder query 가 Phase 1A backend `/api/projects` 호출 + Result envelope unwrap → React Query 캐시 진입.

- [ ] T049 [US4] 다크 모드 일관성 검증 — 19 surface 각각 진입 후 ThemeToggle 활성화 → wireframe.html 의 다크 변환 규칙대로 색상 / 본문 weight (라이트 400 → 다크 300) / 원고지 paper (cream → warm cream-dark) / accent (#0066cc → #2997ff) 일관 변환 확인. surface 이동 시 다크 선호 유지 확인 (SC-003). **🔵 사용자 dogfooding 영역**
- [ ] T050 [US4] 시스템 테마 따라가기 검증 — `preferences.theme === 'system'` 일 때 OS 다크 모드 토글 → 본 spec 화면 자동 따라가기 확인 (DESIGN.md §6 다크 모드, FR-013). **🔵 사용자 dogfooding 영역**
- [ ] T051 [US4] Placeholder query 동작 검증 — backend `bootRun` 실행 후 `/` 진입 → DevTools Network 탭 / React Query DevTools 에서 `useProjects` 호출 1 건 + `Result<Page<ProjectResponse>>` 응답 정상 unwrap 확인 (FR-020, SC-006). **🔵 사용자 dogfooding 영역**

**Checkpoint**: US4 완료 시 공유 인프라가 모든 surface 위에서 가시적으로 검증됨

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 1:1 시각 대응 종합 검증 + PWA 정합 + 빌드/린트 게이트 + agent context 갱신

- [X] T052 [P] 디자인 토큰 grep 검증 — `grep -E "(#0066cc|#2997ff|#d70015|#ff453a|14px|16px|18px|0\\.95|#28231d)" frontend/src/styles/tokens.css frontend/src/app/globals.css` → DESIGN.md 박힌 토큰 모두 매핑 확인 (SC-002 측정 기준 §1). **결과**: 9 토큰 모두 매핑 ✓
- [ ] T053 [P] 19 surface 1:1 시각 대응 육안 검증 — `pnpm dev` + `designs/wireframe.html` 양쪽 비교, 라이트/다크 양쪽 19 surface 매핑 표 (contracts/route-surfaces.md) 와 1:1 일치 확인. 불일치 시 fix → 재확인 (SC-002). **🔵 사용자 dogfooding 영역**
- [ ] T054 [P] PWA 정합 검증 — iOS Safari + Android Chrome 에서 본 spec 결과물 띄워 "홈 화면 추가" 메뉴 노출 + service worker 등록 콘솔 로그 확인 (PoC 0-3 회귀 회피, SC-009). **🔵 사용자 dogfooding 영역**
- [X] T055 라우트 가드 동작 종합 검증 — 코드 검사: `requireAnon` 적용 (`auth/layout.tsx`) ✓ / `requireAuth` 적용 (`page.tsx`, `memos/page.tsx`, `settings/page.tsx`, `write/layout.tsx`) ✓. 런타임 redirect 동작 확인은 dogfooding 영역 (SC-004, SC-005)
- [X] T056 빌드 + 린트 게이트 — `cd frontend && pnpm lint && pnpm build` 모두 GREEN. 21 static page 생성 (19 surface + manifest + auto not-found) (SC-007)
- [X] T057 `docs/plan/02-progress.md` 갱신 — 002 자동화 검증 완료 + dogfooding 5 영역 + 다음 진입점 (트랙 A dogfooding 마무리 / 트랙 B Week 1B 인증 백엔드) 박음 + 본 spec 산출물 인용

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 즉시 시작 가능
- **Foundational (Phase 2)**: Phase 1 완료 후. **모든 user story 의 blocking prerequisite**
- **US1 (Phase 3)**: Phase 2 완료 후 — MVP. 가장 우선
- **US2 (Phase 4)**: Phase 2 완료 후. US1 와 병렬 가능 (다른 라우트)
- **US3 (Phase 5)**: Phase 2 완료 후. US1/US2 와 병렬 가능
- **US4 (Phase 6)**: Phase 2~5 모두 완료 후 — 가시적 검증은 모든 surface 가 진입 가능해야 의미
- **Polish (Phase 7)**: US1~US4 완료 후

### User Story Dependencies

- US1, US2, US3 는 **상호 독립** — 같은 라우트 그룹 (`/auth/*`, `/`, `/write*`, `/memos`, `/settings`) 의 서로 다른 영역. 같은 file 충돌 없음
- US4 는 US1~US3 surface 가시화에 의존 — 19 surface 모두 진입 가능해야 다크모드 일관성 검증 가능

### Within Each User Story

- US1: T025 auth/layout.tsx → T027~T038 자식 page (auth layout 상속 의존). T026 PanelLink 는 T025 와 병렬 가능. T039 가드 검증은 T025 후
- US2: T040~T043 모두 [P] (서로 다른 라우트 파일). T044 가드 적용은 T040~T042 후
- US3: T045 write/layout.tsx → T046, T047 (layout 상속). T046, T047 은 [P]. T048 가드 적용은 T045 후
- US4: T049~T051 모두 독립 검증, 단 US1~US3 완료에 의존

### Parallel Opportunities

- Phase 1 의 T003, T004, T005 [P] 병렬 가능 (서로 다른 파일)
- Phase 2 의 T006~T022 [P] 병렬 가능 (서로 다른 파일, 단 T024 root layout 은 T013/T023 후)
- Phase 3 의 T026~T038 [P] 병렬 가능 (T025 auth layout 완료 후)
- Phase 4 의 T040~T043 [P] 병렬 가능
- Phase 5 의 T046, T047 [P] 병렬 가능 (T045 layout 완료 후)
- Phase 7 의 T052~T054 [P] 병렬 가능

---

## Parallel Example: User Story 1 (인증 surface 12 패널)

```bash
# T025 auth/layout.tsx + T026 PanelLink 컴포넌트 병렬:
Task: "Create auth shared layout in frontend/src/app/auth/layout.tsx"
Task: "Create PanelLink component in frontend/src/components/auth/PanelLink.tsx"

# 그 후 12 인증 page 전부 병렬 (T027 ~ T038):
Task: "Create login page in frontend/src/app/auth/login/page.tsx"
Task: "Create signup method picker in frontend/src/app/auth/signup/page.tsx"
Task: "Create signup email form in frontend/src/app/auth/signup-email/page.tsx"
# ... (T030 ~ T038 모두 동일 패턴)
```

---

## Implementation Strategy

### MVP First (User Story 1 — 인증 진입 surface)

1. Phase 1 Setup 완료 → 의존성 + PoC 정리 + 토큰·폰트 인프라
2. Phase 2 Foundational 완료 → 공유 인프라 + 디자인 컴포넌트
3. Phase 3 US1 완료 → 12 인증 패널 + auth layout + 인라인 링크 + 가드
4. **STOP and VALIDATE**: US1 단독 검증 (12 URL 진입 + wireframe 1:1 + 패널 전환 + 가드)
5. dogfooding 시연 가능 시점

### Incremental Delivery

1. Setup + Foundational 완료 → 공유 인프라 ready
2. US1 (인증 surface) 추가 → 단독 검증 → MVP demo
3. US2 (메인 surface) 추가 → 단독 검증 → demo
4. US3 (작성 surface) 추가 → 단독 검증 → demo
5. US4 (공유 인프라 가시적 검증) → 19 surface 일관 검증
6. Polish → 토큰 grep + PWA + 빌드/린트 게이트

### 단일 개발자 직렬 진행 권장 (본 프로젝트)

본 프로젝트는 단일 개발자 dogfooding V1 (`docs/plan/00-stack §1`). 병렬 가능 task 들도 한 사람이 직렬 실행하나, 같은 file 충돌 없는 점이 컨텍스트 회귀 회피에 유리. Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 순서 권장.

---

## Notes

- [P] = 다른 파일 + 미완 의존 없음 → 단일 개발자 진행 시에도 컨텍스트 분리 가능
- [Story] label = traceability + MVP 분기 단위
- 본 spec 은 도메인 로직 / 자동화 test 영역 밖 — `next build` + `pnpm lint` + 토큰 grep + 라이트/다크 육안 비교 가 검증 게이트
- Commit 단위 권장: phase 종료 시점 또는 user story 종료 시점 (사용자 결정)
- `frontend/AGENTS.md` 의 Next.js 16 breaking change 경고 — App Router 사용 시 `node_modules/next/dist/docs/` 사전 정독 의무
- Phase 1A backend `/api/projects` 호출은 `apiFetch` 의 임시 `X-User-Id` 자동 주입 — Week 1B-5 진입 시 JWT 로 swap (영향 범위: `lib/api/client.ts` 한 파일)
