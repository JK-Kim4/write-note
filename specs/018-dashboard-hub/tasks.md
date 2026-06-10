# Tasks: 대시보드 허브 (재진입 허브)

**Input**: Design documents from `specs/018-dashboard-hub/` (v3 — 백엔드 확장 포함)

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/(backend-api.md·client-contracts.md), quickstart.md

**Tests**: 포함 — 프로젝트 TDD HARD-GATE(Red-Green-Refactor, 한 번에 하나). 빌드/테스트 전부 포어그라운드.

**Organization**: User Story 단위. 실행 순서 = US2(P1 데이터 공급) → US1(P1 MVP 화면) → US3(P2) → US4(P2) → US6(P2 검증) → US5(P3).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

**Purpose**: implement 진입 게이트(quickstart §게이트) — 코드 사실 정합 + 기준선 확보

- [x] T001 정합 grep + 기준선 확인 — `grep -rn "WorkSessionService\|TotalDurationResponse" backend/src/main/kotlin | head` · `grep -rn "listCards\|useProjectCards\|useInboxMemos\|formatDuration" frontend/src/lib | head` · FE `node_modules/.bin/vitest run`(103 pass)·`npx tsc --noEmit`(기존 1건)·`node_modules/.bin/eslint src`(기존 1건) · BE `cd backend && ./gradlew test`(GREEN). 불일치 발견 시 tasks.md 갱신 후 진행
- [x] T002 [P] Next 공식 문서 정독 — `frontend/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`(Suspense 경계 요건) + 전례 `frontend/src/app/auth/verify/page.tsx` 패턴 확인

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: US2(shim)·US1(UI)이 공유하는 타입 선언 (TDD 예외 §5-5 — 타입 선언)

- [x] T003 [P] `frontend/src/types/api.ts`에 `ProjectCardResponse`(ProjectResponse + wordCount·documentUpdatedAt·totalDurationMs) 추가 — contracts/backend-api.md §BE-2 응답 형태
- [x] T004 [P] `frontend/src/types/domain.ts`의 `ProjectCard`를 4필드(lastSentenceSource·wordCount·docUpdatedAt·totalDurationMs)로 확장 — data-model.md §2 주석 포함

**Checkpoint**: FE `tsc --noEmit` 기존 1건 외 0 (기존 소비처 비파괴 확인)

---

## Phase 3: US2 — 카드 집계 데이터 공급 (백엔드) (P1) 🎯

**Goal**: `GET /api/projects/cards`가 활성 작품 전량 + 집계(글자수·문서저장시각·누적작업시간)를 공급하고, FE shim이 마지막 문장 원료까지 채운 `ProjectCard[]`를 만든다.

**Independent Test**: spec US2 — 본문·세션 있는 작품 2편 계정으로 카드 집계 조회 → 수치 정확·소유권 격리·기존 목록 불변.

- [x] T005 [US2] 리포지토리 derived 추가(인터페이스 선언 — 서비스 테스트가 커버): `backend/src/main/kotlin/com/writenote/repository/DocumentRepository.kt`에 `findByProjectIdIn`, `WorkSessionRepository.kt`에 `findByProjectIdInAndEndedAtIsNotNull`
- [x] T006 [US2] RED: `ProjectService.listCards` 단위 테스트 — 조립 정확성(글자수·문서시각·세션 합 eq 정확값)/세션 0 작품=0/아카이브 제외/타 사용자 제외. 위치: `backend/src/test/kotlin/com/writenote/service/` 신규 또는 기존 `*ServiceTest` 패턴 정합(T001 grep 결과 따름)
- [x] T007 [US2] GREEN: `backend/src/main/kotlin/com/writenote/model/response/ProjectCardResponse.kt` 신규 + `service/ProjectService.kt`에 `listCards(userId)` 구현 — 3쿼리 일괄(활성 작품/문서 IN/종료 세션 IN) 후 조립, `@Transactional(readOnly = true)`, body 미포함
- [x] T008 [US2] RED: `backend/src/test/kotlin/com/writenote/controller/ProjectControllerIT.kt` 확장 — `GET /api/projects/cards` 200 필드 검증/빈 배열/401 + **기존 목록·작품별 total 회귀 무변화 단언**
- [x] T009 [US2] GREEN: `backend/src/main/kotlin/com/writenote/controller/ProjectController.kt`에 `listProjectCards()` 추가(리터럴 `cards`가 `/{projectId}` 템플릿보다 우선 매칭)
- [x] T010 [US2] BE 게이트(포어그라운드): `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`
- [x] T011 [US2] FE 어댑터: `frontend/src/lib/api/projects.ts`에 `listProjectCards(): Promise<ProjectCardResponse[]>` 추가(기존 어댑터 패턴)
- [x] T012 [US2] RED: `frontend/src/lib/electron-api/projects.test.ts` 확장 — listCards가 카드 응답+문서 본문(`extractPlainText`)을 합쳐 `ProjectCard[]` 반환 / 한 조회 실패 시 전체 reject(부분 배열 금지). 기존 mock 패턴 준수
- [x] T013 [US2] GREEN: `frontend/src/lib/electron-api/projects.ts`의 `listCards()` 재구현 — `listProjectCards()` 1회 + 작품별 `getProjectDocument(id)` 병렬 → `lastSentenceSource` 채움(placeholder 주석 제거)

