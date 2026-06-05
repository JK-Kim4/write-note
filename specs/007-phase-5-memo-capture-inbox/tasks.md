---
description: "Task list — Desktop Phase 5 빠른 메모 캡처 + Inbox"
---

# Tasks: 빠른 메모 캡처 + Inbox (Desktop Phase 5)

**Input**: `specs/007-phase-5-memo-capture-inbox/` (plan.md / spec.md / research.md / data-model.md / contracts/ / quickstart.md)

**Tests**: 포함 — 본 프로젝트는 TDD HARD-GATE(CLAUDE.md §5). repository/스키마/매퍼 변경은 실패 테스트를 먼저 작성한다.

**Organization**: User Story(P1~P3) 단위 phase. US1만으로도 "캡처→inbox 표시" MVP가 성립한다.

**Path Convention**: Electron main = `desktop/electron/`, renderer = `desktop/src/`.

**환경/게이트**: `cd desktop && node_modules/.bin/{vitest,tsc,vite}` 직접 실행, **포어그라운드**(Node 24.14.0 + corepack pnpm 8.15.5).

---

## Phase 1: Setup (정합 확인)

**Purpose**: implement 진입 전 spec/plan 추측을 실제 코드와 대조(agent-workflow-discipline §6).

- [ ] T001 `desktop/`에서 정합 grep — `memoRepository.list`/`toMemo` 시그니처, `schema.ts`의 `SCHEMA_VERSION`(현재 2)과 v2 ALTER 분기, `contract.ts` `CHANNELS` camelCase 컨벤션, `App.tsx`의 `activeProject`/`captureOpen`/`memoRefresh` 부재, `types.ts`의 `InboxMemo`/`Memo` 더미 정의를 확인하고 plan.md §Source Code 경로와 차이 있으면 메모

**Checkpoint**: 실제 코드 경로·시그니처 확정 → Foundational 진입

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story가 의존하는 저장/타입/표시 기반. ⚠️ 이 phase 완료 전 어떤 US도 시작 불가.

### 스키마 v3 (soft delete 컬럼)

- [ ] T002 [P] `desktop/electron/db/schema.test.ts`에 v3 마이그레이션 실패 테스트 작성 — 신규 DB의 `memos`에 `deleted_at` 컬럼 존재 / 기존 v2 DB(genre만 있는) 업그레이드 시 `deleted_at` ADD / `user_version`=3
- [ ] T003 `desktop/electron/db/schema.ts` — `SCHEMA_VERSION=3`, `CREATE TABLE memos`에 `deleted_at TEXT`(nullable) 추가, `user_version<3` 분기에서 `PRAGMA table_info(memos)` 확인 후 `ALTER TABLE memos ADD COLUMN deleted_at TEXT` (T002 GREEN)

### 도메인/뷰 타입

- [ ] T004 [P] `desktop/electron/db/types.ts`의 `Memo`에 `deletedAt: string | null` 추가 + `desktop/src/types.ts`의 `InboxMemo`를 view 형태로 교체(`dateLabel`/`linkedProjectId`/`linkedProjectTitle`; 기존 더미 `date`/`linkedProject` 제거). `MemoPanel`용 `Memo`(tag)는 유지

### 메모 조회 — 삭제분 제외

- [ ] T005 [P] `desktop/electron/db/memoRepository.test.ts`에 실패 테스트 추가 — `list()`가 `deleted_at IS NULL`만 captured_at DESC로 반환 / `toMemo`가 `deletedAt` 매핑
- [ ] T006 `desktop/electron/db/memoRepository.ts` — `MemoRow`/`toMemo`에 `deleted_at`/`deletedAt` 추가, `list()`에 `WHERE deleted_at IS NULL` (T005 GREEN)

### 상대시간 공용 추출 (research R4)

- [ ] T007 [P] `desktop/src/lib/relativeDate.test.ts` 신설 — `formatRelativeDay(iso, now)` 경계 테스트(오늘/어제/N일 전/N주 전)
- [ ] T008 `desktop/src/lib/relativeDate.ts` 신설(`formatRelativeDay` 추출) + `desktop/src/lib/projectView.ts`를 `formatRelativeDay` 사용으로 교체. `projectView.test.ts` GREEN 유지 확인 (T007 GREEN)

### 메모 view 매퍼

- [ ] T009 [P] `desktop/src/lib/memoView.test.ts` 신설 — `toInboxMemoView(memo, projectTitleById, now)` 매핑(dateLabel · 연결 제목 · linkedProjectId 있으나 맵에 없으면 title=null)
- [ ] T010 `desktop/src/lib/memoView.ts` 신설 — `toInboxMemoView` 구현(`relativeDate` + 맵 조회) (T009 GREEN)

**Checkpoint**: 저장(삭제 제외 조회)·타입·표시 매퍼 준비 완료 — US 진입 가능

---

## Phase 3: User Story 1 - 메모 캡처 + Inbox 표시 (Priority: P1) 🎯 MVP

**Goal**: 두 진입점(모달 + inbox 인라인)으로 본문만 입력해 캡처하고, inbox에 최신순으로 표시한다.

