---
description: "Task list for 운영 툴 (Admin Ops Tool) v1"
---

# Tasks: 운영 툴 (Admin Ops Tool) v1

**Input**: Design documents from `specs/030-admin-ops-tool/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 본 프로젝트는 TDD HARD-GATE(CLAUDE.md §5) — 백엔드 매핑·인가·집계·검증은 테스트 우선(Red→Green). 엔티티/마이그레이션/DTO/설정/UI 스캐폴딩은 §5-5 완화.

**Organization**: User Story 단위 그룹. 단계 A(US1)=MVP, B(US2), C(US3) 독립 배포. 단계 내 BE 선행 → FE 후행.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일·의존 없음 → 병렬 가능
- **[Story]**: US1/US2/US3/US4 (Setup·Foundational·Polish 는 라벨 없음)

## Path Conventions
- 백엔드: `backend/src/main/kotlin/com/writenote/`, 테스트 `backend/src/test/kotlin/com/writenote/`
- 사용자 앱: `frontend/src/`
- 어드민 앱(신규): `admin-site/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 어드민 앱 스캐폴딩 + 관리자 설정 키. 모든 어드민 화면/엔드포인트의 토대.

- [x] T001 `admin-site/` 신규 Next.js 16 앱 스캐폴드 — `admin-site/package.json`, `admin-site/next.config.ts`(`/api/:path*` → `${BACKEND_ORIGIN}/api/:path*` rewrite + 보안 헤더, `BACKEND_ORIGIN` 기본 `http://localhost:8080`), `admin-site/tsconfig.json`, eslint/prettier (frontend/ 설정 미러)
- [x] T002 [P] `admin-site/` UI 기반 — shadcn 대신 Tailwind v4 기본 유틸로 자립(대화형 CLI 회피·결정론적). recharts 는 US3(통계 차트) 단계 C 로 연기
- [x] T003 [P] 공용 HTTP 클라이언트 이식 — `admin-site/src/lib/api/client.ts` (frontend/src/lib/api/client.ts 패턴: `apiFetch`, `credentials:include`, `X-WriteNote-Client:web` 헤더, `Result<T>` unwrap, 401 refresh 1회, error.code 분기)
- [x] T004 백엔드 관리자 설정 키 추가 — `backend/src/main/resources/application.yml`(`app.admin.email: ${ADMIN_EMAIL:}` 기본 빈값) + `application-local.yml`(로컬 관리자 이메일). 빈값이면 누구도 `/api/admin/**` 통과 못 함(안전 기본값)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 관리자 전용 인가 게이트 — 모든 어드민 엔드포인트(US1 CRUD/US2/US3)를 차단/통과시키는 핵심. 어드민 앱 로그인·가드 셸.

**⚠️ CRITICAL**: 이 단계 완료 전 어떤 어드민 스토리도 시작 불가.

- [x] T005 [TDD] 관리자 인가 통합 테스트 작성(실패 확인) — `backend/src/test/kotlin/com/writenote/controller/admin/AdminAuthorizationIT.kt` (Testcontainers): 비인증 `/api/admin/**` → 401, 비관리자 JWT → 403, 관리자(`app.admin.email`) JWT → 200. (FR-015/016, SC-005)
- [x] T006 `AdminAuthorizationManager` 구현 — `backend/src/main/kotlin/com/writenote/config/AdminAuthorizationManager.kt` (`AuthenticatedPrincipal.email == app.admin.email` 비교, 불일치 403)
- [x] T007 SecurityConfig 에 어드민 게이트 등록 — `backend/src/main/kotlin/com/writenote/config/SecurityConfig.kt` 에 `.requestMatchers("/api/admin/**").access(adminAuthorizationManager)` 추가 → T005 GREEN
- [x] T008 어드민 앱 로그인 + 라우트 가드 셸 — `admin-site/src/app/login/page.tsx`(기존 `/api/auth/login` 호출, client) + `admin-site/src/app/(admin)/layout.tsx`(비로그인·비관리자 차단 가드, 네비) — 작성 직후 `cd admin-site && pnpm build`(RSC 경계)

**Checkpoint**: 관리자만 `/api/admin/**` 통과 + 어드민 앱 로그인/가드 동작 → 스토리 구현 시작 가능

---

