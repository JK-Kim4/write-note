---
description: "Task list — 자체 에디터 엔진 2라운드 (마크·혼합폰트)"
---

# Tasks: 자체 에디터 엔진 2라운드 — 마크(부분 스타일) · 혼합폰트 줄 측정

**Input**: `specs/024-custom-editor-r2/` (plan·spec·research·data-model·contracts·quickstart)

**Tests**: 순수 로직(model·measure·pmConvert·history)은 **TDD 의무**(`CLAUDE.md` HARD-GATE — Red→Green). 캐럿/선택/렌더 픽셀·인터랙션·IME는 헤드리스 불가 → CDP/사용자 dogfooding 게이트.

**Organization**: US 우선순위(P1 부분마크 = 양보 불가 핵심)대로. 1라운드 모듈을 run 단위로 일반화하되 **마크0 입력 = 1라운드 동일**(무회귀 토대).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일·의존 없음 → 병렬 가능
- 모든 경로는 워크트리 `write-note-024-custom-editor` 기준 repo-relative

## Sub-agent 위임 / 모델 (회고 §2 정합, haiku 금지)

- **Phase 2(순수 TDD: model/measure/pmConvert/history)** = **sonnet**. Red→Green 한 쌍씩, 검증 cap 라운드별 2개·전체 마지막 1회, 5~12줄 보고, `pnpm exec vitest run src/components/custom-editor` 만.
- **Phase 3·5(캐럿/선택/렌더 run 일반화 + affinity, 최난도)** = **opus**. §11(관찰→확정→수정) 적용, 결정론적 probe.
- **Phase 4(보류마크·툴바 UI)** = **sonnet**(필요 시 opus). 프론트 위임은 작성 직후 `pnpm build`(RSC 경계).
- 모든 dispatch: 절대경로·워크트리 한정·**메인 repo(023) 비접촉**·tool_uses 50 cap·같은 에러 3회 재시도 금지 명시.

---

## Phase 1: Setup (베이스라인)

**Purpose**: 변경 전 회귀 기준선 확정.

- [X] T001 베이스라인 게이트 GREEN 확인 (custom-editor 108 + b/ 13 + tsc OK 기록) — `cd frontend && pnpm exec vitest run src/components/custom-editor`(115) + `pnpm exec vitest run src/app/b`(page.test 7) + `pnpm exec tsc --noEmit`. 결과 기록(무회귀 비교 기준).

---

## Phase 2: Foundational (순수 엔진 레이어 — 모든 US의 선행 차단)

**Purpose**: 마크 run-list 모델 + 측정/변환 일반화. 이 레이어 없이는 어떤 US도 시작 불가. **전부 순수 TDD(sonnet).**

**⚠️ CRITICAL**: Phase 3 이전 완료 필수.

- [X] T002 [P] `frontend/src/components/custom-editor/model.ts` — `MARK`(bold:1/italic:2/underline:4/strike:8) 상수 + `Mask`·`MarkRun={len,mask}` 타입 + `DocModel.markRuns: MarkRun[][]` 필드 추가(타입·상수 = TDD §5-5 완화). 빈 모델 INV-3에 `markRuns:[[]]` 포함.
- [X] T003 `model.test.ts` — `blockRuns` 정규형 실패 테스트 작성(인접 동일 mask 병합·0길이 제거·len 합=블록 글자수) [RED].
- [X] T004 `model.ts` — `blockRuns(model, blockIdx)` 구현 [GREEN].
- [X] T005 `model.test.ts` — `toggleMark` 실패 테스트(부분/전체/구간경계/여러 run 횡단/재토글 해제) [RED].
- [X] T006 `model.ts` — `toggleMark(model, lo, hi, mark)` 구현 + 결과 정규화 [GREEN].
- [X] T007 `model.test.ts` — `marksAt` 실패 테스트(좌측 글자 기준·offset 0/블록시작 예외) [RED].
- [X] T008 `model.ts` — `marksAt(model, offset)` 구현 [GREEN].
- [X] T009 `model.test.ts` — `insertText`/`deleteRange` 마크 추종 실패 테스트(구간 늘어남·줄어듦·split·merge·삽입마스크) [RED].
- [X] T010 `model.ts` — `insertText(model,lo,hi,text,mask)`/`deleteRange` markRuns 추종 + `reconcile`(blockAttrs+markRuns, INV-4·5) 구현 [GREEN]. **마크0 = 1라운드 동일** 보장.
- [X] T011 `model.test.ts` — `splitBlock`/`mergeWithPrev`/`mergeWithNext`/`toggleHeading` markRuns 분할·이어붙임 실패 테스트 [RED].
- [X] T012 `model.ts` — 위 4연산 markRuns 추종 구현(병합 시 두 블록 run-list 이어붙임 후 정규화) [GREEN].
- [X] T013 [P] `measure.test.ts` — run 그룹핑·styled-span 구성 로직 실패 테스트(폭 mock; 픽셀은 CDP) [RED].
- [X] T014 [P] `measure.ts` — `measureParagraphLines`/`measureLineXs`에 `marks: MarkRun[]` 인자 추가, run별 `<span>`(weight/style/decoration) 오프스크린 구성. **canvas 금지·마크0=1라운드 동일** [GREEN].
- [X] T015 [P] `pmConvert.test.ts` — 마크 왕복 무손실(4종·복합)·idempotent(2회 왕복 동일)·미지원 마크 평탄화·**마크0 모델 1라운드 출력 바이트 동일** 실패 테스트 [RED].
- [X] T016 [P] `pmConvert.ts` — `modelToPmJson`(blockRuns→text node `marks:[{type}]`)·`pmJsonToModel`(marks→비트마스크 환원·정규화) 구현. type=`bold`/`italic`/`underline`/`strike` [GREEN].
- [X] T017 [P] `history.ts` — `Snapshot`에 `markRuns` 포함(pendingMarks 제외) + undo/redo 마크 복원 테스트.

