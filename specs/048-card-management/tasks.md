---
description: "Task list — 048 카드 관리 (Card Management)"
---

# Tasks: 카드 관리 (Card Management)

**Input**: `specs/048-card-management/` 설계 문서 (spec·plan·research·data-model·contracts·quickstart)

**Prerequisites**: plan.md · spec.md (US1~US6) · data-model.md · contracts/cards-api.md · research.md

**Tests**: 포함 — 프로젝트 TDD HARD-GATE(§5). BE 매핑·검증·소유격리·재배정 가드·linkCount 는 유닛/IT 로 write-first. FE 순수 헬퍼(검색·필터·집필 그룹핑)는 유닛. 시각·상호작용(그리드·슬라이드오버·IME·집필 토글)은 dogfooding 게이트(rule 14/25).

**Organization**: 사용자 스토리별 phase. **배포 순서 = BE 선행 → FE 후행**(각 스토리의 BE 엔드포인트가 FE 보다 먼저 배포). additive 라 구 프론트 무손상.

**경로**: 백엔드 `backend/src/main/kotlin/com/writenote/` · `backend/src/test/kotlin/com/writenote/` · `backend/src/main/resources/db/migration/` · 프론트 `frontend/src/`

## 진행 현황 (2026-07-01 · 체크포인트 — 새 세션 인계)

- **US1~US5(카드 관리 탭) 완료 · 게이트 GREEN · dogfooding 확정.** BE: V30 로컬 적용(Flyway 30)·`/api/cards` 6엔드포인트·CardControllerIT 7 + **전체 110 클래스 GREEN**. FE: `/boards` [보드|카드] 탭·그리드·검색/필터(소속·종류 라벨)·상세/수정·재배정 잠금·삭제경고·**작품/시리즈 owner 칩**·**785 테스트**·build GREEN. dogfooding 사용자 승인(필터 두 축 라벨 + owner 칩 반영 후).
- **US6(집필 화면 카드 뷰, T045~T047) 구현 완료 · FE 게이트 GREEN**(typecheck·lint 0err·**790 테스트**(+5)·build). 신규 `components/b/{writingCardGroups.ts+test, WritingCardView.tsx, WritingCardDetail.tsx}` + `BoardReferencePanel` [보드|카드] 토글 + `useCardList(enabled)` 지연조회. 신규 BE 0(GET /api/cards + GET /boards/reference 재사용). **다음 = 마무리(T050 dogfooding·T051 배포·T052 surfacing).** 인계 문서 = `docs/handoff/2026-07-01-048-card-management-us6-kickoff.md`.
- **테스트 DB = 로컬 공유 Postgres**(Testcontainers 아님). V30 이미 로컬 적용, 신규 마이그레이션 0. DTO 이름 충돌 회피: `CreateStandaloneCardRequest`/`EditCardRequest`/`SetCardBoardRequest`, 응답 `CardItemResponse.kt`. 커밋됨(체크포인트).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능(다른 파일·미완 태스크 의존 없음)
- **[Story]**: US1~US6 (Setup/Foundational/Polish 은 라벨 없음)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 신규 소스 골격 마련(브라운필드 additive — 초기화 최소).

- [X] T001 [P] BE 신규 소스 스켈레톤 생성: `controller/CardController.kt`(@RequestMapping("/api/cards") 빈 클래스), `service/CardService.kt`, `model/request/CardRequests.kt`, `model/response/CardResponses.kt`
- [X] T002 [P] FE 신규 소스 스켈레톤 생성: `frontend/src/lib/api/cards.ts`, `frontend/src/lib/query/useCards.ts`, `frontend/src/lib/electron-api/cards.ts`, `frontend/src/components/cards/` 디렉토리

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 스키마·엔티티·공유 검증·데이터 계층 — 모든 스토리의 전제. **⚠️ 완료 전 어떤 스토리도 시작 불가.**

