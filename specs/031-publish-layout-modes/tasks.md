# Tasks: 출판 방식 선택 기반 에디터 레이아웃 (종이/웹) + 종이 출판 판형

**Input**: Design documents from `specs/031-publish-layout-modes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/projects-api.md, quickstart.md

**Tests**: 순수 함수/백엔드 검증은 TDD HARD-GATE(테스트 우선). 자체 에디터 렌더·좌표계·한국어 IME·실측 분량은 dogfooding 게이트(자동 단위테스트로 미보장 — §14).

**Organization**: User Story 단위 phase. 라운드 매핑 — US1=R1, US2=R3, US3=R2+글자수, US4=R1전환. 백엔드 layoutMode 는 US1/US3/US4 공통 의존이라 Foundational.

## Path Conventions

- Backend: `backend/src/main/kotlin/com/writenote/`, 마이그레이션 `backend/src/main/resources/db/migration/`, 테스트 `backend/src/test/kotlin/com/writenote/`
- Frontend: `frontend/src/` (모든 frontend 명령은 cwd=`frontend/` 고정)

---

## Phase 1: Setup

**Purpose**: 작업 베이스 확정

- [x] T001 베이스 정합 확인 — `git fetch origin develop && git log --oneline HEAD..origin/develop` 로 누락 커밋(보안·인증·공개경로) 점검(§18). 현재 `031` 브랜치가 develop 최신 위인지 확인
- [x] T002 베이스라인 GREEN 확인 — `cd backend && ./gradlew test` + `cd frontend && pnpm test` 가 변경 전 통과하는지 확인(회귀 기준선)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 작품(Project) `layoutMode` 데이터 모델 — US1/US3/US4 가 모두 의존. ⚠️ 이 phase 완료 전 US1/US3/US4 착수 불가

**배포 순서**: BE 선행 → FE 후행

- [x] T003 마이그레이션 작성 `backend/src/main/resources/db/migration/V17__add_projects_layout_mode.sql` — `ALTER TABLE projects ADD COLUMN layout_mode VARCHAR(16) NOT NULL DEFAULT 'paper' CHECK (layout_mode IN ('paper','web'))`. 기존 행 'paper' 보존(FR-013). ⚠️ 작성만, 로컬 dev DB 적용 금지(IT/Testcontainers 만)
- [x] T004 [P] 엔티티 `backend/src/main/kotlin/com/writenote/entity/Project.kt` — `var layoutMode: String = "paper"` 추가(paperSize 필드 인접)
- [x] T005 [P] 요청 DTO `backend/src/main/kotlin/com/writenote/model/request/CreateProjectRequest.kt` — `val layoutMode: String? = null` (`@Size(max=16)`)
- [x] T006 [P] 요청 DTO `backend/src/main/kotlin/com/writenote/model/request/UpdateProjectRequest.kt` — `val layoutMode: String? = null` (`@Size(max=16)`)
- [x] T007 [P] 응답 DTO `backend/src/main/kotlin/com/writenote/model/response/ProjectResponse.kt` — `val layoutMode: String` 추가
- [x] T008 매퍼 `backend/src/main/kotlin/com/writenote/mapper/ProjectMapper.kt` — `layoutMode = project.layoutMode` 매핑(T004,T007 후)
- [x] T009 [US1] **[테스트 우선]** `backend/src/test/kotlin/com/writenote/controller/ProjectControllerIT.kt` — layoutMode 검증/영속 테스트 추가(RED): (a) 생성 시 layoutMode='web' 저장·응답 (b) null→'paper' 기본 (c) 비허용값→400 VALIDATION_ERROR (d) PATCH layoutMode 전환
- [x] T010 [US1] 서비스 `backend/src/main/kotlin/com/writenote/service/ProjectService.kt` — `validatedLayoutMode()`(null→'paper', 비허용→ValidationException) + `ALLOWED_LAYOUT_MODES = setOf("paper","web")`(companion) + createProject/updateProject 반영. T009 GREEN 까지(Annotation 배열 인자 grep 정합 — kotlin code-quality)
- [x] T011 백엔드 게이트 — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test`(GREEN 확인, T009 통과)
- [x] T012 [P] FE API 타입 `frontend/src/lib/api/projects.ts` — `CreateProjectInput`/`UpdateProjectInput` 에 `layoutMode?: "paper" | "web"` 추가
- [x] T013 [P] FE 응답 타입 `frontend/src/types/api.ts` — `ProjectResponse` 에 `layoutMode: "paper" | "web"` 추가(주석: 031)

**Checkpoint**: layoutMode 백엔드 계약·FE 타입 준비 — US1/US3/US4 착수 가능

---

