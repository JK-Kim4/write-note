---
description: "Task list — Desktop 기록(Log)"
---

# Tasks: Desktop 기록(Log) — 작품별 진척·작업 시간·기록 메모

**Input**: `specs/012-desktop-log-record/` (plan.md, spec.md, research.md, data-model.md, contracts/ipc.md, quickstart.md)

**Tests**: TDD HARD-GATE (CLAUDE.md §5) — 테스트 태스크 포함. Red(실패 확인) → Green(최소 구현) → Refactor.

**환경 선행**: `export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"` (node:sqlite=Node 24). 검증은 `node_modules/.bin/{vitest,tsc,vite}` 직접 실행, **포어그라운드**.

**Format**: `[ID] [P?] [Story?] Description (file path)`

---

## Phase 1: Setup

- [ ] T001 implement 진입 직전 검증(rule §6): `desktop/electron/db/{schema,types,store,documentRepository,memoRepository}.ts`, `desktop/electron/ipc/{contract,registerHandlers}.ts`, `desktop/electron/{main,preload}.ts`, `desktop/src/{App.tsx,global.d.ts}`, `desktop/src/screens/{LogScreen,WriteStudioScreen}.tsx`, `desktop/src/lib/lastSentence.ts` 실제 존재·시그니처 grep 1회. 불일치 시 data-model/contracts 와 대조 후 진행.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ 모든 user story 의 선행. 스키마·타입이 없으면 어떤 story 도 시작 불가.**

- [ ] T002 [P] `desktop/electron/db/schema.test.ts`: v5→v6 마이그레이션 테스트 작성(RED) — 기존 v5 데이터 보존 + `project_logs`/`work_sessions` 테이블·인덱스 존재 + 신규 DB 케이스.
- [ ] T003 `desktop/electron/db/schema.ts`: 메인 CREATE 블록에 `project_logs`/`work_sessions` + 3 인덱스 추가, `SCHEMA_VERSION=6`, v6 주석(별도 ALTER 불필요) (GREEN).
- [ ] T004 [P] `desktop/electron/db/types.ts`: `ProjectLog`/`WorkSession`/`LogCard` 타입 추가(data-model §2).

**Checkpoint**: 스키마 v6 + 도메인 타입 준비 — user story 진입 가능.

---

## Phase 3: User Story 1 - 작품별 진척 상태를 한눈에 (Priority: P1) 🎯 MVP

**Goal**: 기록 화면에서 작품별 진척%·최근 수정일·마지막 문장을 카드로 즉시 확인(신규 데이터 적재 없이 기존 작품·본문에서 파생).

**Independent Test**: 목표 설정/미설정 작품 + 본문 일부 작성 후 기록 화면 진입 → 진척%(또는 "목표 미설정")·최근 수정일·마지막 문장 정확 표시.

### Tests (RED first)

- [ ] T005 [P] [US1] `desktop/src/lib/progress.test.ts`: 진척% 파생(목표 null→"목표 미설정"/목표 0 경계/정상 62%/초과 112%) + duration 포맷("N시간 M분"/0→"기록 없음") (RED).
- [ ] T006 [P] [US1] `desktop/electron/db/store.test.ts`: `listLogCards` 집계 — 작품별 `wordCount`/`lastSentenceSource`/`latestLog=null`/`totalDurationMs=0`, `projects.list` 순서(updated_at DESC) (RED).
- [ ] T007 [P] [US1] `desktop/src/components/LogCard.test.tsx`: 카드 렌더(진척 바+수치·목표 미설정 분기·최근 수정일·마지막 문장·빈 본문 시 마지막 문장 미표시) (RED).

### Implementation (GREEN)

- [ ] T008 [P] [US1] `desktop/src/lib/progress.ts`: 진척% 계산(`Math.round(wordCount/targetLength*100)`, null 분기) + `formatDuration(ms)`.
- [ ] T009 [US1] `desktop/electron/db/store.ts`: `listLogCards(): LogCard[]` 구현 — 각 작품의 document(`wordCount`/`plain_text`) 조회, `latestLog=null`·`totalDurationMs=0` 기본값(US2/US3 에서 채움).
- [ ] T010 [US1] `desktop/electron/ipc/contract.ts`: `logs.list` 계약 + `CHANNELS.logsList`("logs:list") + `LogCard` import.
- [ ] T011 [US1] `desktop/electron/ipc/registerHandlers.ts`: `logs:list` → `store.listLogCards()` 핸들러.
- [ ] T012 [US1] `desktop/electron/preload.ts` + `desktop/src/global.d.ts`: `electronAPI.logs.list` 노출 + renderer 타입 동기.
- [ ] T013 [P] [US1] `desktop/src/components/LogCard.tsx`: 카드(제목·진척 바/수치·"목표 미설정"·최근 수정일·마지막 문장(`lastSentence()` 파생)·총 작업 시간 자리). latestLog/누적/아코디언은 US2.
- [ ] T014 [US1] `desktop/src/screens/LogScreen.tsx`: placeholder 제거 → `logs.list` 결선 + `LogCard` 리스트 + 작품 0개 빈 상태. 우측 더미 통계 패널 제거.

