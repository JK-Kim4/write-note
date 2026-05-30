# Tasks: 에디터·원고지 + 메모 캡처 (Week 3+4 통합)

**Input**: `/specs/006-phase-3-4-editor-memo/` (plan.md / spec.md / research.md / data-model.md / contracts/ / quickstart.md)

**Tests**: 본 프로젝트는 **TDD HARD-GATE**(`CLAUDE.md §5` / `testing-strategy.md`). 매핑·분기·상태전이·무결성 영역은 RED→GREEN 의무. 단순 getter/설정은 완화(§5-5).

**Organization**: User Story(P1~P3) 별 phase. R-16 MVP 라운드 = US1(R1) → US2(R2) → US3(R3) → US4(R4) → US5(R5).

## Path Conventions

- backend: `backend/src/main/kotlin/com/writenote/`, 테스트 `backend/src/test/kotlin/com/writenote/`
- frontend: `frontend/src/`

---

## Phase 1: Setup (공유 인프라)

- [x] T001 frontend 신규 디렉토리 생성 — `frontend/src/components/editor/`, `frontend/src/components/memos/`, `frontend/src/hooks/`
- [x] T002 [P] backend 신규 컨트롤러/서비스 패키지 위치 확인 (`backend/src/main/kotlin/com/writenote/{controller,service,components}` 기존 재사용)

---

## Phase 2: Foundational (모든 US 공통 전제)

**⚠️ MVP(US1)를 막지 않도록 최소화. Document 는 기존(V5) 재사용이라 US1 은 본 phase 의존 없음.**

- [x] T003 [P] frontend `frontend/src/types/api.ts` 에 본 spec 응답 타입 추가 — `DocumentResponse` / `MemoResponse` / `ApiTokenResponse` / 큐레이션 DTO 타입
- [x] T004 [P] frontend `frontend/src/test/msw/` 핸들러 베이스 확장 (document/memo/apiToken mock 엔드포인트 골격)

---

## Phase 3: US1 — 본문 작성 + 자동 저장 (P1, MVP) 🎯

**Goal**: 프로젝트 본문을 끊김 없이 쓰고 자동 저장(409 충돌 선택 UI) + 한국어 IME 안정 + 자수/진행률.
**Independent Test**: 로그인→프로젝트→`/write?projectId=N`→입력→800ms 자동저장→새로고침 복원(SC-001), IME 4케이스 무손실(SC-002).

### Tests (RED 먼저)

- [x] T005 [P] [US1] DocumentService word_count(공백제외) 계산 + 저장 테스트 — `backend/src/test/kotlin/com/writenote/service/DocumentServiceTest.kt`
- [x] T006 [P] [US1] DocumentService optimistic lock 409 충돌(currentVersion/currentBody) IT — `backend/src/test/kotlin/com/writenote/service/DocumentServiceConflictIT.kt`
- [x] T007 [P] [US1] DocumentController D1~D4 WebTest (nested 조회/단건/PUT 200·409/PATCH title) — `backend/src/test/kotlin/com/writenote/controller/DocumentControllerWebTest.kt`
- [x] T008 [P] [US1] frontend useAutoSave debounce 800ms + 409 분기 단위 테스트 — `frontend/src/hooks/useAutoSave.test.ts`
- [x] T009 [P] [US1] frontend 자수/진행률 계산 단위 테스트 — `frontend/src/components/editor/wordCount.test.ts`

### Backend (GREEN)

