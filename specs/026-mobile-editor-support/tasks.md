---
description: "Task list for 026 모바일 집필 지원 (iOS 입력 + 반응형)"
---

# Tasks: 모바일 집필 지원 (iOS 입력 + 반응형)

> **⚠️ 최종 결과(2026-06-18)**: **US1·US2(iOS 자체에디터 입력/편집) = 폐기** — contenteditable·hidden textarea 두 방식 모두 dogfooding서 실패(자모 중복 / 네이티브 선택 발산), 사용자가 **iOS 편집 미지원 결정**(research.md Decision 7). iOS는 글쓰기 미지원 안내 + 집필실 페이지 차단. **US3 모바일 반응형 = 완료**(헤더 햄버거 + 에디터 화면폭 reflow, 운영 배포·검증). Phase 6 정리분(textareaAdapter·setCaretRect·debugNoZoom·poc/mobile-editor·ios-textarea-probe 제거, 배너 복원) 반영. 데스크탑·안드 무회귀.

**Input**: `specs/026-mobile-editor-support/` (plan.md, spec.md, research.md, data-model.md, quickstart.md)

**Tests**: 어댑터의 결정적 로직(이벤트→model 매핑)은 단위테스트(TDD). iOS 한글 IME 정확성은 자동화 불가 → 실기기 dogfooding 게이트.

**Organization**: user story별 phase. Foundational(입력 어댑터 추상화)이 US1·US2의 전제. US3(반응형)는 독립.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

- frontend 단독: `frontend/src/...` (백엔드 변경 0)

---

## Phase 1: Setup

**Purpose**: 입력 어댑터 골격

- [X] T001 `frontend/src/components/custom-editor/input/` 디렉토리 생성 + `inputAdapter.ts`에 `InputAdapter` 인터페이스·`InputHandlers`·`EditIntent` 타입 정의 (data-model.md 기준: attach/detach/syncText/syncSelection/getText/getSelection/isComposing + onTextUpdate/onCompositionStart/onCompositionEnd/onEdit)

---

## Phase 2: Foundational (Blocking — 무회귀 핵심)

**Purpose**: 기존 EditContext 결합부를 어댑터로 추출하고 CustomEditor가 어댑터로 입력받게 한다. **데스크탑 무회귀가 게이트.**

**⚠️ CRITICAL**: US1·US2는 이 phase 완료 후 시작

- [X] T002 `editContextAdapter.ts` 구현 — `CustomEditor.tsx`의 EditContext 결합부(new EditContext / host.editContext / `textupdate`→onTextUpdate / compositionstart·end / updateText·updateSelection·updateControlBounds)를 이동해 `InputAdapter` 구현 (동작 보존)
- [X] T003 `CustomEditor.tsx` 리팩토링 — EditContext 직접 사용부를 `InputAdapter` 호출로 교체. 기능 감지(`typeof EditContext !== "undefined"`)로 어댑터 선택(없으면 iOS 어댑터 = textarea 프록시, US1에서 확정). copy/cut/paste·화살표 keydown 등 host 공통 이벤트는 유지
- [X] T004 [P] `editContextAdapter.test.ts` — textupdate→onTextUpdate 매핑·composition·selection 동기를 단위 검증(시스템 경계 mock)
- [X] T005 무회귀 검증 — `cd frontend && npx vitest run && npx tsc --noEmit && npx next build` GREEN (기존 CustomEditor 동작·전체 테스트 무회귀)

**Checkpoint**: 데스크탑이 어댑터 경유로 기존과 동일 동작(무회귀 GREEN)

---

## Phase 3: User Story 1 - iOS 한글 집필 (Priority: P1) — ❌ 폐기(iOS 편집 미지원 결정, Decision 7)

**Goal**: iOS(WebKit)에서 한글이 입력되고 IME 받침 재조합이 정확.

**Independent Test**: iPhone Safari로 집필실 진입 → 한글 문단 입력 → 정확 표시 + 받침 재조합(quickstart Phase A).

> **⚠️ 아키텍처 정정(2026-06-18)**: T006~T012는 contenteditable 어댑터 기준으로 작성·구현됐으나, iOS 한글 IME PoC 실패(자모 중복·줄바꿈 소실)로 **contenteditable 폐기**. **hidden textarea 입력 프록시**(`textareaAdapter.ts`)로 재구현해 **실기기 dogfooding 전부 통과**(한글 IME·받침·줄바꿈 중복0·글자크기 reflow·탭 이동+작성). 아래 T006~T012는 **textarea 어댑터로 superseded**, US1 게이트는 통과. 근본 원인·채택 근거는 research.md Decision 6, 커밋 `444d4b0`.

