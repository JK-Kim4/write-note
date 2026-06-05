---
description: "Task list — Desktop Phase 6 메모↔작품 연결 + 집필 사이드 패널"
---

# Tasks: 메모↔작품 연결 + 집필 사이드 패널 (Desktop Phase 6)

**Input**: `specs/008-phase-6-memo-linking-side-panel/` (plan.md / spec.md / research.md / data-model.md / contracts/ / quickstart.md)

**Tests**: 포함 — 본 프로젝트는 TDD HARD-GATE(CLAUDE.md §5). 스키마/repository/store/매퍼 변경은 실패 테스트를 먼저 작성한다.

**Organization**: User Story(P1~P2) 단위 phase. US1(Inbox 연결/해제)만으로도 "메모를 작품에 붙여 정리" MVP가 성립한다. US2(집필 패널 실데이터)는 두 번째 P1 슬라이스.

**Path Convention**: Electron main = `desktop/electron/`, renderer = `desktop/src/`.

**환경/게이트(HARD)**: `cd desktop && export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"` 후 `node_modules/.bin/{vitest,tsc,vite}` 직접 실행, **포어그라운드**(셸 기본 Node v20 → PATH 선행 필수, node:sqlite는 Node 24).

**진행 상태(2026-06-05)**: 🟡 **구현 자동화 GREEN** — vitest **100 tests**(baseline 75 + 신규 25, 회귀 0) + tsc + vite build GREEN. 마이그레이션 DROP COLUMN/cascade 실측 검증. **T027 dogfooding(사용자 영역) + STATUS/vault 완료표기(merge 후) 대기.**

---

## Phase 1: Setup (정합 확인)

- [X] T001 `desktop/`에서 정합 grep — `memos.link`/`linkedProjectId`/`MemoState`/구 `Memo` 전체 사용처 확인(전환 누락 방지)

---

## Phase 2: Foundational (Blocking Prerequisites — 전 User Story 차단)

다대다 데이터/저장/IPC 백본. US1·US2·US3 모두 의존.

- [X] T002 [P] `desktop/electron/db/schema.test.ts` — v3→v4 마이그레이션 실패 테스트: fresh DB `memo_projects` 존재 + `memos.linked_project_id` 부재 / legacy v3 단일 연결 보존 이관 + DROP + `user_version=4`
- [X] T003 `desktop/electron/db/schema.ts` — `SCHEMA_VERSION=4`, `memo_projects`(STRICT, PK, 양쪽 CASCADE) CREATE, `version<4` 이관 + `DROP COLUMN linked_project_id`
- [X] T004 [P] `desktop/electron/db/types.ts` `Memo.linkedProjectIds: string[]` + `desktop/src/types.ts` `LinkedProject`·`InboxMemo.linkedProjects`(복수, 구 `Memo`/`MemoState` 제거)
- [X] T005 [P] `desktop/electron/db/memoRepository.test.ts` — addLink 멱등/removeLink/listByProject(필터·정렬·다중연결)/list 집계 + cascade(C1)·복원 복귀(C2)
- [X] T006 `desktop/electron/db/memoRepository.ts` — `linkedProjectIds` 집계, `listByProject` 조인, `addLink`(INSERT OR IGNORE)/`removeLink`, `link` 제거, `CreateMemoInput`에서 linkedProjectId 제거
- [X] T007 [P] `desktop/electron/db/store.test.ts` — `captureMemo` 트랜잭션(원자성/미연결/FK 위반 롤백)
- [X] T008 `desktop/electron/db/store.ts` — `captureMemo({body, source?, linkProjectId?})` 트랜잭션
- [X] T009 `desktop/electron/ipc/contract.ts` — `listByProject`/`addLink`/`removeLink` + `CHANNELS`, `create` 입력 `linkProjectId`, `link` 제거
- [X] T010 `desktop/electron/ipc/registerHandlers.ts` — 신규 핸들러 + `create`→`captureMemo`, `link` 제거
- [X] T011 `desktop/electron/preload.ts` — 신규 채널 노출, `link` 제거
- [X] T012 [P] `desktop/src/lib/memoView.test.ts` — `linkedProjects` 복수 매핑 + 사라진 작품 필터
- [X] T013 `desktop/src/lib/memoView.ts` — `toInboxMemoView` 복수 매핑
- [X] T014 `desktop/src/components/QuickCapture.tsx` — create 입력 키 `linkProjectId`(FR-010 동작 동일)

**Checkpoint**: ✅ Foundational GREEN (schema 6 + memoRepo 15 + store 7 + memoView 5 + connection 2)

---

## Phase 3: User Story 1 - Inbox에서 메모를 작품에 연결/해제 (P1) 🎯 MVP