## Phase 3: User Story 1 - 작품 생성 시 출판 방식 강제 선택 (Priority: P1) 🎯 MVP

**Goal**: 작가가 새 작품 생성 시 종이/웹을 반드시 직접 고르고, 기존 작품은 종이로 보존(FR-001, FR-013)

**Independent Test**: 출판 방식 미선택 시 생성 차단 / 종이→페이지 분할 집필실 / 웹→판형 UI 없음 / 기존 작품 그대로 열림

- [x] T014 [US1] 생성 폼 상태 `frontend/src/app/(main)/library/page.tsx` — `ProjectFormState` 에 `layoutMode: "paper" | "web" | null`(기본 null=미선택) 추가, `emptyForm()`/`fromProject()` 갱신
- [x] T015 [US1] 생성 폼 UI `frontend/src/app/(main)/library/page.tsx` — 출판 방식 선택 컨트롤(종이/웹, 라벨·설명) 추가. **미선택 시 "새 작품 만들기" 비활성/차단**(강제 선택). `'use client'` 확인
- [x] T016 [US1] 생성 호출 `frontend/src/app/(main)/library/page.tsx` — `handleCreate` 에서 `layoutMode` 를 `createProject` 입력에 포함(T012 의존)
- [x] T017 [US1] RSC 경계 검증 — `cd frontend && pnpm build`(생성 폼 이벤트 핸들러 경계 위반 미검출 확인) + `pnpm lint && pnpm typecheck`
- [ ] T018 [US1] **Dogfooding 게이트(quickstart R1)** — 미선택 생성 차단 / 종이 생성→페이지 분할 / 웹 생성→판형UI 없음 / 기존 작품 그대로. 한국어 표시 확인

**Checkpoint**: US1 단독 동작 — 출판 방식 선택 MVP 완성(전환 US4·판형 US2·웹렌더 US3 없이도 viable)

---

## Phase 4: User Story 2 - 종이 출판 판형 + 실측 분량 (Priority: P2)

**Goal**: 종이 출판 작가가 판형 4종을 골라 실제 단행본 분량으로 집필(FR-005~008, SC-002). paper 모드 한정

**Independent Test**: 종이 작품에서 판형 select 8종 노출 / 신국판 1면≈700~800자 / 판형 변경 시 텍스트 무손실 / zoom 가독성

**배포 순서**: BE 선행 → FE 후행

- [x] T019 [US2] 마이그레이션 `backend/src/main/resources/db/migration/V18__extend_projects_paper_size.sql` — paper_size CHECK 제약 DROP 후 8종으로 ADD(`A4,A3,A2,B4,sinkukpan,kukpan,pan46,mungopan`). ⚠️ 작성만, 적용 금지
- [x] T020 [US2] **[테스트 우선]** `backend/.../ProjectControllerIT.kt` — paperSize 신규 판형(예 'sinkukpan') 생성·PATCH 허용 + 비허용값 400 테스트(RED)
- [x] T021 [US2] 백엔드 허용값 동기 — `service/ProjectService.kt:ALLOWED_PAPER_SIZES` + `service/SettingsService.kt:ALLOWED["paperSize"]` 8종으로 확장(계약서 §4 매트릭스 전 지점). T020 GREEN
- [x] T022 [US2] 백엔드 게이트 — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test`
- [x] T023 [US2] **[테스트 우선]** `frontend/src/components/custom-editor/geometry.test.ts` — 판형 프리셋 분량 계산 테스트(RED): 신국판 1면 글자수가 700~800자(원고지 3.3~3.7매) 범위(SC-002), 국판<신국판, 문고판<46판<국판 면적비 단조성
- [x] T024 [US2] 판형 프리셋 `frontend/src/components/custom-editor/geometry.ts` — `PaperSize` 타입에 4종 추가, `PAPER_MM` 치수 추가, `PAPER_SIZES` 배열 추가, 판형별 조판 프리셋(폰트~10pt·여백) 정의. `pageGeometry` 시그니처에 `marginMm`(또는 프리셋) 추가하되 ISO 기존 동작 보존. T023 GREEN
- [x] T025 [US2] 폰트 적용 `frontend/src/components/b/BStudioShell.tsx` 또는 `BCustomChapterEditor` — 판형 프리셋의 출판 표준 폰트를 CustomEditor `fontSizePx` 로 주입(현재 `FONT_SIZE_PX=18` 고정 대체), ISO 는 기존값 유지
- [x] T026 [P] [US2] 판형 select 옵션 — `frontend/src/app/(main)/library/page.tsx` 생성/수정 폼 용지 select 8종으로 확장(라벨 한글 "신국판" 등, 값 ASCII)
- [x] T027 [P] [US2] 판형 select 옵션 — `frontend/src/components/b/BStudioShell.tsx` 집필실 용지 select 8종 + **`layoutMode==='paper'` 일 때만 노출**(FR-010)
- [x] T028 [P] [US2] 판형 옵션 — `frontend/src/app/(main)/settings/page.tsx` `PAPER_SIZE_OPTIONS` 8종(전역 기본 판형, 선택적)
- [x] T029 [US2] zoom 가독성 — `frontend/src/components/custom-editor/CustomEditor.tsx` 의 기존 `userZoom`(`:440`)이 작은 폰트 판형에서 가독 배율을 제공하는지 확인/기본 배율 보정(신규 메커니즘 없이 재사용)
- [x] T030 [US2] FE 게이트 — `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- [ ] T031 [US2] **Dogfooding 게이트(quickstart R3)** — 판형 8종 노출 / 신국판 1면 분량 앵커 / 판형 변경 무손실 / zoom 가독성 / **한국어 IME 4케이스**(폰트·여백 변경이 측정 영향) 무회귀