## Phase 3: User Story 1 - 공지사항 발행과 사용자 노출 (Priority: P1) 🎯 MVP

**Goal**: 운영자가 공지를 작성·발행하면 사용자가 홈 배너 + `/notice` 에서 보고, 비공개 시 사라진다. + "문의하기" 외부 링크(US4).

**Independent Test**: 어드민에서 공지 작성·발행 → 비로그인/로그인 사용자가 홈 배너·`/notice` 목록·상세 확인 → 비공개 전환 → 사라짐.

### Backend (BE 선행)

- [x] T009 [P] [US1] `Announcement` 엔티티 — `backend/src/main/kotlin/com/writenote/entity/Announcement.kt` (Character.kt 패턴: IDENTITY, @PrePersist/@PreUpdate; title/body/isPublished/isPinned/publishedAt) — data-model.md
- [x] T010 [P] [US1] Flyway 마이그레이션 — `backend/src/main/resources/db/migration/V16__create_announcements.sql` (CREATE TABLE + idx_announcements_published). 로컬/IT 만 적용
- [x] T011 [US1] `AnnouncementRepository` — `backend/src/main/kotlin/com/writenote/repository/AnnouncementRepository.kt` (`findAllByIsPublishedTrueOrderByPublishedAtDesc(pageable)`, 배너 1건 조회, `findByIdAndIsPublishedTrue`)
- [x] T012 [US1] [TDD] AnnouncementService 테스트(실패) — `backend/src/test/kotlin/com/writenote/service/AnnouncementServiceTest.kt`: 발행 시 publishedAt 설정, 빈 title/body 거부, 비공개 공개조회 제외
- [x] T013 [US1] `AnnouncementService` 구현 — `backend/src/main/kotlin/com/writenote/service/AnnouncementService.kt` (CRUD + 공개 목록/상세/배너, @Transactional) → T012 GREEN
- [x] T014 [P] [US1] DTO — `CreateAnnouncementRequest`/`UpdateAnnouncementRequest`(@NotBlank title 1..200, body) + `AdminAnnouncementResponse` + 공개 `AnnouncementResponse`/목록항목 (controller 인접 또는 dto/)
- [x] T015 [US1] [TDD] 공개 공지 컨트롤러 통합 테스트(실패) — `backend/src/test/kotlin/com/writenote/controller/AnnouncementControllerIT.kt`: `GET /api/announcements`(비인증 200, 공개만), `GET /api/announcements/{id}`(비공개/없음 404) — contracts/public-announcements.md
- [x] T016 [US1] 공개 공지 컨트롤러 + SecurityConfig permitAll — `backend/.../controller/AnnouncementController.kt`(공개 GET 2) + SecurityConfig 에 `.requestMatchers(HttpMethod.GET, "/api/announcements", "/api/announcements/*").permitAll()` → T015 GREEN
- [x] T017 [US1] [TDD] 어드민 공지 CRUD 통합 테스트(실패) — `backend/src/test/kotlin/com/writenote/controller/admin/AdminAnnouncementControllerIT.kt`: 관리자 CRUD 200/201/204, 빈 값 400, 발행 토글, 비관리자 403 — contracts/admin-announcements.md
- [x] T018 [US1] 어드민 공지 컨트롤러 — `backend/.../controller/admin/AdminAnnouncementController.kt` (GET 전체/POST/PUT/DELETE) → T017 GREEN

### Frontend — 사용자 앱 (BE 후행)

- [x] T019 [P] [US1] 공지 API 래퍼 + React Query 훅 — `frontend/src/lib/api/announcements.ts` + `frontend/src/lib/query/useAnnouncements.ts` (목록·상세·배너 1건)
- [x] T020 [US1] `AnnouncementBanner` 컴포넌트 — `frontend/src/components/AnnouncementBanner.tsx`(client, 최신 공개 1건, 없으면 미표시) + `frontend/src/app/(main)/page.tsx` 홈 상단 삽입 (FR-004)
- [x] T021 [P] [US1] 공지 목록 페이지 — `frontend/src/app/(main)/notice/page.tsx` (최신순 목록 + 상세 링크)
- [x] T022 [P] [US1] 공지 상세 페이지 — `frontend/src/app/(main)/notice/[id]/page.tsx`
- [x] T023 [US4] "문의하기" 외부 링크 — `frontend/src/app/(main)/layout.tsx`(또는 footer)에 mailto 링크(기본 `jongbell4@gmail.com`, 채널 변경 가능). (FR-014)