- [X] T003 BE V30 마이그레이션 작성: `backend/src/main/resources/db/migration/V30__add_card_user_and_nullable_board.sql` — `user_id` 추가→`boards.user_id` 백필→NOT NULL+`fk_cards_user`(ON DELETE CASCADE), `board_id` DROP NOT NULL, `idx_cards_user (user_id, created_at DESC)` (data-model 마이그레이션 SQL 그대로)
- [X] T004 BE Card 엔티티 확장: `entity/Card.kt` — `userId: Long` 추가(NOT NULL), `boardId: Long?` 로 nullable화
- [X] T005 [P] BE 공유 카드종류 검증 추출: `service/CardTypes.kt`(`ALLOWED_CARD_TYPES` + `normalizeCardType`) 신설 후 `service/BoardService.kt` 가 이를 사용하도록 치환(매퍼 중복 회피)
- [X] T006 BE (TDD) `BoardService.createCard` 가 user_id 를 채우는지 회귀 테스트 작성(먼저 실패): `backend/src/test/kotlin/com/writenote/service/BoardServiceCardUserIdTest.kt` — 보드 캔버스 카드 생성 후 그 카드 user_id == 보드 user_id
- [X] T007 BE `BoardService.createCard` 수정: 생성 Card 에 `userId = board.userId` 채움(T006 GREEN) — `service/BoardService.kt` (⚠️ NOT NULL 함정: 이 경로 누락 시 기존 보드 카드 생성이 런타임 파손)
- [X] T008 [P] BE CardRepository 확장: `repository/CardRepository.kt` — `findByIdAndUserId(id,userId)`, 본인 카드 전량 정렬조회(`created_at desc, id desc`; 파생 메서드 또는 `@Query`, `BoardRepository.findByUserIdOrderByUpdatedAtDesc` 선례 참조)
- [X] T009 [P] BE LinkRepository distinct 이웃 카운트 projection: `repository/LinkRepository.kt` — 카드 id 집합에 대해 source/target UNION 후 `COUNT(DISTINCT 상대카드)` group by(native), `countGroupedByBoardId` 선례 동형
- [X] T010 [P] BE (TDD) V30 백필 IT: `backend/src/test/kotlin/.../CardMigrationIT.kt`(**로컬 공유 Postgres @SpringBootTest — 격리 아님, rule 7-4; V30 로컬 적용 컨펌 후**) — 기존 보드 카드가 user_id 백필됨 + board_id nullable(독립 카드) 확인
- [X] T011 [P] FE 데이터 타입: `lib/api/cards.ts` — `CardItem`(id·boardId·boardName·body·type·linkCount·createdAt·updatedAt) + `apiFetch` client 골격(`error.code` 분기: BOARD_OWNER_INVALID 등)
- [X] T012 [P] FE useCards 골격: `lib/query/useCards.ts` — queryKey + 무효화 헬퍼(재배정/삭제 시 `useBoardDetail`·`useBoardsMine`·카드목록 invalidate)
- [X] T013 [P] FE electron 미러 골격: `lib/electron-api/cards.ts` (패턴 일치)

**Checkpoint**: 스키마·엔티티·소유 무결성·데이터 계층 준비 — 스토리 시작 가능.

---

## Phase 3: User Story 1 - 카드 목록 조회 + 소속 보드 확인 (Priority: P1) 🎯 MVP

**Goal**: `/boards` 카드 탭에서 여러 보드 카드 + 독립 카드를 한 그리드로, 소속 보드명(독립="속한 보드 없음")과 함께 생성일 내림차순으로 본다. 검색·필터로 찾는다.

**Independent Test**: 서로 다른 보드 카드 + 독립 카드가 있는 사용자로 카드 탭 진입 → 전부 한 그리드에 소속 보드명과 함께 최신 생성순. 검색·필터 동작. 타인 카드 미노출.

### Tests (write-first)