**Checkpoint**: BE 게이트 GREEN + FE vitest GREEN — 카드 데이터 경로 완성(벽 마지막 문장 회복의 토대)

---

## Phase 4: US1 — 홈에서 최근작 이어서 쓰기 (P1) 🎯 MVP

**Goal**: `/` = 대시보드(인사+날짜, 이어서 쓰기 타일), 벽 → `/library`, Rail 재편. 1클릭 재진입.

**Independent Test**: spec US1 — 작품 2편 계정 `/` 진입 → 최근작 타일(제목·마지막 문장·다음 장면·메타) → 클릭 1번 집필 화면. `/library` 벽 전 기능.

- [x] T014 [P] [US1] RED: `frontend/src/lib/dashboardView.test.ts` 신규 — `selectDashboard`(빈 배열→null/1편/`docUpdatedAt` 내림차순/동률 시 id 내림차순) · `formatRelativeTime`(방금/N분/N시간/N일, now 주입)
- [x] T015 [US1] GREEN: `frontend/src/lib/dashboardView.ts` 신규(순수, DOM/시계 비의존)
- [x] T016 [P] [US1] RED: `frontend/src/components/dashboard/ResumeCard.test.tsx` — 제목/인용 마지막 문장/빈 본문 placeholder/다음 장면 빈 줄 숨김/총시간 0 토막 숨김/onOpen 호출
- [x] T017 [US1] GREEN: `frontend/src/components/dashboard/ResumeCard.tsx`(`'use client'`, props만 — contracts §5)
- [x] T018 [US1] 벽 이동: `git mv frontend/src/app/page.tsx frontend/src/app/library/page.tsx`(내용 불변) + `frontend/src/app/library/page.test.tsx` 신규 렌더 스모크(쿼리 mock — 벽 행위 보존)
- [x] T019 [P] [US1] Rail 재편: `frontend/src/components/workspace/Rail.tsx` — "홈" 항목 신설(`/`, `p === "/"`) + "작품" `href:"/library"`·`match: p.startsWith("/library")`. 집필 fallback `push("/")` 유지
- [x] T020 [P] [US1] 집필 page 1줄: `frontend/src/app/projects/[id]/write/page.tsx:220` 부근 에러 버튼 `push("/") → push("/library")`(라벨 "작품 벽으로" 정합)
- [x] T021 [US1] RED: `frontend/src/app/page.test.tsx` 신규 — 인사(이름 없음)+날짜(마운트 게이트)/이어서 쓰기 타일 데이터/타일 클릭 → 집필 라우팅/Rail "홈"·"작품"(`/library`) 네비 단언(FR-008·016)/작품 0 환영 블록+CTA/로딩 skel/에러 재시도(쿼리 mock)
- [x] T022 [US1] GREEN: `frontend/src/app/page.tsx` 대시보드 신규(`'use client'`+`useAuthGuard("requireAuth")`+`.app` 셸+Titlebar "홈") — ①② + 빈 상태 + `useProjectCards`→`selectDashboard` 결선 + `frontend/src/styles/desktop-app.css`에 목업 클래스 이관(웜 토큰 계승)
- [x] T023 [US1] RSC 게이트(작성 직후): `cd frontend && pnpm build` — Suspense/use client 경계·hydration 콘솔 에러 0

