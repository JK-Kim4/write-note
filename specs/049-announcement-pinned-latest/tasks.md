---
description: "Task list — 공지사항 고정 슬롯 + 최신 슬롯"
---

# Tasks: 공지사항 고정 슬롯 + 최신 슬롯

**Input**: Design documents from `specs/049-announcement-pinned-latest/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/announcements-home.md, quickstart.md

**Tests**: 포함 — 프로젝트 TDD 규율(CLAUDE.md §5 HARD-GATE). BE = IT(MockMvc) 행위 검증, FE = vitest 렌더 행위. 시각(색·라이트/다크·한글)은 dogfooding 게이트(rule 14).

**Organization**: `/home` 조회 + FE 데이터 계층은 두 스토리 공통 전제 → Phase 2 Foundational. 화면 렌더 증분만 US1(고정 슬롯)·US2(최신 슬롯).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능(다른 파일, 미완 선행 의존 없음)
- **[Story]**: US1 / US2 (Setup·Foundational·Polish 은 라벨 없음)

## Path Conventions

- BE: `backend/src/main/kotlin/com/writenote/` · `backend/src/test/kotlin/com/writenote/`
- FE: `frontend/src/`
- 시각 SoT: `docs/research/2026-07-01-announcement-pinned-latest-mockup.html`

---

## Phase 1: Setup

**Purpose**: 실측 확인(rule 6) — 신규 스키마·의존성·에러코드 0, 기존 파일 정합.

- [x] T001 [P] 기존 파일·경로 정합 grep 확인: BE `entity/Announcement.kt`·`repository/AnnouncementRepository.kt`·`service/AnnouncementService.kt`·`controller/AnnouncementController.kt`·`model/response/AnnouncementResponse.kt` 존재 + `config/SecurityConfig.kt:78` `/api/announcements/*` permitAll 이 `/home` 커버 확인 + FE `lib/api/announcements.ts`·`lib/query/useAnnouncements.ts`·`components/AnnouncementBanner.tsx` 존재 확인. 마이그레이션·신규 의존성 없음 재확인.

---

## Phase 2: Foundational (Blocking — US1·US2 공통 전제)

**Purpose**: 두 슬롯 데이터를 서버측 pick+dedup 로 내려주는 `GET /api/announcements/home` + FE 데이터 계층. 두 스토리 모두 이 endpoint 를 소비.

**⚠️ 완료 전 어떤 스토리도 시작 불가.**

### 백엔드 (선행 배포)

- [x] T002 실패하는 IT 시나리오 작성(RED) — `backend/src/test/kotlin/com/writenote/controller/AnnouncementControllerIT.kt` 에 `GET /api/announcements/home` 케이스 추가(기존 `deleteAll` 격리 재사용): (a) 공개+고정 1 & 공개 비고정 1 → pinned=고정·latest=비고정, (b) 공개+고정 다수 → pinned=공개일 최신 고정 1, (c) 고정=공개일 최신 → latest=그다음 공개(dedup), (d) 공개 1건이며 고정 → pinned 객체·latest=null, (e) 고정 없음·공개 있음 → pinned=null·latest 최신, (f) 공개 0건 → 둘 다 null, (g) 미공개(고정 포함) 제외, (h) 비인증 200.
- [x] T003 [P] `AnnouncementRepository.kt` 에 `findFirstByIsPublishedTrueAndIsPinnedTrueOrderByPublishedAtDesc(): Optional<Announcement>` 추가.
- [x] T004 [P] `model/response/AnnouncementResponse.kt` 에 `HomeAnnouncementsResponse(pinned: AnnouncementSummaryResponse?, latest: AnnouncementSummaryResponse?)` 추가(기존 `AnnouncementSummaryResponse` 재사용, `isPinned` 미추가).
- [x] T005 `AnnouncementService.kt` 에 `@Transactional(readOnly = true) fun getHome(): HomeAnnouncementsResponse` 추가 — pinned=T003 쿼리, topTwo=`findAllByIsPublishedTrueOrderByPublishedAtDesc(PageRequest.of(0,2))`, latest=`topTwo.firstOrNull { it.id != pinned?.id }`, 각 `toSummary` 매핑(null 허용). (T003·T004 의존)
- [x] T006 `AnnouncementController.kt` 에 `@GetMapping("/home")` 추가 → `Result.success(announcementService.getHome())` (기존 Result envelope·Operation 패턴 정합). (T005 의존)
- [x] T007 BE 게이트 GREEN(포어그라운드): `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` — T002 전 시나리오 통과. (T002~T006 의존)

### 프론트 데이터 계층 (BE 코드와 병렬 작성 가능)

- [x] T008 [P] `lib/api/announcements.ts` 에 `getHomeAnnouncements(): Promise<HomeAnnouncements>` + 타입 `HomeAnnouncements = { pinned: AnnouncementSummary | null; latest: AnnouncementSummary | null }` 추가(`GET /api/announcements/home`, 기존 `apiFetch` 패턴).
- [x] T009 `lib/query/useAnnouncements.ts` 에 `useHomeAnnouncements()` 추가(`announcementKeys` 에 `home` 키 추가, 기존 `STALE_MS` 재사용). (T008 의존)

**Checkpoint**: `/home` 이 상태별 올바른 `{pinned, latest}` 반환(IT GREEN) + FE 훅 준비 → 스토리 진입 가능.

---

## Phase 3: User Story 1 — 고정 공지를 메인에서 구분해 본다 (Priority: P1) 🎯 MVP

**Goal**: 운영자가 고정한 공지가 홈에 최신과 구분되는 붉은 강조 슬롯으로 노출.

**Independent Test**: 어드민에서 한 공지 공개+고정 → 홈(/)에서 그 공지가 채운 붉은 카드(좌측 바·「고정」 배지·진한 제목)로 노출, 고정 해제 시 사라짐.

- [x] T010 [US1] 실패하는 vitest(RED) — `components/AnnouncementBanner.test.tsx`: `useHomeAnnouncements` mock 으로 (a) `{pinned, latest:null}` → 고정 배너 렌더·제목 표시·링크 `/notice/{pinned.id}`, (b) `{pinned:null, latest:null}` → 아무것도 안 렌더(null). 행위 검증(`getByText`/`getByRole('link')`).
- [x] T011 [US1] `components/AnnouncementBanner.tsx` 재구성 — `useLatestAnnouncement` → `useHomeAnnouncements` 로 교체, `pinned` 슬롯 렌더(강조 스타일: `--w-accent-soft` 채운 배경 + 좌측 `--w-accent` 세로 바 + 채운 「고정」 배지[솔리드 accent·흰 글자·핀 아이콘] + 진한 제목, 목업 대비), 둘 다 null 이면 `null` 반환. `useAnnouncements.ts` 의 이제 미사용 `useLatestAnnouncement` 는 grep 으로 타 소비처 없음 확인 후 제거(내 변경이 만든 orphan). (최신 슬롯은 US2)
- [x] T012 [US1] FE 게이트 GREEN(포어그라운드): `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` — T010 통과 + RSC 경계(build) 무위반.

**Checkpoint**: 홈에 고정 슬롯이 붉은 강조로 단독 노출(MVP). 배포 시 이 증분만으로도 "고정 식별" 가치 성립.

---

## Phase 4: User Story 2 — 고정과 별개로 최신 공지도 함께 본다 (Priority: P2)

**Goal**: 고정 슬롯 아래 최신 공지 슬롯 병행 노출, 같은 공지 중복 없음(dedup 은 서버측 완료).

**Independent Test**: 공개 공지 2건(1 고정·1 비고정) → 홈에 고정 슬롯 + 최신 슬롯 둘 다, 같은 공지 두 번 안 뜸. 고정=최신인 경우 최신 슬롯은 그다음 공지.

- [x] T013 [US2] vitest 확장 — `components/AnnouncementBanner.test.tsx`: (a) `{pinned, latest}` 둘 다 → 배너 2개·각 제목·각 링크 `/notice/{id}`(서로 다른 id), (b) `{pinned:null, latest}` → 최신 배너만 1개. (dedup 은 서버 책임이므로 FE 는 받은 값 렌더만 검증)
- [x] T014 [US2] `components/AnnouncementBanner.tsx` 확장 — `pinned` 아래 `latest` 슬롯 렌더(약 스타일: 흰 `--w-surface` 배경 + 붉은 테두리[accent 계열] + 아웃라인 「공지」 배지[accent-text·확성기 아이콘] + 보통 굵기 제목, 목업 대비), 세로 적층. 모든 null 조합 처리(고정만/최신만/없음). (T011 동일 파일 → US1 의존)
- [x] T015 [US2] FE 게이트 GREEN(포어그라운드): `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

**Checkpoint**: 두 슬롯 완성 — spec 전 FR 충족.

---

## Phase 5: Polish & Cross-Cutting

- [x] T016 Dogfooding 게이트(rule 25 — 전항 사용자 확인 후 통과 단정): 로컬 3종 기동(`docker compose up -d --wait postgres` → `bootRun --args='--spring.profiles.active=local'` → `pnpm dev`), 어드민으로 공지 상태 조성 후 홈에서 quickstart 전항 확인 — 둘 다/고정만/최신만/없음 · 라이트/다크 · 한글 제목 · 클릭→`/notice/{id}` · teal 잔재 없음(브랜드 테라코타).
- [x] T017 [P] dead code 결정(컨펌 필요): `AnnouncementRepository.findFirstByIsPublishedTrueOrderByIsPinnedDescPublishedAtDesc()` 미사용·본 기능이 대체 — 제거 or 잔존을 사용자 확정. 제거 시 grep 으로 타 참조 0 확인 후 삭제 + BE 게이트 재실행.
- [x] T018 [P] 배포 순서 명시(배포 시): BE(`/home` 신규) 선행 → FE(배너 재구성·색) 후행. `/notice` 목록·상세 페이지 색 정합은 범위 밖(필요 시 후속 트랙).

---

## Dependencies

- **Phase 1 → Phase 2 → (US1 → US2) → Phase 5**.
- Phase 2 내: T002(RED) 먼저 → T003·T004[P] → T005 → T006 → T007(GREEN). FE 데이터 T008 → T009 는 BE 코드(T003~T006)와 **병렬 작성 가능**(다른 언어/파일). 단 FE dogfooding 은 BE 배포/기동 후.
- US2(T013·T014)는 US1(T011)과 **같은 파일**(`AnnouncementBanner.tsx`) → US1 완료 후 진행(순차).
- **배포**: BE 선행 → FE 후행(FR: FE 가 `/home` 호출).

## Parallel Opportunities

- Phase 2: T003·T004 병렬(다른 파일). BE 트랙(T002~T007)과 FE 데이터 트랙(T008~T009) 병렬 작성.
- Phase 5: T017·T018 병렬.

## Implementation Strategy

- **MVP = Phase 1 + Phase 2 + US1**: 홈에 고정 슬롯이 붉은 강조로 노출 → "항상 고정 공지 식별" 핵심 가치. 이 단계에서 배포 가능.
- **US2 추가**: 최신 슬롯 병행 → 사용자 요구 완전 충족.
- 각 FE 스토리 끝에 게이트, 마지막에 통합 dogfooding(T016).

## 검증 규모 요약

- 총 18 task (Setup 1 · Foundational 8 · US1 3 · US2 3 · Polish 3).
- 신규 스키마·마이그레이션·에러코드·SecurityConfig 변경 0.
- 변경 파일: BE 4(repo·DTO·service·controller) + BE test 1 + FE 3(api·hook·banner) + FE test 1.