- [X] T014 [P] [US1] (TDD) `CardService.listMine` IT: `backend/src/test/kotlin/.../CardServiceListIT.kt` — 본인 카드만(보드+독립), created_at desc·id desc, boardName/linkCount 정확, 타인 카드 제외
- [X] T015 [P] [US1] (TDD) linkCount distinct 이웃 테스트: 같은 IT 또는 `LinkRepositoryNeighborTest.kt` — A↔B 양방향 링크 2개여도 이웃 카운트 1, 링크 없는 카드 0
- [X] T016 [P] [US1] (FE 순수) 검색·필터 헬퍼 테스트: `frontend/src/components/cards/cardFilter.test.ts` — 소속(전체/보드소속/독립)·종류(4종+무지정)·문자열(내용·보드명) 필터, 정렬 불변

### Implementation (BE 선행)

- [X] T017 [P] [US1] `CardItemResponse` DTO: `model/response/CardResponses.kt` (data-model 정의대로)
- [X] T018 [US1] `CardService.listMine(userId)`: `service/CardService.kt` — 전량 조회 + boardName 일괄 매핑(distinct boardId→`boardRepository.findAllById`) + linkCount projection → `CardItemResponse` (N+1 회피)
- [X] T019 [US1] `GET /api/cards`: `controller/CardController.kt` — `@AuthenticationPrincipal` 유저 스코프, `Result<List<CardItemResponse>>`

### Implementation (FE 후행)

- [X] T020 [US1] `lib/api/cards.ts` `listCards()` + `lib/query/useCards.ts` `useCardList` 훅
- [X] T021 [US1] `/boards` 탭 바 [보드 | 카드] + 카드 뷰 마운트(`?tab=` 등): `app/(main)/boards/page.tsx` (기존 보드 목록 뷰 보존)
- [X] T022 [P] [US1] 카드 그리드·타일: `components/cards/CardGrid.tsx`·`CardTile.tsx` — 종류색 틴트(cardKinds 재사용)·본문 미리보기·소속 보드명/독립·연결 배지
- [X] T023 [US1] 순수 필터 헬퍼 구현: `components/cards/cardFilter.ts` (T016 GREEN)
- [X] T024 [US1] 검색창 + 필터 칩(소속·종류) + 빈 상태 오버레이(화면 컨텍스트 유지): 카드 뷰 컨테이너 `components/cards/CardManager.tsx`

**Checkpoint**: MVP — 카드 목록·소속·검색·필터가 독립 동작. **BE(T017~T019) 배포 후 FE 배포.**

---

## Phase 4: User Story 2 - 독립 카드 생성 (Priority: P2)

**Goal**: 카드 탭에서 보드 없는 독립 카드를 새로 만들어 즉시 목록에 표시.

**Independent Test**: 카드 탭에서 본문 입력→저장→board_id null·본인 소유 독립 카드가 목록 최상단(created_at desc)에 나타남. 빈 본문 저장 막힘(FE 가드).

### Tests (write-first)

- [X] T025 [P] [US2] (TDD) `CardService.createIndependent` IT: `.../CardServiceCreateIT.kt` — board_id null·user_id=principal, 빈 body 허용(default ''), 4종 외 type 400, 무지정 허용

### Implementation

- [X] T026 [US2] `CreateCardRequest`(body?·type?) + `CardService.createIndependent(userId,req)`: `model/request/CardRequests.kt`·`service/CardService.kt` (normalizeCardType 재사용, pos 0)
- [X] T027 [US2] `POST /api/cards`: `controller/CardController.kt` — 201 `Result<CardItemResponse>`
- [X] T028 [US2] FE `createCard()` + `useCreateCard`(성공 시 카드목록 invalidate): `lib/api/cards.ts`·`lib/query/useCards.ts`
- [X] T029 [US2] 독립 카드 인라인 생성 폼: `components/cards/CardCreateForm.tsx` — 본문 필수 FE 가드 + **IME 조합 가드**(`!e.nativeEvent.isComposing`, code-quality §생성 폼 IME)

**Checkpoint**: US1 + 독립 카드 생성 독립 동작.

---

## Phase 5: User Story 3 - 카드 상세 확인 및 수정 (Priority: P3)

**Goal**: 목록에서 카드를 열어 종류·본문 확인, 본문·종류 수정·저장(보드 카드·독립 공통).

**Independent Test**: 카드 열기→종류(무지정="무지정")·본문 표시→수정·저장→재오픈 시 유지.

