---
description: "Task list — Desktop Phase 5 빠른 메모 캡처 + Inbox"
---

# Tasks: 빠른 메모 캡처 + Inbox (Desktop Phase 5)

**Input**: `specs/007-phase-5-memo-capture-inbox/` (plan.md / spec.md / research.md / data-model.md / contracts/ / quickstart.md)

**Tests**: 포함 — 본 프로젝트는 TDD HARD-GATE(CLAUDE.md §5). repository/스키마/매퍼 변경은 실패 테스트를 먼저 작성한다.

**Organization**: User Story(P1~P3) 단위 phase. US1만으로도 "캡처→inbox 표시" MVP가 성립한다.

**Path Convention**: Electron main = `desktop/electron/`, renderer = `desktop/src/`.

**환경/게이트**: `cd desktop && PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" node_modules/.bin/{vitest,tsc,vite}` 직접 실행, **포어그라운드**(Node 24.14.0 — 셸 기본이 v20이라 PATH 선행 필수).

**진행 상태(2026-06-05)**: ✅ **완료** — 14 files / **75 tests**(baseline 51 + 신규 24, 회귀 0) + tsc + vite build GREEN + **dogfooding 통과**. develop merge 대기. dogfooding 발견: 집필창 `MemoPanel`(연결 메모 패널)이 더미라 혼란 → 설계상 Phase 6 영역 재확인.

---

## Phase 1: Setup (정합 확인)

- [X] T001 `desktop/`에서 정합 grep — `memoRepository.list`/`toMemo`, `schema.ts` `SCHEMA_VERSION`(2), `contract.ts` `CHANNELS`(camelCase), `App.tsx` `activeProject`/`captureOpen`, `types.ts` `InboxMemo`/`Memo` 확인

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T002 [P] `desktop/electron/db/schema.test.ts` v3 마이그레이션 실패 테스트(fresh DB의 memos.deleted_at / legacy v2 ADD / user_version=3)
- [X] T003 `desktop/electron/db/schema.ts` — `SCHEMA_VERSION=3`, `memos`에 `deleted_at TEXT`, `version<3` 분기 ALTER
- [X] T004 [P] `desktop/electron/db/types.ts` `Memo.deletedAt` + `desktop/src/types.ts` `InboxMemo` view 교체(dateLabel/linkedProjectId/linkedProjectTitle)
- [X] T005 [P] `desktop/electron/db/memoRepository.test.ts` — list `deleted_at IS NULL` 필터 / `toMemo` deletedAt 매핑 실패 테스트
- [X] T006 `desktop/electron/db/memoRepository.ts` — `MemoRow`/`toMemo` deleted_at, `list()` WHERE 필터
- [X] T007 [P] `desktop/src/lib/relativeDate.test.ts` — `formatRelativeDay` 경계 테스트
- [X] T008 `desktop/src/lib/relativeDate.ts` 추출 + `projectView.ts` 교체(projectView.test GREEN 유지 확인)
- [X] T009 [P] `desktop/src/lib/memoView.test.ts` — `toInboxMemoView` 매핑 테스트
- [X] T010 `desktop/src/lib/memoView.ts` — `toInboxMemoView` 구현

**Checkpoint**: ✅ 저장(삭제 제외 조회)·타입·표시 매퍼 완료

---

## Phase 3: User Story 1 - 메모 캡처 + Inbox 표시 (P1) 🎯 MVP

- [X] T011 [US1] `desktop/src/components/QuickCapture.tsx` 결선 — `activeProjectId`/`onCaptured` props, textarea 제어, 빈값 가드, `memos.create` 후 onCaptured+onClose
- [X] T012 [US1] `desktop/src/App.tsx` — `memoRefresh` state + QuickCapture(activeProjectId/onCaptured)·MemoInboxScreen(refresh) 전달
- [X] T013 [US1] `desktop/src/screens/MemoInboxScreen.tsx` — 더미 제거, `memos.list` 자체 fetch + `toInboxMemoView` 매핑, `refresh` 의존 재조회
- [X] T014 [US1] `desktop/src/screens/MemoInboxScreen.tsx` — 인라인 입력란 결선(본문 한 줄 → `memos.create({linkedProjectId: null})` 미연결 저장 → 로컬 재조회), 빈값 가드
- [X] T015 [P] [US1] `desktop/src/screens/MemoInboxScreen.test.tsx` — 목록 표시 / 인라인 추가 / 빈 본문 미저장

