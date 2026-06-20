---
description: "Task list — 029 집필실 에디터 페이지 넘김 뷰"
---

# Tasks: 집필실 에디터 페이지 넘김 뷰

**Input**: Design documents from `specs/029-editor-paged-view/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/editor-paged-view.md, quickstart.md

**Tests**: 포함 (TDD HARD-GATE §5 — 순수 로직/렌더 행위는 Red→Green). 캐럿/IME/모바일 정합은 dogfooding 게이트.

**Organization**: user story 별 phase. 작업 브랜치 = `develop` 직접. 변경 집중 = `frontend/src/components/custom-editor/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일 + 의존 없음 → 병렬
- **[Story]**: US1/US2/US3 (Setup/Foundational/Polish 라벨 없음)

---

## Phase 1: Setup

- [X] T001 현 구조 재확인: `CustomEditor.tsx` 의 렌더 블록(1178~1195 `view.pages.map`), 스크롤-follow effect(472~482), 목차 점프(502~), `onStageMouseDown`(1001~) 위치를 implement 직전 grep 으로 확정(라인 이동 가능 — §6).

**Checkpoint**: 변경 지점 확정.

---

## Phase 2: Foundational (순수 헬퍼 — 모든 US 공통)

**Purpose**: 페이지 이동 결정 로직을 테스트 가능한 순수 함수로 분리. US1~3 모두 이 헬퍼에 의존.

- [X] T002 [P] `frontend/src/components/custom-editor/pagedView.test.ts` (신규): `clampPage`(total≤0→0, [0,total-1]) / `nextPage`·`prevPage`(clamp ±1) / `pageToFollowCaret`(다르면 새 인덱스, 같으면 null) Red.
- [X] T003 `frontend/src/components/custom-editor/pagedView.ts` (신규): 위 순수 함수 구현 (Green). 시계·DOM 비의존.

**Checkpoint**: 헬퍼 GREEN → 컴포넌트 결선 가능.

---

## Phase 3: User Story 1 - 한 화면에 한 페이지 + 자동 전환 (Priority: P1) 🎯 MVP

**Goal**: 연속 스택 제거, `pages[currentPage]` 한 장 렌더, 캐럿이 흘러가면 자동 페이지 전환.

**Independent Test**: 한 페이지 이상 입력 → 화면 안 늘어나고 다음 페이지 자동 전환 + 캐럿 보임.

### Tests for User Story 1 (TDD)

- [X] T004 [P] [US1] `frontend/src/components/custom-editor/CustomEditor.test.tsx` 보강: 여러 페이지 분량 모델에서 **PageBox(또는 data-poc-page)가 한 개만** 렌더되는지(전체 map 아님) RTL Red.

### Implementation for User Story 1

- [X] T005 [US1] `CustomEditor.tsx`: `currentPage` 상태(useState 0) 추가. 렌더(1178~1195) 두 분기(데스크탑 zoom·모바일 transform:scale)를 `view.pages[clampPage(currentPage, view.pages.length)]` **단일 PageBox** 로 교체. (T004 Green — 핵심 조기 dogfood §10)
- [X] T006 [US1] `CustomEditor.tsx`: 스크롤-follow effect(472~482)를 **캐럿→페이지 동기**로 대체 — `pageToFollowCaret(caretPos.pageIndex, currentPage)` 가 null 아니면 `setCurrentPage`. deps 를 `caretPos?.pageIndex` 중심으로 안정화(무한 렌더 회피, 코드퀄리티 §). 줌인 시 페이지 내 scrollTop 캐럿 보정은 같은 페이지 한정 유지.
- [X] T007 [US1] `CustomEditor.tsx`: 페이지 수 감소로 `currentPage` 가 범위를 벗어나면 렌더 직전 `clampPage` 로 보정(FR-011, 빈 화면 금지).

**Checkpoint**: 단일 페이지 + 자동 전환 동작.

---

## Phase 4: User Story 2 - `< >` + 키보드 네비게이션 (Priority: P1)

**Goal**: 좌/우 `< >` 오버레이 + PageUp/Down + "n / N" 위치 표시.

**Independent Test**: `< >`/키로 앞뒤 이동, 첫/끝 비활성, 위치 표시 정확, 클릭 시 캐럿 이동.

### Tests for User Story 2 (TDD)

- [X] T008 [P] [US2] `CustomEditor.test.tsx` 보강: 첫 페이지에서 `<` 비활성·마지막에서 `>` 비활성, "n / N" 위치 표시 렌더, `>` 클릭 시 다음 페이지로 전환 RTL Red.