### Tests (write-first)

- [X] T030 [P] [US3] (TDD) `CardService.getCard/updateCard` IT: `.../CardServiceDetailIT.kt` — 유저 스코프 404(타인), 종류 4종 검증, 본문/종류 수정 반영

### Implementation

- [X] T031 [US3] `UpdateCardRequest`(body?·type?) + `CardService.getCard`·`updateCard`: `model/request/CardRequests.kt`·`service/CardService.kt` (findByIdAndUserId, normalizeCardType)
- [X] T032 [US3] `GET /api/cards/{id}` + `PATCH /api/cards/{id}`: `controller/CardController.kt`
- [X] T033 [US3] FE `getCard`/`updateCard` + 훅: `lib/api/cards.ts`·`lib/query/useCards.ts`(수정 성공 시 목록 invalidate)
- [X] T034 [US3] 우측 슬라이드오버 상세: `components/cards/CardDetailSheet.tsx` — 종류 트레이(4종+무지정)·본문 편집·저장, portal(`createPortal(document.body)`, code-quality §stacking)

**Checkpoint**: 상세·수정 독립 동작.

---

## Phase 6: User Story 4 - 카드 삭제 및 연결 경고 (Priority: P3)

**Goal**: 카드 삭제. 연결 있는 카드는 확정 전 "N개의 다른 카드와 연결" 경고, 확정 시 카드+링크 cascade.

**Independent Test**: 연결 3인 카드 삭제 시도→경고+카운트→확정 시 카드·링크 사라짐. 연결 0 카드는 경고 없이 삭제. 다른 카드/보드 무영향.

### Tests (write-first)

- [X] T035 [P] [US4] (TDD) `CardService.deleteCard` IT: `.../CardServiceDeleteIT.kt` — 유저 스코프 404(타인), 삭제 시 걸린 링크 cascade 정리, 연결 상대 카드 보존

### Implementation

- [X] T036 [US4] `CardService.deleteCard(userId,id)`: `service/CardService.kt` (findByIdAndUserId → delete, 링크는 DB cascade)
- [X] T037 [US4] `DELETE /api/cards/{id}`: `controller/CardController.kt` — 204
- [X] T038 [US4] FE `deleteCard` + `useDeleteCard`(목록 invalidate, 링크 중복삭제 금지 — cascade 위임): `lib/api/cards.ts`·`lib/query/useCards.ts`
- [X] T039 [US4] 삭제 경고 다이얼로그: `components/cards/CardDeleteDialog.tsx` — linkCount>0 시 "N개의 다른 카드와 연결" 경고, 0 시 일반 확인, portal

**Checkpoint**: 삭제·경고 독립 동작.

---

## Phase 7: User Story 5 - 카드의 소속 보드 변경 (연결 없는 카드) (Priority: P4)

**Goal**: 연결 없는 카드의 소속 보드 변경(붙이기·떼기·옮기기). 연결 있는 카드는 잠금.

**Independent Test**: 독립→보드 배정 시 그 보드 캔버스 등장, 연결 없는 보드 카드 독립화/이동 반영, 타인 보드 거부, 연결 있는 카드 재배정 비활성/거부.

### Tests (write-first)

- [X] T040 [P] [US5] (TDD) `CardService.setCardBoard` IT: `.../CardServiceReassignIT.kt` — 붙이기(board_id set·pos 0)/떼기(null)/옮기기, 연결 있으면 400(ValidationException), 타인·없는 대상 보드 400(BOARD_OWNER_INVALID), 대상 보드 본인 소유 검증

### Implementation

- [X] T041 [US5] `SetCardBoardRequest`(boardId?) + `CardService.setCardBoard`: `model/request/CardRequests.kt`·`service/CardService.kt` — linkCount>0 거부, boardId!=null 이면 `boardRepository.findByIdAndUserId`, 배정 시 posX/posY=0
- [X] T042 [US5] `PATCH /api/cards/{id}/board`: `controller/CardController.kt`
- [X] T043 [US5] FE `setCardBoard` + `useSetCardBoard`: `lib/api/cards.ts`·`lib/query/useCards.ts` — 성공 시 **해당 board `useBoardDetail` + `useBoardsMine` + 카드목록 invalidate**(캔버스 stale 방지)
- [X] T044 [US5] 상세 슬라이드오버 소속 보드 select(재배정) + 연결 있는 카드 잠금 UI + 안내: `components/cards/CardDetailSheet.tsx`

