---
description: "Task list — 자체 에디터 엔진 1라운드 (B형 수직 슬라이스, 구조)"
---

# Tasks: 자체 에디터 엔진 1라운드 — B형 집필실 수직 슬라이스(구조)

**Input**: `specs/024-custom-editor-r1/` (plan.md·spec.md·research.md·data-model.md·contracts/·quickstart.md)

**Tests**: 순수 로직(model·pmConvert·layoutEngine·outline·history)은 **TDD(RED→GREEN)** — `CLAUDE.md` HARD-GATE. 브라우저 측정(measure·캐럿·렌더)·통합은 헤드리스 CDP + 사용자 dogfooding(IME).

**Path**: 워크트리 `frontend/` 기준. `custom-editor/` = 신규 승격 모듈. PoC(`poc-editor/`)는 순수 3파일 이전 외 무수정(동결).

**작업 위치**: `/Users/jongwan-air/Desktop/workspaces/write-note-024-custom-editor`, 브랜치 `024-custom-editor`. 023-export 미커밋 패치 비접촉. 백엔드/DB 변경 0.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 승격 모듈 골격 + PoC 순수 자산 단일 SoT화.

- [X] T001 PoC 순수 3+1파일을 `frontend/src/components/poc-editor/`에서 `frontend/src/components/custom-editor/`로 이동(`geometry.ts`·`layoutEngine.ts`·`layoutEngine.test.ts`·`measure.ts`) 후 PoC 라우트 import 재지정(`src/components/poc-editor/PocEditorLive.tsx`·`PocEditor.tsx`가 새 경로 참조). `pnpm exec tsc --noEmit` + `pnpm exec vitest run src/components/custom-editor` GREEN 확인(기존 7 테스트 유지).
- [X] T002 [P] `frontend/src/components/custom-editor/geometry.ts`에 A2(420×594mm)를 `PAPER_MM`·`PaperSize` 유니온·`PAPER_SIZES`에 추가(프로젝트 용지셋 A4/A3/A2/B4 정합). 단위테스트로 A2 contentHeightPx 양수 확인.

**Checkpoint**: 승격 모듈에서 기존 엔진 테스트 GREEN, 빌드 통과.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 의존하는 내부모델 + 에디터 코어. **완료 전 US 작업 불가.**

**⚠️ CRITICAL**: 본 Phase 완료 전 어떤 user story 도 시작 금지.

- [X] T003 [P] [TDD-RED] `frontend/src/components/custom-editor/model.test.ts` 작성(실패 상태): `DocModel`/`BlockAttr`/`Selection` 타입, `blockIndexAt`·`insertText`·`deleteRange`·`splitBlock`·`mergeWithPrev`·`mergeWithNext`·`reconcileAttrs`의 행위 + 불변식 INV-1(`blockAttrs.length === buffer.split('\n').length`)·INV-2(heading level 1~3)·INV-3(빈 모델) 케이스. (heading 토글은 US2.)
- [X] T004 `frontend/src/components/custom-editor/model.ts` 구현(T003 GREEN): 순수 편집 연산 + 불변식 가드 + `reconcileAttrs` fallback. paragraph 블록만(heading 토글 US2).
- [X] T005 `frontend/src/components/custom-editor/CustomEditor.tsx` 코어 — `PocEditorLive`의 EditContext 입력루프·`caretToScreen`/`screenToCaret`/`selectionRects`/드래그/화살표/Cmd+A를 승격하되, **버퍼 직접조작 대신 `model.ts` 연산을 거치도록** 결선(Enter=`splitBlock`, 블록시작 Backspace=`mergeWithPrev`, 블록끝 Delete=`mergeWithNext`, 선택삭제=`deleteRange`, 입력=`insertText`). 렌더는 `DocModel` 기반(paragraph만, 단일 폰트). props `{ model, onModelChange, paperSize, fontSize }`.
- [X] T006 [P] `frontend/src/components/custom-editor/CustomEditor.tsx` 입력 후 EditContext 동기(`updateText`/`updateSelection`)와 INV-1 가드 호출 일관화 — 구조편집 6경로(R1) 각각에서 model 연산 결과로 버퍼/선택/EditContext 동기. CDP smoke(클릭 캐럿·타이핑·Enter·Backspace 병합) 확인.