**Checkpoint**: US2 단독 동작 — 종이 출판 판형·실측 분량 완성

---

## Phase 5: User Story 3 - 웹 출판 연속 작업공간 + 글자수 (Priority: P2)

**Goal**: 웹 출판 작가가 페이지 분할 없는 연속 집필 + 글자수 지표(FR-004, FR-009, FR-010). 가장 불확실 — PoC 선행

**Independent Test**: 웹 작품에서 본문 연속 흐름(페이지 미분할) / 글자수 표시 / 종이 전용 UI 없음

**배포 순서**: FE 단독(BE 무변경)

- [x] T032 [US3] **PoC(결선 전 필수 게이트)** — 작은 범위로 `layoutEngine.layout(measured, ∞)` 단일 페이지 + `CustomEditor` 웹 렌더 분기만 띄워 dogfood: 연속 스크롤 / **한국어 IME 4케이스** / 캐럿·드래그 선택 / 자동저장. 통과 전 아래 결선·다중 커밋 금지(§10). 실패 시 설계 재논의
- [x] T033 [US3] 미분할 분기 `frontend/src/components/custom-editor/layoutEngine.ts` — `layout()` 에 연속 모드(무한 높이→단일 페이지) 분기 추가. ISO/판형 페이지 분할 경로 무회귀
- [x] T034 [US3] relayout 모드 전달 `frontend/src/components/custom-editor/printLayout.tsx` — `relayout()` 가 layoutMode/연속 플래그를 layout 에 전달
- [x] T035 [US3] 렌더 분기 `frontend/src/components/custom-editor/CustomEditor.tsx` — `layoutMode==='web'` 시 단일 페이지를 세로 스크롤 렌더 + 페이지 넘김 네비/currentPage 동기 비활성. 좌표계 어댑터(`caretToScreen`/`screenToCaret` pageIndex=0 고정·offsetY 절대 y). 데스크탑 zoom·모바일 transform 분기 보존
- [x] T036 [US3] 모드별 UI 분기 `frontend/src/components/b/BStudioShell.tsx` — 웹 모드 시 판형·용지·원고지 UI 숨김(FR-010), CustomEditor 에 layoutMode prop 전달
- [ ] T037 [P] [US3] **[테스트 우선]** `frontend/src/components/custom-editor/charCount.test.ts` — `model.buffer` 기반 글자수(공백 포함/제외) 테스트(RED): 빈 문서 0, 공백 제외 계산, 다중 블록(\n) 처리
- [ ] T038 [US3] 글자수 헬퍼 `frontend/src/components/custom-editor/charCount.ts` — 신규 순수 함수(공백 포함/제외). T037 GREEN
- [ ] T039 [US3] 웹 분량 표시 `frontend/src/components/b/BStudioShell.tsx`(또는 집필실 분량 영역) — 웹 모드 분량을 글자수(공백 제외 우선)로 표시
- [x] T040 [US3] FE 게이트 — `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- [x] T041 [US3] **Dogfooding 게이트(quickstart R2)** — 연속 흐름 / 글자수 갱신 / 종이 UI 없음 / 한국어 IME 4케이스 / 캐럿·선택·스크롤 / 자동저장(016)·챕터 전환(022) 무회귀

**Checkpoint**: US3 단독 동작 — 웹 출판 연속 집필·글자수 완성

---

## Phase 6: User Story 4 - 출판 방식 전환 (Priority: P3)

**Goal**: 작품 생성 후 종이↔웹 양방향 전환, 텍스트 무손실(FR-011, FR-012, SC-004)

**Independent Test**: 본문 있는 작품 web↔paper 왕복 후 텍스트 동일, 형태만 전환

**배포 순서**: BE 무변경(layoutMode PATCH 는 Foundational 에서 이미 지원) — FE 단독

- [x] T042 [US4] 전환 UI `frontend/src/components/b/BStudioShell.tsx`(또는 작품 설정) — 출판 방식 전환 컨트롤 추가 → `updateProject.mutate({ id, patch: { layoutMode } })`(handlePaperSizeChange 패턴 재사용). `'use client'` 확인
- [x] T043 [US4] 전환 무손실 결선 확인 — 전환이 본문(챕터 bodyJson)을 건드리지 않는지 확인(D6). 챕터 세션 리마운트(`key={documentId}`) 유지 점검(거짓 409 회귀 방지 §12)
- [x] T044 [US4] FE 게이트 — `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- [x] T045 [US4] **Dogfooding 게이트(quickstart R1-5)** — 본문 있는 작품 web↔paper 왕복 → 전환 전후 텍스트 동일(무손실) + 형태 전환 확인

