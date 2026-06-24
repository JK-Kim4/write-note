# Implementation Plan: 플롯 보드 (Plot Board)

**Branch**: `038-memo-plot-board` | **Date**: 2026-06-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/038-memo-plot-board/spec.md`

## Summary

작가가 작품/시리즈와 **무관하게 독립 생성**하는 플롯 보드를 도입한다. 보드는 무한 캔버스 위에 **보드 전용 노드**(기존 캡처 메모와 별개 신규 객체)를 만들어 드래그 배치하고, 노드 간 **방향 연결(엣지)**로 플롯 구조를 표현하며, 노드 위치·본문·연결·뷰포트를 **영속/복원**한다. 보드는 선택적으로 **시리즈(Category, 0~1)·작품(Project, 0~1)** 에 매핑한다(양방향 0~1:0~1).

기술 접근: 신규 백엔드 도메인(boards/board_nodes/board_edges, Flyway **V24**) + 사용자 소유 CRUD(기존 `Result` envelope·`@AuthenticationPrincipal`·`findByIdAndUserId` 패턴 재사용) → 프론트는 **`@xyflow/react`(React Flow v12)** 클라이언트 전용 캔버스로 하이드레이션·드래그종료 저장·뷰포트 디바운스 저장·낙관적 업데이트(React Query `onMutate`/`onError` 롤백)를 구현. 배포는 **BE 선행 → FE 후행**(FE 가 새 계약을 BE 로 보내므로).

## Technical Context

**Language/Version**: Backend Kotlin 2.2 / Spring Boot 4.0.6 (Java 24 toolchain) · Frontend TypeScript 5.9 / Next.js 16.2.6 (App Router) / React 19.2.4

**Primary Dependencies**: Spring Web·Security·Data JPA·Validation / React Query·Zustand / **신규 `@xyflow/react` v12 (React Flow)**

**Storage**: PostgreSQL (Flyway). 신규 마이그레이션 **V24** (실제 최신 = V23 수치 확인). 신규 테이블 3개(boards / board_nodes / board_edges). 기존 테이블 변경 0.

**Testing**: Backend JUnit5 + AssertJ + MockK + Testcontainers(통합) / Frontend Vitest + RTL. TDD(CLAUDE.md §5) 준수.

**Target Platform**: 웹 — FE Vercel(soseolbi.com), BE OCI Docker. 인증 화면(authed) 영역이라 prod authed 검증 한계(CLAUDE.md §19) 적용.

**Project Type**: Web application (backend + frontend).

**Performance Goals**: 한 보드 노드 ~300개에서 열기·드래그·줌 끊김 없음(React Flow `onlyRenderVisibleElements`). 드래그 중 BE 저장 0회(드래그 종료 시점만). 뷰포트는 조작 종료 후 디바운스 1회.

**Constraints**: 모든 변경 낙관적 반영 + 실패 시 직전 상태 롤백. 위치 저장 = `onNodeDragStop` 만(드래그 중 미저장). 노드/보드는 본인 소유만(타 사용자 차단). 캡처 메모 도메인 0 영향.

**Scale/Scope**: 단일 사용자/보드(v1). 신규 endpoint ~12개, 신규 엔티티 3개, FE 신규 라우트 1개(`/boards`) + 보드 캔버스 컴포넌트군.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` 는 **빈 템플릿** → 프로젝트 `CLAUDE.md` + `.claude/rules/**` 룰을 헌법으로 준용(036/037 선례 정합). 적용 게이트:

- **추측 금지 / 단정 금지 (HARD-GATE)**: 캔버스 라이브러리·메모 구조·시리즈 구조를 spec/plan 단계에서 실제 코드·공식 문서로 검증 완료(Phase 0 research 참조). ✅
- **TDD §5 (Red-Green-Refactor)**: 백엔드 서비스·컨트롤러, 프론트 매핑/상태전이는 실패 테스트 선행. Mock 은 시스템 경계(HTTP·DB)만, 내부 collaborator mock 금지. ✅ 계획됨
- **Simplicity §2 / Surgical §3**: 신규 도메인만 추가, 기존 메모/시리즈/작품 도메인 무변경. 투기적 추상화 없음(N:M 공유·undo·노드유형 등 v1 제외). ✅
- **external-infra-safety**: 마이그레이션 SQL **작성**만(적용은 사용자 컨펌). 로컬 dev DB 적용·운영 쓰기 금지. subagent 위임 시 인프라 쓰기 금지 명시 + 완료 후 실제 상태 확인(§13). ✅
- **TS code-quality (409 분기)**: 신규 409 코드(매핑 충돌·엣지 중복)는 `client.ts` 에서 **error.code 기준 분기**(status 단독 금지) — 기존 409 코드 grep 정합. ✅
- **RSC 경계**: 캔버스/폼 컴포넌트 `'use client'` 의무, 작성 직후 `pnpm build` 로 검출. ✅
- **agent-workflow-discipline §4·§6**: subagent dispatch 체크리스트(verbose cap·tool_uses cap·ktlintFormat main+test·`pnpm build`) 적용, tasks 진입 전 파일/endpoint grep. ✅

