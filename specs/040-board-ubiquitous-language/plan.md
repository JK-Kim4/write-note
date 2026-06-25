# Implementation Plan: 보드 유비쿼터스 언어 정리 (node/edge → Card/Link)

**Branch**: `038-memo-plot-board` (트랙 B, 새 브랜치 미생성) | **Date**: 2026-06-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/040-board-ubiquitous-language/spec.md` + 영향범위 SoT `docs/board/board-track-b-impact-survey.md`

## Summary

보드 도메인의 `node/edge/board_nodes/board_edges` 를 PRD §0 유비쿼터스 언어 `Card/Link/cards/links` 로 **전면 rename**한다. 순수 리팩토링(동작 변화 0). 접근: ① BE 선행(마이그레이션 V24~26 in-place 편집 + 엔티티/repo/service/DTO/controller/에러코드/테스트) → 게이트 GREEN → 로컬 DB 리셋·재마이그레이션(컨펌) → ② FE 후행(데이터 계층 + 어댑터 내부 도메인 식별자, RF API 보존) → 게이트 GREEN → ③ 검증(회귀 grep + dogfooding 전항). 보드 미배포라 API 계약 변경에도 prod 위험 0(원자적 동반 merge).

## Technical Context

**Language/Version**: Kotlin 2.2 / Spring Boot 4.0.6 on Java 24 (BE) · TypeScript 5.9 / Next.js 16 / React 19 (FE)

**Primary Dependencies**: Spring Data JPA · Flyway (BE) · React Query · Zustand · React Flow `@xyflow/react` v12 (FE)

**Storage**: PostgreSQL — board 테이블 3개(`boards` 불변 / `board_nodes`→`cards` / `board_edges`→`links`). Flyway 마이그레이션 V24·V25·V26 **in-place 편집**.

**Testing**: JUnit5 + AssertJ + Testcontainers(BE `BoardServiceTest`/`BoardControllerIT`) · Vitest(FE `linkGraph.test.ts`/`useBoards.test.tsx`). 캔버스 제스처는 jsdom 미검증 → dogfooding 게이트.

**Target Platform**: 웹(Vercel FE + OCI BE). 보드는 미배포(develop·main에 V24~26 없음 — 실측).

**Project Type**: web (backend + frontend monorepo)

**Performance Goals**: N/A(동작·성능 불변이 목표 — rename)

**Constraints**: 동작 보존(트랙 A 회귀 0) · 어댑터 경계(RF node/edge는 어댑터 안에서만) · 화면/도메인 코드 node/edge·메모 잔재 0

**Scale/Scope**: BE 12파일(엔티티2·repo2·service1·controller1·DTO2·에러코드1·마이그레이션3) + FE 9파일(api·electron-api·query·query.test·components/board 6) + 문서. 신규 기능 0.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` = 빈 템플릿(미작성). 따라서 **CLAUDE.md + `.claude/rules/` 룰 준용**(트랙 A와 동일 정책):

- **TDD(룰 §5)**: rename은 §5-5 예외(시그니처 조정·테스트 파일 수정·리네임)에 해당 — 기존 테스트를 rename에 맞춰 동기하되, **순수 신규 로직 0**이라 RED→GREEN 신규 사이클 불필요. 기존 테스트가 동작 보존의 회귀 게이트.
- **surgical changes(글로벌 §3)**: rename 외 동작·로직 변경 금지. 어댑터 구조 리팩토링 안 함(룰 §15).
- **외부 인프라 안전(external-infra-safety)**: 로컬 DB drop/repair는 쓰기 → **사용자 컨펌 후** 실행. prod 무접촉.
- **에이전트 규율(agent-workflow-discipline)**: §6(tasks.md 식별자 implement 직전 grep) · §7(subagent 자기진단 무검증 수용 금지) · §24(structured 입력) · §25(dogfooding 전항 확인) 적용.

**판정: PASS**(위반 없음 — Complexity Tracking 불필요).

## Project Structure

### Documentation (this feature)

```text
specs/040-board-ubiquitous-language/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 결정 근거(마이그레이션 in-place·어댑터 split·rename 순서)
├── data-model.md        # Phase 1 — Card/Link 엔티티·컬럼 맵·마이그레이션 DDL
├── quickstart.md        # Phase 1 — 회귀 grep·로컬 DB 리셋·dogfooding 전항
├── contracts/
│   └── board-api.md     # Phase 1 — rename된 endpoint 계약(/cards·/links)
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root) — 변경 대상

```text
backend/src/main/kotlin/com/writenote/
├── entity/BoardNode.kt          → Card.kt   (class BoardNode→Card, @Table cards)
├── entity/BoardEdge.kt          → Link.kt   (class BoardEdge→Link, @Table links, source_card_id/target_card_id)
├── repository/BoardNodeRepository.kt → CardRepository.kt
├── repository/BoardEdgeRepository.kt → LinkRepository.kt
├── service/BoardService.kt      (메서드·내부헬퍼·DTO 참조 rename)
├── controller/BoardController.kt (endpoint /cards·/links, path var cardId/linkId)
├── model/request/BoardRequests.kt  (CreateCardRequest·UpdateCardRequest·BatchCardPositionItem·CreateLinkRequest)
├── model/response/BoardResponses.kt (CardResponse·LinkResponse·BoardDetailResponse.cards/.links·BoardSummary.cardCount)
└── enums/AuthErrorCode.kt       (BOARD_LINK_INVALID·BOARD_LINK_DUPLICATE, 메시지 노드→카드)
backend/src/main/resources/db/migration/
├── V24__create_plot_boards.sql  (in-place: cards/links + source_card_id/target_card_id + 제약·인덱스명)
├── V25__add_board_node_type.sql (in-place: ALTER TABLE cards … ; 파일명도 의미 정합 검토)
└── V26__add_board_edge_handles.sql (in-place: ALTER TABLE links …)
backend/src/test/kotlin/com/writenote/
├── service/BoardServiceTest.kt  (식별자·DTO·에러코드 동기)
└── controller/BoardControllerIT.kt (endpoint·DTO·에러코드 동기)

frontend/src/
├── lib/api/boards.ts            (타입·함수·endpoint rename)
├── lib/electron-api/boards.ts   (shim 함수 rename)
├── lib/query/useBoards.ts (+ .test.tsx) (훅 rename)
└── components/board/
    ├── nodeKinds.ts             → cardKinds.ts
    ├── NodeCard.tsx             → CardNode.tsx
    ├── LinkEdge.tsx             (유지 — Link-led)
    ├── linkGraph.ts (+ .test.ts) (neighborCardIds·incidentLinkIds·toRFEdge 인자타입)
    ├── boardActions.ts          (스토어 식별자)
    └── PlotBoardCanvas.tsx      (도메인 참조 rename, RF API 보존)
```

**불변(변경 금지)**: `entity/Board.kt`·`repository/BoardRepository.kt`·`BoardController` base `/api/boards`·`boards` 테이블·`boards.category_id/project_id`·매핑 에러코드(`BOARD_PROJECT_ALREADY_MAPPED`·`BOARD_CATEGORY_ALREADY_MAPPED`)·`components/board/BoardMappingControl.tsx`·`app/(main)/boards/*`(node/edge 무관)·카드 종류 값 문자열(plot/character/place/theme/note).

**Structure Decision**: 기존 monorepo(backend/ + frontend/) 구조 유지. 신규 디렉토리 0. rename만.

## Complexity Tracking

> Constitution Check PASS — 위반 없음. 본 섹션 불필요.