**Checkpoint**: paragraph 전용 자체 에디터가 (임시 하네스/PoC 유사 화면에서) 입력·캐럿·선택·분할 동작. model 불변식 GREEN.

---

## Phase 3: User Story 1 - 자체 엔진으로 쓰고 저장·재로드 (Priority: P1) 🎯 MVP

**Goal**: 신규 라우트에서 프레시 테스트 챕터에 문단을 쓰고 → 자동저장 → 재로드, 페이지 경계 줄단위 이어짐.

**Independent Test**: 신규 라우트 진입 → 페이지 높이 초과 입력 → ~1.5초 후 `PUT /api/documents/{id}` 발생 → 새로고침 → 본문·분할 무손실 복원. 문단 통째 점프 0(SC-001·SC-002).

### Tests for User Story 1 (TDD)

- [X] T007 [P] [US1] [TDD-RED] `frontend/src/components/custom-editor/pmConvert.test.ts` 작성(실패): `pmJsonToModel`/`modelToPmJson` paragraph 왕복 무손실(SC-003 paragraph 한정), 빈 문서→빈 문단 1블록, 빈 블록 보존, list/blockquote **평탄화(lossy)** 확인, 잘못된 JSON→빈 모델. (heading 왕복은 US2.)

### Implementation for User Story 1

- [X] T008 [US1] `frontend/src/components/custom-editor/pmConvert.ts` 구현(T007 GREEN): paragraph 블록 ↔ PM `paragraph` 노드, 미지원 노드 평문 평탄화, 빈/오류 처리. (heading 매핑은 US2에서 추가.)
- [X] T009 [US1] **셸 추출 비용 게이트(R5)** — `frontend/src/app/b/works/[id]/page.tsx`의 챕터관리·세션·3패널·모달을 `frontend/src/components/b/BStudioShell.tsx`로 추출 가능성 평가: 추출이 회귀 위험으로 과하면 신규 라우트가 셸을 복제하는 B안으로 후퇴(research R5). 결정 결과를 본 task 주석/plan 보강에 1줄 기록.
- [X] T010 [US1] `frontend/src/components/b/BStudioShell.tsx` 신설 — `BWorkDetailPage`에서 셸 추출(에디터 슬롯 `renderEditor(args)` + 아웃라인 소스 `outline:{items,selectItem,activeIndex}` 주입). 기존 `frontend/src/app/b/works/[id]/page.tsx`를 `BStudioShell` 얇은 래퍼로 전환(TipTap 에디터 + `useEditorOutline` 주입). **무회귀(SC-007)**: 기존 B형 라우트 동작 동일 + 기존 프론트 테스트 GREEN 확인. (T009가 B안이면 본 task는 셸 복제로 대체.)
- [X] T011 [US1] `frontend/src/components/custom-editor/BCustomChapterEditor.tsx` 신설 — `BChapterEditor` props 계약 대응. 내부에서 `pmJsonToModel(serverBody)`로 초기 `DocModel`, `useDocumentSession`에 `body = modelToPmJson(model)`(문자열) 결선, 입력마다 `flushDraft(modelToPmJson(model))`. `CustomEditor`를 `key`로 documentId 단위 리마운트(016/022 stale 토큰 회피). **본문 `fontSizePx` = 고정 기본값(18px) 상수**(U1) — 1라운드는 본문 폰트크기 사용자 노출 없음(엔진 리플로우 능력은 보유). 용지(`paperSize`)는 셸에서 주입.
- [X] T012 [US1] 신규 라우트 `frontend/src/app/b/works/[id]/custom/page.tsx` 신설 — `BStudioShell`에 `renderEditor=BCustomChapterEditor` 주입. `'use client'` + `pnpm build`로 RSC 경계 검증. 프레시 테스트 챕터 진입 가드/안내(기존 마크 챕터 경고).
- [X] T013 [US1] 자동저장 결선 검증 — 입력 후 debounce(1500ms)·maxInterval(10000ms)에 `PUT {body, version}` 발생, 응답 version 토큰 갱신, localStorage draft(`wn:draft:doc:{id}`) 기록. CDP로 PUT 관찰 + 새로고침 무손실 복원(SC-002). **충돌 경로 검증(C2/FR-015)**: 서버 version 토큰을 인위적으로 어긋나게(다른 탭/직접 PUT) 만든 뒤 저장 시 `session.conflict` → 셸 충돌 모달 노출, `reload`(서버 최신본)·`overwrite`(내 본문) 양쪽 동작 확인 — 자체 엔진이 충돌 감지를 무력화하지 않음.
- [X] T014 [US1] 줄단위 분할 검증(CDP) — 페이지 높이 초과 문단 입력 시 초과분이 다음 페이지로 줄단위 이어짐, 통째 점프 0(SC-001). 클릭 캐럿 vs `caretRangeFromPoint` diff 0(SC-005). **리플로우 검증(C1/SC-004)**: 셸 용지 셀렉터로 `paperSize` 변경 시 1초 이내 재배치, 깨짐 0 — `relayout`이 새 geometry로 1회 재실행(race 없음).

