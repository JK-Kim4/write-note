# Tasks: 보드 "끌어서 잇기" 첫-진입 코치마크

**Feature**: `specs/045-board-link-coachmark/` | **Branch**: `worktree-045-board-link-coachmark`
**Input**: spec.md · plan.md · research.md · data-model.md · contracts/coachmark-module.md · quickstart.md

**범위**: FE only(`frontend/`). 백엔드·마이그레이션·에러코드 0. 단일 유저 스토리(US1) = MVP.

**TDD**: 순수 로직(`boardCoachmark`·`linkHintPlacement`)은 Red→Green(룰 5). 캔버스 hover·시각은 jsdom 미검증(룰 14·25) → dogfooding 게이트.

**경로 기준**: 모든 경로는 `frontend/` 기준. 명령은 `cd frontend` 후 실행(CLAUDE.md cwd 의무).

---

## Phase 1: Setup

- [ ] T001 `frontend/src/components/board/` 에서 "끌어서 잇기" 문구·기존 COPY/리터럴 사용 관행 확인(grep `끌어서 잇기`·`hoverHint`) — 신규 상수 도입 vs 리터럴 결정(worksheet §5 `link.hoverHint='끌어서 잇기'` 기준, 동적 보간 없는 리터럴).

## Phase 2: Foundational (순수 모듈 TDD — US1 결선 이전 완료 필수)

- [ ] T002 [P] (RED) `frontend/src/lib/boardCoachmark.test.ts` 작성 — `hasSeenLinkHint()` 초기 false / `markLinkHintSeen()` 후 true / 손상값(JSON.parse 실패)·`linkHint` 부재 → false 화해 / `localStorage` 부재 시 no-op·throw 0 / 멱등 / 다른 키 보존. (실패 확인)
- [ ] T003 (GREEN) `frontend/src/lib/boardCoachmark.ts` 구현 — key `writenote.board.coachmark.v1`, `{ linkHint?: true }`, `hasSeenLinkHint()`/`markLinkHintSeen()`. `lastViewedBoard.ts` 패턴(read 손상 화해·write 저장소 가드). T002 GREEN.
- [ ] T004 [P] (RED) `frontend/src/components/board/linkHintPlacement.test.ts` 작성 — `linkHintPlacement(anchor)` 4 앵커 매핑: top→caret "down" / right→"left" / bottom→"up" / left→"right", 각 `positionClass` 리터럴 고정. (실패 확인)
- [ ] T005 (GREEN) `frontend/src/components/board/linkHintPlacement.ts` 구현 — `HandleAnchor`·`LinkHintPlacement`·`linkHintPlacement()`. 리터럴 Tailwind 클래스(JIT 안전, `cardKinds.ts` 패턴). T004 GREEN.

## Phase 3: User Story 1 — 처음 사용자가 카드 잇는 법을 발견 (P1) 🎯 MVP

**Goal**: 첫 연결점 hover 시 그 점에서 "끌어서 잇기" 1회 → 이후 안 뜸. (캔버스 결선 — dogfooding 검증)

**Independent Test**: localStorage 비운 보드에서 카드 연결점에 처음 커서 → 그 점에서 라벨 1회 → 재hover·재진입 시 0회.

- [ ] T006 [US1] `frontend/src/components/board/CardNode.tsx` — `hoveredHandle` 상태(`"top"|"right"|"bottom"|"left"|null`) 추가 + `HANDLE_DEFS` 의 각 `<Handle>` 에 `onMouseEnter={()=>setHoveredHandle(handleId)}`·`onMouseLeave={()=>setHoveredHandle(null)}` 부착. 연결 드래그·기존 핸들 동작 무변경.
- [ ] T007 [US1] `frontend/src/components/board/CardNode.tsx` — 첫 노출 게이팅: mount 시 `hasSeenLinkHint()` 로 `showLinkHint` 초기화. `showLinkHint && hoveredHandle != null` 이면 `linkHintPlacement(hoveredHandle)` 위치에 "끌어서 잇기" 라벨 렌더 + 첫 노출 시 `markLinkHintSeen()` 호출 후 `showLinkHint=false`. 라벨 `pointer-events-none`. (편집 중·dimmed 시 미노출은 기존 흐름과 정합)
- [ ] T008 [US1] `frontend/src/components/board/CardNode.tsx` — 라벨 시각: 다크 툴팁 pill + 방향 캐럿(`linkHintPlacement.caret`), 고정색(보드 light 고정), `whitespace-nowrap`. 위치 목업(`docs/research/2026-06-27-board-coachmark-placement-mockup.html`) 정합. 리터럴 Tailwind.

## Phase 4: Polish & 검증

- [ ] T009 FE 자동 게이트 GREEN — `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build`. 순수 TDD(T002~T005) 포함 전 테스트 GREEN, RSC 경계·타입 0err.
- [ ] T010 회귀 grep — `CardNode.tsx` 외 `node/edge` 식별자 미증식·기존 잇기/종류/삭제 경로 식별자 무변경 확인(시각 변경만).
- [ ] T011 dogfooding 게이트(authed 로컬 풀스택, `quickstart.md` 전항) — 사용자 확인 후에만 통과 단정(룰 25): 첫 연결점 hover 1회→재진입·다른 보드 0회 / 네 방향 자연 / 비차단 잇기 / 잇기4·종류·삭제 무회귀 / 집필 참조 패널 동일 / "이건 뭔가요?" 안 뜸.

---

## Dependencies

```
Phase 1 (T001)
   ↓
Phase 2 (T002→T003, T004→T005)   # 순수 TDD, 두 모듈 [P] 병렬 가능
   ↓
Phase 3 / US1 (T006→T007→T008)   # 같은 파일 CardNode.tsx 순차
   ↓
Phase 4 (T009→T010→T011)
```

- T002·T004 [P] 병렬(다른 파일). T003·T005도 각 RED 후 [P] 병렬 가능.
- T006~T008 은 같은 `CardNode.tsx` → 순차.
- T011 dogfooding 은 T009 게이트 GREEN + 로컬 풀스택(DB→BE→FE) 기동 후.

## Parallel 예시

```
# 순수 모듈 2종 동시 TDD:
T002 (boardCoachmark.test) ‖ T004 (linkHintPlacement.test)
→ T003 (boardCoachmark) ‖ T005 (linkHintPlacement)
```

## Implementation Strategy

- **MVP = US1**(T001~T008) + 게이트(T009·T010). 단일 스토리라 US1 완료 = 기능 완성.
- 순수 모듈(Phase 2) 먼저 GREEN → CardNode 결선(Phase 3)은 검증된 헬퍼만 조립.
- dogfooding(T011)은 ISSUE-051 잔여 종료 조건 — 전항 사용자 확인 전 완료 단정 금지.
