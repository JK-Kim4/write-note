# Implementation Plan: 보드 진입점·매핑·아이디어 보드 (트랙 C 코어)

**Branch**: `038-memo-plot-board` | **Date**: 2026-06-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/041-board-entry-points/spec.md`

> **설계 SoT**: [`docs/board/board-track-c-design.md`](../../docs/board/board-track-c-design.md) — 데이터 모델·API·마이그레이션 결정의 상위 근거. 본 plan은 그것을 구현 단위로 전개한다.

## Summary

보드↔작품/시리즈 매핑을 **dual-FK(`project_id`/`category_id`) → 다형 단일소유(`owner_type`/`owner_id`) + 1:N**으로 전환하고, 그 위에 **전역 보드 허브**(소속 라벨·클라 검색)·**아이디어 보드**(owner null)·**나중에 붙이기**(PATCH owner)·**전역 생성 picker**를 얹는다. 내부 탭·집필 참조는 후속. 기술 접근: V24 in-place 편집(보드 미배포) + 앱 레벨 owner 검증·대상 삭제 보존 훅 + `GET /boards/mine`(라벨 동봉, N+1 회피 일괄조회) + FE `/boards` 재설계. BE 선행 → FE 후행.

## Technical Context

**Language/Version**: BE Kotlin 2.2 / Spring Boot 4.0.6 (Java 24 toolchain) · FE TypeScript 5.9 / Next.js 16 (App Router) / React 19

**Primary Dependencies**: BE Spring Web·Security·Data JPA·Validation, Flyway · FE React Query(서버 상태)·Zustand(로컬 UI)·React Flow(@xyflow/react, 어댑터 안에서만)

**Storage**: PostgreSQL. ⚠️ BE 테스트 게이트는 **공유 로컬 Docker PG**(`localhost:5432/writenote`, Testcontainers 아님 — Track B 회고 §4-1) → 마이그레이션 in-place 편집 시 게이트 전 로컬 DB 정합 선처리 의무.

**Testing**: BE JUnit5 + AssertJ + MockK(단위) + Spring Boot Test(통합) · FE Vitest(단위, jsdom). 순수 로직 TDD(룰 §5), 캔버스 상호작용은 본 트랙 범위 밖.

**Target Platform**: 웹(Vercel FE / OCI BE). 본 트랙은 보드 도메인 — **develop·main 미배포**(Track B 실증).

**Project Type**: web (backend + frontend)

**Performance Goals**: 단일 사용자 규모. 허브 목록 N+1 회피(owner 라벨 일괄조회). 검색 클라 즉시 필터.

**Constraints**: 보드 트랙 누적(038), develop merge 보류. API 계약 변경 가능(미배포라 prod 위험 0). React Flow `node/edge`는 어댑터(PlotBoardCanvas·linkGraph·CardNode·LinkEdge) 안에서만.

**Scale/Scope**: BE 마이그레이션 1(in-place) + 엔드포인트 신규 1·변경 3·제거 2 + 에러코드 ±. FE `/boards` 1페이지 재설계 + 데이터계층 + picker 컴포넌트. 삭제 보존 훅(Project/Category 서비스).

## Constitution Check

`.specify/memory/constitution.md`는 빈 템플릿 → **프로젝트 `CLAUDE.md` 룰 준용**(Track A~B 동일). 적용 게이트:

- **추측 금지·단정 금지**(HARD-GATE) — 모델/마이그레이션/삭제 의미는 코드 실측 후 결선(research.md에 인용).
- **TDD 규율**(룰 §5) — owner 검증·라벨 파생·검색 필터 등 순수 로직 RED→GREEN. rename 아닌 신규 로직이므로 §5-5 예외 아님(실제 TDD).
- **Mock 경계**(Classist) — 내부 collaborator mock 금지, 시스템 경계(DB)만. owner 검증은 repository 상태로 검증.
- **유비쿼터스 언어**(Track B) — 어댑터 밖 `node/edge` 금지, 화면 폐기 문구 0(worksheet §5).
- **공용 fetch 분기 error.code 기준**(typescript/code-quality) — 보드 에러는 generic 경로 `error.code`.
- **배포 순서** — 코어 내 BE 선행 → FE 후행. 보드 미배포라 prod 위험 0.

게이트 위반 없음(Complexity Tracking 생략).

## Project Structure

### Documentation (this feature)

```text
specs/041-board-entry-points/
├── plan.md              # 본 파일
├── spec.md              # 요구사항·시나리오
├── research.md          # Phase 0 — 결정·근거(실측 인용)
├── data-model.md        # Phase 1 — boards owner 스키마·엔티티·DTO
├── contracts/
│   └── board-api.md     # Phase 1 — 엔드포인트 계약(변경/신규/제거)
├── quickstart.md        # Phase 1 — 로컬 리셋·게이트·dogfooding 체크리스트
└── tasks.md             # Phase 2 — /speckit-tasks 산출(본 명령 아님)
```

### Source Code (repository root)

```text
backend/src/main/kotlin/com/writenote/
├── entity/Board.kt                         # categoryId/projectId → ownerType/ownerId
├── repository/BoardRepository.kt           # 매핑충돌용 finder 제거, owner 기준 finder
├── service/BoardService.kt                 # owner 검증 통합, 매핑충돌 409 제거, 라벨 파생, GET mine
├── service/ProjectService.kt               # 작품 삭제 시 보드 owner null 강등 훅
├── service/CategoryService.kt              # 시리즈 삭제 시 보드 owner null 강등 훅
├── controller/BoardController.kt           # GET /mine 신규, PATCH owner 통합, PUT 2 제거, GET 필터 owner화
├── model/request/BoardRequests.kt          # CreateBoardRequest owner, PatchBoardRequest
├── model/response/BoardResponses.kt        # ownerType/ownerId/ownerLabel
├── enums/AuthErrorCode.kt                  # BOARD_*_ALREADY_MAPPED 제거, BOARD_OWNER_INVALID 추가
└── resources/db/migration/V24__create_plot_boards.sql   # in-place: boards owner 컬럼