**Checkpoint**: MVP — `/` 대시보드에서 1클릭 재진입 + `/library` 벽 + vitest·build GREEN

---

## Phase 5: US3 — 이번 주 집필 시간 (P2)

**Goal**: BE 기간 합계 + 대시보드 ③ "이번 주 집필 시간 · N시간 M분" 한 줄(0이면 숨김).

**Independent Test**: spec US3 — 이번 주 종료 세션 있는 계정 `/` 진입 → 합계 한 줄. 없으면 미표시. 기간 조회 직접 호출 정확.

- [x] T024 [US3] RED: `backend/src/test/kotlin/com/writenote/service/WorkSessionServiceTest.kt` 확장 — `rangeTotalDurationMs`: 범위 내 종료 세션 합/경계(from 포함·to 제외)/진행 중 제외/타 사용자 제외/빈 0/`from >= to` 검증 오류
- [x] T025 [US3] GREEN: `WorkSessionRepository.kt` JPQL(projects join — WorkSession에 userId 없음) + `service/WorkSessionService.kt` `rangeTotalDurationMs(userId, from, to)`(`@Transactional(readOnly = true)`, Kotlin 합산)
- [x] T026 [US3] RED: `backend/src/test/kotlin/com/writenote/controller/WorkSessionTotalControllerIT.kt` 신규 — 200 정상 합/400(`from>=to`·파라미터 누락)/401
- [x] T027 [US3] GREEN: `backend/src/main/kotlin/com/writenote/controller/WorkSessionTotalController.kt` 신규(`@RequestMapping("/api/work-sessions")`, `GET /total?from=&to=`, `TotalDurationResponse` 재사용)
- [x] T028 [US3] BE 게이트(포어그라운드): ktlint(main+test)+checkstyle+test+build
- [x] T029 [US3] RED: `frontend/src/lib/dashboardView.test.ts` 확장 — `startOfWeekMonday`(주중/월요일 당일/일요일/자정 경계, 로컬 기준)
- [x] T030 [US3] GREEN: `dashboardView.ts`에 `startOfWeekMonday` + `frontend/src/lib/electron-api/sessions.ts`에 `rangeTotal(fromIso, toIso)` + `frontend/src/lib/query/useSessions.ts` 신규 `useWeeklyTotal`(캐시 키에 주 시작 ISO 포함) — shim 테스트는 기존 sessions 테스트 패턴 확장
- [x] T031 [US3] RED→GREEN: `frontend/src/app/page.test.tsx` 확장(③ 한 줄 표시/0 숨김) → `page.tsx`에 ③ 결선(`formatDuration` 재사용) + CSS 한 줄 스타일(조용한 텍스트 — 점선 박스 아님)

**Checkpoint**: BE·FE 게이트 GREEN + 이번 주 줄 동작

---

## Phase 6: US4 — 다른 작품 빠른 진입과 새 작품 (P2)

**Goal**: ④ 미니 카드(최근작 제외, 정렬 유지) + "+ 새 작품" → `/library?new=1`(create 모드).

**Independent Test**: spec US4 — 작품 3편 `/` 진입 → 2편 미니 카드 → 클릭 집필 이동, 새 작품 → 폼 열린 벽.

- [ ] T032 [P] [US4] RED: `frontend/src/components/dashboard/WorkMiniCard.test.tsx` — 제목/마지막 문장 2줄 클램프/빈 본문 placeholder/onOpen
- [ ] T033 [US4] GREEN: `frontend/src/components/dashboard/WorkMiniCard.tsx`
- [ ] T034 [US4] RED: `frontend/src/app/page.test.tsx` 확장(④ 나머지 작품 정렬·작품 1편이면 "+ 새 작품"만) + `frontend/src/app/library/page.test.tsx` 확장(`?new=1` → create 모드)
- [ ] T035 [US4] GREEN: `page.tsx` ④ 결선("+ 새 작품" → `/library?new=1`) + `library/page.tsx`에 Suspense+`useSearchParams` 초기 mode(전례 `auth/verify` 패턴) → 직후 `pnpm build`(RSC)