**Checkpoint**: 엔진 레이어 GREEN(115 + 신규). 캐럿/렌더는 아직 1라운드 동작(마크 미노출). 검증 1회: `pnpm exec vitest run src/components/custom-editor`.

---

## Phase 3: User Story 1 - 드래그한 부분만 굵게/기울임/밑줄/취소선 (Priority: P1) 🎯 MVP

**Goal**: 선택 구간 마크 적용 → 그 구간만 렌더 + 혼합 스타일 줄 측정/캐럿 무드리프트 + 저장 왕복 무손실. **양보 불가 핵심 = 첫 dogfoodable(§10).**

**Independent Test**: 프레시 테스트 챕터에서 한 줄 일부 드래그 → Cmd+B → 구간만 굵게 → wrap 유발 → 캐럿/hit-test 드리프트 0 → 저장·새로고침 → 동일 복원.

**위임**: opus(캐럿/선택/렌더 run 일반화 = 최난도). §11 관찰→확정→수정.

- [X] T018 [US1] `CustomEditor.tsx` `relayout` — 블록별 `blockRuns(model,i)`를 `measureParagraphLines`에 전달 + `ParsedBlock`에 `marks: MarkRun[]` 슬라이스 보유.
- [X] T019 [US1] `CustomEditor.tsx` 렌더(`PageBox`) — 블록을 run별 styled `<span>`(font-weight/font-style/text-decoration)으로 렌더(측정 div와 동일 스타일 → 픽셀 일치).
- [X] T020 [US1] `CustomEditor.tsx` `caretToScreen`/`screenToCaret`/`selectionRects` — `measureLineXs`에 해당 블록 `marks` 전달(혼합 폭 반영). affinity는 본 단계 1라운드 `<=` 유지(US3에서 대체).
- [X] T021 [US1] `CustomEditor.tsx` — 선택 있을 때 Cmd+B/I/U(+툴바 4버튼) → `toggleMark(model, lo, hi, mark)`. **`onKey` 최상단 `if(e.isComposing||composingRef.current) return` 가드 아래** 배치(IME 회귀룰).
- [X] T022 [US1] `CustomEditor.tsx` — 마크 구간 한가운데 입력 시 `marksAt` 좌측 상속으로 삽입(보류 마크는 US2). 평문 paste = 마스크 0.
- [X] T023 [US1] 게이트 — `pnpm exec tsc --noEmit` + `pnpm exec vitest run src/components/custom-editor` + 무회귀 `pnpm exec vitest run src/app/b`(7 GREEN).
- [X] T024 [US1] **dogfooding(사용자 게이트)** — quickstart §4 US1: 드래그 굵게·italic/underline/strike·혼합 wrap 캐럿 드리프트 0·저장 재로드 무손실·삽입삭제 마크 추종. IME 4케이스(조합 중 단축키).

**Checkpoint**: "드래그한 부분만 굵게"가 실제 집필실에서 동작·저장. MVP 완성 — STOP & VALIDATE.

---

## Phase 4: User Story 2 - 마크를 켜고 이어서 쓴다 (보류 마크 + 툴바) (Priority: P2)

**Goal**: 선택 없이 토글 → 이후 입력 적용(보류 마크) + 툴바 활성 표시.

**Independent Test**: 빈 위치 Cmd+B → 타이핑 굵게 → Cmd+B 해제. 마크 구간 안/밖 캐럿 이동 → 툴바 버튼 활성 전환.

**위임**: sonnet(필요 시 opus). 프론트 작성 직후 `pnpm build`.

- [ ] T025 [US2] `CustomEditor.tsx` — `pendingMarksRef: Mask|null` 추가, 선택 없을 때 Cmd+B/I/U·툴바 토글 = 보류 마크 set/clear.
- [ ] T026 [US2] `CustomEditor.tsx` — 입력 마스크 = `pendingMarksRef ?? marksAt(model, caret)`. 입력 후 pending 소비(null), 캐럿 이동 시 pending 폐기.
- [ ] T027 [US2] `CustomEditor.tsx` — 툴바 마크 버튼 활성 = `marksAt`(보류 마크 우선) 반영(캐럿 이동마다 갱신).
- [ ] T028 [US2] **dogfooding** — quickstart §4 US2: 보류 마크 입력 적용·해제·툴바 활성 전환·구간 한가운데 상속.

