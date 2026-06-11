---
description: "Task list for Round 1 스키마 확장 기능"
---

# Tasks: Round 1 스키마 확장 기능 — 곁쪽지 삭제·설정 영속·등장인물 확장

**Input**: Design documents from `specs/019-round1-schema-extensions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-contracts.md, quickstart.md

**Tests**: 본 프로젝트는 TDD HARD-GATE(상태 전이·매핑·검증 로직은 테스트 우선 — `~/.claude/rules/shared/testing-strategy.md` + CLAUDE.md). 백엔드 service/controller 의 상태 전이(soft-delete·restore·설정 upsert·gender 검증)와 매핑은 테스트 태스크 포함. 단순 DTO 필드 추가·정적 UI 는 테스트 생략.

**Organization**: User Story 단위로 그룹화 — 세 US 는 상호 의존 0 이라 독립 구현·검증 가능. 파일 충돌도 거의 없음(Memo / UserSetting / Character 분리).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능(다른 파일, 미완 태스크 의존 없음)
- **[Story]**: US1/US2/US3 — 추적용
- 모든 태스크에 정확한 파일 경로 명시

## Path Conventions

- 백엔드: `backend/src/main/kotlin/com/writenote/`, `backend/src/test/kotlin/com/writenote/`
- 마이그레이션: `backend/src/main/resources/db/migration/`
- 프론트: `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 구현 진입 전 환경·정합 확인

- [x] T001 로컬 dev DB 기동 — `docker compose up -d --wait postgres` (마이그레이션 V9~V11 적용 대상, 운영 Supabase 는 Round 4 일괄이므로 건드리지 않음)
- [x] T002 최신 마이그레이션 번호 재확인 — `ls backend/src/main/resources/db/migration/` 로 V8 이 최신이고 V9 가 비어있는지 grep (agent-workflow-discipline §6 — implement 진입 직전 실측)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 세 User Story 공통 차단 의존 — **없음**.

세 US 는 서로 다른 테이블/엔티티(Memo / UserSetting / Character)를 다루고 상호 의존이 0 이라, 공통 선행 태스크가 없다. 각 US 의 마이그레이션·엔티티는 해당 US 페이즈 안에 둔다. Phase 1 완료 후 US1/US2/US3 를 **임의 순서·병렬**로 진입 가능.

**Checkpoint**: Phase 1 완료 → 어느 US 든 즉시 착수 가능

---

## Phase 3: User Story 1 - 곁쪽지 버리기 + 되돌리기 (Priority: P1) 🎯 MVP

**Goal**: 책상에서 곁쪽지를 버리고(soft-delete) 되돌릴 수 있다. 버린 곁쪽지는 모든 목록 표면에서 숨겨지고, 되돌리면 작품 연결·고정까지 복귀.

**Independent Test**: 책상에서 곁쪽지 1장 버리기 → 목록·작품 서랍·재진입 카드에서 사라짐 확인 → 되돌리기 → 목록 복귀 + 작품 연결 보존 확인.

### Tests for User Story 1 (TDD — 구현 전 작성·실패 확인)

- [x] T003 [P] [US1] `MemoEditService.restoreMemo` + `deleteMemo`(soft) 상태 전이 테스트 — `backend/src/test/kotlin/com/writenote/service/MemoEditServiceTest.kt`: 삭제 시 `deletedAt` 기록·연결행 보존, restore 시 `deletedAt=null`·연결 복귀, 삭제/복원 멱등, 타 사용자 404
- [x] T004 [P] [US1] 목록 deleted 제외 통합 테스트 — `backend/src/test/kotlin/com/writenote/repository/MemoSoftDeleteFilterIT.kt`: 삭제된 메모가 전체목록·미분류·작품필터·인물필터·태그·검색·작품서랍 7개 경로에서 제외, 복원 시 재노출 (Testcontainers)
- [x] T005 [P] [US1] restore 엔드포인트 web 테스트 — `backend/src/test/kotlin/com/writenote/controller/MemoRestoreWebTest.kt`: `POST /api/memos/{id}/restore` 200+MemoResponse, 미존재 404, 미인증 401

