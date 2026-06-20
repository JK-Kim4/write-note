# Tasks: 자체 에디터 R3 — 블록 패리티 + 소프트 줄바꿈

**Feature**: `specs/024-custom-editor-r3` | **Branch**: `023-export` | **Spec**: spec.md | **Plan**: plan.md

TDD HARD-GATE(§5): 순수 모듈(model/measure/pmConvert)은 Red-Green-Refactor. 테스트 먼저 작성·실패 확인 후 최소 구현.
sub-agent 모델: 순수 TDD=sonnet, 캐럿/선택/렌더·툴바=opus (haiku 금지).
무수정: `layoutEngine.ts`·`geometry.ts`·`useCustomOutline.ts`·`BCustomChapterEditor.tsx`·백엔드.
경로 접두사: `frontend/src/components/custom-editor/`

---

## Phase 1: Setup

- [ ] T001 현 모델/측정/변환 baseline 스냅샷 — `model.ts`·`measure.ts`·`pmConvert.ts`·`CustomEditor.tsx` 의 R2 동작과 기존 테스트(GREEN) 확인. 변경 전 `pnpm exec vitest run src/components/custom-editor` 통과 기록.

## Phase 2: Foundational (블로킹 — 모든 US 선행)

- [ ] T002 `model.ts`에 `BlockAttr` 유니온 확장(`blockquote`/`listItem{listKind,depth}`/`hr`) + `SOFT_BREAK="\u2028"` 상수 + INV-6/7 주석. 타입만(데이터 구조), 동작 변경 없음. (§5-5 타입 선언 완화)
- [ ] T003 `model.ts`에 `isAtomic(attr)` + `listNumberAt(model,i)` 파생 헬퍼 스텁 + 시그니처. (계약 `contracts/internal-modules.md`)

---

## Phase 3: US1 — 블록 서식 입력·표시 (P1, 양보불가 핵심)

**Goal**: 인용·글머리표·번호목록·구분선을 입력하고 올바로 표시. 독립 테스트: 프레시 챕터에서 각 블록 생성 시 렌더·캐럿·타이핑·페이지분할 정상.

### TDD — 순수 모듈 (sonnet)

- [ ] T004 [P] [US1] `model.test.ts`: `toggleBlockType`(paragraph↔blockquote↔listItem) 텍스트 보존 + INV 검증 테스트 작성(RED).
- [ ] T005 [US1] `model.ts`: `toggleBlockType` 최소 구현(GREEN) — blockAttr type 전환, buffer/markRuns 보존.
- [ ] T006 [P] [US1] `model.test.ts`: `insertHr`/`deleteAtomicAt` + `isAtomic`/`nextCaretSkippingAtomic`(hr 건너뜀) 테스트(RED).
- [ ] T007 [US1] `model.ts`: hr 삽입·삭제·캐럿 건너뜀 구현(GREEN). INV-6 보장.
- [ ] T008 [P] [US1] `model.test.ts`: `listNumberAt` 파생(연속 ordered·depth 카운트, 경계 재시작) 테스트(RED).
- [ ] T009 [US1] `model.ts`: `listNumberAt` 구현(GREEN).
- [ ] T010 [US1] `model.ts`: Refactor — splitBlock가 목록 항목에서 같은 listKind·depth 새 블록 생성 + 빈 목록 항목 paragraph 강등. 테스트 추가(RED→GREEN→정규형 reconcile 유지).

### measure 일반화 (sonnet)

- [ ] T011 [P] [US1] `measure.test.ts`: `measureParagraphLines`에 `blockAttr` 인자 추가 — 인용 들여쓰기·목록 마커폭·depth 들여쓰기로 content 폭 축소 검증(RED). 폭 상수 단위 테스트.
- [ ] T012 [US1] `measure.ts`: `blockAttr` 인자 수용 + 폭 조정 구현(GREEN). canvas 금지(styled-DOM+Range 유지). 마크/문단 무회귀 보장.

### 렌더·툴바 (opus)

- [ ] T013 [US1] `CustomEditor.tsx`: 블록 렌더 일반화 — blockquote(인용선·들여쓰기)·listItem(마커 •/파생번호)·hr(가로선) DOM 렌더. `relayout`이 `blockAttr`를 measure에 전달.
- [ ] T014 [US1] `CustomEditor.tsx`: hr 캐럿 라우팅 — 화살표/클릭이 hr 진입 안 함(`nextCaretSkippingAtomic`), 인접 Backspace/Delete로 hr 삭제.
- [ ] T015 [US1] `CustomEditor.tsx`: 툴바에 인용·글머리표·번호목록·구분선 버튼 + 활성 상태 표시(B형 BEditor 툴바 구성 참조). 클릭 → `toggleBlockType`/`insertHr`.

**Checkpoint US1**: 자동 게이트(tsc·vitest·build) GREEN. 블록 4종 입력·표시·캐럿 동작.

---

## Phase 4: US2 — 소프트 줄바꿈 (P1)

