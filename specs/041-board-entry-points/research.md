# Research — 보드 트랙 C 코어

> brainstorming(설계 doc `docs/board/board-track-c-design.md`)에서 확정된 결정의 근거·실측·대안. 모든 결정은 코드/문서 실측으로 그라운딩(추측 금지 HARD-GATE).

## R1. 매핑 데이터 모델 = owner_type/owner_id 다형 단일소유 + 1:N

- **결정**: `boards.category_id`·`project_id` 두 FK 컬럼 → `owner_type VARCHAR(16)`(`'project'`/`'category'`/`null`) + `owner_id BIGINT` 한 쌍. 부분 유니크 인덱스 제거(1:N).
- **근거**: PRD §4(Board↔주체 1:N 확정)·§7(owner_type/owner_id 제안). 사용자 brainstorming 선택 = B(PRD 정석). 현 코드 실측: `V24__create_plot_boards.sql`에 `uq_boards_project`/`uq_boards_category` 부분 유니크(대상당 ≤1) + `BoardService.requireMappableProject/Category`의 409 → 1:N과 정면 배치였음.
- **대안**: (A) 현 dual-FK 유지 + 인덱스만 DROP(1:N) — DB FK 무결성 유지·마이그레이션 최소. (C) 무변경(≤1). 사용자가 PRD 정석(B) 선택.
- **트레이드오프(수용)**: 다형이라 진짜 FK 불가 → DB 무결성·대상 삭제 보존을 앱 레벨로 대체(R3).

## R2. owner_type 값 = `'project'` / `'category'`

- **결정**: 내부 값은 `'project'`(작품)·`'category'`(시리즈). 화면 비노출(UI는 "이 작품/시리즈 전체/아이디어").
- **근거**: 코드베이스 일관성 — 기존 엔티티 `Project`/`Category`, 테이블 `projects`/`categories`, 컬럼 `project_id`/`category_id`. PRD 문구는 work/series지만 내부값이라 코드 정합 우선. owner_type='project'→projects, 'category'→categories 로 라벨 resolver 단순.

## R3. 대상 삭제 시 보드 보존 = 앱 레벨 훅 (실측 확정)

- **결정**: 작품/시리즈 **hard delete** 시 그 대상 소유 보드의 owner를 null로 강등(아이디어 보존, PRD §5.3). `ProjectService.deleteProject`·`CategoryService.delete`에 `BoardRepository` 주입 + owner null 일괄 UPDATE(같은 @Transactional).
- **실측 근거**:
  - `ProjectService.deleteProject`(L236): `projectRepository.delete(project)` = **hard delete**(별도 archive=soft `archiveProject`/`unarchiveProject` 존재). DELETE /api/projects/{id}.
  - `CategoryService.delete`(L134): `categoryRepository.delete(category)` = **hard delete**. 주석 "소속 작품은 DB FK ON DELETE SET NULL로 미분류"(projects.category_id FK는 유지).
  - 현 boards는 `fk_boards_project`/`fk_boards_category` **ON DELETE SET NULL** 로 대상 삭제 시 자동 미매핑 → 다형 전환으로 이 자동성 상실 → 훅으로 대체.
- **구현**: `boardRepository` 에 `@Modifying @Query("UPDATE Board b SET b.ownerType=null, b.ownerId=null WHERE b.ownerType=:type AND b.ownerId=:id")` 류. boards를 로드하지 않고 일괄 처리(소량이라 무해, N 회피). 삭제 전/후 순서 무관(FK 없음).
- **단방향 유지**: Project/Category 서비스가 `BoardRepository`(같은 레이어) 주입 — Controller→Service→Repository 단방향. cross-service 호출 회피.
- **soft(archive)는 무처리**: 작품 보관(archive)은 대상이 살아있으므로 owner 유지(보드는 보관 작품에 계속 소속). 강등은 hard delete만.

## R4. 검색 = 클라이언트 필터

- **결정**: `GET /boards/mine`이 소속 라벨 포함 전체 보드 반환 → FE가 검색어로 즉시 필터(작품명·시리즈명·보드명 OR, 아이디어 보드는 보드명). 서버 `?q=` 미도입.
- **근거**: 사용자 brainstorming 선택. 단일 사용자·보드 소량 → 클라 필터 간단·즉각, 검색 엔드포인트 0. PRD §10의 `?q=`는 보드 대량 시 확장 옵션(현 불요).

## R5. 전역 허브 라벨 파생 N+1 회피

- **결정**: `GET /boards/mine` 응답에 `ownerLabel`(작품 title / 시리즈 name / "아이디어") 동봉. 보드 목록의 owner_id를 종류별로 모아 **일괄 조회**(`projectRepository.findAllById`/`categoryRepository.findAllById`) 후 id→name map으로 라벨 매핑.
- **근거**: 기존 패턴 실측 — `ProjectService.categoriesByProjects`(L251)가 `categoryIds.distinct()` + `findAllById` + `associateBy`로 N+1 회피. `ProjectService.listCards`도 categoryById 일괄. 동형 적용.

## R6. 마이그레이션 = V24 in-place 편집 + 로컬 리셋

- **결정**: `V24__create_plot_boards.sql`의 boards 블록을 in-place 편집(owner 컬럼·CHECK·인덱스). cards/links 및 V25/V26 불변. 게이트 전 로컬 dev DB 리셋(board 3테이블 drop + flyway_schema_history V24·V25·V26 행 삭제 + 재마이그레이션).
- **근거**: 보드 V24~26 **develop·main 미배포**(Track B `git ls-tree` 실증·회고). Track B가 in-place 편집 선례. BE 게이트는 공유 로컬 Docker PG(Testcontainers 아님, Track B 회고 §4-1) → 편집 마이그레이션은 체크섬 불일치로 컨텍스트 로드 자체 실패 → 게이트 전 리셋이 선행조건. **로컬 DB 쓰기 = 사용자 컨펌 후 실행**(external-infra-safety §1).
- **대안**: 신규 V27 ALTER — 미배포라 누적 불필요. in-place가 깔끔.

## R7. React Flow 어댑터 경계 보존

- **결정**: 본 트랙은 목록·매핑·생성(캔버스 무관)이라 RF 미접촉. `node/edge` 용어는 어댑터(PlotBoardCanvas·linkGraph·CardNode·LinkEdge) 안에서만(Track B 정합). 새 picker·허브 코드는 도메인 용어(Board/Card/소속)만.
- **근거**: Track B 확립 경계. 회귀 grep으로 어댑터 밖 node/edge 0 검증.

## R8. FE 영향 범위 (실측)

- `useBoardList`/`BoardMappingControl`/`useSetBoardProject`/`useSetBoardCategory` = **전부 `/boards/page.tsx` 한 곳**에서만 사용(grep 0건 외부). → 코어 변경이 잘 격리됨.
- `BoardMappingControl`(작품·시리즈 2 드롭다운 + `BOARD_PROJECT_ALREADY_MAPPED` 안내)은 picker로 대체·제거 → 그 에러코드 FE 참조도 함께 소멸.
- `client.ts`는 보드 에러를 generic 경로로 `error.code` 전달(api/boards.ts 주석 확인) → 신규 `BOARD_OWNER_INVALID`도 동일 경로.