- [x] T010 [US1] Document DTO — `DocumentResponse`/`SaveDocumentRequest`/`DocumentSaveResponse`/`UpdateDocumentTitleRequest`/`DocumentConflictResponse` in `backend/src/main/kotlin/com/writenote/model/{request,response}/`
- [x] T011 [US1] DocumentService — `findByProjectId` 조회 + 저장(version/word_count 서버계산) + 409 매핑 in `backend/src/main/kotlin/com/writenote/service/DocumentService.kt`
- [x] T012 [US1] DocumentController D1~D4 (nested 조회 + 단건 + PUT 409 + PATCH title) in `backend/src/main/kotlin/com/writenote/controller/DocumentController.kt`
- [x] T013 [US1] SecurityConfig `/api/documents/**` + `/api/projects/*/document` JWT 보호 확인 in `backend/src/main/kotlin/com/writenote/config/SecurityConfig.kt`
- [ ] T014 [US1] 03-backend §3-4 + §6 변경이력에 nested `GET /api/projects/{projectId}/document` 신설 기록 — `docs/plan/03-backend-requirements.md`

### Frontend (GREEN)

- [x] T015 [US1] document API 훅 (nested GET / PUT / PATCH title, React Query) in `frontend/src/lib/api/document.ts`
- [x] T016 [US1] useAutoSave hook (800ms debounce + 409 → 충돌 상태 노출) in `frontend/src/hooks/useAutoSave.ts`
- [x] T017 [US1] TipTap 에디터 컴포넌트 (`StarterKit` + `immediatelyRender:false`, PoC 0-1 기준선) in `frontend/src/components/editor/Editor.tsx`
- [x] T018 [US1] 자수 카운터 + 진행률 ring (ProgressRing 재사용) in `frontend/src/components/editor/WordCount.tsx`
- [x] T019 [US1] 충돌 선택 UI (다시 불러오기/덮어쓰기) in `frontend/src/components/editor/ConflictDialog.tsx`
- [x] T020 [US1] write page 에디터 모드 실데이터 + 활성 프로젝트 `?projectId=` search param in `frontend/src/app/write/page.tsx`
- [x] T021 [US1] write layout 사이드 패널 실데이터(프로젝트 메타 + 등장인물) in `frontend/src/app/write/layout.tsx`

### 검증

- [ ] T022 [US1] 라운드 게이트 — `./gradlew test --tests "*Document*"` + `pnpm test` GREEN + **dogfooding R1**(quickstart §3 R1, IME 4케이스)

**Checkpoint**: US1 단독 동작 = MVP. 사용자 검증 후 US2~ 진행.

---

## Phase 4: US2 — 원고지 격자 + 매수 (P2)

**Goal**: 원고지 모드 격자/마커/행번호 + 매수 자동계산 + 크기 변환 무손실.
**Independent Test**: 설정 원고지 400 → 격자 표시 → 입력 → 매수 → 200 변환 무손실(SC-006).

- [x] T023 [P] [US2] 원고지 매수 계산(200/400/1000 + 크기 변환) 단위 테스트 — `frontend/src/components/editor/manuscript.test.ts`
- [x] T024 [US2] 매수 카운팅 + 크기 변환 로직 in `frontend/src/components/editor/manuscript.ts`
- [x] T025 [US2] 원고지 격자 오버레이 컴포넌트 (CSS, 칸/마커 5·10·15·20/행번호) in `frontend/src/components/editor/ManuscriptGrid.tsx`
- [x] T026 [US2] write page 원고지 모드 분기 (preferences `writingMode`/`manuscriptSize` 재사용) in `frontend/src/app/write/page.tsx`
- [x] T027 [US2] 설정 작성 모드/원고지 크기 선택 UI 결선 in `frontend/src/app/settings/page.tsx`
- [ ] T028 [US2] **dogfooding R2** — 한글 칸 정렬 라이트/다크 + 200/400/1000 (research R-2 미검증 리스크 검증, 정렬 실패 시 완화 모드 fallback)

---

## Phase 5: US3 — 마찰 0 캡처 (P2)

**Goal**: 데스크탑 ⌘+N / 모바일 캡처 → inbox 도착(멱등). entity + V6 + ApiTokenFilter 결선.
**Independent Test**: 모바일 캡처 1건 도착 / 데스크탑 활성 프로젝트 기록 / 중복 캡처 1건(SC-007).

### Entity + 마이그레이션 (Foundational for US3/4/5)