**Checkpoint**: US1 독립 동작 — 실제 집필실 신규 라우트에서 쓰기→저장→재로드→줄단위 분할. **MVP 게이트.**

---

## Phase 4: User Story 2 - 제목 구조 + 목차 이동 (Priority: P2)

**Goal**: 본문 줄을 제목(H1~3)으로 토글 → 큰 글자 렌더·즉시 재분할, 좌측 목차에 순서대로 표시·클릭 점프·상단 강조.

**Independent Test**: 제목 섞은 본문 → 목차 순서 일치 → 항목 클릭 점프 → 스크롤 시 상단 제목 강조 → 저장·재로드 후 제목 수준 보존(SC-006·SC-003 heading).

### Tests for User Story 2 (TDD)

- [X] T015 [P] [US2] [TDD-RED] `model.test.ts`에 `toggleHeading` 케이스 추가(실패): paragraph↔heading 토글, 동일 level 재토글→paragraph, INV-2, 버퍼 불변.
- [X] T016 [P] [US2] [TDD-RED] `pmConvert.test.ts`에 heading 왕복 케이스 추가(실패): `heading{level 1·2·3}` ↔ 모델 왕복 무손실(SC-003 heading).
- [X] T017 [P] [US2] [TDD-RED] `layoutEngine.test.ts`에 heading 가변 줄높이 분할 케이스 추가(실패): 블록마다 `MeasuredLine.height` 다를 때 경계 분할 정확(FR-008).
- [X] T018 [P] [US2] [TDD-RED] `frontend/src/components/custom-editor/outline.test.ts` 작성(실패): `outlineFromModel`이 heading 블록 등장순 `OutlineItem[]`(level/text/index) 반환.

### Implementation for User Story 2

