# Implementation Plan: 보드 카드 만들기 UX 보완 (Board Card Creation UX)

**Branch**: `worktree-044-board-card-creation-ux` | **Date**: 2026-06-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/044-board-card-creation-ux/spec.md`

## Summary

보드 TASK-1 미구현 잔여를 회수한다. 빈 보드 진입 시 빈 캔버스 대신 중앙 안내를 노출하고(FR-001~003), 캔버스 빈 곳 더블클릭으로 그 자리에 카드를 만들며(FR-004), 세 생성 경로("+ 카드" 버튼 / 빈 곳 더블클릭 / 빈 보드 버튼)가 모두 카드를 즉시 생성하고 **생성 직후 자동 본문 편집에 진입**한다(FR-005). 빈 카드도 저장·잔존(FR-006, 사용자 결정). 더블클릭을 카드 생성에 쓰기 위해 더블클릭 줌을 끈다(FR-008). 기존 동작 무회귀(FR-009·010). **FE only — 백엔드·스키마·에러코드 변경 0**(기존 카드 생성·본문 편집 경로 재사용). 동반: `specs/038-memo-plot-board/spec.md` FR-005 정정(FR-011).

기술 접근: `PlotBoardCanvas.tsx`(CanvasInner)에 `zoomOnDoubleClick={false}` + wrapper `onDoubleClick`(대상이 `.react-flow__pane`일 때만 `screenToFlowPosition`으로 생성) + 생성 3경로 공통 `createCardAt(pos)`(onSuccess에서 `autoEditCardId=실제 id`) + `nodes.length===0` 시 빈 보드 안내 오버레이. `CardNode.tsx`는 `autoEditCardId===id`면 편집 진입+consume(기존 더블클릭 편집 보존). `boardActions.ts`에 `autoEditCardId·consumeAutoEdit` 추가. 신규 `BoardEmptyGuide` 컴포넌트(COPY 드롭인).

## Technical Context

**Language/Version**: TypeScript 5.9 / React 19.2 / Next.js 16 (App Router)

**Primary Dependencies**: `@xyflow/react` 12.11.1 (React Flow, 무한 캔버스), React Query(서버 상태), 기존 보드 도메인 훅(`useBoards`)

**Storage**: N/A (백엔드·DB 변경 0 — 기존 카드 생성/편집 엔드포인트 재사용)

**Testing**: Vitest(단위, jsdom) + dogfooding(캔버스 상호작용·시각·포커스 — jsdom 미검증 영역, 룰 14)

**Target Platform**: 웹(데스크탑 우선). 보드 캔버스는 `dynamic(ssr:false)` 클라이언트 전용

**Project Type**: web frontend (단일 `frontend/`)

**Performance Goals**: 캔버스 상호작용 즉시 반영(낙관적). 신규 네트워크 호출 0 추가(기존 카드 생성 1회 그대로)

**Constraints**: 카드 = `body` 단일 모델(제목/내용 분리 없음). 자동 편집은 카드 서버 확정(실제 id) 후 진입(키 유실 방지). 보드 캔버스가 렌더되는 두 화면(보드 상세·집필 참조 패널) 동일 적용

**Scale/Scope**: 변경 파일 4개(3개 수정 + 1개 신규) + 038 spec.md 1줄 정정. 신규 라우트·엔드포인트·마이그레이션 0

## Constitution Check

*GATE: 프로젝트 constitution 은 빈 템플릿 → CLAUDE.md + `.claude/rules/*` 를 준거로 사용.*

| 게이트 | 적용 | 상태 |
|---|---|---|
| 추측 금지(HARD) | React Flow API(zoomOnDoubleClick·onPaneDoubleClick 부재·pane class·screenToFlowPosition·기본값)를 설치본 소스로 실측 확정 | PASS |
| 단순성(§2) | 현행 즉시 저장 패턴 유지 + 진입 UX만 추가. deferred-persist 재구성 회피(사용자 결정) | PASS |
| Surgical(§3) | 변경 4파일 + 038 1줄. 인접 코드 리팩토링·"+ 카드" 문구 변경 등 범위 외 금지 | PASS |
| TDD(§5) | 순수/결정 로직(좌표 변환·pane 판별·autoEdit consume·빈보드 판정)은 Red-Green. 캔버스 상호작용(줌오프·focus)은 jsdom 미검증 → dogfooding 게이트(§5-5·룰 14) | PASS |
| RSC 경계(typescript/code-quality) | 변경 컴포넌트 전부 기존 `"use client"` 내부. 신규 `BoardEmptyGuide`도 `onClick` 가져 `"use client"`. 작성 직후 `pnpm build`로 검출 | PASS |
| 한국어 cadence | 안내/버튼 COPY 한국어 + 라이트/다크 dogfooding | PASS |
| 배포 순서 | FE 단독 → 순서 무관(BE 계약 변경 0) | PASS |

위반 없음 → Complexity Tracking 불필요.

## Project Structure

### Documentation (this feature)

```text
specs/044-board-card-creation-ux/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — React Flow API 실측 + 자동편집 메커니즘 결정
├── data-model.md        # Phase 1 — 데이터 변경 0 + FE 상태 추가(autoEditCardId)
├── quickstart.md        # Phase 1 — dogfooding 검증 체크리스트
├── contracts/
│   └── README.md        # 신규 계약 0(기존 카드 생성/편집 재사용) 명시
└── tasks.md             # /speckit-tasks 출력(본 명령 아님)
```

### Source Code (repository root)

```text
frontend/src/components/board/
├── PlotBoardCanvas.tsx      # 수정 — zoomOnDoubleClick=false, 빈곳 더블클릭, createCardAt 통합, autoEditCardId 상태, 빈 보드 오버레이
├── CardNode.tsx             # 수정 — autoEditCardId===id면 편집 진입+consume(기존 더블클릭 편집 보존)
├── boardActions.ts          # 수정 — BoardActions에 autoEditCardId·consumeAutoEdit 추가
├── BoardEmptyGuide.tsx      # 신규 — 빈 보드 중앙 안내(COPY 드롭인)
└── __tests__/               # 신규/보강 — 순수 헬퍼 단위 테스트
    └── boardCardCreate.test.ts   # 좌표/pane 판별/autoEdit consume 등 순수 로직

specs/038-memo-plot-board/spec.md   # FR-005 문구 정정(1줄)
```

**Structure Decision**: 기존 `frontend/src/components/board/` 단일 디렉토리에 집중. 신규 디렉토리·라우트 없음. 순수 헬퍼는 같은 디렉토리 `__tests__`에 단위 테스트(기존 `linkGraph` 테스트 패턴 동형).

## 구현 접근 (상세)

### A. 자동 편집(autoEdit) 신호 — 캔버스 → CardNode

- 캔버스 상태 `autoEditCardId: string | null` 추가. `boardActions`(컨텍스트)로 `autoEditCardId`와 `consumeAutoEdit(id)`를 CardNode에 전달(함수를 node.data에 넣으면 매 변경 리렌더 → 컨텍스트 사용, 기존 패턴 정합).
- `CardNode`: `useEffect`에서 `autoEditCardId === id && !editing`이면 `setEditing(true)` 후 `consumeAutoEdit(id)`(1회성). 기존 더블클릭 편집 진입은 그대로 보존.
- **타이밍(키 유실 방지)**: 생성은 낙관적 temp 노드 추가 → `createCard.mutate`. **onSuccess에서 temp→real id 확정 직후** `setAutoEditCardId(realId)`. 자동 편집은 실제 id 노드에서 열리므로 temp→real 스왑으로 인한 리마운트·입력 유실 위험이 없다(타이핑은 확정 후 시작). 짧은 네트워크 지연이 체감되면 dogfooding에서 재검토.

### B. 빈 곳 더블클릭 → 그 자리 생성

- React Flow 12.11.1에 `onPaneDoubleClick` prop **없음**(실측). wrapper `div`에 네이티브 `onDoubleClick` 부착 → `(e.target as HTMLElement).classList.contains('react-flow__pane')`일 때만 빈 곳으로 판정(카드·핸들·컨트롤·패널 제외) → `screenToFlowPosition({x:clientX,y:clientY})` → `createCardAt(pos)`.
- `zoomOnDoubleClick={false}` 설정(기본 true → 더블클릭 줌 제거). 줌은 휠(`zoomOnScroll` 기본 true)·핀치(`zoomOnPinch` 기본 true)·"한눈에 보기"(fitView) 유지.

### C. 생성 3경로 통합 `createCardAt(position)`

- 현 `handleAddCard`(중앙)·신규 빈곳 더블클릭·빈 보드 안내 버튼이 공통 `createCardAt(pos)` 호출. 내부 = 기존 낙관적 temp 노드 추가 + `createCard.mutate`(즉시 저장, 빈 본문 허용) + onError 롤백 + **onSuccess에서 id 스왑 + autoEdit 신호**. "+ 카드" 버튼도 이 경로를 타 자동 편집을 얻는다(현재는 자동 편집 없음 → 통합으로 동일).

### D. 빈 보드 안내 오버레이

- `nodes.length === 0`이면(낙관적 temp 추가 시 즉시 1 → 안내 사라짐) 캔버스 위 중앙 오버레이 `BoardEmptyGuide` 렌더. 빈 격자 캔버스를 덮어 노출 금지(FR-001). COPY: `"여기에 첫 카드를 적어보세요"` + `"+ 카드 만들기"` 버튼 → `createCardAt(중앙 좌표)`.
- 보드 캔버스가 렌더되는 두 화면(`/boards/[boardId]` 페이지 + `BoardReferencePanel`)에서 동일 적용 — `CanvasInner` 내부에 두므로 자동(특별처리 없음, FR-010).

### E. 회귀 가드

- 더블클릭 pane 한정 → 카드 더블클릭 편집(`CardNode` onDoubleClick)·잇기 빈곳 drop(`onConnectEnd`, 드래그-릴리스)·컨트롤 무충돌.
- 잇기(드래그/클릭-클릭)·드래그 배치(`onNodeDragStop`)·선택 해제(`onPaneClick`)·이웃 하이라이트·종류 부여(트랙 D)·매핑 무변경.
- 잇기 빈곳 drop의 연결-생성 카드(`handleConfirmEmptyDrop`)는 자동 편집 미적용(TASK-2 범위, 무변경).

### F. 038 FR-005 정정

- `specs/038-memo-plot-board/spec.md` FR-005 문구를 "빈 보드는 빈 캔버스 대신 중앙 안내를 표시(044로 대체)"로 정정 + 044 출처 주석(룰 28 화해).

## Testing 전략

- **단위(TDD)**: 순수/결정 로직만 — (a) 빈 곳 판별(target classList에 `react-flow__pane` 포함 여부 판정 헬퍼), (b) autoEdit consume 1회성 로직, (c) 빈 보드 판정(`nodes.length===0`) 파생. `screenToFlowPosition`은 RF 인스턴스 의존이라 단위 경계 밖.
- **dogfooding 게이트(룰 14·25)**: 캔버스 상호작용·시각·포커스 — 빈 보드 안내(보드 페이지+참조 패널, 라이트/다크)·빈 곳 더블클릭 그 자리 생성+자동편집·세 경로 동일결과·더블클릭 줌 안 됨·휠/핀치 줌 됨·빈 카드 잔존·기존 잇기/드래그/종류/매핑 무회귀. quickstart.md 전항 사용자 확인 후에만 통과 단정.
- **게이트**: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`(RSC 경계 build 검출).

## Complexity Tracking

위반 없음 — 표 생략.