- [ ] T029 [US3] V6 마이그레이션 작성 (`memos`/`memo_projects`/`memo_project_characters`/`api_tokens`, 핀 컬럼 제외) — `backend/src/main/resources/db/migration/V6__create_memos_and_api_tokens.sql` **(적용은 사용자 컨펌 — HARD-GATE)**
- [ ] T030 [P] [US3] Memo entity (tags `TEXT[]`↔`List<String>`) in `backend/src/main/kotlin/com/writenote/entity/Memo.kt`
- [ ] T031 [P] [US3] MemoProject entity in `backend/src/main/kotlin/com/writenote/entity/MemoProject.kt`
- [ ] T032 [P] [US3] MemoProjectCharacter entity in `backend/src/main/kotlin/com/writenote/entity/MemoProjectCharacter.kt`
- [ ] T033 [P] [US3] ApiToken entity in `backend/src/main/kotlin/com/writenote/entity/ApiToken.kt`
- [ ] T034 [P] [US3] MemoRepository / MemoProjectRepository / ApiTokenRepository in `backend/src/main/kotlin/com/writenote/repository/`

### Tests (RED)

- [ ] T035 [P] [US3] IdempotencyCache 5분 TTL 단위 테스트 — `backend/src/test/kotlin/com/writenote/components/IdempotencyCacheTest.kt`
- [ ] T036 [P] [US3] MemoService 캡처(source MOBILE/DESKTOP 분기 + active_project) 테스트 — `backend/src/test/kotlin/com/writenote/service/MemoCaptureServiceTest.kt`
- [ ] T037 [P] [US3] ApiTokenAuthenticationFilter 검증(유효/해지/형식오류 → 401) IT — `backend/src/test/kotlin/com/writenote/auth/ApiTokenAuthenticationFilterIT.kt`
- [ ] T038 [P] [US3] CaptureController 멱등(같은 Idempotency-Key → 1건) WebTest — `backend/src/test/kotlin/com/writenote/controller/CaptureControllerWebTest.kt`

### Backend (GREEN)

- [ ] T039 [US3] IdempotencyCache 컴포넌트 (5분 메모리 TTL) in `backend/src/main/kotlin/com/writenote/components/IdempotencyCache.kt`
- [ ] T040 [US3] ApiTokenHasher 컴포넌트 (SHA-256 검증 + last_used 갱신용) in `backend/src/main/kotlin/com/writenote/components/ApiTokenHasher.kt`
- [ ] T041 [US3] ApiTokenAuthenticationFilter stub → 실제 결선 (Repository 주입 + 검증 + SecurityContext) in `backend/src/main/kotlin/com/writenote/auth/ApiTokenAuthenticationFilter.kt`
- [ ] T042 [US3] Memo 캡처 DTO (`MemoResponse`/`CaptureMemoRequest`/`MobileCaptureRequest`) in `backend/src/main/kotlin/com/writenote/model/`
- [ ] T043 [US3] MemoService 캡처(데스크탑 JWT / 모바일) in `backend/src/main/kotlin/com/writenote/service/MemoService.kt`
- [ ] T044 [US3] MemoController M3 (데스크탑 캡처 `POST /api/memos`) in `backend/src/main/kotlin/com/writenote/controller/MemoController.kt`
- [ ] T045 [US3] CaptureController M6 (`POST /api/capture` + Idempotency-Key) in `backend/src/main/kotlin/com/writenote/controller/CaptureController.kt`

### Frontend (GREEN)

- [ ] T046 [US3] memo API 훅 (capture/list) in `frontend/src/lib/api/memo.ts`
- [ ] T047 [US3] ⌘+N 전역 단축키 hook + 빠른 입력 모달 in `frontend/src/hooks/useGlobalShortcut.ts` + `frontend/src/components/memos/QuickCaptureModal.tsx`
- [ ] T048 [US3] memos page inbox 실데이터 결선 in `frontend/src/app/memos/page.tsx`
- [ ] T049 [US3] **dogfooding R3** — 데스크탑/모바일 캡처 + 멱등(quickstart §3 R3)