### Implementation for User Story 2

- [X] T009 [US2] `CustomEditor.tsx`: 화면 좌/우 가장자리 `<` `>` 오버레이 버튼(활성 조건 `currentPage>0` / `<length-1`) + 하단 "{currentPage+1} / {length}" 표시. 클릭 = `prevPage`/`nextPage`.
- [X] T010 [US2] `CustomEditor.tsx`: 키보드 PageUp=prevPage / PageDown=nextPage 핸들러(기존 keydown 경로에 추가, ←/→는 캐럿용이라 미사용). `< >` 는 뷰 이동만(캐럿 불변) — 클릭은 기존 onStageMouseDown 으로 캐럿 이동(currentPage 대상).

**Checkpoint**: US1+US2 — 단일 페이지 + 네비 동작.

---

## Phase 5: User Story 3 - 목차 점프 페이지 전환 (Priority: P2)

**Goal**: 목차 항목 클릭 시 해당 heading 페이지로 전환 + 캐럿 이동.

**Independent Test**: 여러 페이지의 제목에서 목차 클릭 → 해당 페이지 전환 + 캐럿 그 제목으로.

### Implementation for User Story 3

- [X] T011 [US3] `CustomEditor.tsx`: 목차 점프(502~)를 `setCurrentPage(heading 페이지)` + 캐럿 이동으로 변경. heading 페이지 = `caretToScreen(headingCaret).pageIndex`. 기존 scrollTop 점프 제거/대체.

**Checkpoint**: US1~3 동작.

---

## Phase 6: Polish & Cross-Cutting

- [X] T012 게이트: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` GREEN(포어그라운드 — build=RSC 경계).
- [X] T013 dogfooding(로컬, 사용자 확인 2026-06-20): 단일 페이지·`<>`·페이지표시·세로 스크롤(가운데 내부)·양옆 패널 고정/안 잘림 **사용자 승인**. ⚠️ 잔여 dogfooding(한글 IME 4케이스 / 모바일 / PDF·분할 무회귀)은 merge 전 권장.
- [X] T015 (dogfooding 파생, 계획 외) 레이아웃 containment 수정 — 세로로 긴 종이가 창 전체를 스크롤시켜 양옆 패널이 사라지고 잘리던 문제: `BStudioShell` 가운데 컬럼 `min-h-0` + `CustomEditor` 스테이지를 `position:absolute; inset:0` 내부 스크롤 컨테이너로. (잘못 든 page-sizing 시도 windowPageGeometry/fit-to-page 는 전량 원복.)
- [ ] T014 마무리: `docs/plan/02-progress.md` + vault 029 진척 반영(finish-work/sync-vault). 028과 트랙 분리 — 커밋 시 분리 또는 028 선마무리. (커밋·merge 사용자 요청 시)

---

## Dependencies & Execution Order

- **Setup(P1)**: T001 변경 지점 확정 → 즉시.
- **Foundational(P2)**: T002~T003 순수 헬퍼 — US1~3 전제(BLOCKS).
- **US1(P3)**: 헬퍼 후. 단일 렌더 + 캐럿 동기 — MVP.
- **US2(P4)**: US1 위(같은 컴포넌트, currentPage 상태 공유) → US1 후 순차.
- **US3(P5)**: US1 후 독립.
- **Polish(P6)**: 전체 후.

### 파일 동시성
- `pagedView.ts`/`pagedView.test.ts` 는 [P](신규 독립). `CustomEditor.tsx`·`CustomEditor.test.tsx` 는 단일 파일이라 US1~3 변경 **비병렬**(순차 편집).

### Within Each Story
- 테스트(Red, 가능 범위) → 구현(Green). 순수 로직 우선, 캐럿/IME/모바일은 dogfooding.

---

## Implementation Strategy

### MVP First (US1)
1. Setup(T001) → Foundational(헬퍼) → US1(단일 페이지+자동전환) → 조기 dogfood(§10 — 핵심을 첫 산출물에서).

### Incremental
1. 헬퍼 → US1(단일 페이지) → US2(네비) → US3(목차). 각 단계 dogfooding.

---

## Notes
- `layoutEngine`/`measure`/`model`/`geometry`/`printLayout`/`pmConvert`/`history`/`outline`/`input/*` **무수정**(표시 계층만).
- 좌표계가 절대 pageIndex 기준이라 단일 렌더에도 캐럿/클릭/선택 보존(research R2).
- 028과 별도 트랙 — 같은 작업트리, 커밋 분리 권장.
- 커밋·merge는 사용자 요청 시에만.