위반 없음 → PASS. Complexity Tracking 불필요.

## Project Structure

### Documentation (this feature)

```text
specs/038-memo-plot-board/
├── plan.md              # This file
├── spec.md              # Feature spec (완료)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── rest-api.md      # Phase 1 output (REST 계약)
├── checklists/
│   └── requirements.md  # spec 품질 체크리스트(완료)
└── tasks.md             # /speckit-tasks 출력(본 명령 미생성)
```

### Source Code (repository root)

```text
backend/src/main/kotlin/com/writenote/
├── entity/                 # Board.kt, BoardNode.kt, BoardEdge.kt (신규)
├── repository/             # BoardRepository, BoardNodeRepository, BoardEdgeRepository (신규)
├── service/                # BoardService (신규) — 소유권·매핑 0~1 강제·엣지 검증
├── controller/             # BoardController (신규) — /api/boards/**
├── model/request|response/ # Create/Update/...Request, Board(Detail)/Node/Edge Response (신규)
├── enums/                  # BoardErrorCode (신규) — 매핑충돌·엣지중복·검증 (AuthErrorCode 스타일)
├── error/                  # BoardException + GlobalExceptionHandler 분기 추가
└── resources/db/migration/ # V24__create_plot_boards.sql (신규)

backend/src/test/kotlin/com/writenote/  # BoardServiceTest(단위) + BoardControllerIT(Testcontainers)

frontend/src/
├── app/(main)/boards/      # page.tsx (보드 목록) + [boardId]/page.tsx (캔버스) (신규, 'use client')
├── components/board/       # PlotBoardCanvas(dynamic ssr:false), NodeCard, BacklinkPanel, BoardList, BoardMappingControl (신규)
├── lib/query/              # useBoards.ts (신규) — useQuery/useMutation + 낙관적 업데이트
└── lib/api/                # client.ts 의 boards.* 호출 + 신규 409 error.code 분기
```

**Structure Decision**: 기존 web application 구조(backend Kotlin/Spring + frontend Next.js)에 **신규 독립 도메인**을 더한다. 기존 메모(`memos`)·시리즈(`categories`)·작품(`projects`) 코드는 **읽기 참조(매핑 FK)만** 하고 수정하지 않는다. 캔버스는 `(main)` 라우트 그룹(인증 가드 `useAuthGuard("requireAuth")`) 아래 신규 `/boards` 경로.

## 라운드 분해 (배포 단위)

신규 계약이라 충돌 없음 — 백엔드를 먼저 전체 완성(GREEN)한 뒤 프론트를 US 우선순위로 얹는다.

| 라운드 | 범위 | 대응 US | 배포 |
|---|---|---|---|
| **R1 (BE 전체)** | V24 마이그레이션 + 엔티티/리포지토리/서비스/컨트롤러 + 보드 CRUD·매핑(0~1 강제)·노드 CRUD·배치 PATCH·뷰포트·엣지 CRUD + 소유권·검증 + 에러코드 + 테스트(단위+IT) GREEN | US1·2·3 백엔드 | BE 선행 |
| **R2 (FE — P1)** | `@xyflow/react` 도입 + `/boards` 목록·캔버스 라우트 + 노드 생성/편집/드래그(배치 저장)/뷰포트 디바운스 + 하이드레이션 + 낙관적·롤백 | US1 | FE 후행 |
| **R3 (FE — P2)** | 엣지 그리기/삭제 + 백링크 패널(들어오는/나가는) | US2 | FE |
| **R4 (FE — P3)** | 작품/시리즈 매핑·해제 UI + 보드 이름변경·삭제 + library/시리즈에서 보드 진입점 | US3 | FE |

배포 순서 근거(CLAUDE.md): FE 가 새 계약(보드/노드/엣지/매핑 payload)을 BE 로 **보내므로 BE 선행**. R1 은 GREEN 후 사용자 컨펌 시 OCI blue-green 배포(authed 영역 → §19 한계 명시).

## Complexity Tracking

위반 없음 — 비움.
