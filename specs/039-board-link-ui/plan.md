# Implementation Plan: 플롯 보드 연결(Link) UI — 트랙 A

**Branch**: `038-memo-plot-board` (트랙 A 연장) | **Date**: 2026-06-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/039-board-link-ui/spec.md`

## Summary

038 플롯 보드에서 보류된 **연결(Link) UI를 FE 캔버스에만 재결선**한다. 백엔드 엣지 계약·FE API·React Query 훅·타입·`BoardDetail.edges`는 전부 보존돼 있으므로 **신규 백엔드 0**. brainstorming 확정대로 **무방향 선**(React Flow `ConnectionMode.Loose`, 화살표 없음) + **이웃 하이라이트**(별도 패널 없음)로 구현한다.

기술 접근: React Flow v12(`@xyflow/react@12.11.1`) 표준 연결 API(`onConnect`/`onConnectEnd`/`Handle`/`isValidConnection`/`ConnectionMode.Loose`/custom edge)로 결선하고, 무방향 의미·중복/자기연결 가드·이웃 집합 계산은 **순수 헬퍼(`linkGraph.ts`)로 추출해 TDD**한다. 캔버스 상호작용(드래그 잇기·빈곳 drop·잇기 모드·dim)은 jsdom으로 검증 불가하므로 **dogfooding 게이트**(quickstart)로 닫는다. 낙관 반영은 노드와 동형으로 RF 로컬 `useEdgesState`가 담당(실패 시 직전 상태 복원).

> **⚠️ dogfooding 파생 범위 변경(2026-06-25)**: "신규 BE 0" 전제가 바뀌었다. 연결 테두리 앵커 영속 요구로 **BE V26**(`board_edges.source_handle/target_handle`) + 엔티티·DTO·service 확장이 추가됐다(BE 선행→FE). floating 접근은 폐기하고 핸들 앵커 기반으로. 클릭-클릭 진입은 카드 바깥 하단 분리 인디케이터로. 상세 = spec.md "dogfooding 파생 변경" 절.

## Technical Context

**Language/Version**: TypeScript 5.9 / React 19.2 / Next.js 16 (App Router)

**Primary Dependencies**: `@xyflow/react@^12.11.1`(이미 설치), `@tanstack/react-query`(서버 상태·영속), 보드 RF 로컬 상태(`useNodesState`/`useEdgesState` — Zustand 미사용)

**Storage**: N/A (FE only). 보존된 백엔드 엣지 계약 재사용 — `POST/DELETE /api/boards/:id/edges`, `GET /api/boards/:id`의 `edges` 하이드레이션. 신규 마이그레이션·엔드포인트·에러코드 **0**.

**Testing**: Vitest(순수 헬퍼 `linkGraph` 단위 — 어댑터·중복가드·이웃집합 TDD) + 로컬 dogfooding(캔버스 상호작용·EditContext 무관 React Flow 제스처)

**Target Platform**: 웹 데스크탑 브라우저(클라이언트 전용 캔버스, `dynamic(ssr:false)`)

**Project Type**: web (frontend 단독 변경)

**Performance Goals**: 드래그·연결 중 60fps(RF 로컬 낙관 반영, 드래그 중 BE 미호출). BE 호출은 연결 완료/끊기/노드 생성 시점만.

**Constraints**: 어댑터 경계 — `node`/`edge` 단어는 `PlotBoardCanvas`/custom edge 등 어댑터 파일 내부에서만(화면 문구는 작가 언어). `colorMode="light"` 고정(서드파티 캔버스 OS 자동추종 금지, 038 회고 교훈). 무방향 중복은 FE가 BE 호출 전 선제 차단.

**Scale/Scope**: 보드 1장당 수십~수백 카드/연결. 단일 사용자 가정(동시 편집 비범위).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

프로젝트 `.specify/memory/constitution.md`는 **빈 템플릿**(미작성)이다. 038 선례대로 **CLAUDE.md + 프로젝트 룰을 헌법 대용 게이트**로 적용한다:

| 게이트 | 적용 | 상태 |
|---|---|---|
| **추측 금지** (CLAUDE.md 금지1) | React Flow v12 연결 API를 설치된 타입 정의(`@xyflow/system@0.0.78`)로 직접 검증 후 plan 작성 | ✅ research.md에 시그니처 인용 |
| **TDD 규율** (CLAUDE.md §5) | 무방향 가드·이웃집합·어댑터 = 순수함수 RED→GREEN. 캔버스 결선은 dogfooding 게이트(jsdom 한계 명시) | ✅ data-model에 헬퍼 시그니처 |
| **Surgical Changes** (§3) | 보존된 BE·API·훅 무수정 재사용. 변경은 `PlotBoardCanvas`/`NodeCard`/`boardActions`/신규 `linkGraph`·`LinkEdge`에 집중 | ✅ Project Structure |
| **Simplicity First** (§2) | 무방향+이웃 하이라이트(별도 패널 없음)로 v1 최소. relation_type·온보딩·종류변경 비범위 | ✅ spec Out of Scope |
| **TS 코드 품질** (`typescript/code-quality.md`) | RSC 경계(`"use client"` 유지)·named export·`enum` 회피(ConnectionMode는 라이브러리 enum 사용 허용)·`pnpm build` RSC 검출 | ✅ Phase 1 |
| **FE/BE 배포 순서** | FE 단독(BE 무변경) → 배포 순서 무관 | ✅ |

**위반 없음** → Complexity Tracking 비움.

## Project Structure

### Documentation (this feature)

```text
specs/039-board-link-ui/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — React Flow v12 연결 API 검증
├── data-model.md        # Phase 1 — Link 엔티티(보존)·FE 어댑터·순수 헬퍼·UI 상태
├── quickstart.md        # Phase 1 — dogfooding 게이트 시나리오
├── contracts/
│   └── edges-api.md     # Phase 1 — 보존된 엣지 API 계약(재사용·신규 0) + FE 가드 정합
├── checklists/
│   └── requirements.md  # spec 품질 체크리스트(완료)
└── tasks.md             # /speckit-tasks 출력(본 명령 아님)
```

### Source Code (repository root)

```text
frontend/src/
├── components/board/
│   ├── PlotBoardCanvas.tsx      # [변경] 엣지 결선: useEdgesState·edges 렌더·ConnectionMode.Loose·
│   │                            #        nodesConnectable=true·onConnect·onConnectEnd(빈곳 drop)·
│   │                            #        onEdgesDelete·isValidConnection 가드·이웃 dim·잇기 모드 상태
│   ├── NodeCard.tsx             # [변경] Handle(source/target, hover/선택 시 노출)·잇기 버튼·이웃 dim className
│   ├── boardActions.ts          # [변경] 연결 액션 추가(startConnect 등 — 컨텍스트로 NodeCard→캔버스)
│   ├── nodeKinds.ts             # [무변경] DEFAULT_KIND='plot'(빈곳 drop 새 카드 종류)
│   ├── linkGraph.ts             # [신규] 순수 헬퍼: toRFEdge 어댑터·isPairLinked(무방향 중복)·
│   │                            #        isSelfLink·neighborNodeIds·연결된 edgeId 집합 — TDD 대상
│   ├── linkGraph.test.ts        # [신규] 순수 헬퍼 단위(RED→GREEN)
│   └── LinkEdge.tsx             # [신규] custom edge — 무방향(화살표 없음) + hover "연결 끊기" ✕
├── lib/query/useBoards.ts       # [변경(소)] useCreateEdge/useDeleteEdge onError용 detail 무효화(reseed) 추가
├── lib/api/boards.ts            # [무변경] createEdge/deleteEdge·BoardEdgeResponse(보존)
└── lib/electron-api/boards.ts   # [무변경] 위임(보존)
```

**Structure Decision**: 기존 `components/board/` 디렉토리에 집중. 무방향 의미·가드·이웃 계산을 `linkGraph.ts` 순수 헬퍼로 분리(테스트 가능·캔버스 결선과 독립). custom edge(`LinkEdge.tsx`)로 hover ✕ 끊기. 백엔드·FE API·훅 시그니처는 보존된 것을 재사용(소규모 onError 무효화만 추가).

## Complexity Tracking

> Constitution Check 위반 없음 — 비움.