- [X] ~~T006 [US1] `contentEditableAdapter.ts` 골격~~ → **superseded**: `textareaAdapter.ts`(`createTextareaAdapter`) — stage 덮는 투명 textarea attach/detach, `InputAdapter` 구현
- [X] ~~T007 [US1] `beforeinput`→onTextUpdate~~ → **superseded**: `input` 이벤트 → `value` diff(공통 prefix/suffix 제거)→`onTextUpdate`(브라우저 기본 편집을 막지 않고 textarea가 단일 입력 전담)
- [X] ~~T008 [US1] `compositionupdate` 받침 재조합~~ → **superseded**: `compositionstart`/`compositionend` → onCompositionStart/End. textarea가 IME를 네이티브 처리 → 받침 재조합 별도 워크어라운드 불필요(DOM 미재구성 = orphan 없음)
- [X] ~~T009 [US1] syncText/syncSelection — contenteditable DOM 동기~~ → **superseded**: `textarea.value` / `setSelectionRange` 동기(조합 중 억제). `textarea.value === model.buffer` 1:1
- [X] ~~T010 [US1] 캐럿 충돌 — contenteditable 캐럿 숨김~~ → **superseded**: textarea를 전체 덮기+투명(`color/caret-color/-webkit-text-fill-color:transparent`), 캐럿·선택·글자는 자체 렌더가 표시
- [X] ~~T011 [P] [US1] `contentEditableAdapter.test.ts`~~ → **superseded**: `textareaAdapter.test.ts`(10 테스트 — value diff·composition·selection 매핑)
- [X] T012 [US1] 기능 감지 분기에 어댑터 연결(`typeof EditContext !== "undefined" ? createEditContextAdapter() : createTextareaAdapter()`) + iOS 안내 배너 비활성(완전 제거는 Phase 6/T025). 추가: 탭 hit-test(`elementsFromPoint`로 textarea 아래 페이지 탐색), `mobilePageGeometry` reflow, 소프트 키보드(사용자 제스처 내 `focusInput()`)

**Checkpoint (dogfooding 게이트)**: ✅ 통과 — iPhone Safari에서 한글 입력·받침 재조합·줄바꿈·탭 이동 확인. US2 진행 가능.

---

## Phase 4: User Story 2 - iOS에서 데스크탑과 동일 편집 (Priority: P2) — ❌ 폐기(iOS 편집 미지원 결정, Decision 7)

**Goal**: textarea 입력 위에서 데스크탑 편집 기능이 iOS에서 best-effort 동일하게 동작하는지 **점검·이식**.

**Independent Test**: iOS에서 선택→굵게(toolbar), Enter 분할, 목록 전환, 붙여넣기 서식 보존, 자동저장 무충돌.

> **textarea 경로 전제(2026-06-18)**: 마크·블록은 **toolbar 버튼(onClick)** 경로라 iOS에서 닿는다(`CustomEditor.tsx` ToolbarButton 12종 확인). 그러나 **undo/redo·Shift+Enter(소프트 줄바꿈)는 host keydown 전용**인데 textarea가 keydown을 `stopPropagation`하므로 iOS에서 **현재 안 닿는다**(키보드에 Cmd 키도 없음) — T013/T018에서 대안(toolbar 버튼/제스처) 필요. 각 항목 **계측(이벤트·value·selection 덤프) 먼저, 추측 수정 금지(§11)**.

- [ ] T013 [US2] 편집키 검증·이식 — Enter(splitBlock)·Backspace/Delete는 textarea 네이티브 `\n`/문자 삭제 → value diff → `onTextUpdate`→`insertText`/`deleteRange`로 자동 라우팅(`textareaAdapter`). **iOS 실기기에서 블록 분할·삭제·블록 경계 병합(mergeWithPrev) 정확성 점검.** ⚠️ **Shift+Enter 소프트 줄바꿈(U+2028)**: textarea는 Enter/Shift+Enter 모두 value에 `\n`을 넣어 value diff로 구분 불가 + host keydown 차단 → 현재 iOS 미지원. 대안 결정(toolbar 줄바꿈 버튼 등) 또는 best-effort 미지원 보고(T021)
- [ ] T014 [US2] 선택/드래그 검증 — textarea 네이티브 선택 → `selectionchange`→`onSelectionChange`→렌더 sel(anchor/focus) 동기(이미 결선). iOS 실기기에서 드래그 선택·핸들 동작 점검
- [ ] T015 [US2] 캐럿 이동(화살표·Home/End) — textarea 네이티브 이동 → `onSelectionChange`로 렌더 캐럿 추종(host keydown 아님). 외장 키보드/소프트 키보드 캐럿 이동 iOS 점검
- [ ] T016 [US2] 마크(B/I/U/S) — toolbar `applyMark`→`toggleMark`(buffer/선택 불변, markRuns만 변경) 경로. iOS toolbar 탭으로 선택 구간 토글 점검(키보드 Cmd+B는 textarea 차단 → 미지원 확인)
- [ ] T017 [US2] 블록(heading H1~3/blockquote/bullet·ordered list/hr) — toolbar `applyBlockType`/`toggleBlockType`/`applyHrRef` 경로. iOS toolbar 탭 점검
- [ ] T018 [US2] undo/redo — 현재 Cmd+Z/Cmd+Shift+Z(host keydown)뿐이라 **iOS textarea 차단으로 미도달**. toolbar undo/redo 버튼 신설 또는 best-effort 미지원 보고 결정(T021). `history.ts`(pushSnapshot/undo/redo) 로직 자체는 재사용
- [ ] T019 [US2] 복사/잘라내기/붙여넣기 — host `copy`/`cut`/`paste` 리스너(text/plain U+2028→\n + PM JSON 병기). ⚠️ **textarea 네이티브 클립보드와 충돌 가능** — iOS에서 textarea 기본 복붙이 host 리스너를 가로채는지 계측 후 점검
- [ ] T020 [US2] 목차 점프(`outlineFromModel`/`useCustomOutline`)·자동저장(`useDocumentSession`, 챕터별 key 리마운트)·페이지 분할(자체 엔진) iOS 동작 점검
- [ ] T021 [US2] best-effort 불가/차이 항목 기록(보고용) — 최소 후보: 소프트 줄바꿈(T013)·undo/redo(T018)·키보드 단축키(마크/블록은 toolbar 대체)