### Frontend — 어드민 앱

- [x] T024 [P] [US1] 어드민 공지 API + 훅 — `admin-site/src/lib/api/announcements.ts` + query 훅 (CRUD)
- [x] T025 [US1] 어드민 공지 관리 화면 — `admin-site/src/app/(admin)/announcements/page.tsx`(목록, 공개/비공개·고정 표시) + `announcements/new`·`[id]/edit` 작성/수정 폼(client) — 작성 직후 `pnpm build`

**Checkpoint**: 공지 작성→발행→사용자 노출→비공개 왕복 동작 = MVP 성립. 단계 A 배포 단위(BE→FE→어드민 앱 Vercel 신규 프로젝트 1회 설정).

---

## Phase 4: User Story 2 - 회원 현황 조회 (Priority: P2)

**Goal**: 운영자가 어드민에서 가입자 목록·검색·상세를 조회(읽기 전용, 비밀값 미노출).

**Independent Test**: 회원 목록 → 이메일 검색 → 상세(가입일·마지막 로그인 등) 확인. 비밀번호 등 미노출.

### Backend

- [x] T026 [P] [US2] `AdminUserResponse` DTO(화이트리스트) — `backend/.../controller/admin/dto` (id/email/kakaoLinked/emailVerified/lastLoginAt/createdAt/projectCount; passwordHash·kakaoId·토큰 제외) — data-model.md
- [x] T027 [US2] [TDD] 회원 조회 통합 테스트(실패) — `backend/src/test/kotlin/com/writenote/controller/admin/AdminUserControllerIT.kt`: 목록 최신순·페이지, email 검색, 검색 무결과 빈배열, 상세 404, **비밀값 미노출 assert**(passwordHash 응답 부재), 비관리자 403 — contracts/admin-users.md
- [x] T028 [US2] 회원 조회 서비스 + projectCount 집계 — `backend/.../service/AdminUserService.kt` (목록·검색·상세, 작품 수 집계 쿼리 N+1 회피)
- [x] T029 [US2] 회원 조회 컨트롤러 — `backend/.../controller/admin/AdminUserController.kt` (`GET /api/admin/users`?page,size,q; `GET /api/admin/users/{id}`) → T027 GREEN

### Frontend — 어드민 앱

- [x] T030 [P] [US2] 회원 API + 훅 — `admin-site/src/lib/api/users.ts` + query 훅 (목록·검색·상세)
- [x] T031 [US2] 회원 조회 화면 — `admin-site/src/app/(admin)/users/page.tsx`(목록 + 검색 input) + `users/[id]/page.tsx`(상세) — 작성 직후 `pnpm build`

**Checkpoint**: 회원 조회 독립 동작. 단계 B 배포(BE→어드민 앱).

---

## Phase 5: User Story 3 - 사용 현황 통계 대시보드 (Priority: P3)

**Goal**: 어드민 대시보드에서 카운트 카드 + 최근 30일 가입 추이 그래프.

**Independent Test**: 대시보드 진입 → 카운트가 실제 DB와 일치 → 30일 그래프(빈 날 0) 표시. 데이터 0건도 오류 없음.

### Backend

- [x] T032 [P] [US3] 통계 DTO — `AdminStatsSummaryResponse`(totalUsers/newUsersToday/newUsersThisWeek/activeUsers/totalProjects) + signups points — contracts/admin-stats.md
- [x] T033 [US3] [TDD] 통계 집계 통합 테스트(실패) — `backend/src/test/kotlin/com/writenote/controller/admin/AdminStatsControllerIT.kt`: summary 카운트(오늘/이번주/활성7일 KST), signups 빈 날 0 채움·days 개수, 데이터 0건 시 0, 비관리자 403 — contracts/admin-stats.md
- [x] T034 [US3] `AdminStatsService` — `backend/.../service/AdminStatsService.kt` (KST 기준 집계, @Transactional(readOnly=true))
- [x] T035 [US3] 통계 컨트롤러 — `backend/.../controller/admin/AdminStatsController.kt` (`GET /api/admin/stats/summary`, `GET /api/admin/stats/signups?days=30`) → T033 GREEN