**Checkpoint**: US4 동작 — 양방향 전환 완성

---

## Phase 7: Polish & Cross-Cutting (R4 마감)

**Purpose**: 분량 지표 표시 마감 + 전체 회귀 점검

- [x] T046 종이 분량 지표 — 종이 작품의 페이지 수 + 200자 원고지 환산 매수 표시(집필실/홈 카드). `view.pages.length` + 글자수/200 재사용
- [x] T047 [P] 홈 카드 분량 — `frontend/src/app/(main)/library/page.tsx` 작품 카드가 모드별 지표(종이=페이지/원고지, 웹=글자수) 표시(US2·US3 산출 재사용)
- [ ] T048 전체 verify — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` + `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- [ ] T049 회귀 점검 — (a) 직렬화 왕복 idempotence(전환이 bodyJson 미변경, 거짓 dirty 없음 §자동저장) (b) RSC 경계(모드 select/전환 client) (c) client.ts 신규 status 분기 0 확인(409 오분류 없음 §계약 5)
- [ ] T050 vault/회고 — `sync-vault` 로 `~/obsidian/write-note/02-PROGRESS.md` 갱신 + 회고 작성 후보 surfacing(라운드 종료 시)

---

## Dependencies & Execution Order

```
Phase 1 (Setup: T001-T002)
  ↓
Phase 2 (Foundational: T003-T013) ← layoutMode 백엔드+FE타입, US1/US3/US4 차단 해제
  ↓
  ├─ Phase 3 US1 (T014-T018) [P1 MVP] ── 독립
  ├─ Phase 4 US2 (T019-T031) [P2] ────── 독립(판형 백엔드 V18 자체 포함)
  ├─ Phase 5 US3 (T032-T041) [P2] ────── 독립(T032 PoC 게이트 선행)
  └─ Phase 6 US4 (T042-T045) [P3] ────── Foundational PATCH 의존, US1 후 권장
  ↓
Phase 7 Polish (T046-T050)
```

**스토리 독립성**: US1~US4 는 Foundational(layoutMode) 완료 후 상호 독립 — 병렬 가능. 단 US4 전환은 US1(생성) 후 dogfooding 이 자연스러움. US3 는 T032 PoC 통과가 내부 선행 게이트.

## Parallel Execution Examples

- **Foundational 내**: T004·T005·T006·T007(서로 다른 파일) 병렬 → T008(매퍼, 의존) → T009(테스트)→T010(서비스). T012·T013(FE 타입) 병렬
- **US2 내**: T026·T027·T028(서로 다른 select 파일) 병렬. 단 T024(geometry) 후
- **스토리 간**: Foundational 후 US1·US2·US3 를 다른 작업자가 병렬 진행 가능(파일 겹침 적음 — US2=geometry/select, US3=layoutEngine/CustomEditor 렌더, US1=library 생성폼)

## Implementation Strategy

- **MVP = US1(Phase 1~3)**: 출판 방식 선택만으로도 "작가가 작업 방식을 고른다"는 가치 전달. 종이는 기존 페이지 분할 그대로라 즉시 viable.
- **증분 전달**: US1 → US2(종이 판형 가치) → US3(웹 작가 유입) → US4(전환 편의). 각 phase 끝 dogfooding 게이트 통과 후 다음.
- **가장 불확실(US3 T032)**: 웹 연속 렌더 PoC 를 작게 먼저 통과. 실패 시 US1·US2 는 독립적으로 출시 가능(웹 모드만 보류).
- **배포**: R1·R3·R4 BE선행→FE후행, R2(US3) FE단독. 배포 전 베이스 정합(§18) + authed 미검증 항목 명시(§19).