**Checkpoint (dogfooding)**: iOS에서 편집 기능 확인(계측 우선).

---

## Phase 5: User Story 3 - 모바일 반응형 (Priority: P3, 독립·병렬 가능) — ✅ 완료(운영 배포·검증)

**Goal**: 모바일 폭에서 헤더 가로 overflow(왼쪽 슬라이드) 제거 + 셸/에디터 반응형.

**Independent Test**: 모바일 폭에서 가로 스크롤 없음, 헤더가 화면 안.

- [ ] T022 [P] [US3] `frontend/src/app/b/layout.tsx` 헤더 nav 모바일 반응형 — 가로 overflow 제거(메뉴 접기/오버플로 처리), `body` 가로 스크롤 방지
- [ ] T023 [P] [US3] `frontend/src/components/b/BStudioShell.tsx` 모바일 레이아웃 점검(880px 분기 정합)
- [ ] T024 [P] [US3] `CustomEditor` stage 모바일 점검(가로 overflow 없는지)

**Checkpoint**: 모바일 폭 가로 스크롤 없음.

---

## Phase 6: Polish & 정리

- [ ] T025 iOS 안내 배너 잔재 제거 — `CustomEditor.tsx`(현재 비활성 주석 상태, iOS 입력 동작 확인 후 완전 제거)
- [ ] T026 viewport `minimum-scale` 재검토 — `frontend/src/app/layout.tsx`(반응형이 핀치줌 깨짐을 근본 해결하면 제거 검토)
- [ ] T027 `ios-textarea-probe` 검증 라우트 제거 — `frontend/src/app/poc/ios-textarea-probe/page.tsx`(textarea IME 검증용 probe, 입력 확정으로 역할 종료)
- [ ] T028 `debugNoZoom` prop 제거 — `CustomEditor.tsx`(line 357/359/429, fit-to-width zoom 비활성 진단 잔재, 미사용)
- [ ] T029 `poc/mobile-editor` 진단 헤더 최종 정리 — `frontend/src/app/poc/mobile-editor/page.tsx`(현재 buffer 한 줄만 남김 — dogfooding 종료 후 라우트 유지/제거 결정)
- [ ] T030 전체 무회귀 최종 검증 — `cd frontend && npx vitest run && npx eslint && npx tsc --noEmit && npx next build` GREEN
- [ ] T031 best-effort 결과(iOS 구현 가능/불가 기능) 사용자 보고 + quickstart 최종 검증

---

## Dependencies & Execution Order

- **Phase 1 Setup** → **Phase 2 Foundational(무회귀 게이트)** → US1 → US2
- **Phase 5 US3(반응형)**: Foundational 무관, 언제든 병렬 가능
- **US1 dogfooding 게이트 통과 후 US2** (PoC 실패 시 research 재검토)
- **Phase 6**: US1~US3 후

### Within Each Story

- 단위테스트(결정적 로직) 먼저 작성·실패 확인 후 구현(TDD)
- iOS IME·편집은 단위테스트 한계 → dogfooding 게이트로 검증

### Parallel Opportunities

- T004(어댑터 테스트), T011(어댑터 테스트), US3 전체(T022~T024)는 [P]
- US3는 입력 작업과 병렬 가능

---

## Implementation Strategy

### MVP First (US1 — iOS 한글 입력)

1. Phase 1 Setup → Phase 2 Foundational(데스크탑 무회귀 GREEN) — ✅ 완료
2. Phase 3 US1 → iOS 실기기 dogfooding(한글·받침) — ✅ 통과(textarea 프록시, contenteditable 폐기 → Decision 6)
3. → US2(편집 이식) 진행

### Incremental Delivery

- Foundational(무회귀) → US1(iOS 입력 MVP, dogfood) → US2(편집) → US3(반응형, 병렬) → Polish(정리)

## Notes

- [P] = 다른 파일·의존 없음
- 데스크탑 무회귀(Phase 2/T005, Phase 6/T030)가 상시 게이트
- iOS 한글 IME 정확성은 실기기 dogfooding이 최종 진실(자동 한계 — spec/plan 명시)
- 자동 진행 중 중대 결정(데이터 손실·되돌리기 어려움·데스크탑 회귀)만 멈춰 질문, 나머지 default+보고
