# Phase 0 Research: 플롯 보드

본 기능의 불확실 영역을 실제 코드·공식 문서로 해소한 기록(추측 금지 HARD-GATE).

## R0. 캔버스(노드 UI) 라이브러리 선택

- **Decision**: `@xyflow/react` (React Flow **v12**) 를 클라이언트 전용으로 도입. `import('@/components/board/PlotBoardCanvas')` 를 `next/dynamic` + `{ ssr: false }` 로 lazy load, 컴포넌트는 `'use client'`, `@xyflow/react/dist/style.css` import.
- **Rationale**: 공식 문서(context7 `/websites/reactflow_dev`) 확인 — 무한 캔버스·줌·팬·드래그·연결(handle)·다중선택을 기본 제공. 본 기능 요구와 1:1 매핑되는 API 존재:
  - 드래그 종료 저장: `onNodeDragStop` (FR-008). 드래그 중 미저장 = onChange 는 내부 상태만 갱신.
  - 제어 뷰포트: `viewport` prop + `onViewportChange` (FR-012, 디바운스 저장).
  - 대량 노드 성능: `onlyRenderVisibleElements` (SC-003, ~300 노드).
  - 연결: handle 에서 드래그로 `onConnect` (FR-017), 자기연결/중복은 앱에서 차단(FR-019·013).
  - 라이트/다크: `colorMode="system"`.
  - v12 는 SSR/SSG 지원(노드 width/height/handles 정의 시)이나 본 기능은 **클라이언트 전용 렌더**로 SSR 회피가 더 단순·안전.
- **검증 잔여(설치 시 확정)**: v12 `peerDependencies` 의 React 19 허용 여부를 `pnpm add @xyflow/react` 시 확인(경고 시 버전 핀 검토). 클라이언트 전용 렌더라 Next 16 RSC 경계 위험은 `'use client'` + dynamic `ssr:false` 로 차단, 작성 직후 `pnpm build` 로 검출(code-quality §RSC).
- **Alternatives considered**:
  - 자체 캔버스 구현 — 줌/팬/히트테스트/엣지 라우팅을 직접 만들어야 해 비용 과다, YAGNI 위반.
  - `@dnd-kit`(이미 사용, 032 시리즈 드래그) — 자유좌표 캔버스·줌/팬·엣지 미지원(리스트/그리드 DnD 전용). 부적합.
  - React Flow v11(`reactflow`) — 구 패키지명, v12 가 현행. 신규 도입은 v12.

## R1. 보드↔작품/시리즈 매핑 0~1:0~1 강제 방법

- **Decision**: `boards.project_id`·`boards.category_id` 를 nullable FK 로 두고, **부분 유니크 인덱스**로 대상당 보드 1개를 DB 레벨에서 보장: `CREATE UNIQUE INDEX ... ON boards(project_id) WHERE project_id IS NOT NULL` (시리즈도 동일). 매핑/해제는 set/clear PUT 으로, 충돌 시 409.
- **Rationale**: 032 의 `projects.category_id`(nullable FK, ON DELETE SET NULL) 패턴과 정합. 부분 유니크 인덱스는 "미매핑 다수 허용 + 매핑 대상당 1개" 를 정확히 표현. FK `ON DELETE SET NULL` 이 FR-027(대상 삭제 시 보드 보존·매핑만 해제)을 DB 레벨로 충족.
- **Alternatives**: 별도 매핑 조인 테이블 — 0~1:0~1 에는 과설계(조인 불필요). 앱 레벨 검사만 — 동시성 경합 시 중복 매핑 위험, DB 제약이 안전.

## R2. 노드 위치 영속 / 배치 저장 / 뷰포트 디바운스

- **Decision**: 위치/겹침순서를 `board_nodes` 행에 직접 저장(노드↔보드 1:N). 드래그 종료 시 변경 노드들을 **배치 PATCH 1회**(`PATCH /api/boards/{id}/nodes`, body 배열). 뷰포트는 `onViewportChange` → 500ms~1s 디바운스 → `PATCH /api/boards/{id}/viewport` 1회. 본문 편집은 단건 `PATCH .../nodes/{nodeId}`.
- **Rationale**: spec FR-007·009·010·012 직접 충족. 다중선택 일괄 이동을 단건 N회가 아닌 배치 1회로(PRD §7 원칙). 좌표는 캔버스 절대좌표(double, 음수·소수 허용).
- **Alternatives**: 드래그 중 스트리밍 저장 — 불필요한 쓰기 폭증(SC-002 위반). 노드 단건 N회 — 일괄 이동 시 N 라운드트립.