### Implementation for User Story 1

- [x] T006 [US1] 마이그레이션 V9 — `backend/src/main/resources/db/migration/V9__add_memos_deleted_at.sql`: `ALTER TABLE memos ADD COLUMN deleted_at TIMESTAMPTZ` + `CREATE INDEX idx_memos_user_active ON memos(user_id) WHERE deleted_at IS NULL` (data-model §1)
- [x] T007 [US1] `Memo` 엔티티에 `deletedAt: Instant?` 추가 — `backend/src/main/kotlin/com/writenote/entity/Memo.kt`
- [x] T008 [US1] `MemoRepository` 필터 — `backend/src/main/kotlin/com/writenote/repository/MemoRepository.kt`: JPQL 6개(`findAllWithConnectionsByUserId`·`findUnclassifiedByUserId`·`...ByProjectId`·`...ByCharacterId`·`...ByQuery`)에 `AND m.deletedAt IS NULL`(value+count 양쪽), native(`findByUserIdAndTagNative`)에 `AND m.deleted_at IS NULL`, 신규 `findByIdAndUserIdAndDeletedAtIsNull` 추가 (research D1)
- [x] T009 [US1] `MemoProjectRepository.findAllByProjectIdWithMemo` 에 `AND m.deletedAt IS NULL` — `backend/src/main/kotlin/com/writenote/repository/MemoProjectRepository.kt` (작품 서랍·재진입 카드 경로)
- [x] T010 [US1] 단건/수정 경로를 `findByIdAndUserIdAndDeletedAtIsNull` 로 교체 — `MemoQueryService.kt`(getMemo·toResponseWithConnections), `MemoEditService.kt`(updateMemo), `MemoCurationService.kt`, `MemoPinService.kt`. delete/restore 만 `findByIdAndUserId`(deleted 포함) 유지 (research D1)
- [x] T011 [US1] `MemoEditService.deleteMemo` soft 전환 + `restoreMemo` 신설 — `backend/src/main/kotlin/com/writenote/service/MemoEditService.kt`: deleteMemo 가 연결행 보존하고 `deletedAt=now()` 저장, restoreMemo(userId,memoId) 가 `deletedAt=null` 후 `buildResponse` 반환 (T003 통과)
- [x] T012 [US1] `MemoController` 에 `POST /{id}/restore` + 기존 DELETE Swagger description 갱신("버리기·복원 가능") — `backend/src/main/kotlin/com/writenote/controller/MemoController.kt` (T005 통과, contracts US1)
- [x] T013 [P] [US1] Toast 컴포넌트 포팅 — `frontend/src/components/ui/Toast.tsx`: desktop `Toast.tsx` 1:1 + `'use client'`(onClick prop, RSC 경계 HARD-GATE). CSS 는 기존 `desktop-app.css:910` 재사용(추가 불요) (research D8)
- [x] T014 [P] [US1] `restoreMemo` API 클라이언트 — `frontend/src/lib/api/memo.ts`: `POST /api/memos/{id}/restore` 호출 함수 추가
- [x] T015 [US1] `webElectronApi.memos` 에 `delete`/`restore` 추가 + 보류 주석 해소 — `frontend/src/lib/electron-api/memos.ts`(12-13행 주석 제거, delete→`deleteMemo`, restore→`restoreMemo`) (T014 의존)
- [x] T016 [US1] 책상 삭제 UX — `frontend/src/app/memos/page.tsx`: desktop `MemoInboxScreen.tsx:90-104` 1:1(낙관적 제거 + `pendingDelete {id,seq}` state + Toast key=seq remount + 되돌리기 시 restore 후 재로드) (T013·T015 의존)
- [x] T017 [P] [US1] 책상 삭제/되돌리기 컴포넌트 테스트 — `frontend/src/app/memos/page.test.tsx`: 버리기 클릭 시 목록 제거 + Toast 노출, 되돌리기 클릭 시 restore 호출(RTL, msw 경계 mock)