- [X] T019 [US2] `model.ts`에 `toggleHeading(model, blockIdx, level)` 구현(T015 GREEN).
- [X] T020 [US2] `pmConvert.ts`에 heading 노드 ↔ heading 블록 매핑 추가(T016 GREEN).
- [X] T021 [US2] `frontend/src/components/custom-editor/geometry.ts`에 `blockFont(attr, base)` 추가(H1 1.8×/H2 1.5×/H3 1.25×, 줄높이 ratio 1.8) — 상수, 튜닝 가능.
- [X] T022 [US2] 블록별 폰트 관통 — `CustomEditor.tsx`의 `relayout`·`caretToScreen`·`screenToCaret`·`selectionRects`·`PageBox` 렌더가 `blockFont`로 블록 폰트/줄높이를 사용(`geo.lineHeightPx` 직참조 제거). `measureParagraphLines`/`measureLineXs`를 블록 폰트로 호출(canvas 금지 — DOM Range 유지). T017 GREEN(layout heading 분할).
- [X] T023 [US2] 제목 토글 UI — `CustomEditor.tsx`에 현재 블록 H1/H2/H3/본문 토글(상단 버튼 또는 단축키). `toggleHeading` 호출 → 즉시 재분할.
- [X] T024 [US2] `frontend/src/components/custom-editor/outline.ts` 구현(T018 GREEN): `outlineFromModel` + `headingLayoutCoord(model, pages, index)`(점프 좌표).
- [X] T025 [US2] `frontend/src/components/custom-editor/useCustomOutline.ts` 신설 — `{ items, selectItem, activeIndex }` 제공(엔진 파생 + 점프=`headingLayoutCoord`로 스크롤 + 상단 heading 활성추적). `BCustomChapterEditor`가 `BStudioShell`의 `outline` 슬롯에 주입(TipTap `useEditorOutline` 대체).
- [X] T026 [US2] heading 검증(CDP) — 토글 후 큰 글자 렌더 + 즉시 재분할, 목차 순서 일치·클릭 점프·상단 강조, 저장·재로드 후 제목 수준 보존(SC-006·SC-003).

**Checkpoint**: US1 + US2 독립 동작 — 구조(문단/제목) 쓰기·목차 탐색·무손실 왕복.

---

## Phase 5: User Story 3 - 실행취소 + 평문 붙여넣기 (Priority: P3)

**Goal**: Cmd+Z/Cmd+Shift+Z 실행취소·다시실행, 외부 텍스트 평문 붙여넣기.

**Independent Test**: 입력 → Cmd+Z 취소 → Cmd+Shift+Z 복원. 서식 텍스트 복사 → 붙여넣기 → 평문만 삽입(FR-004·FR-005).

### Tests for User Story 3 (TDD)

- [X] T027 [P] [US3] [TDD-RED] `frontend/src/components/custom-editor/history.test.ts` 작성(실패): `pushSnapshot`(coalesce true=직전 교체/false=새 경계)·`undo`·`redo`(스냅샷 반환)·redo 스택 새 편집 시 폐기.

### Implementation for User Story 3

- [X] T028 [US3] `frontend/src/components/custom-editor/history.ts` 구현(T027 GREEN): `Snapshot{buffer,blockAttrs,selection}` 스택, coalesce 정책.
- [X] T029 [US3] `CustomEditor.tsx`에 undo/redo 결선 — 구조편집 경계마다 `pushSnapshot`(연속 타이핑 coalesce), Cmd+Z/Cmd+Shift+Z → 복원 스냅샷으로 `model`+`EditContext` 동기.
- [X] T030 [US3] `CustomEditor.tsx`에 plain paste — `paste` 이벤트에서 `clipboardData.getData('text/plain')` → `insertText`(개행 포함 시 블록 동기) + `preventDefault`.
- [X] T031 [US3] undo/redo·paste 검증(CDP) — 취소/복원 정확, 평문 삽입(서식 제거)(FR-004·FR-005).

**Checkpoint**: 세 스토리 모두 독립 동작.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 회귀 가드 + 사용자 검증 + 정리.

