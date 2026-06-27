# Quickstart: 플롯 보드 (개발/검증 절차)

## 전제

- 로컬 dogfooding 은 **DB + 백엔드 + 프론트 3개 동시 기동** 필요(메모리 [[local-dogfooding-needs-backend]]).
  1. `docker compose up -d --wait postgres`
  2. `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'`
  3. `cd frontend && pnpm dev` → http://localhost:3000 (포트 점유 시 자동 승격 — 실제 바인딩 포트 확인 §20)

## R1 백엔드 검증 (BE 선행)

- 마이그레이션: `V24__create_plot_boards.sql` **작성만**. 로컬 dev DB 적용·운영 적용은 **사용자 컨펌 필수**(external-infra-safety). 검증은 Testcontainers(IT)로.
- 테스트: `cd backend && ./gradlew test`
- 전체 게이트: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`
- TDD 순서: BoardServiceTest(소유권·매핑 0~1·엣지 검증) → BoardControllerIT(엔드포인트 계약·에러코드) 실패 선작성 → 최소 구현 → GREEN.
- 계약 스모크(인증 토큰 필요):
  - `POST /api/boards {name:"테스트"}` → 201, projectId/categoryId null
  - `PUT /api/boards/{id}/project {projectId: X}` → 200, 같은 X 에 다른 보드 매핑 시 409 `BOARD_PROJECT_ALREADY_MAPPED`
  - `POST .../nodes`, `PATCH .../nodes`(배치), `POST .../edges`(중복 409 / 자기연결 400)

## R2~R4 프론트 검증 (FE 후행)

- 의존 추가: `cd frontend && pnpm add @xyflow/react` — 설치 시 React 19 peerDeps 경고 여부 확인(research R0).
- 게이트: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
  - **`pnpm build` 필수**: 캔버스/폼 `'use client'` + dynamic `ssr:false` RSC 경계는 build 에서만 검출(code-quality §RSC).
- 라우트 제거/이동이 있으면 typecheck 전 `rm -rf .next`(code-quality §라우트 캐시).

## dogfooding 게이트 (authed — §19 prod 검증 한계)

US 슬라이스별 실제 화면 확인(로그인 후 `/boards`):

- **R2(US1)**: 빈 보드 생성 → 노드 만들고 본문 입력 → 드래그 이동(손 뗄 때 저장) → 다중선택 일괄 이동 → 줌/팬 → **재진입 시 위치·본문·뷰포트 100% 복원**(SC-001). 드래그 중 네트워크 탭에 저장 호출 0회(SC-002).
- **R3(US2)**: 두 노드 연결 → 노드 선택 시 들어오는/나가는 연결 표시 → 연결 삭제 → 노드 삭제 시 걸린 엣지 사라짐 → 재진입 복원(SC-004).
- **R4(US3)**: 독립 보드를 작품에 매핑 → 그 작품에서 보드 보임 → 해제 시 작품에서 사라지되 보드 잔존(SC-005) → 이미 매핑된 작품에 다른 보드 매핑 시 거부(409) → 보드 삭제 후 **쪽지 책상 캡처 메모 그대로**(SC-007).
- 성능: 노드 ~300개 보드에서 열기·드래그·줌 끊김 없음(SC-003).

## 저장 타이밍 체크리스트(회귀 예방)

- 노드 위치 = `onNodeDragStop` 에서만 배치 PATCH(드래그 중 X).
- 뷰포트 = `onViewportChange` 디바운스(500ms~1s) 후 1회.
- 모든 변경 낙관적 반영 + 실패 시 롤백 + 실패 노출(FR-014).
- 신규 409 는 `client.ts` 에서 error.code 분기(기존 409 분기 무회귀).