**Checkpoint**: 미니 카드·새 작품 흐름 + build GREEN

---

## Phase 7: US6 — 작품 벽 마지막 문장 회복 (P2, 검증)

**Goal**: US2의 데이터 채움이 벽에 실제로 흐르는지 검증(구현은 T013에서 완료).

**Independent Test**: spec US6 — 본문 있는 작품 `/library` → 실제 마지막 문장(placeholder 아님).

- [ ] T036 [US6] `frontend/src/app/library/page.test.tsx` 확장 — 본문 있는 카드 mock으로 벽 카드에 마지막 문장 표시/빈 본문은 기존 placeholder 카피 단언

---

## Phase 8: US5 — 최근 곁쪽지 (P3)

**Goal**: ⑤ 최신 곁쪽지 2장(쪽지 톤, 상대 날짜) → `/memos` 진입.

**Independent Test**: spec US5 — 곁쪽지 3장 계정 `/` 진입 → 최신 2장 + 클릭 시 메모 화면.

- [ ] T037 [US5] RED: `frontend/src/app/page.test.tsx` 확장 — 최신 2장 선별(capturedAt 내림차순)/상대 날짜 라벨/0장 빈 문구("아직 곁쪽지가 없어요")/클릭 → `/memos`
- [ ] T038 [US5] GREEN: `page.tsx` ⑤ 결선 — `useInboxMemos` + 기존 `memoView.ts`(`formatRelativeDay`) 재사용 + `.memo-card*` CSS 이관

---

## Phase 9: Polish & Cross-Cutting

- [ ] T039 FE 전체 게이트(포어그라운드): `node_modules/.bin/vitest run`(전체 GREEN) → `npx tsc --noEmit`(기존 1건 외 0) → `node_modules/.bin/eslint src`(신규 0 경고) → `pnpm build`
- [ ] T040 BE 전체 게이트(포어그라운드): `./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` — 기존 endpoint 회귀 무변화 재확인
- [ ] T041 시각 검증: headless Chrome 스크린샷 — 라이트(`--blink-settings=preferredColorScheme=1`)/다크 × 작품 있음/0편 × 곁쪽지 0 × 이번 주 0(줄 숨김). 목업 `docs/design/web/mockups/dashboard-reentry-hub.html` 대조 + 대비 AA·포커스·reduced-motion
- [ ] T042 라이브 dogfooding 인계 정리(사용자 영역): 1클릭 재진입/이번 주 수치 체감 정합/벽 회복/로그인·작업 종료 귀환 — quickstart §dogfooding 체크리스트로 보고

---

## Dependencies

```
Setup(T001-T002) → Foundational(T003-T004)
  → US2(T005-T013)  ← P1, 데이터 공급(다른 모든 스토리의 토대)
    → US1(T014-T023) ← P1, MVP (T014/T016/T019/T020은 [P] 병렬 가능)
      → US3(T024-T031)  # BE(T024-T028)는 US1과 병렬 가능(다른 스택) — FE 결선(T031)만 US1 이후
      → US4(T032-T035)
      → US6(T036)       # T013 완료가 실질 전제
      → US5(T037-T038)
        → Polish(T039-T042)
```

## Parallel Examples

- **US2 진행 중 병렬**: T024~T028(US3 백엔드)은 US2 백엔드와 파일이 겹치지 않아(WorkSession* vs Project*) 선행 가능 — 단 한 번에 하나의 RED만(프로젝트 TDD 규율).
- **US1 내부**: T014(순수함수 테스트)·T016(ResumeCard 테스트)·T019(Rail)·T020(집필 1줄) 상호 [P].
- **US4**: T032[P]는 T031과 독립.

## Implementation Strategy

- **MVP = US2 + US1**(둘 다 P1): 카드 데이터 공급 → 홈 1클릭 재진입. 여기까지가 첫 dogfoodable 슬라이스(룰 §10 — 핵심 직접 실행).
- 이후 P2(US3 → US4 → US6) → P3(US5) → Polish 순 증분. 각 Phase Checkpoint에서 게이트 GREEN 확인 후 다음 진입.
- BE 작업은 모든 단계에서 기존 계약 불변(FR-013)을 IT로 보호.