backend/src/test/kotlin/com/writenote/
├── service/BoardServiceTest.kt             # owner 검증·1:N·라벨·삭제보존 단위
└── controller/BoardControllerIT.kt         # GET mine·POST owner·PATCH owner·1:N·삭제보존 통합

frontend/src/
├── lib/api/boards.ts                       # BoardSummary/Response owner*, GET mine, createBoard owner, patchBoard
├── lib/electron-api/boards.ts              # shim 정합
├── lib/query/useBoards.ts                  # useBoardsMine, usePatchBoard, set* 제거
├── app/(main)/boards/page.tsx              # 전역 허브 재설계(라벨 칩·검색·picker·나중에 붙이기)
├── components/board/BoardOwnerPicker.tsx   # 신규 — "이 보드는 어디에 쓸 건가요?" 모달
└── components/board/BoardMappingControl.tsx # 제거(picker로 대체)
```

**Structure Decision**: 기존 web 구조(backend + frontend) 그대로. 보드 도메인 파일만 변경 + picker 신규 + BoardMappingControl 제거. 삭제 보존 훅은 Project/Category 서비스에 BoardRepository 주입(단방향 유지).

## Phase 0 / 1 산출

- **research.md** — 모델 B·owner 값·in-place 마이그레이션·삭제 보존 훅·검색 클라·N+1 회피·RF 어댑터 경계 결정과 실측 근거.
- **data-model.md** — `boards` owner 스키마(CHECK·인덱스), 엔티티/repo/DTO 변경, 라벨 파생.
- **contracts/board-api.md** — 엔드포인트 계약(신규/변경/제거)·요청/응답·에러코드.
- **quickstart.md** — 로컬 DB 리셋 절차·게이트 명령·dogfooding 체크리스트 6항.

## Complexity Tracking

위반 없음 — 생략.
