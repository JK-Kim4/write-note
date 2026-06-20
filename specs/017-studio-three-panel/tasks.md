---

description: "Task list — 집필실 3단 (Studio 3-panel)"
---

# Tasks: 집필실 3단 (Studio 3-panel)

**Input**: Design documents from `specs/017-studio-three-panel/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/client-contracts.md, quickstart.md

**Tests**: 본 프로젝트는 TDD 필수(CLAUDE.md §5). 순수함수는 RED→GREEN, 패널은 RTL 행위 테스트 포함.

**Organization**: User Story 단위 phase. 우선순위 P1(아웃라인) → P2(인물) → P3(접기/토글). 각 스토리는 독립 테스트·증분 전달 가능.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일·선행 의존 없음 → 병렬 가능
- **[Story]**: US1/US2/US3 (Setup·Foundational·Polish는 라벨 없음)
- 모든 작업 디렉터리는 `frontend/` (백엔드 변경 0)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 베이스라인 확인 + 신규 파일 위치 확보

- [x] T001 베이스라인 게이트 확인 (`frontend/`에서 `node_modules/.bin/vitest run` = 83 pass, `tsc --noEmit`는 기존 `src/lib/electron-api/documents.test.ts` version 에러 1건만 — 본 작업 무관·무시, `pnpm build` OK). 회귀 0 기준선 기록

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 의존하는 에디터 참조 노출 — UX 변경 없음

**⚠️ CRITICAL**: 이 phase 완료 전 어떤 스토리도 시작 불가

- [x] T002 `PaperEditor`에 `onEditorReady?: (editor: Editor | null) => void` prop 추가 + 준비/파기 effect 1개로 참조 노출. 기존 props·IME 가드(`e.view.composing`)·자동저장·페이지분할 내부 로직 **무변경** in `frontend/src/components/editor/PaperEditor.tsx`
- [x] T003 page가 `const [editor, setEditor] = useState<Editor | null>(null)` 보유 + `PaperEditor`에 `onEditorReady={setEditor}` 결선. 화면/동작 변경 없음(참조만 확보) in `frontend/src/app/projects/[id]/write/page.tsx` (depends T002)

**Checkpoint**: 에디터 인스턴스를 형제 패널에서 쓸 수 있음 — 스토리 시작 가능

---

## Phase 3: User Story 1 - 장면 아웃라인으로 원고를 조망하고 점프 (Priority: P1) 🎯 MVP

**Goal**: 좌측 패널에 본문 heading(1·2) 파생 목차 — 클릭 점프(커서 이동+스크롤) + 현재 섹션 하이라이트 + 빈 상태.

**Independent Test**: H1/H2가 있는 원고를 열어 목차가 순서·레벨대로 뜨고, 항목 클릭 시 원고가 그 위치로 점프(커서 이동)하며, 스크롤 시 현재 섹션이 하이라이트되고, 제목 0개면 안내가 보인다.

### Tests for User Story 1 ⚠️ (RED 먼저)

- [x] T004 [P] [US1] `outlineFromDoc` 실패 테스트 작성 (한 케이스씩 추가) — 빈 문자열/파싱실패/빈 문서 → `[]`, H1·H2 순서·level·index, level3+ 제외, heading 외 노드 무시, 빈/공백 텍스트 항목 유지, 동일 텍스트 중복 index 구분. `manuscript.test.ts`처럼 plain JSON→`JSON.stringify` 입력 in `frontend/src/lib/editor/outline.test.ts`
- [x] T006 [P] [US1] `StudioOutline` RTL 행위 테스트 — 항목 렌더(레벨 들여쓰기), 항목 클릭 시 점프 동작 호출, 빈 상태 문구("장면에 큰 제목을 달면 여기 목차가 생겨요.") in `frontend/src/components/editor/StudioOutline.test.tsx`

### Implementation for User Story 1

- [x] T005 [US1] `OutlineItem` 타입(`{level:1|2; text:string; index:number}`) + `outlineFromDoc(bodyJson: string): OutlineItem[]` 순수함수 — JSON 파싱·트리 walk·level1·2 heading 수집(contracts C1). T004 GREEN in `frontend/src/lib/editor/outline.ts` (depends T004)
- [x] T007 [US1] `StudioOutline.tsx` (`'use client'`) — editor doc(`getJSON`) → `outlineFromDoc` 디바운스 재파생·렌더, 항목 클릭 → 라이브 doc에서 `index`번째 heading pos 해결 → `setTextSelection(pos+1).focus()` + heading DOM 스크롤(`prefers-reduced-motion` 시 즉시), 스크롤 현재 섹션 `aria-current`(굵기/배경 병행), 빈 상태. T006 GREEN in `frontend/src/components/editor/StudioOutline.tsx` (depends T005, T006)
- [x] T008 [US1] `.screen-body` 그리드에 좌측 아웃라인 열 추가 + `.studio-outline` 패널 스타일(`--surface-sunken` 톤, 대비 ≥4.5:1, 항목 버튼/현재섹션 굵기·배경) in `frontend/src/styles/desktop-app.css`
- [x] T009 [US1] page 좌측 열에 `<StudioOutline editor={editor} scrollContainer=…/>` 결선 in `frontend/src/app/projects/[id]/write/page.tsx` (depends T007, T008, T003)
- [x] T010 [US1] 게이트 — `vitest run` + `tsc --noEmit` + `eslint` + `pnpm build`(RSC: StudioOutline `'use client'` 검출) + 시각 확인(목차·점프·하이라이트)

**Checkpoint**: US1 단독으로 동작·테스트 가능 (MVP)

---

## Phase 4: User Story 2 - 곁에 둔 인물 노트 보기와 빠른 추가 (Priority: P2)

**Goal**: 우측에 인물 노트 — 기존 등장인물 목록 보기(이름·한 줄·상세 펼침) + 빠른 추가 + 상세 화면 링크 + 빈 상태. 우측 스택(인물 위 / 곁쪽지 아래) 구성(MemoPanel 컴포넌트 불변).

**Independent Test**: 등장인물이 있는 작품을 열어 인물이 이름·한 줄로 뜨고, 상세 펼침 토글이 되며, 이름 입력→추가가 목록에 반영되고, 인물 0명이면 안내+입력이 보이고, 상세 링크가 `/projects/[id]/characters`로 간다.

### Tests for User Story 2 ⚠️

- [x] T012 [P] [US2] `CharacterPanel` RTL — 목록 렌더(이름·한 줄), 상세 펼침/접힘, 빈 상태("곁에 둘 인물을 추가."), 빠른 추가가 create 호출+입력 초기화, 빈 이름 제출 비활성, 상세 링크 존재. HTTP만 mock in `frontend/src/components/workspace/CharacterPanel.test.tsx`

### Implementation for User Story 2

- [x] T011 [P] [US2] `useCharacters.ts` — `characterKeys`(all/byProject) + `useProjectCharacters(projectId)`(→ `listCharacters(...).content`, enabled=finite) + `useCreateCharacter()`(onSuccess invalidate byProject) in `frontend/src/lib/query/useCharacters.ts`
- [x] T013 [US2] `CharacterPanel.tsx` (`'use client'`, `{projectId}`) — `useProjectCharacters` 목록(이름·`shortDescription`·`notes` 펼침), `useCreateCharacter` 빠른 추가(이름 필수·실패 시 에러+입력 보존), 빈 상태, `/projects/[id]/characters` 링크(FR-014) in `frontend/src/components/workspace/CharacterPanel.tsx` (depends T011, T012)
- [x] T014 [US2] `StudioRightStack.tsx` — 우측 스택 컨테이너: 상단 `CharacterPanel` + 하단 기존 `MemoPanel`(props 그대로 전달, 컴포넌트 불변) in `frontend/src/components/workspace/StudioRightStack.tsx` (depends T013)
- [x] T015 [US2] `.screen-body` 우측 열 + `.studio-right`(스택) 스타일 — 기존 `.side-panel` 톤 계승 in `frontend/src/styles/desktop-app.css`
- [x] T016 [US2] page 우측 열의 직접 `MemoPanel` 렌더를 `StudioRightStack`(memo props + projectId 전달)으로 교체. 곁쪽지 동작 불변(FR-017) in `frontend/src/app/projects/[id]/write/page.tsx` (depends T014, T015)
- [x] T017 [US2] 게이트 — `vitest run` + `pnpm build`(CharacterPanel `'use client'`) + 시각 확인(인물 목록·빠른 추가·곁쪽지 회귀 0)

**Checkpoint**: US1·US2 모두 독립 동작

---

## Phase 5: User Story 3 - 패널 접기로 몰입과 조망을 전환 (Priority: P3)

**Goal**: 좌·우 패널 접기 토글(진입 기본 = 아웃라인만 펼침), 우측 스택 인물/곁쪽지 개별 접기, 반응형 단계 접힘(아웃라인 먼저→우측), 모바일 오버레이/시트.

**Independent Test**: 좌·우 토글로 패널이 접히고/펼쳐지며 둘 다 접으면 원고만 남고, 우측 인물·곁쪽지 섹션을 따로 접을 수 있고, 폭을 좁히면 아웃라인이 먼저 물러난 뒤 우측이 물러나며, 곁쪽지 고정/해제가 기존과 동일하다.

### Implementation for User Story 3

- [x] T018 [US3] page에 `leftOpen`(기본 `true`)/`rightOpen`(기본 `false`) 상태 + 접힘 조합 4가지에 따른 `.screen-body` modifier 클래스(또는 data-attr) 적용. 둘 다 접힘 = 원고만(`--solo` 계승) in `frontend/src/app/projects/[id]/write/page.tsx`
- [x] T019 [US3] Titlebar `right` JSX의 단일 곁쪽지 토글을 좌(아웃라인)·우(맥락 패널) **2개 토글**로 확장 — `aria-pressed`/`aria-label`, 기존 토글 어휘 계승 in `frontend/src/app/projects/[id]/write/page.tsx` (depends T018)
- [x] T020 [US3] `StudioRightStack`에 인물·곁쪽지 섹션 개별 접기 — 섹션 헤더 버튼 `aria-expanded`, 한 섹션 접어도 다른 섹션 유지 in `frontend/src/components/workspace/StudioRightStack.tsx`
- [x] T021 [US3] `.screen-body` 접힘 4조합 `grid-template-columns` + 반응형(중간 폭 아웃라인 자동 접힘 → 좁은 폭 우측 물러남, 기존 880px 분기 계승) + 모바일 오버레이/시트 + `prefers-reduced-motion` 전환 대체. 유동 타이포 금지 in `frontend/src/styles/desktop-app.css`
- [x] T022 [US3] 게이트 — `vitest run` + `pnpm build` + 시각 확인(4조합·반응형·reduced-motion)

**Checkpoint**: 전 스토리 독립 동작

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 접근성·회귀·시각 검증·최종 게이트

- [x] T023 [P] 접근성 패스 — 패널 텍스트 대비 ≥4.5:1, 키보드 포커스 순서, `aria-current`/`aria-expanded`/`aria-pressed` 동작, 하이라이트 색 단독 의존 X 확인(FR-018~020)
- [ ] T024 회귀 0 검증 — 한국어 IME 4케이스(`docs/poc/0-1-tiptap-korean.md`: 빠른 타자·조합 중 bold·한자 변환·Backspace 분해), 자동저장, 페이지 분할, 곁쪽지 고정/해제가 3단 도입 후 동일(SC-005). `PaperEditor` 내부·`MemoPanel` 무변경 확인
- [ ] T025 시각 검증 — 실제 `desktop-app.css`를 `<link>`한 정적 하니스 HTML + headless Chrome(`--blink-settings=preferredColorScheme=1` 라이트 강제) 스크린샷: 라이트/다크 × 패널 4조합 × 좁은 폭(quickstart.md)
- [x] T026 최종 전체 게이트 — `node_modules/.bin/vitest run` + `tsc --noEmit`(기존 documents.test.ts 1건 무시) + `eslint src` + `pnpm build`. 포어그라운드 실행·결과 직접 확인
- [x] T027 [P] quickstart.md 검증 체크리스트 1회 수행

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup(P1)**: 의존 없음
- **Foundational(P2)**: Setup 후. 모든 스토리 BLOCK (T002→T003)
- **US1(P3)**: Foundational 후. MVP
- **US2(P4)**: Foundational 후. US1과 독립(다른 패널·파일). 단 page.tsx·desktop-app.css 공유 편집은 순차
- **US3(P5)**: US1·US2 패널이 존재해야 토글·스택 접기 의미 → US1·US2 후 권장
- **Polish(P6)**: 원하는 스토리 완료 후

### Within Each User Story

- 테스트(T004/T006/T012) FAIL 먼저 → 구현
- 순수함수(T005) → 컴포넌트(T007) → CSS(T008) → page 결선(T009) → 게이트(T010)
- US2: 훅(T011) → 컴포넌트(T013) → 스택(T014) → CSS(T015) → page(T016) → 게이트(T017)

### Parallel Opportunities

- T004 ↔ T006 (US1 테스트, 다른 파일) [P]
- T011 ↔ T012 (US2 훅 vs 패널 테스트, 다른 파일) [P]
- T023 ↔ T027 (Polish, 독립) [P]
- ⚠️ `page.tsx`(T003/T009/T016/T018/T019) 및 `desktop-app.css`(T008/T015/T021)는 동일 파일 → **순차**(병렬 금지)

---

## Parallel Example: User Story 1

```bash
# US1 테스트 동시 작성(RED):
Task: "outlineFromDoc 실패 테스트 in frontend/src/lib/editor/outline.test.ts"
Task: "StudioOutline RTL 테스트 in frontend/src/components/editor/StudioOutline.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & VALIDATE**(아웃라인 단독 dogfooding) → demo.

### Incremental Delivery

Setup+Foundational → US1(MVP, 아웃라인) → US2(인물) → US3(접기/토글) → Polish. 각 스토리는 이전을 깨지 않고 가치 추가.

---

## Notes

- [P] = 다른 파일·무의존. `page.tsx`·`desktop-app.css`는 여러 task가 공유하므로 순차.
- 신규 패널(`StudioOutline`/`CharacterPanel`/`StudioRightStack`) = `'use client'` 의무 + 작성 직후 `pnpm build`로 RSC 경계 검출.
- 빌드/테스트 포어그라운드 실행·결과 직접 확인(CLAUDE.md). 같은 에러 3회 재시도 금지.
- 백엔드 변경 0 / AI·Ambience 금지 / `PaperEditor` IME 가드·`MemoPanel` 무변경.
- 커밋은 사용자 신호 시(자동 커밋 안 함).
