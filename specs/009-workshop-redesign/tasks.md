---
description: "Task list — 작업실 디자인 고도화"
---

# Tasks: 작업실 디자인 고도화 (작품 벽 · 서랍형 집필실 · 쪽지 책상)

**Input**: `specs/009-workshop-redesign/` (plan.md, spec.md, research.md, data-model.md, contracts/ipc-contract.md, quickstart.md)

**Tests**: TDD 적용 — 로직(repository/store/순수함수)·동작(연결/고정/재진입/모달)은 테스트 선행. CSS·정적 외관·토큰은 §5-5 완화(테스트 선택).

**Organization**: User Story 별 phase. P1: US1(작품 벽)·US2(서랍형 집필실) / P2: US3(쪽지 책상)·US4(잉크 한 방울)·US6(고정) / P3: US5(접근성).

**환경(모든 test/build)**: `export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"` 선행, `cd desktop`. 빌드/테스트는 포어그라운드.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 베이스 GREEN 확인 — `cd desktop && pnpm test`(기존 16 files/102) / `pnpm typecheck` / `pnpm build` 통과 확인(Node 24)

---

## Phase 2: Foundational (Blocking — 모든 backend 의 전제)

**Purpose**: 스키마 v5 + 도메인 타입 + 공통 토큰. 완료 전 어떤 US backend 도 진행 불가.

- [ ] T002 [P] `desktop/electron/db/schema.test.ts` — v4→v5 마이그레이션 테스트 추가(RED): 기존 DB 에 `projects.next_scene`(DEFAULT '')·`memo_projects.pinned`(DEFAULT 0) 가 무손실 추가되고 `user_version=5` 가 되는지
- [ ] T003 `desktop/electron/db/schema.ts` — v5 구현(GREEN): CREATE 정의에 두 컬럼 + `if (version < 5)` 블록(projects.next_scene / memo_projects.pinned ALTER) + `SCHEMA_VERSION=5`
- [ ] T004 [P] `desktop/electron/db/types.ts` — `Project.nextScene: string` 추가 + `ProjectMemo = Memo & { pinned: boolean }` 신설
- [ ] T005 [P] `desktop/src/styles/app.css` — `--scrap`/`--scrap-edge`/`--scrap-ink` 토큰 라이트·다크 정의(쪽지 면, 대비 검증) [CSS 완화]

**Checkpoint**: 스키마·타입·토큰 준비 → US phase 진입 가능.

---

## Phase 3: US1 — 작품 벽 + 다음 장면 (Priority: P1) 🎯 MVP

**Goal**: 작품 목록을 마지막 문장이 얼굴인 작업 벽으로, 작가가 "다음 장면"을 적어 영속.

**Independent Test**: 작품 카드에 마지막 문장이 두드러지고 날짜/카운터 없음, 다음 장면을 적으면 저장·재표시, 카드 클릭 시 집필 진입.

### Backend (다음 장면 저장)

- [ ] T006 [US1] `desktop/electron/db/projectRepository.test.ts` — update 로 nextScene 저장/조회, 미지정 시 기존값 유지, create 기본값 '' (RED)
- [ ] T007 [US1] `desktop/electron/db/projectRepository.ts` — ProjectRow·toProject·CreateProjectInput·create INSERT·update SET 절에 next_scene 반영(GREEN)
- [ ] T008 [US1] `desktop/electron/ipc/contract.ts` + `registerHandlers.ts` + `preload.ts` — `UpdateProjectInput.nextScene` 경로 노출(기존 `projects:update` 재사용, 새 채널 불요)

### Renderer (마지막 문장 파생 + 작업 벽)

- [ ] T009 [P] [US1] `desktop/src/lib/lastSentence.test.ts` — plainText→마지막 비어있지 않은 문장 파생, 빈 본문 null, 한국어 종결부호(`.?!…`)/줄바꿈 케이스(RED)
- [ ] T010 [US1] `desktop/src/lib/lastSentence.ts` — 순수 함수 구현(GREEN)
- [ ] T011 [US1] `desktop/src/screens/ProjectsScreen.test.tsx` — 카드에 마지막 문장 표시, 날짜/카운터 미표시, 다음 장면 입력→`projects.update(nextScene)` 호출, 카드 선택→집필 진입(RED)
- [ ] T012 [US1] `desktop/src/screens/ProjectsScreen.tsx` — 작업 벽형(핀 카드 + 마지막 문장 얼굴 + 다음 장면 입력칸 + 새 작품). 동작 GREEN, 레이아웃/CSS 완화
- [ ] T013 [US1] dogfooding(quickstart US1): Electron 창에서 작품 벽·다음 장면 저장·진입 확인

**Checkpoint**: US1 단독으로 작품 벽 + 다음 장면 영속 동작.

---