**Goal**: Shift+Enter = 같은 블록/번호 줄 추가, Enter = 새 블록. 독립 테스트: 번호 목록 항목 안 Shift+Enter→같은 번호, Enter→새 번호.

### TDD — 순수 모듈 (sonnet)

- [ ] T016 [P] [US2] `model.test.ts`: `insertSoftBreak(model,offset)` — U+2028 삽입, blockRanges 무영향(블록 수 불변), INV-4(U+2028 1글자 카운트) 테스트(RED).
- [ ] T017 [US2] `model.ts`: `insertSoftBreak` 구현(GREEN) + markRuns 정합(소프트 줄바꿈 위치 run len +1).
- [ ] T018 [P] [US2] `model.test.ts`: U+2028 인접 Backspace(줄 병합)·캐럿 이동 테스트(RED).
- [ ] T019 [US2] `model.ts`: U+2028 삭제·캐럿 처리 구현(GREEN).

### measure (sonnet)

- [ ] T020 [P] [US2] `measure.test.ts`: U+2028 offset에서 줄 강제 분리 검증(RED).
- [ ] T021 [US2] `measure.ts`: U+2028 강제 줄나눔 구현(GREEN).

### 입력 라우팅 (opus)

- [ ] T022 [US2] `CustomEditor.tsx`: keydown에서 `Shift+Enter`→`insertSoftBreak`, `Enter`→기존 splitBlock 분기. IME 가드(compositionstart/end) 유지. 보류 마크 유지 정합.

**Checkpoint US2**: 자동 게이트 GREEN. Shift+Enter/Enter 분기 동작.

---

## Phase 5: US3 — 왕복 무손실·idempotent (P1, R4 안전 전제)

**Goal**: 5종 블록+4종 마크+소프트 줄바꿈 문서가 PM JSON 왕복 무손실·idempotent. 독립 테스트: `modelToPmJson(pmJsonToModel(x))` 2회 적용 바이트 동일.

### TDD — pmConvert (sonnet)

- [ ] T023 [P] [US3] `pmConvert.test.ts`: blockquote/bulletList/orderedList/listItem/horizontalRule/hardBreak 각 노드 왕복 의미보존 테스트(RED).
- [ ] T024 [US3] `pmConvert.ts`: `pmJsonToModel` — 신규 노드 → 모델(depth 추적, hardBreak→U+2028, hr→hr 블록) 구현(GREEN).
- [ ] T025 [US3] `pmConvert.ts`: `modelToPmJson` — 연속 동일 listKind·depth listItem 재그룹(중첩 list 복원), blockquote/hr/U+2028 노드 복원 구현(GREEN).
- [ ] T026 [P] [US3] `pmConvert.test.ts`: **결정론 idempotence** — 대표 문서 집합에 `modelToPmJson(pmJsonToModel(x))` 2회 적용 바이트 동일(SC-002) 테스트(RED→GREEN).
- [ ] T027 [P] [US3] `pmConvert.test.ts`: **무회귀** — 마크/신규블록 없는 입력이 R1/R2 출력과 바이트 동일(SC-004) 테스트.
- [ ] T028 [US3] `pmConvert.ts`: Refactor — idempotence/무회귀 동시 만족하도록 정규화. 미지원 노드(table/image/code/link) 평문 평탄화 현행 유지.

**Checkpoint US3**: pmConvert 왕복 GREEN. 거짓 dirty 없음(baseline 정규화 확인).

---

## Phase 6: Polish & 통합 검증

- [ ] T029 `history.ts`: Snapshot이 확장된 blockAttrs를 따라가는지 확인(이미 markRuns 포함 — 무변경 가능성 높음, 검증만).
- [ ] T030 layoutEngine/geometry 무수정 동작 확인 — 인용/목록/hr이 줄 리스트로 측정되어 페이지 분할에 정상 태워지는지 단위 또는 통합 확인(SC-001 분할 항목 대비).
- [ ] T031 전체 자동 게이트: `pnpm exec tsc --noEmit` + `pnpm exec vitest run src/components/custom-editor` + `pnpm build`(RSC 경계) GREEN.
- [ ] T032 dogfooding 준비 — `quickstart.md` SC-001~ 시나리오 점검표 확인. frontend dev 서버 재기동. **여기서 정지: 사용자 브라우저 dogfooding 게이트.**

---

## Dependencies

- Phase 2(Foundational) → Phase 3·4·5 선행.
- US1·US2는 model/measure 공유 파일이라 순차(같은 파일). US3(pmConvert)는 US1·US2 모델 확장 완료 후.
- Phase 6는 전 US 후.

## Parallel 예시

- T004/T006/T008(서로 다른 테스트 케이스, 같은 파일이면 순차 주의) — `model.test.ts` 단일 파일이라 실제로는 순차 append. [P]는 논리적 독립.
- T011(measure.test)·T023/T026/T027(pmConvert.test)는 model 작업과 다른 파일 → 병렬 가능.

## MVP

US1(블록 입력·표시)만으로도 "자체 엔진에 블록이 보인다"는 가시 증분. 단, R4 안전엔 US3까지 필수.