### Frontend — 어드민 앱

- [x] T036 [P] [US3] 통계 API + 훅 — `admin-site/src/lib/api/stats.ts` + query 훅
- [x] T037 [US3] 대시보드 화면 — `admin-site/src/app/(admin)/dashboard/page.tsx` (카운트 카드 + recharts 30일 가입 추이 막대/선) — 작성 직후 `pnpm build`

**Checkpoint**: 통계 독립 동작. 단계 C 배포(BE→어드민 앱).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T038 백엔드 전체 게이트 — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` GREEN
- [x] T039 [P] 사용자 앱 게이트 — `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- [x] T040 [P] 어드민 앱 게이트 — `cd admin-site && pnpm lint && pnpm typecheck && pnpm build`
- [ ] T041 quickstart.md 검증 절차 수행(스모크 + dogfooding 게이트) — 공지 왕복·비관리자 차단(§16 버그 있던 surface 직접 관찰)·통계 일치
- [ ] T042 어드민 앱 Vercel 신규 프로젝트 설정(Root=`admin-site`, Production Branch=`main`, env) + prod `ADMIN_EMAIL` 설정 + 배포 순서(BE 선행) 확인. 어드민은 정적 download-site와 달리 빌드 필요

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup(P1)**: 의존 없음, 즉시 시작
- **Foundational(P2)**: Setup 후. 모든 어드민 스토리 차단(T005-T008 완료 전 US1 어드민 CRUD/US2/US3 불가)
- **US1(P3)**: Foundational 후. 공개 공지(T009-T016)는 어드민 게이트와 독립이라 일부 병행 가능하나, 어드민 공지 화면(T024-T025)은 T008 필요
- **US2(P4) / US3(P5)**: Foundational 후. US1 과 독립(각자 테스트 가능)
- **Polish(P6)**: 원하는 스토리 완료 후

### User Story Dependencies
- US1: Foundational 후 시작, 타 스토리 무의존 (MVP)
- US2: Foundational 후, US1 무의존
- US3: Foundational 후, US1/US2 무의존
- US4(문의 링크): US1 단계에 동봉(T023), 독립 trivial

### Within Each User Story
- 테스트(TDD) 먼저 실패 확인 → 구현 GREEN
- 엔티티/마이그레이션 → repository → service → controller
- BE 완료 → FE(사용자 앱/어드민 앱)

---

## Parallel Opportunities

- Phase 1: T002, T003 병렬(T001 후)
- Phase 3 BE: T009, T010 병렬 / T014 [P] / 사용자앱 T019·T021·T022 병렬, 어드민 T024 [P]
- Phase 4: T026 [P], T030 [P]
- Phase 5: T032 [P], T036 [P]
- Polish: T039, T040 병렬(BE 게이트 T038과도 병렬 가능)

### Parallel Example: User Story 1
```bash
# BE 모델·마이그레이션 동시
Task: "Announcement 엔티티 in backend/.../entity/Announcement.kt"
Task: "V16__create_announcements.sql in backend/.../db/migration/"
# 사용자 앱 페이지 동시(API 훅 T019 후)
Task: "공지 목록 in frontend/src/app/(main)/notice/page.tsx"
Task: "공지 상세 in frontend/src/app/(main)/notice/[id]/page.tsx"
```

---

## Implementation Strategy

### MVP First (US1 = 단계 A)
1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & VALIDATE**(dogfooding) → 단계 A 배포(어드민 Vercel 1회 설정 포함)

### Incremental Delivery
- 단계 A(US1) 배포 = 운영 MVP → 단계 B(US2) → 단계 C(US3). 각 단계 BE 선행→FE 후행, 독립 배포.

---

## Notes
- [P] = 다른 파일·무의존. [Story] = 추적용.
- 어드민 FE task 작성 직후 `cd admin-site && pnpm build`(RSC 경계 검출).
- 백엔드 위임 시 `ktlintFormat` main+test 양쪽 / `rollbackFor = [Exception::class]` 배열 문법 / 비밀값 DTO 화이트리스트 준수.
- 로컬/IT DB 만 마이그레이션 적용(external-infra-safety). prod 는 컨펌 후 배포.
- 커밋은 사용자 요청 시에만.