## Phase 4: US2 — 서랍형 집필실 + 재진입 한 장 (Priority: P1)

**Goal**: 집필 화면을 종이 우선으로, 보기 control 접힘, 재진입 시 한 장(마지막 지점+다음 장면+곁 쪽지) 펼침.

**Independent Test**: 진입 시 종이 주영역 + 상시 조작 최소, 재진입 한 장 펼침, 곁 쪽지 서랍 닫힘 기본.

### Backend (재진입 선정)

- [ ] T014 [US2] `desktop/electron/db/store.test.ts` — `pickReentryMemo(projectId)` 우선순위(고정 pinned=1 > memo_projects.created_at 최신 > memos.captured_at 최신) + soft delete 제외 + 연결 없음 null (RED, pinned fixture 직접 세팅)
- [ ] T015 [US2] `desktop/electron/db/memoRepository.ts` — pickReentry 조회 쿼리 추가, `desktop/electron/db/store.ts` — `pickReentryMemo` use-case(GREEN)
- [ ] T016 [US2] `desktop/electron/ipc/contract.ts`(`memos:pickReentry` 채널/타입) + `registerHandlers.ts` + `preload.ts` — `memos.pickReentry(projectId)` 노출

### Renderer (서랍형 + 재진입 한 장 + 접힌 보기)

- [ ] T017 [US2] `desktop/src/screens/WriteStudioScreen.test.tsx` — 진입 시 재진입 한 장(마지막 문장+다음 장면+곁 쪽지) 표시, 보기 control 이 접힌 메뉴 안, 저장상태/글자수 상시(RED)
- [ ] T018 [US2] `desktop/src/components/` — 보기 팝오버(zoom/줄노트/테마/자동저장 통합, LinkPopover 패턴 재사용). 기존 `Dock`/`ZoomControl`/`PanelToggle` 정리
- [ ] T019 [US2] `desktop/src/screens/WriteStudioScreen.tsx` — 서랍형(종이 우선 + 재진입 한 장 + 가장자리 서랍에 MemoPanel 접힘 + 접힌 보기 메뉴) 결선(GREEN), CSS 완화
- [ ] T020 [US2] 한국어 IME 본문 입력 4케이스(PoC 0-1) 재검 + dogfooding(quickstart US2)

**Checkpoint**: US1+US2 = 재진입 강화 MVP(작품 벽 → 서랍형 집필실).

---

## Phase 5: US3 — 쪽지 책상 메모 (Priority: P2)

**Goal**: 메모 화면을 통계/필터 없는 흩어진 쪽지 작업대로, 붙이기 중심.

**Independent Test**: 통계 패널·전체/미연결 필터 제거, 쪽지 본문 중심, 안 붙은 쪽지 붙이기 즉시 반영.

- [ ] T021 [US3] `desktop/src/screens/MemoInboxScreen.test.tsx` — 통계 패널/세그먼트 필터 미존재, 작품 이름표/붙이기 표시, 붙이기 즉시 반영(기존 optimistic 유지) 갱신(RED)
- [ ] T022 [US3] `desktop/src/screens/MemoInboxScreen.tsx` — 쪽지 책상형(흩어진 쪽지 + 작품 추림 + 잉크 한 방울). 통계/필터 제거, 붙이기 진입점 유지(GREEN), CSS 완화
- [ ] T023 [US3] dogfooding(quickstart US3)

**Checkpoint**: 메모 화면이 관리화면 → 작업대.

---

## Phase 6: US4 — 잉크 한 방울 + 모달 hardening (Priority: P2)

**Goal**: 빠른 메모를 캡처 affordance 로, 모달 focus trap/restore/초안 보존.

**Independent Test**: 진입점이 캡처로 읽힘, 입력 중 닫기 시 초안 보존, 닫은 뒤 직전 포커스 복귀, 집필 중 현재 작품 연결.

- [ ] T024 [P] [US4] `desktop/src/components/Rail.tsx` — 빠른 메모 버튼을 "잉크 한 방울"(잉크 방울 아이콘+라벨)로, accessible name 유지 [정적 외관 완화]
- [ ] T025 [US4] `desktop/src/components/QuickCapture.test.tsx` — 입력 중 닫기 시 초안 보존, close 시 직전 activeElement 복귀, Tab 모달 내 순환, 집필 중 현재 작품 연결(RED)
- [ ] T026 [US4] `desktop/src/components/QuickCapture.tsx` — focus trap + restore + 초안 보존 구현(GREEN)
- [ ] T027 [US4] dogfooding(quickstart US4): 키보드 경로 포함

**Checkpoint**: 캡처 흐름이 신뢰 가능.

---

## Phase 7: US6 — 곁에 둘 쪽지 고정 (Priority: P2)

**Goal**: 작가가 작품별로 곁에 둘 쪽지를 고정 → 재진입 한 장에 우선.