**Checkpoint**: US1 독립 동작 — 책상 버리기/되돌리기 풀 사이클, 모든 표면 deleted 제외

---

## Phase 4: User Story 2 - 환경설정 다기기 동기화 (Priority: P2)

**Goal**: 테마·작성 모드·원고지 크기 3종이 계정에 묶여 서버 저장되고, 다른 기기 진입 시 반영. FOUC 0.

**Independent Test**: 브라우저 프로필 A 에서 다크 변경 → 프로필 B 로그인 → 다크 적용. 오프라인 변경 비차단. 새로고침 FOUC 0.

### Tests for User Story 2 (TDD)

- [x] T018 [P] [US2] `SettingsService` 검증·upsert 테스트 — `backend/src/test/kotlin/com/writenote/service/SettingsServiceTest.kt`: 허용 key/value 통과, 허용 외 거부, 부분 맵 per-key upsert(보낸 key 만 갱신·LWW), 미저장 사용자 빈 맵
- [x] T019 [P] [US2] settings 엔드포인트 web 테스트 — `backend/src/test/kotlin/com/writenote/controller/SettingsControllerWebTest.kt`: `GET /api/settings` 200, `PUT` 부분 갱신 200, 허용 외 value 400(VALIDATION_FAILED), 미인증 401

### Implementation for User Story 2

- [x] T020 [US2] 마이그레이션 V10 — `backend/src/main/resources/db/migration/V10__create_user_settings.sql`: `user_settings(user_id FK, key, value, updated_at, PK(user_id,key))` (data-model §2)
- [x] T021 [US2] `UserSetting` 엔티티(복합키 `@IdClass` 또는 `@EmbeddedId`) — `backend/src/main/kotlin/com/writenote/entity/UserSetting.kt`
- [x] T022 [US2] `UserSettingRepository` — `backend/src/main/kotlin/com/writenote/repository/UserSettingRepository.kt`: `findAllByUserId`
- [x] T023 [US2] 설정 request/response DTO — `backend/src/main/kotlin/com/writenote/model/request/UpdateSettingsRequest.kt` + `model/response/SettingsResponse.kt`(`settings: Map<String,String>`) (contracts US2)
- [x] T024 [US2] `SettingsService` — `backend/src/main/kotlin/com/writenote/service/SettingsService.kt`: allowlist(theme/writingMode/manuscriptSize) 검증 + per-key upsert + 조회 (T018 통과, research D3)
- [x] T025 [US2] `SettingsController` — `backend/src/main/kotlin/com/writenote/controller/SettingsController.kt`: `GET`/`PUT /api/settings` (T019 통과)
- [x] T026 [P] [US2] settings API 클라이언트 — `frontend/src/lib/api/settings.ts`: `fetchSettings`/`putSettings`(Round 1 신규 — 기존 `lib/electron-api/settings.ts` 의 localStorage shim 과 다른 파일)
- [x] T027 [US2] `PreferencesSync` 컴포넌트 — `frontend/src/components/PreferencesSync.tsx`(`'use client'`): 인증 확정 후 1회 `fetchSettings`→store 주입(빈 응답이면 현재 로컬값 시딩 PUT) + store 변경 구독 디바운스 `putSettings`. **`manuscriptSize` 직렬화 경계 처리**: DB·API 는 문자열(`"400"`), store `ManuscriptSize` 는 숫자(`400`) — 서버→store 주입 시 `Number()`, store→PUT 시 `String()` 변환(허용값 200/400/1000 외는 무시). theme·writingMode 는 문자열 그대로 (research D4, FR-008, data-model §2)
- [x] T028 [US2] `PreferencesSync` 를 루트 레이아웃에 마운트 — `frontend/src/app/layout.tsx`: FOUC blocking inline script(38행)는 **무변경**, PreferencesSync 만 추가 (FR-009, SC-004)
- [x] T029 [P] [US2] `PreferencesSync` 테스트 — `frontend/src/components/PreferencesSync.test.tsx`: 서버값 주입 시 store 반영, 빈 응답 시 로컬값 시딩 PUT, 변경 시 putSettings 디바운스 호출(msw)