**Independent Test**: 모달/인라인에서 본문 저장 → inbox 맨 위 표시, 빈 본문은 저장 안 됨, 재시작 후 잔존.

- [ ] T011 [US1] `desktop/src/components/QuickCapture.tsx` 결선 — `activeProjectId`/`onCaptured` props 추가, textarea 제어 상태, `body.trim()` 빈값 가드, 저장 시 `memos.create({ body, linkedProjectId: activeProjectId })` → `onCaptured()` + `onClose()`
- [ ] T012 [US1] `desktop/src/App.tsx` — `memoRefresh` state 추가, `QuickCapture`에 `activeProjectId={activeProject?.id ?? null}`·`onCaptured={() => setMemoRefresh(n=>n+1)}`, `MemoInboxScreen`에 `refresh={memoRefresh}` 전달
- [ ] T013 [US1] `desktop/src/screens/MemoInboxScreen.tsx` — 더미 `MEMOS` 제거, `memos.list` 자체 fetch + `toInboxMemoView` 매핑으로 목록 표시(최신순), `refresh` prop useEffect 의존 재조회
- [ ] T014 [US1] `desktop/src/screens/MemoInboxScreen.tsx` — 상단 인라인 입력란 결선(본문 한 줄 → `memos.create` → 로컬 재조회), 빈값 가드
- [ ] T015 [P] [US1] `desktop/src/screens/MemoInboxScreen.test.tsx` 신설 — 목록 최신순 표시 / 캡처 후 반영 / 빈 본문 미저장 (HTTP/IPC는 경계 mock)

**Checkpoint**: 캡처→표시 MVP 독립 동작

---

## Phase 4: User Story 2 - 작품 자동 연결 + 표시 (Priority: P2)

**Goal**: active project 캡처는 그 작품에 연결되고, inbox가 연결 작품 제목(미연결이면 "미연결")을 보여준다.

**Independent Test**: 작품 연 상태 캡처 → inbox에 작품 제목 / 작품 없이 캡처 → "미연결".

- [ ] T016 [US2] `desktop/src/screens/MemoInboxScreen.tsx` — `projects.list` 함께 fetch해 `projectTitleById` 맵 구성 후 `toInboxMemoView`에 주입, 각 카드에 연결 칩(작품 제목 또는 "미연결") 표시. 연결/해제 클릭 동작은 Phase 6이므로 표시 전용(no-op)
- [ ] T017 [US2] `desktop/src/screens/MemoInboxScreen.test.tsx` — 연결 메모는 작품 제목, 미연결/사라진 작품은 "미연결" 표시 케이스 추가

**Checkpoint**: US1 + US2 독립 동작

---

## Phase 5: User Story 3 - 전체/미연결 필터 (Priority: P2)

**Goal**: "전체"와 "미연결" 필터로 정리 대상을 분리해 본다.

**Independent Test**: 연결·미연결 섞인 상태에서 "미연결"→미연결만, "전체"→모두(삭제 제외).

- [ ] T018 [US3] `desktop/src/screens/MemoInboxScreen.tsx` — 전체/미연결 세그먼트를 실데이터 기준 필터로 결선(미연결 = `linkedProjectId == null`), 카운트 표시 실데이터화
- [ ] T019 [US3] `desktop/src/screens/MemoInboxScreen.test.tsx` — 미연결 필터가 미연결만, 전체가 모두 표시 케이스 추가

**Checkpoint**: US1~US3 독립 동작

---

## Phase 6: User Story 4 - soft delete + 되돌리기 (Priority: P3)

**Goal**: 메모를 지우면 즉시 사라지고, 되돌리기 토스트로 복원한다. 기회가 지나면 삭제 유지(재시작 후에도).

**Independent Test**: 삭제→즉시 숨김+토스트→되돌리기 복원 / 토스트 종료·재시작 후 비노출.

### Backend (TDD)

- [ ] T020 [P] [US4] `desktop/electron/db/memoRepository.test.ts` — `softDelete(id)` 후 `list()` 제외 / `restore(id)` 후 재포함 / 없는 id는 false·null 실패 테스트
- [ ] T021 [US4] `desktop/electron/db/memoRepository.ts` — `softDelete(id): boolean`(deleted_at=now, updated_at touch) + `restore(id): Memo | null`(deleted_at=NULL) 구현 (T020 GREEN)

### IPC 결선 (순차 — 같은 경계 3파일)

- [ ] T022 [US4] `desktop/electron/ipc/contract.ts` — `ElectronAPI.memos`에 `delete(id)=>Promise<boolean>`·`restore(id)=>Promise<Memo|null>` + `CHANNELS.memosDelete`/`memosRestore`
- [ ] T023 [US4] `desktop/electron/ipc/registerHandlers.ts` — `memosDelete`→`store.memos.softDelete`, `memosRestore`→`store.memos.restore` 핸들러
- [ ] T024 [US4] `desktop/electron/preload.ts` — `memos.delete`/`memos.restore` invoke 노출

### Renderer