**Independent Test**: 고정 시 그 작품 재진입에 고정 쪽지, 해제 시 fallback, 작품별 독립, 연결 해제 시 고정 소멸.

### Backend (고정 set/조회)

- [ ] T028 [US6] `desktop/electron/db/memoRepository.test.ts` — setPin 작품당 1개 유지(같은 작품 기존 고정 해제), removeLink 시 고정 소멸, listByProject 가 ProjectMemo(pinned) 반영(RED)
- [ ] T029 [US6] `desktop/electron/db/memoRepository.ts` — `setPin(memoId, projectId, pinned)`(트랜잭션: 같은 project 기존 pinned=0 후 대상 set) + listByProject 반환 `ProjectMemo[]`(pinned 포함)(GREEN)
- [ ] T030 [US6] `desktop/electron/ipc/contract.ts`(`memos:setPin`) + `registerHandlers.ts` + `preload.ts` — `memos.setPin` 노출, `listByProject` 반환 타입 ProjectMemo 동기화

### Renderer (고정 토글 + 재진입 우선 검증)

- [ ] T031 [US6] `desktop/src/components/MemoPanel.test.tsx` 또는 MemoInboxScreen — 고정 토글 동작(optimistic) + 작품별 독립 표시(RED)
- [ ] T032 [US6] `desktop/src/components/MemoPanel.tsx`(집필 서랍) / 메모 작품 맥락 — 고정 토글 UI 결선(GREEN)
- [ ] T033 [US6] dogfooding(quickstart US6): 고정→재진입 우선, 해제→fallback, 작품별 독립, 연결 해제 시 고정 소멸

**Checkpoint**: 재진입 한 장 정확도가 작가 의도로 제어됨.

---

## Phase 8: US5 — 접근성 대비/focus (Priority: P3)

**Goal**: 라이트·다크 대비 AA + 키보드 포커스 가시성.

**Independent Test**: 보조/placeholder 대비 측정 AA, 모든 상호작용 요소 focus 가시.

- [ ] T034 [US5] `desktop/src/styles/app.css` — `--faint`/`--muted` 사용처 대비 상향(본문급 `--ink-soft`↑, placeholder `--muted`↑), 라이트·다크 ≥4.5:1 [CSS 완화, 측정 검증]
- [ ] T035 [US5] `desktop/src/styles/app.css` + 컴포넌트 — 전역 `:focus-visible { outline: none }` 제거, 컴포넌트별 `box-shadow` focus ring(`--accent-soft`): QuickCapture/LinkPopover/삭제·고정 토글/Toast action
- [ ] T036 [US5] dogfooding(quickstart US5): 대비·focus 라이트/다크 확인

---

## Phase 9: Polish & 검증

- [ ] T037 전체 게이트(포어그라운드): `pnpm test`(기존 102 + 신규) / `pnpm typecheck` / `pnpm build` 올 GREEN
- [ ] T038 마이그레이션 회귀: 기존 v4 DB → v5 무손실(pinned/next_scene 기본값), 기존 연결/고정 보존 확인
- [ ] T039 `impeccable critique desktop app` 재실행 — P1 0건 + 총점 24/40 초과 확인(SC-007)
- [ ] T040 vault `02-PROGRESS.md` / `03-ISSUES.md` 갱신 + 회고

---

## Dependencies & 실행 순서

```
Setup(T001) → Foundational(T002-T005)
  → US1(T006-T013) [P1]
  → US2(T014-T020) [P1]  (pickReentry 는 pinned 컬럼=Foundational 에 의존, fixture 로 고정 검증)
  → US3(T021-T023) [P2]
  → US4(T024-T027) [P2]
  → US6(T028-T033) [P2]  (setPin; 재진입 pinned 우선은 US2 에서 이미 구현 → 여기선 토글·검증)
  → US5(T034-T036) [P3]
  → Polish(T037-T040)
```

- **MVP**: Foundational + US1 + US2 (재진입 강화 핵심: 작품 벽 → 서랍형 집필실 + 다음 장면).
- **병렬 가능**: T004/T005(타입·토큰), T009(lastSentence 테스트), T024(Rail) 등 [P] 표시.
- **독립성**: US3/US4/US5 는 US1·US2 와 독립 슬라이스(각 화면). US6 은 US2 의 pickReentry 위에 토글을 얹음.

## TDD 노트

- RED→GREEN 강제: T002/T006/T009/T011/T014/T017/T021/T025/T028/T031 은 실패 테스트 선행 후 구현.
- 완화(§5-5): CSS·토큰·정적 외관(T005/T012 레이아웃/T018/T019 레이아웃/T022 레이아웃/T024/T034/T035).
- Mock 경계: backend 는 실제 node:sqlite(테스트 격리 DB), renderer 는 `window.electronAPI` stub(시스템 경계)만.