**Checkpoint**: ✅ 캡처→표시 MVP 독립 동작

---

## Phase 4: User Story 2 - 작품 자동 연결 + 표시 (P2)

- [X] T016 [US2] `desktop/src/screens/MemoInboxScreen.tsx` — `projects.list` 함께 fetch해 `projectTitleById` 맵 주입, 연결 칩(작품 제목/미연결) 표시(클릭 동작은 Phase 6 — 표시 전용)
- [X] T017 [US2] `desktop/src/screens/MemoInboxScreen.test.tsx` — 연결 제목 / 미연결 표시 케이스

**Checkpoint**: ✅ US1 + US2 독립 동작

---

## Phase 5: User Story 3 - 전체/미연결 필터 (P2)

- [X] T018 [US3] `desktop/src/screens/MemoInboxScreen.tsx` — 전체/미연결 필터 실데이터 결선(미연결 = linkedProjectId null), 카운트 실데이터화
- [X] T019 [US3] `desktop/src/screens/MemoInboxScreen.test.tsx` — 미연결 필터 케이스

**Checkpoint**: ✅ US1~US3 독립 동작

---

## Phase 6: User Story 4 - soft delete + 되돌리기 (P3)

- [X] T020 [P] [US4] `desktop/electron/db/memoRepository.test.ts` — softDelete 후 list 제외 / restore 후 재포함 / 없는 id false·null
- [X] T021 [US4] `desktop/electron/db/memoRepository.ts` — `softDelete(id): boolean` / `restore(id): Memo|null`
- [X] T022 [US4] `desktop/electron/ipc/contract.ts` — `memos.delete`/`memos.restore` + `CHANNELS.memosDelete`/`memosRestore`
- [X] T023 [US4] `desktop/electron/ipc/registerHandlers.ts` — delete→softDelete / restore 핸들러
- [X] T024 [US4] `desktop/electron/preload.ts` — `memos.delete`/`memos.restore` 노출
- [X] T025 [P] [US4] `desktop/src/components/Toast.tsx` — 자동 dismiss 타이머 + unmount clearTimeout
- [X] T026 [US4] `desktop/src/screens/MemoInboxScreen.tsx` — 삭제 버튼 + 낙관적 제거 + `memos.delete` + Toast, 되돌리기 `memos.restore`+재조회(최근 1건 토스트 교체)
- [X] T027 [US4] `desktop/src/screens/MemoInboxScreen.test.tsx` — 삭제 낙관적 제거 / 되돌리기 restore 호출
- [X] T028 [US4] preload smoke — dogfooding에서 메모 캡처/삭제/되돌리기 IPC가 실동작 → `window.electronAPI.memos.*` 노출 입증(통과)

**Checkpoint**: ✅ 전 User Story 동작 + dogfooding 통과

---

## Phase 7: Polish & Cross-Cutting

- [X] T029 전체 게이트 — vitest(75) + tsc + vite build 포어그라운드, 회귀 0(projectView/schema/ProjectsScreen GREEN 유지)
- [X] T030 dogfooding — 통과(2026-06-05). 캡처·자동연결·전체/미연결 필터·삭제/되돌리기·실데이터 inbox 정상. ④/⑪ 증상은 집필창 `MemoPanel` 더미(Phase 6) 때문으로 규명 — Phase 5 inbox 정상
- [X] T031 [P] 문서 갱신 — vault `02-PROGRESS.md`(Phase 5 완료 + Phase 6 진입점) / `docs/desktop-mvp-progress.html` / `docs/phase/README.md` 갱신 완료

---

## Dependencies & Execution Order

- Setup → Foundational(전 US 차단) → US1(MVP) → US2 → US3 → US4 → Polish.
- `MemoInboxScreen.tsx`를 US1~US4가 순차로 확장(같은 파일이라 [P] 불가).
- US4 backend(T020~T024)는 renderer와 다른 파일이라 병행 가능했음.

## Notes
- `MemoPanel.tsx`·`memos.link` 연결/해제 **동작 UI**는 **Phase 6** — 본 Phase 범위 밖(표시 전용).
- 잔여 T028/T030/T031은 실제 앱 실행(dogfooding) 및 Phase 완료 후 문서 영역.