**Checkpoint**: US2 독립 동작 — 다기기 동기화, FOUC 0, 오프라인 비차단

---

## Phase 5: User Story 3 - 등장인물 확장 + 관리 진입 (Priority: P3)

**Goal**: 인물에 나이(자유 텍스트)·성별(선택지)·특징(자유 텍스트) 기록. Rail 등장인물 진입 메뉴.

**Independent Test**: 인물에 나이·성별·특징 저장 → 목록·집필실 인물 패널 표시. 기존 인물 무손상. Rail 메뉴 진입.

### Tests for User Story 3 (TDD)

- [x] T030 [P] [US3] gender 검증 + 3필드 매핑 테스트 — `backend/src/test/kotlin/com/writenote/service/CharacterServiceTest.kt`(기존 파일 확장): age/gender/traits create·update 매핑, gender 허용 외 값 거부, NULL(비움) 허용, 기존 인물(새 필드 null) 무손상
- [x] T031 [P] [US3] Character 엔드포인트 IT 확장 — `backend/src/test/kotlin/com/writenote/controller/CharacterControllerIT.kt`(기존 확장): create/get/update 응답에 age·gender·traits 포함, 허용 외 gender 400

### Implementation for User Story 3

- [x] T032 [US3] 마이그레이션 V11 — `backend/src/main/resources/db/migration/V11__expand_characters_age_gender_traits.sql`: `age VARCHAR(80)`·`gender VARCHAR(16) CHECK(IN MALE/FEMALE/OTHER)`·`traits TEXT CHECK(<=10000)` (data-model §3)
- [x] T033 [US3] `Character` 엔티티 3필드 추가 — `backend/src/main/kotlin/com/writenote/entity/Character.kt`
- [x] T034 [P] [US3] `CreateCharacterRequest`/`UpdateCharacterRequest` 에 age·gender·traits + 검증 — `backend/src/main/kotlin/com/writenote/model/request/CreateCharacterRequest.kt`·`UpdateCharacterRequest.kt`(`@field:Size`, gender 허용값) (contracts US3)
- [x] T035 [P] [US3] `CharacterResponse` 3필드 — `backend/src/main/kotlin/com/writenote/model/response/CharacterResponse.kt`
- [x] T036 [US3] `CharacterMapper`/`CharacterService` 매핑 — `backend/src/main/kotlin/com/writenote/mapper/CharacterMapper.kt`·`service/CharacterService.kt`: 3필드 create/update/response 반영 + gender 검증 (T030·T031 통과, T033·T034·T035 의존)
- [x] T037 [P] [US3] `CreateCharacterInput` 타입 확장 — `frontend/src/lib/api/characters.ts`: age?·gender?·traits?
- [x] T038 [US3] `CharacterForm` 입력 확장 — `frontend/src/components/projects/CharacterForm.tsx`: 나이(FormInput) + 성별 드롭다운(비움/남/여/기타 ↔ null/MALE/FEMALE/OTHER) + 특징(FormTextarea) (T037 의존)
- [x] T039 [P] [US3] 인물 목록·집필실 패널 새 필드 표시 — `frontend/src/components/projects/CharacterList.tsx`·`components/workspace/CharacterPanel.tsx`: gender 코드→한글 표시, age·traits 노출 (FR-014)
- [x] T040 [US3] Rail 등장인물 메뉴 — `frontend/src/components/workspace/Rail.tsx`: Item 추가(label "등장인물", `getLastProject()`→`/projects/{id}/characters`, 없으면 `/library`, `match: p.includes("/characters")`) (research D7, FR-015)
- [x] T041 [P] [US3] CharacterForm 테스트 확장 — `frontend/src/app/projects/[id]/characters/page.test.tsx`(기존 확장): 나이·성별·특징 입력·저장, gender 드롭다운 비움 허용

**Checkpoint**: US3 독립 동작 — 인물 3필드 입력·표시, 기존 인물 무손상, Rail 진입

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 전 US 마무리·게이트