---

## Phase 6: US4 — 큐레이션 (P3)

**Goal**: 미분류 메모를 다중 프로젝트 + 인물 합집합 + 태그 + 이유로 큐레이션. 필터/미분류 보존.
**Independent Test**: 메모 2 프로젝트 연결 → 각 필터 노출(SC-005), 미분류 영구.

### Tests (RED)

- [ ] T050 [P] [US4] 큐레이션 차이 계산 + 단일 트랜잭션 IT — `backend/src/test/kotlin/com/writenote/service/MemoCurationServiceIT.kt`
- [ ] T051 [P] [US4] 인물-프로젝트 무결성(불일치 400 VALIDATION_FAILED) 테스트 — `backend/src/test/kotlin/com/writenote/components/MemoCharacterIntegrityValidatorTest.kt`
- [ ] T052 [P] [US4] 메모 목록 N+1 회피(Hibernate Statistics 쿼리 카운트) IT — `backend/src/test/kotlin/com/writenote/repository/MemoListN1IT.kt`
- [ ] T053 [P] [US4] frontend 큐레이션 차이 계산 단위 테스트 — `frontend/src/components/memos/curation.test.ts`

### Backend (GREEN)

- [ ] T054 [US4] 인물-프로젝트 무결성 validator in `backend/src/main/kotlin/com/writenote/components/MemoCharacterIntegrityValidator.kt`
- [ ] T055 [US4] MemoRepository `@EntityGraph` 필터 조회 (unclassified/projectId/characterId/tag/q + Pageable) in `backend/src/main/kotlin/com/writenote/repository/MemoRepository.kt`
- [ ] T056 [US4] 큐레이션/수정 DTO (`UpdateMemoRequest`/`CurateMemoRequest`/`ProjectConnectionDto`) in `backend/src/main/kotlin/com/writenote/model/`
- [ ] T057 [US4] MemoCurationService 차이 계산(add/remove 단일 트랜잭션) in `backend/src/main/kotlin/com/writenote/service/MemoCurationService.kt`
- [ ] T058 [US4] MemoController M1/M2/M4/M5/M7 (목록필터/단건/수정/삭제/큐레이션) in `backend/src/main/kotlin/com/writenote/controller/MemoController.kt`

### Frontend (GREEN)

- [ ] T059 [US4] 큐레이션 카드 (프로젝트 다중 + 인물 합집합 + 태그 + 이유, 800ms 슬라이드) in `frontend/src/components/memos/CurationCard.tsx`
- [ ] T060 [US4] 필터 칩 + overlap 카운트 in `frontend/src/components/memos/FilterChips.tsx`
- [ ] T061 [US4] memos page 큐레이션/필터 결선 in `frontend/src/app/memos/page.tsx`
- [ ] T062 [US4] **dogfooding R4** — 큐레이션 + 필터 + 연결 해제 cascade(quickstart §3 R4)

---

## Phase 7: US5 — 모바일 캡처용 토큰 (P3)

**Goal**: 토큰 발급(1회 표시)/목록/label/해지 + 설정 UI + iOS Shortcut 가이드.
**Independent Test**: 발급 1회 표시 → 캡처 성공 → 해지 → 캡처 거부(SC-008).

### Tests (RED)

- [ ] T063 [P] [US5] ApiTokenService 발급(원본 1회/해시 저장) + 해지 테스트 — `backend/src/test/kotlin/com/writenote/service/ApiTokenServiceTest.kt`

### Backend (GREEN)

- [ ] T064 [US5] ApiTokenService (base62 32자 생성 + SHA-256 + 목록/label/해지) in `backend/src/main/kotlin/com/writenote/service/ApiTokenService.kt`
- [ ] T065 [US5] ApiToken DTO (`CreateApiTokenRequest`/`ApiTokenCreatedResponse`/`ApiTokenResponse`) in `backend/src/main/kotlin/com/writenote/model/`
- [ ] T066 [US5] ApiTokenController T1~T4 (발급/목록/label/해지) in `backend/src/main/kotlin/com/writenote/controller/ApiTokenController.kt`
- [ ] T067 [US5] `/api/auth/me` 활성 ApiToken 수 정합 확인 (003 UserAuthConverter) in `backend/src/main/kotlin/com/writenote/...`