**Checkpoint**: US1 단독 동작·테스트 가능(진척 카드 MVP). dogfooding(quickstart US1) 가능.

---

## Phase 4: User Story 2 - 작업 종료 시 기록 메모 + 누적 조회 (Priority: P2)

**Goal**: 집필 "작업 종료"에서 기록 메모를 남기고, 기록 화면 카드에 최신 1줄 + 아코디언 누적 전체를 본다.

**Independent Test**: 작업 종료로 기록 2건 남기고 → 카드 최신 1줄 + 펼침 시 최신순 누적 2건.

### Tests (RED first)

- [ ] T015 [P] [US2] `desktop/electron/db/projectLogRepository.test.ts`: `create`/`listByProject`(created_at DESC)/`latestByProject`/작품 삭제 CASCADE (RED).
- [ ] T016 [P] [US2] `desktop/electron/db/store.test.ts`: `addProjectLog` + `listLogCards` 의 `latestLog` 반영 (RED).
- [ ] T017 [P] [US2] `desktop/src/components/LogCard.test.tsx`: 최신 기록 1줄 + 아코디언 토글(펼침 시 `logs.listByProject` 최신순) + 기록 없음 빈 상태 (RED).
- [ ] T018 [P] [US2] `desktop/src/screens/WriteStudioScreen.test.tsx`: "작업 종료" 버튼 → 기록 메모 모달 → 저장(본문 전달)/취소(미추가·집필 유지) (RED).

### Implementation (GREEN)

- [ ] T019 [US2] `desktop/electron/db/projectLogRepository.ts`: `create(projectId, body)`/`listByProject`/`latestByProject` (시각=main 시계, R5).
- [ ] T020 [US2] `desktop/electron/db/store.ts`: `addProjectLog(projectId, body)` + `listLogCards` 에 `latestLog` 채우기.
- [ ] T021 [US2] `desktop/electron/ipc/{contract,registerHandlers}.ts`: `logs.listByProject` + `logs.add(projectId, body)` 계약/`CHANNELS`/핸들러. (`logs.add` 는 US3 에서 `sessions.endWithLog` 로 격상.)
- [ ] T022 [US2] `desktop/electron/preload.ts` + `desktop/src/global.d.ts`: `logs.listByProject`/`logs.add` 노출·동기.
- [ ] T023 [US2] `desktop/src/components/LogCard.tsx`: 최신 기록 1줄 + 아코디언 토글(펼침 시 `logs.listByProject` lazy 조회·최신순).
- [ ] T024 [US2] `desktop/src/screens/WriteStudioScreen.tsx`: "작업 종료" 버튼(R3 위치) + 기록 메모 모달(textarea+저장/취소, Phase 5 캡처 모달 패턴) → `logs.add`.

**Checkpoint**: US1+US2 독립 동작. 기록 메모 누적·아코디언 dogfooding 가능.

---

## Phase 5: User Story 3 - 작업 시간 자동 추적 (Priority: P3)

**Goal**: 집필 진입=시작·이탈/전환/앱닫힘=자동 종료로 작업 시간을 추적, 총 작업 시간을 카드에 표시. 30초 폐기·비정상 종료 정리로 신뢰도 유지.

**Independent Test**: 집필 5분 머문 뒤 이탈 → 총 작업 시간 ~5분. 30초 미만 진입 제외. 앱 닫고 재시작 시 과대 합산 없음.

### Tests (RED first)

- [ ] T025 [P] [US3] `desktop/electron/db/workSessionRepository.test.ts`: `start`(열린 1개 보장)/`endOpen`(30s 폐기)/`endAllOpenSessions`/`closeDangling`/`totalDurationMsByProject`/CASCADE (RED).
- [ ] T026 [P] [US3] `desktop/electron/db/store.test.ts`: `endSessionWithLog` 트랜잭션(세션 종료+로그, 30s 미만도 보존) + `listLogCards` `totalDurationMs` 반영 (RED).
- [ ] T027 [P] [US3] `desktop/src/App.test.tsx`: 세션 생명주기 — `screen==="write" && activeProject` 진입 시 `sessions.start`, 화면/작품 전환 cleanup 시 직전 projectId 로 `sessions.end`(stale closure 주의) (RED).

### Implementation (GREEN)