**Checkpoint**: US1 + US2 독립 동작.

---

## Phase 5: User Story 3 - 줄바꿈·마크 경계 캐럿 정확 (caret affinity) (Priority: P3)

**Goal**: `(offset, affinity)` 튜플로 wrap/마크 경계 캐럿 정식화 — 1라운드 `<=` 대체.

**Independent Test**: wrap되는 긴 줄에서 End → 앞 줄 끝. 다음 줄 시작 이동 → 다음 줄 머리. 경계 캐럿 튐 없음.

**위임**: opus(캐럿 좌표 모델 변경). 순수 affinity 산술은 가능하면 Vitest 분리.

- [ ] T029 [US3] `model.ts`/`CustomEditor.tsx` — `Affinity=-1|1`, `Caret={offset,affinity}`, `Selection`에 affinity 필드 추가(기본 +1). (타입 = §5-5 완화, 단 caret 산술은 테스트.)
- [ ] T030 [US3] `CustomEditor.tsx` `caretToScreen`/`screenToCaret` — affinity 분기로 wrap 경계 줄 선택(-1=앞 줄 끝, +1=다음 줄 머리). 1라운드 `<=` 워크어라운드(L103·112·125) 제거.
- [ ] T031 [US3] `CustomEditor.tsx` — 좌/우 화살표·End/Home·클릭이 affinity를 이동 방향과 일관 갱신.
- [ ] T032 [US3] **dogfooding** — quickstart §4 US3: wrap 경계 End/줄이동 캐럿 위치, 마크 경계 겹침.

**Checkpoint**: 전 US 독립 동작.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T033 [P] 전체 게이트 — `pnpm exec tsc --noEmit` + `pnpm exec vitest run src/components/custom-editor`(전체) + `pnpm build`(RSC, dev 서버 종료 후) + `pnpm exec vitest run src/app/b`(7 GREEN). 베이스라인(T001) 대비 무회귀 확인.
- [ ] T034 idempotence 최종 확인 — 마크 포함 챕터 로드 즉시 거짓 dirty 0(serverBody 정규화 왕복). `BCustomChapterEditor` 경계 변환 점검(무수정 재사용 확인).
- [ ] T035 회고(retrospective 스킬) + 룰 갱신 후보 surfacing(보류 A/B/D 동종 재발 여부) + vault 02-PROGRESS/03-ISSUES 동기.

---

## Dependencies & Execution Order

- **Phase 1(Setup)**: 즉시.
- **Phase 2(Foundational)**: Setup 후. **모든 US 차단**. model 내부 작업(T002~T012)은 같은 파일이라 순차; measure(T013·14)·pmConvert(T015·16)·history(T017)는 T002(타입) 후 model과 병렬 [P].
- **Phase 3(US1)**: Phase 2 완료 후. 핵심 MVP.
- **Phase 4(US2)**: Phase 3 후(보류 마크는 US1 toggle/marksAt 토대).
- **Phase 5(US3)**: Phase 2 후 독립 가능하나, 캐럿 일반화(T020)와 한 파일 충돌 → US1 후 권장.
- **Phase 6(Polish)**: 원하는 US 완료 후.

### Within each story
- TDD 레이어: RED(실패 테스트) → GREEN(구현) 순서 의무.
- model 타입(T002) → model 연산 → measure/pmConvert(타입 의존).
- US: 측정·렌더·캐럿 일반화(T018~20) → 입력·토글(T021·22) → 게이트 → dogfooding.

## Parallel Opportunities

- Phase 2: T002 후 measure(T013·14)·pmConvert(T015·16)·history(T017)를 model 연산과 병렬 [P](서로 다른 파일).
- Phase 3~5는 같은 `CustomEditor.tsx` 집중 → 대체로 순차(병렬 충돌 위험).

## Implementation Strategy

### MVP First (US1)
1. Phase 1 → 2(엔진 레이어 GREEN) → 3(US1) → **STOP & VALIDATE dogfooding**. "드래그한 부분만 굵게"가 저장까지 동작 = MVP.

### Incremental
2. US2(보류 마크·툴바) → dogfooding → US3(affinity) → dogfooding → Phase 6 게이트·회고.

## Notes
- [P] = 다른 파일·의존 없음. 같은 파일(특히 `CustomEditor.tsx`) 동시 편집 금지.
- 마크0 입력·마크 없는 모델은 항상 1라운드와 동일(무회귀 토대 — 각 GREEN에서 확인).
- 각 task/논리 묶음 후 커밋. 체크포인트마다 독립 검증.
- 메인 repo(023-export 미커밋) 비접촉 / 백엔드·DB·마이그레이션 변경 0 / canvas 측정 금지 / `e.isComposing` 신뢰 금지(composingRef).