## R3. 낙관적 업데이트 / 실패 롤백 패턴

- **Decision**: React Query `useMutation` 의 `onMutate`(캐시 즉시 갱신 + 이전값 스냅샷) → `onError`(스냅샷 복원) → `onSettled`/`onSuccess`(invalidate) 패턴 재사용. 보드 상세 캐시 키 `boardKeys.detail(boardId)`.
- **Rationale**: 기존 `useMoveProjectCategory`(`frontend/src/lib/query/useCategories.ts`) 의 onMutate/onError 롤백과 동일 컨벤션 → 학습비용 0, 일관성. FR-014(낙관적+롤백+실패 노출) 충족.
- **Alternatives**: 매 변경 invalidate-only — 드래그 후 깜빡임/지연. 비낙관적 — 즉시성 저하.

## R4. 에러코드 / 409 분기

- **Decision**: 신규 `BoardErrorCode` enum(`AuthErrorCode` 스타일 = `httpStatus` + `defaultMessage`) + `BoardException` + `GlobalExceptionHandler` 분기. 코드:
  - `BOARD_NOT_FOUND` (404), `BOARD_NODE_NOT_FOUND` (404), `BOARD_EDGE_NOT_FOUND` (404)
  - `BOARD_PROJECT_ALREADY_MAPPED` (409), `BOARD_CATEGORY_ALREADY_MAPPED` (409) — 대상에 이미 보드 매핑됨
  - `BOARD_EDGE_DUPLICATE` (409) — 같은 방향 동일 쌍
  - `BOARD_EDGE_INVALID` (400) — 자기연결 / 다른 보드 노드 / 노드 부재
- **Rationale**: 기존 409 코드(`DOCUMENT_VERSION_CONFLICT`·`EMAIL_ALREADY_REGISTERED`·`KAKAO_ALREADY_LINKED`·`LAST_CHAPTER_UNDELETABLE`·`NICKNAME_ALREADY_REGISTERED`) 와 **구분되는 코드 문자열** 필요 — `client.ts` 가 409 를 error.code 로 분기(code-quality HARD-GATE, 006 회귀 예방). 소유권 위반은 기존 패턴(404 은닉 또는 403)으로.
- **Alternatives**: 기존 `AuthErrorCode` 에 추가 — 보드는 인증 도메인 아님, 의미 혼선. 제네릭 `CONFLICT` 단일 — 409 분기 불가(회귀 위험).

## R5. 소유권 / 인증

- **Decision**: `@AuthenticationPrincipal AuthenticatedPrincipal` 에서 `userId` 추출 → `BoardService` 가 `findByIdAndUserId` 로 소유 보드만 조회, 노드/엣지는 그 보드 경유로 소유 검증. 미소유 접근은 NOT_FOUND 은닉.
- **Rationale**: `CategoryController`/`CategoryService` 의 `requireOwnedCategory(userId, id)` 패턴과 동일(존재 노출 최소화). FR-002·FR-005 충족.
- **Alternatives**: 컨트롤러에서 소유 검증 — 서비스 계층 일원화가 기존 컨벤션.

## R6. 캡처 메모 도메인과의 독립성 확인

- **Decision**: 본 기능은 `memos`/`memo_projects`/`memo_project_characters` 를 **읽지도 쓰지도 않는다**. 노드는 별도 `board_nodes` 테이블.
- **Rationale**: 사용자 확정(노드=보드 전용 신규 객체). SC-007(캡처 메모 0 영향)·노드 제거≠메모 삭제(FR-016) 를 도메인 분리로 구조적으로 보장.
- **Alternatives**: 메모 참조형 노드 — 사용자가 명시적으로 배제(별개 객체).

## 미해소(NEEDS CLARIFICATION) 잔여

없음 — spec 의 모든 결정이 확정되었고, 위 R0~R6 으로 기술 불확실성 해소.