- [ ] T025 [P] [US4] `desktop/src/components/Toast.tsx` 신설 — `message`/`actionLabel`/`onAction`/`onDismiss`/`durationMs=5000`, 마운트 시 타이머 자동 dismiss + unmount `clearTimeout`
- [ ] T026 [US4] `desktop/src/screens/MemoInboxScreen.tsx` — 카드 삭제 버튼 + 낙관적 로컬 제거 + `memos.delete(id)` + `Toast` 표시, 되돌리기 시 `memos.restore(id)` + 재조회. 연속 삭제는 최근 1건 대상(토스트 교체)
- [ ] T027 [US4] `desktop/src/screens/MemoInboxScreen.test.tsx` — 삭제 시 목록 제거 / 되돌리기 복원 / 삭제 유지 케이스 추가
- [ ] T028 [US4] preload smoke(quickstart) — renderer에서 `typeof window.electronAPI.memos.delete/restore === "function"` 1회 확인(agent-workflow §8)

**Checkpoint**: 전 User Story 독립 동작

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: 게이트·dogfooding·문서.

- [ ] T029 전체 게이트 — `cd desktop && node_modules/.bin/vitest run && node_modules/.bin/tsc --noEmit && node_modules/.bin/vite build` 포어그라운드, Phase 1~4 회귀 0(특히 `projectView.test.ts`/`schema.test.ts`/`ProjectsScreen.test.tsx`)
- [ ] T030 dogfooding — `quickstart.md` 시나리오 1~10 사용자 확인(캡처·연결·필터·삭제/복구·재시작·IME·작품삭제 교차)
- [ ] T031 [P] 문서 갱신 — 통과 후 vault `~/obsidian/write-note/02-PROGRESS.md` Phase 5 완료 + 다음 진입점 Phase 6 / `docs/desktop-mvp-progress.html` / `docs/phase/05-memo-capture-inbox/README.md`

---

## Dependencies & Execution Order

### Phase 의존
- **Setup(P1)**: 즉시 시작.
- **Foundational(P2)**: Setup 후. **모든 US 차단**.
- **US1(P3)~US4(P6)**: Foundational 후. 본 기능은 단일 작업자·동일 파일(`MemoInboxScreen.tsx`) 다수라 **우선순위 순차(P1→P2→P3) 권장**.
- **Polish(P7)**: 원하는 US 완료 후.

### User Story 의존
- **US1**: Foundational 후 독립. MVP.
- **US2**: Foundational 후. `MemoInboxScreen`을 US1 위에 확장(연결 표시) — US1 카드 렌더 전제.
- **US3**: Foundational 후. US1 목록 위에 필터 — US1 전제.
- **US4**: Foundational 후. backend(T020~T024)는 US1과 독립 병행 가능, renderer(T026)는 US1 카드 전제.

### Within Story
- 테스트(실패) → 구현 → GREEN. repository/스키마/매퍼는 TDD 의무. 모델/매퍼 → 서비스 → UI.

### 병렬 기회
- Foundational: T002/T005/T007/T009(서로 다른 테스트 파일) 병렬 작성 가능. 단 구현 T003/T006/T008/T010은 각 테스트 GREEN 후.
- US4 backend(T020~T024)는 US1~US3 renderer 작업과 다른 파일이라 병행 가능.
- 같은 `MemoInboxScreen.tsx`를 건드리는 T013/T014/T016/T018/T026은 **순차**([P] 아님).

---

## Parallel Example: Foundational 테스트 선작성

```bash
# 서로 다른 테스트 파일 — 병렬 작성(모두 RED 확인 후 각 구현)
Task: "schema.test.ts v3 마이그레이션 테스트 (T002)"
Task: "memoRepository.test.ts list 필터 테스트 (T005)"
Task: "relativeDate.test.ts 경계 테스트 (T007)"
Task: "memoView.test.ts 매핑 테스트 (T009)"
```

---

## Implementation Strategy

### MVP First (US1)
1. Phase 1 Setup → Phase 2 Foundational(전부) → Phase 3 US1.
2. **STOP & VALIDATE**: 캡처→inbox 표시 독립 검증(dogfooding 1·2·4).
3. 데모 가능.

### Incremental
- US1(MVP) → US2(연결 표시) → US3(필터) → US4(삭제/복구). 각 단계 독립 검증 후 다음.

### 권장 진행
- 단일 작업자 + `MemoInboxScreen.tsx` 집중도 높음 → 우선순위 순차. US4 backend만 필요 시 US1과 병행.

---

## Notes
- `[P]` = 다른 파일·의존 없음. 같은 파일(`MemoInboxScreen.tsx`) 다수 task는 순차.
- TDD: repository/스키마/매퍼는 실패 테스트 먼저(HARD-GATE). UI 결선은 행위 테스트로 보호.
- `MemoPanel.tsx`(연결 메모 side panel)·`memos.link` 연결/해제 **동작 UI**는 **Phase 6** — 본 Phase 범위 밖.
- 각 task 또는 논리 묶음 후 commit. checkpoint에서 멈춰 story 독립 검증.
- agent-workflow §8: preload 결선 회귀 방지 위해 renderer 첫 IPC 호출 전 smoke(T028).