- [X] T015 [P] [US1] `desktop/src/components/LinkPopover.test.tsx` — 토글(연결/해제 onToggle)/체크 상태/작품 0개 빈 상태/Esc
- [X] T016 [US1] `desktop/src/components/LinkPopover.tsx` — 체크리스트 팝오버 + backdrop/Esc 닫기
- [X] T017 [US1] `desktop/src/screens/MemoInboxScreen.tsx` — "연결" 버튼 + LinkPopover(addLink/removeLink+재조회) + 칩 복수/✕ + 필터 `linkedProjects.length`
- [X] T018 [US1] `desktop/src/screens/MemoInboxScreen.test.tsx` — stub 갱신 + 연결 팝오버/칩 ✕ 해제/복수 칩/미연결 필터/회귀 보존

**Checkpoint**: ✅ US1 — Inbox 연결/해제 독립 동작 (LinkPopover 5 + MemoInbox 14)

---

## Phase 4: User Story 2 - 집필 중 현재 작품 연결 메모 보기 + 해제 (P1)

- [X] T019 [P] [US2] `desktop/src/components/MemoPanel.test.tsx` — 실데이터 나열/빈 상태/loading/칩 ✕ onUnlink
- [X] T020 [US2] `desktop/src/components/MemoPanel.tsx` — 더미 제거, 실데이터 카드 + 해제 ✕(작품명 칩 생략·A1) + 빈 상태(FR-015) + 약하게(FR-008)
- [X] T021 [US2] `desktop/src/App.tsx` — 더미 제거, `listByProject` 패널 상태(activeProject/memoRefresh 트리거) + 패널 `onUnlink`(removeLink+즉시 갱신, FR-009)
- [X] T022 [US2] `desktop/src/screens/WriteStudioScreen.tsx` — `memos: MemoState` 제거, `MemoPanel` 실데이터 props 전달
- [X] T023 [US2] preload smoke — 빌드 preload.mjs 에 `listByProject`/`addLink`/`removeLink` 결선 + 구 `memos:link` 제거 정적 확인(런타임 console 은 T027 dogfooding)

**Checkpoint**: ✅ US2 — 집필 패널 실데이터 + 패널 내 해제 (MemoPanel 4)

---

## Phase 5: User Story 3 - 한 메모를 여러 작품에 연결 (P2)

- [X] T024 [P] [US3] `desktop/electron/db/memoRepository.test.ts` — 다중 연결: A·B 양쪽 `listByProject` 포함 / A 해제 후 B 잔존 / `linkedProjectIds`에 둘
- [X] T025 [US3] `desktop/src/screens/MemoInboxScreen.test.tsx` — 칩 2개 렌더 / 한 칩 ✕ 시 해당 작품 id 만 removeLink(나머지 유지)

**Checkpoint**: ✅ US3 — 다중 연결 동작

---

## Phase 6: Polish & Cross-Cutting

- [X] T026 전체 게이트 — vitest(100) + tsc + vite build 포어그라운드, 회귀 0. + 신규 UI(LinkPopover/칩 ✕/연결 버튼/패널 해제) 스타일(`app.css`, DESIGN 토큰)
- [ ] T027 dogfooding(사용자 영역) — quickstart §수동 1~8: 연결/해제·필터·집필 패널(US2)·다중 연결(US3)·캡처 자동연결·빈 상태·작품 삭제 보존·한국어/라이트·다크
- [ ] T028 문서 — `docs/phase/06/README.md` 제외에서 "다중 프로젝트 연결" 제거 ✅완료 / `docs/STATUS.md`·vault `02-PROGRESS.md`·`docs/desktop-mvp-progress.html` 완료표기는 **dogfooding 통과·merge 후**

---

## Dependencies & Execution Order

- **Setup(T001) → Foundational(T002~T014) → US1(T015~T018) → US2(T019~T023) → US3(T024~T025) → Polish(T026~T028)**.
- 실제 실행: Foundational 일괄(타입 ripple) → US1 → US2 → US3 검증 → 게이트. 마이그레이션 DROP COLUMN/cascade·`INSERT OR IGNORE`+FK 동작은 실측 선검증(research R2).

## Notes

- 마이그레이션 DROP COLUMN 실측(SQLite 3.51.2, FK=ON OK) — 테이블 재생성 대비책 불요.
- `INSERT OR IGNORE`는 PK 중복만 무시하고 FK 위반은 throw → addLink 멱등 + captureMemo 롤백 양립(실측).
- C1(작품삭제 cascade)·C2(복원 시 연결 복귀)는 memoRepository.test.ts 에 자동 테스트로 보강(analyze 권고 반영).
- 외부 데이터 스토어 아님(로컬 SQLite) — 마이그레이션은 앱 기동 시 자체 수행.