**Checkpoint**: 재배정 독립 동작.

---

## Phase 8: User Story 6 - 집필 중 카드 모아 보기 (Priority: P5) — FE-only, 신규 BE 0

**Goal**: 집필 화면 "보드 참조" 패널에 [보드 | 카드] 토글. 카드 뷰 = 그 작품 관련 보드 카드 + 독립 카드를 **이 작품 보드 → 시리즈 보드 → 독립** 3단 그룹(각 그룹 생성일 내림차순).

**Independent Test**: 집필 화면 참조 패널 [카드] 전환 → 그 작품 보드/시리즈 보드/독립 3단 그룹 표시(다른 작품 카드 제외), 카드 열기로 종류·내용 확인, 관련 카드 0 시 빈 안내.

### Tests (write-first)

- [X] T045 [P] [US6] (FE 순수) 3단 그룹핑 헬퍼 테스트: `components/b/writingCardGroups.test.ts` — 참조 보드 id 집합(workBoards/seriesBoards) + 독립 → work/series/solo 그룹 분류, 각 그룹 created_at desc, 무관 작품 카드 제외

### Implementation (신규 BE 0 — 기존 계약 재사용)

- [X] T046 [US6] 그룹핑 순수 헬퍼: `components/b/writingCardGroups.ts` (T045 GREEN) — `GET /api/cards`(전량) + `GET /boards/reference`(그 작품 보드 id) 결합·필터
- [X] T047 [US6] `BoardReferencePanel` 에 [보드 | 카드] 토글 + 카드 뷰 그룹 렌더(CardTile 재사용) + 카드 열기(**읽기 전용** 중앙 상세 `WritingCardDetail` — 목업/research D9 정합, rule-28 화해: "슬라이드오버 재사용"의 literal=편집 시트 마운트는 목업의 읽기 전용 의도와 모순이라 열람 전용 뷰어로 화해) + 빈 상태: `components/b/BoardReferencePanel.tsx`·`WritingCardView.tsx`·`WritingCardDetail.tsx` (기존 보드 참조 뷰 보존, 카드 뷰는 최상위 분기라 참조 보드 0+독립 카드 N 도달 가능)

**Checkpoint**: 집필 카드 뷰 독립 동작.

---

## Phase 9: Polish & Cross-Cutting

- [X] T048 [P] BE 게이트: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` (ktlintFormat main+test 양쪽)
- [X] T049 [P] FE 게이트: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` + 회귀 grep(기존 보드 카드 생성·편집·연결·삭제 / 보드 참조 무변경)
- [ ] T050 dogfooding 게이트(quickstart 전항): 로컬 BE+DB+FE 3개 기동 → R1~R4 체크리스트 전항 사용자 확인 후 통과 단정(rule 14/25) — 그리드·검색·필터·슬라이드오버·IME·삭제경고·재배정·집필 3단 그룹·라이트/다크·한국어
- [ ] T051 배포: BE 선행(V30 + 신규 계약) → FE 후행. 배포 전 베이스 정합(`git log HEAD..origin/develop`, rule 18) + 운영 Flyway 버전 확인(rule 22)
- [ ] T052 [P] 범위 밖 잔여 surfacing: `~/obsidian/write-note/03-ISSUES.md` 후보로 등재(회수는 후속, rule 28) — (a) 고아 memo FE 코드(`lib/api/memo.ts`·`lib/query/useMemos.ts`·`lib/memoView.ts`·`lib/electron-api/memos.ts`) 정리, (b) **집필 카드 뷰 전량 로드 후 클라 필터**(`WritingCardView`+`writingCardGroups`) — 현재 MVP 의도(research D9, `GET /api/cards` 유저 스코프라 현 교차노출 0)이나 카드 급증·향후 공유/읽기전용 집필 화면 재사용 시 `GET /api/cards?projectId=` 서버 필터 도입 검토(코드리뷰 P3, 2026-07-01)