- [ ] T028 [US3] `desktop/electron/db/workSessionRepository.ts`: `start`/`endOpen`(MIN_SESSION_MS=30_000 폐기)/`endAllOpenSessions`/`closeDangling`/`totalDurationMsByProject`.
- [ ] T029 [US3] `desktop/electron/db/store.ts`: `endSessionWithLog`(트랜잭션, 짧아도 보존 — `endOpen` 폐기 분기 우회) + `closeDangling`/`endAllOpenSessions` 위임 + `listLogCards` `totalDurationMs` 채우기.
- [ ] T030 [US3] `desktop/electron/ipc/{contract,registerHandlers}.ts`: `sessions.start`/`sessions.end`/`sessions.endWithLog` 계약/`CHANNELS`/핸들러(`end` 는 main 시계 now 주입).
- [ ] T031 [US3] `desktop/electron/preload.ts` + `desktop/src/global.d.ts`: `sessions.*` 노출·동기.
- [ ] T032 [US3] `desktop/src/App.tsx`: 세션 자동 시작/종료 effect(`screen`/`activeProject` 의존, cleanup 캡처값으로 직전 projectId end).
- [ ] T033 [US3] `desktop/electron/main.ts`: `whenReady` Store 초기화 직후 `store.closeDangling()` + `app.on("before-quit", () => store.endAllOpenSessions(now))`.
- [ ] T034 [US3] `desktop/src/screens/WriteStudioScreen.tsx`: "작업 종료" 동작을 `logs.add` → `sessions.endWithLog`(세션 종료+로그 트랜잭션, FR-011)로 격상. (US2 의 `logs.add` IPC 는 미사용 시 제거.)

**Checkpoint**: 3개 story 모두 독립 동작. 작업 시간 추적 dogfooding 가능.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T035 [P] 전체 게이트(포어그라운드): `node_modules/.bin/vitest run` + `tsc --noEmit` + `vite build` GREEN, 기존 회귀 0.
- [ ] T036 quickstart.md dogfooding 체크리스트(US1/US2/US3/공통) 수행 — 사용자 영역(특히 작업 시간 실측·앱 닫기 재시작).
- [ ] T037 [P] vault `02-PROGRESS.md` §완료 Phase + 진입점 갱신, 발견 이슈 시 `03-ISSUES.md` (sync-vault).

---

## Dependencies & Execution Order

- **Phase 1 Setup** → **Phase 2 Foundational(스키마·타입)** → user stories.
- **US1(P1)**: Foundational 후 시작. 다른 story 의존 없음(latestLog/total 기본값). **MVP.**
- **US2(P2)**: Foundational 후. `listLogCards` 의 `latestLog` 자리를 채움(US1 의 store/LogCard/LogScreen 확장). US1 위에 증분.
- **US3(P3)**: Foundational 후. `totalDurationMs` 자리를 채우고 세션 생명주기·main 훅 추가. US2 의 "작업 종료" 버튼 동작을 트랜잭션으로 격상.
- **Polish**: 모든 원하는 story 완료 후.

### Within story (TDD)

- 테스트(RED) → 모델/repository → store → IPC → 컴포넌트/화면(GREEN). 테스트 먼저 실패 확인 의무.

### Parallel Opportunities

- T002/T004 (foundational, 다른 파일) 병렬.
- 각 story 의 테스트 태스크([P])는 서로 다른 파일이라 병렬 작성 가능.
- `store.ts`·`contract.ts`·`registerHandlers.ts`·`LogCard.tsx`·`WriteStudioScreen.tsx` 는 story 간 **순차 확장**(같은 파일) — [P] 아님.

---

## Parallel Example: User Story 1 테스트

```
T005 progress.test.ts (진척% + duration)
T006 store.test.ts (listLogCards 집계)
T007 LogCard.test.tsx (카드 렌더)
```

---

## Implementation Strategy

### MVP First (US1만)

1. Phase 1 Setup → Phase 2 Foundational(스키마 v6 + 타입)
2. Phase 3 US1(진척 카드)
3. **STOP & VALIDATE**: quickstart US1 dogfooding(진척%·최근 수정일·마지막 문장)
4. 가치 확인 후 US2 진입

### Incremental Delivery

1. Foundational → US1(MVP, 진척 카드) → 검증
2. US2(기록 메모 + 아코디언) → 검증
3. US3(작업 시간 추적) → 검증
4. 각 story 가 이전을 깨지 않고 가치 추가

---

## Notes

- [P] = 다른 파일·의존 없음. 같은 파일(store/contract/LogCard/WriteStudio) 확장은 순차.
- 회귀 주의(quickstart): App effect cleanup stale closure / endSessionWithLog 30s 폐기 우회 / v6 마이그레이션 데이터 보존 / 한국어 렌더(keep-all).
- 외부 인프라 안전: 로컬 SQLite 만(앱 런타임 마이그레이션). 외부 DB 쓰기 아님 — 컨펌 게이트 비해당.
- 각 task 완료 또는 논리 그룹 후 commit. checkpoint 에서 story 독립 검증.