### Frontend (GREEN)

- [ ] T068 [P] [US5] apiToken API 훅 in `frontend/src/lib/api/apiToken.ts`
- [ ] T069 [US5] 설정 토큰 관리 UI (발급 모달 1회 표시 + 복사 경고 + 목록 + 해지) in `frontend/src/app/settings/page.tsx`
- [ ] T070 [US5] iOS Shortcut 셋업 가이드 (설정 링크 + quickstart §5) in `frontend/src/app/settings/page.tsx`
- [ ] T071 [US5] **dogfooding R5** — 발급/캡처/해지(quickstart §3 R5)

---

## Phase 8: Polish & Cross-Cutting

- [ ] T072 [P] OpenAPI annotation (`@Tag`/`@Operation`/`@SecurityRequirement`) — Document/Memo/Capture/ApiToken Controller in `backend/.../controller/`
- [ ] T073 [P] 03-backend §6 변경이력 — Week 4 entity(Memo/MemoProject/MemoProjectCharacter/ApiToken) + 핀·세션노트 제외 명시 in `docs/plan/03-backend-requirements.md`
- [ ] T074 backend 전체 검증 게이트 — `./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` (003/004/005 회귀 GREEN)
- [ ] T075 frontend 전체 게이트 — `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (RSC 경계 검출)
- [ ] T076 [P] `docs/plan/02-progress.md` + `01-phase-breakdown.md` §6/§7 진척 갱신 (Week 3/4 ✅)
- [ ] T077 [P] vault `~/obsidian/write-note/02-PROGRESS.md` §완료+진입점 + `03-ISSUES.md`(발견 시) 갱신
- [ ] T078 [P] 5축 회고 — `docs/retrospectives/2026-XX-XX-006-editor-memo.md`
- [ ] T079 SC 전체 매핑 확인 (SC-001~008) + SC-008 해지 토큰 거부 실측

---

## Dependencies & 실행 순서

- **Phase 1 → 2** 선행. 이후 **US1(P1)** 은 Foundational 무관하게 즉시 진입 가능(Document 기존).
- **US 순서**: US1(MVP) → US2 → **US3**(entity+V6 신설, US4/US5 의 전제) → US4(US3 entity 의존) → US5(US3 ApiToken entity + filter 의존).
- **US3 가 Week4 entity/V6 의 단일 소스** — US4/US5 는 US3 의 T029~T034 에 의존.
- Polish 는 전 US 후.

## Parallel 기회

- **Setup/Foundational**: T002·T003·T004 [P]
- **US1 테스트**: T005·T006·T007·T008·T009 [P] (RED 동시 작성)
- **US3 entity**: T030·T031·T032·T033·T034 [P] / 테스트 T035·T036·T037·T038 [P]
- **US4 테스트**: T050·T051·T052·T053 [P]
- **Polish**: T072·T073·T076·T077·T078 [P]
- ⚠️ 같은 파일(`memos/page.tsx`, `settings/page.tsx`, `write/page.tsx`)을 건드리는 task 는 [P] 제외 — 순차.

## Implementation Strategy (MVP first)

1. **MVP = US1 (T001~T022)** — 본문 작성+자동저장. 단독 사용자 검증 통과 후 진행(005 패턴).
2. US2(원고지) → US3(캡처, entity 신설) → US4(큐레이션) → US5(토큰).
3. 각 US 끝 dogfooding checkpoint. Polish 에서 전체 게이트 + 문서/vault/회고.

**총 79 task** (Setup 2 / Foundational 2 / US1 18 / US2 6 / US3 21 / US4 13 / US5 9 / Polish 8).