- [X] T032 무회귀 확인(SC-007) — 기본 B형 라우트 `/b/works/<id>` 가 셸 추출 전후 동일 동작, 기존 프론트 테스트 전체 GREEN(`pnpm exec vitest run` + `pnpm build`).
- [X] T033 [P] 사용자 dogfooding(IME, 헤드리스 불가) — `code-quality.md` 4케이스(빠른타자·경계조합·한자·Backspace 분해) + 실제 집필 체감(쓰기→저장→재로드). 신규 라우트 프레시 테스트 챕터.
- [ ] T034 [P] `specs/024-custom-editor-r1/quickstart.md` 검증 절차 1회 완주(순수 게이트 + CDP 항목 + 데이터 안전).
- [ ] T035 정리 — PoC 라이브 컴포넌트(`poc-editor/PocEditorLive.tsx`·`PocEditor.tsx`) 동결 유지 여부 결정(본 라운드 무삭제 default, 회고에서 후속 판단). caret affinity 워크어라운드 유지 명시(정식 추적=2라운드). 회귀 룰 후보(canvas↔DOM 금지·host caret-color) 회고 surfacing.

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup(P1)**: 즉시 시작. T001 → T002.
- **Foundational(P2)**: Setup 후. **모든 US 차단.** T003→T004, T005→T006(모델 의존).
- **US1(P3)**: Foundational 후. MVP.
- **US2(P4)**: US1의 `CustomEditor`·신규 라우트·셸 위에 확장(heading/outline). US1 완료 후 권장.
- **US3(P5)**: US1의 `CustomEditor` 위에 확장(undo/paste). US1 후. US2와 독립(병행 가능).
- **Polish(P6)**: 원하는 US 완료 후.

### User Story Dependencies
- **US1(P1)**: Foundational 후 독립. 셸 추출(T009/T010) 포함.
- **US2(P2)**: US1의 에디터·라우트 마운트 전제(같은 컴포넌트 확장). heading/outline 독립 테스트.
- **US3(P3)**: US1의 에디터 마운트 전제. undo/paste 독립 테스트. US2와 파일 충돌 적어 병행 가능.

### Within Each Story
- TDD: 테스트(RED) → 구현(GREEN). model/pmConvert/layoutEngine/outline/history.
- 모델 → 변환 → 컴포넌트 결선 → CDP 검증.

### Parallel Opportunities
- T002(geometry A2)는 T003/T004(model)와 [P].
- US2 테스트 T015·T016·T017·T018 [P](서로 다른 파일).
- US3는 US2와 다른 파일(history/paste) → US1 후 병행 가능.
- T033·T034(dogfooding/quickstart) [P].

---

## Parallel Example: User Story 2 테스트(TDD-RED)

```bash
# 서로 다른 테스트 파일 — 동시 작성 가능:
T015 model.test.ts (toggleHeading)
T016 pmConvert.test.ts (heading 왕복)
T017 layoutEngine.test.ts (heading 가변 줄높이)
T018 outline.test.ts (outlineFromModel)
```

---

## Implementation Strategy

### MVP First (US1)
1. Setup(T001~T002) → Foundational(T003~T006) → US1(T007~T014).
2. **STOP & VALIDATE**: 신규 라우트에서 쓰기→저장→재로드→줄단위 분할 dogfooding(IME 포함).
3. 핵심("진짜 분할이 실제 집필 경험 안에서") 증명되면 US2/US3로.

### Incremental Delivery
- US1(MVP) → US2(구조/목차) → US3(편집보조). 각 단계 독립 검증, 기본 B형 무회귀 유지.

### 주의(회귀 룰 정합)
- 셸 추출(T010)은 행위보존 — 기존 B형 무회귀가 게이트(SC-007). 과하면 T009에서 복제로 후퇴.
- `CustomEditor`는 documentId 단위 리마운트(022 stale 토큰 회귀 회피).
- 구조편집 후 INV-1 가드 필수(미가로챈 자동편집 → `reconcileAttrs`).

---

## Notes
- [P] = 다른 파일·무의존. [US#] = 스토리 추적.
- TDD 대상은 RED 확인 후 구현. 브라우저 측정(measure/캐럿/렌더)·IME는 CDP/dogfooding.
- 백엔드/DB/마이그레이션 변경 0. 023-export 미커밋 패치 비접촉.
- 커밋은 task 또는 논리 묶음 단위(사용자 컨펌 시).