---

## Dependencies & Execution Order

### Phase 의존
- Setup(P1) → Foundational(P2, 모든 스토리 차단) → US1~US6 → Polish(P9)
- **Foundational 완료 전 어떤 스토리도 시작 불가** (마이그레이션·엔티티·createCard user_id·리포지토리).

### Story 의존
- US1(P1): Foundational 후 시작, MVP. 다른 스토리 무의존.
- US2·US3·US4·US5: Foundational 후 각각 독립(상세/삭제/재배정 UI 는 US3 의 슬라이드오버 컴포넌트를 공유 — US4·US5 는 US3 이후가 자연스러움).
- US6(P5): US1 의 CardTile·US3 의 상세 슬라이드오버 재사용 → US1·US3 이후. BE 무의존(기존 계약).

### 배포 순서(HARD-GATE)
- 각 스토리: **BE 태스크 배포 → FE 태스크 배포** (additive, 구 프론트 무손상). US6 은 FE 단독.

### Story 내
- 테스트 write-first(FAIL 확인) → 모델/DTO → 서비스 → 엔드포인트 → FE api → 훅 → 컴포넌트.

## Parallel Opportunities

- Setup T001·T002 병렬.
- Foundational: T005·T008·T009·T010·T011·T012·T013 병렬(T003→T004→T007 은 순차, T006 은 T007 전).
- 각 스토리 내 테스트([P])·DTO([P])·독립 컴포넌트([P]) 병렬.
- Foundational 완료 후 US1~US5 는 인력 있으면 병렬 가능(단 US3 슬라이드오버를 US4/US5/US6 이 공유하므로 US3 선행 권장).

## Parallel Example: Foundational

```bash
Task: "T005 CardTypes 추출 (service/CardTypes.kt)"
Task: "T008 CardRepository 확장 (repository/CardRepository.kt)"
Task: "T009 LinkRepository 이웃 카운트 projection (repository/LinkRepository.kt)"
Task: "T011 FE CardItem 타입 (lib/api/cards.ts)"
Task: "T012 FE useCards 골격 (lib/query/useCards.ts)"
```

## Implementation Strategy

### MVP (US1)
1. Phase 1 Setup → Phase 2 Foundational(⚠️ createCard user_id 회귀 태스크 T006/T007 포함) → Phase 3 US1.
2. **STOP & VALIDATE**: 카드 목록·소속·검색·필터 dogfooding. BE 선행 배포 후 FE.

### 증분 배포
- Foundational → US1(MVP) → US2 → US3 → US4 → US5 → US6. 각 스토리 BE 선행→FE, 독립 검증 후 다음.

### 라운드 매핑(plan)
- R1 = Phase 2 + 각 스토리 BE(T017~T019·T026~T027·T031~T032·T036~T037·T041~T042) / R2·R3 = 각 스토리 FE / R4 = US6.

## Notes

- [P] = 다른 파일·무의존. [Story] = 추적용.
- **T006/T007(createCard user_id) 는 기존 보드 캔버스를 깨뜨리는 회귀 지점 — 별도 태스크 + 회귀 테스트로 반드시 유지**(advisor·rule 27 계열).
- **T015(linkCount distinct) 는 native UNION+COUNT(DISTINCT) 정확성이 틀리기 쉬운 지점 — 양방향 링크 케이스 명시 테스트.**
- 로컬/운영 DB 마이그레이션 적용은 사용자 컨펌(external-infra-safety §1) — **테스트 DB 가 로컬 공유 Postgres**(Testcontainers 아님)라 `./gradlew test`/`build`/`bootRun` 자체가 V30 을 로컬 dev DB 에 적용. 공유 비격리 DB 주의(rule 7-4). subagent 위임 시 로컬 dev DB 적용 금지 명시 + 완료 후 실제 상태 확인(rule 13).
- 태스크·논리 그룹마다 커밋.