- [x] T042 백엔드 전체 게이트 — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` (main+test 양쪽 ktlint — agent-workflow-discipline §4)
- [x] T043 프론트 전체 게이트 — `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build`(RSC 경계 검출은 build)
- [x] T044 quickstart dogfooding — `specs/019-round1-schema-extensions/quickstart.md` 3 US 수동 검증(책상 버리기/되돌리기 + 다기기 설정 동기화 + 인물 3필드·Rail). 한국어 입력 영역 변경 없음 확인
- [x] T045 GitHub 이슈 갱신 — #36/#37/#38 체크박스 진행 반영(이 PC vault 부재 — 진척은 이슈 코멘트·체크박스로 기록)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존 없음 — 즉시 시작
- **Foundational (Phase 2)**: 비어있음(공통 차단 없음)
- **User Stories (Phase 3~5)**: Phase 1 완료 후 **상호 독립** — 임의 순서·병렬 가능
- **Polish (Phase 6)**: 구현하려는 US 들 완료 후

### User Story Dependencies

- **US1 (P1)**: Phase 1 후 시작. 타 US 의존 0
- **US2 (P2)**: Phase 1 후 시작. 타 US 의존 0
- **US3 (P3)**: Phase 1 후 시작. 타 US 의존 0

세 US 는 다른 테이블/파일을 다뤄 파일 충돌이 거의 없음 — `layout.tsx`(US2 T028)만 단독 편집 지점.

### Within Each User Story

- TDD: 테스트(T003-005 / T018-019 / T030-031) 먼저 작성·실패 확인 → 구현
- 마이그레이션 → 엔티티 → repository → service → controller → FE API → FE 컴포넌트
- 같은 파일 수정 태스크는 순차(예 T008/T010 은 `MemoQueryService` 등 일부 공유 — US1 내부 순서 준수)

### Parallel Opportunities

- US1/US2/US3 를 서로 다른 작업자/세션이 병렬 진행 가능
- 각 US 내 `[P]` 테스트 태스크 병렬, 다른 파일 모델/DTO `[P]` 병렬
- US1 T013(Toast)·T014(API) 병렬 / US3 T034·T035·T037·T039 병렬

---

## Parallel Example: User Story 1

```bash
# US1 테스트 3종 병렬 작성(구현 전):
Task: "MemoEditServiceTest — soft-delete·restore 상태 전이"
Task: "MemoSoftDeleteFilterIT — 7개 목록 경로 deleted 제외"
Task: "MemoRestoreWebTest — POST /restore 200/404/401"

# US1 FE 독립 파일 병렬:
Task: "Toast.tsx 포팅"
Task: "lib/api/memo.ts restoreMemo 추가"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup
2. Phase 3 US1(곁쪽지 버리기/되돌리기) — TDD
3. **STOP·검증**: 책상 풀 사이클 독립 dogfooding
4. MVP — 가장 사용자 체감 큰 데이터 유실 방지 기능 단독 배포 가능

### Incremental Delivery

1. Setup → US1 → 검증 (MVP)
2. US2 추가 → 다기기 동기화 검증
3. US3 추가 → 인물 확장 검증
4. 각 US 가 이전을 깨지 않음(독립)

### 라운드 마무리

세 US 게이트 GREEN 후 Phase 6 → `develop` merge(finish-work) + 이슈 #36/#37/#38 갱신. 운영 마이그레이션은 적용하지 않음(Round 4 일괄, 사용자 컨펌).

---

## Notes

- `[P]` = 다른 파일, 의존 없음
- TDD HARD-GATE: 상태 전이·매핑·검증은 테스트 먼저, 실패 확인 후 구현
- 마이그레이션은 로컬 dev 한정 — 운영 Supabase 쓰기 금지(external-infra-safety HARD-GATE)
- 신규 에러 코드·HTTP status 분기 없음 — 공용 `client.ts` 분기 룰 비저촉
- 태스크/논리 그룹 단위 커밋
