# Research: 작품 카테고리 분류 (032)

Phase 0 — 설계 결정과 근거. spec 의 NEEDS CLARIFICATION 은 명세 단계에서 사용자 컨펌으로 모두 해소됨(폴더형 / 미분류 허용 / 인터랙션 C / 용어 "모음"). 본 문서는 구현으로 내려오며 생긴 기술 결정을 박는다.

## R-1. 작품↔카테고리 관계 = 폴더형 (1:N), `projects.category_id` nullable

- **Decision**: 작품은 최대 1개 카테고리에 속한다. `projects` 테이블에 `category_id BIGINT NULL` 컬럼 추가(미분류 = NULL). 별도 조인 테이블 없음.
- **Rationale**: 사용자 컨펌(폴더형). 1:N 은 컬럼 1개로 끝나 단순하고, 기존 작품은 NULL = 미분류로 자동 정합(FR-009, 데이터 변경 0).
- **Alternatives**: N:M 조인 테이블(태그형) — 사용자가 폴더형 선택으로 기각. "디렉토리" 메타포·N뎁스 트리와도 1:N 이 정합.

## R-2. 카테고리 삭제 시 작품 보존 = FK `ON DELETE SET NULL`

- **Decision**: `projects.category_id` FK 를 `ON DELETE SET NULL` 로 건다. 카테고리 삭제 시 그 안 작품의 `category_id` 가 DB 레벨에서 자동 NULL(미분류)로 전환.
- **Rationale**: FR-007(삭제해도 작품 무손실). DB 제약으로 강제하면 서비스 누락·경합에도 작품이 삭제되지 않음. 서비스는 단순 `delete(category)` 만.
- **Alternatives**: 서비스에서 명시적으로 `UPDATE projects SET category_id=NULL` 후 삭제 — DB 제약이 더 견고. CASCADE(작품까지 삭제) — FR-007 정면 위반, 절대 금지.

## R-3. 작품 이동 = 전용 엔드포인트 `PATCH /api/projects/{id}/category`

- **Decision**: 기존 `PATCH /api/projects/{id}`(`UpdateProjectRequest`)에 `categoryId` 를 **넣지 않는다**. 전용 엔드포인트 `PATCH /api/projects/{projectId}/category` (body `{ "categoryId": <Long?|null> }`)를 신설. null/생략 = 미분류로 빼냄.
- **Rationale**: 기존 PATCH 의 계약은 "null 필드 = 미변경"이다. 여기에 `categoryId` 를 넣으면 "미변경"과 "미분류로 비우기(null 설정)"를 구분할 수 없다(PATCH null-vs-absent 문제). 전용 엔드포인트는 "이 작품의 카테고리를 이 값으로 설정"이 유일 책임이라 null=비우기가 모호 없이 성립. 기존 `archive`/`unarchive` 액션 엔드포인트 패턴과 일관. 드래그 드롭 1회 = 1 액션 호출로 깔끔.
- **Alternatives**: (a) `UpdateProjectRequest` 에 `JsonNullable<Long>`/`Optional` 래퍼로 absent vs null 구분 — 기존 DTO 의미 변경·복잡도↑, 다른 필드와 일관성 깨짐. (b) 매직값(0/-1=미분류) — 해킹성, 금지.

## R-4. 카테고리 목록은 작품과 독립 조회 (`GET /api/categories`) — 빈 카테고리 표시 위해

- **Decision**: `GET /api/categories` 신설. 작가의 모든 카테고리를 `sort_order, id` 순으로 반환하며, 각 항목에 `projectCount`(그 카테고리의 활성 작품 수)를 서버 집계로 동봉.
- **Rationale**: 작품 0개 카테고리도 화면에 보여야 한다(빈 폴더 타일 — 작가가 미리 만들어 둠). `/cards`(작품 목록)에서 group-by 로 카테고리를 파생하면 작품 0개 카테고리가 누락된다. 따라서 카테고리는 독립 SoT 가 필요. `projectCount` 는 `countByUserIds` 와 동일한 group-by 집계 패턴(N+1 금지)으로 1쿼리.
- **Alternatives**: `/cards` 에서 FE 파생 — 빈 카테고리 누락으로 기각.

## R-5. 응답 DTO 에 `categoryId` 추가 (`ProjectResponse` + `ProjectCardResponse`)

- **Decision**: `ProjectResponse` 와 `ProjectCardResponse` 에 `categoryId: Long?` 필드 추가. `ProjectMapper.toResponse` 가 채움. `/library` 는 `/cards` 를 쓰므로 카드 응답에 categoryId 가 있어야 FE 가 루트/폴더로 그룹핑 가능.
- **Rationale**: FE 가 각 작품의 소속을 알아야 드릴인 뷰에서 필터·그룹 가능. 추가 필드라 구 FE 는 무시(하위호환), 신 FE 만 사용 → BE 선행 안전.
- **Alternatives**: 별도 조회 — 불필요한 라운드트립.

## R-6. N뎁스 설계 = `parent_id` 컬럼 보유 + 앱레벨 1뎁스 강제

- **Decision**: `categories.parent_id BIGINT NULL`(self-FK) 컬럼을 둔다. v1 은 **서비스가 `parentId` 비-null 생성 요청을 `VALIDATION_FAILED`(400)로 거부**해 모든 카테고리를 루트로 강제. 향후 N뎁스 = 이 거부 규칙만 완화(+깊이 검증 추가), 스키마 변경 0.
- **Rationale**: FR-010(1뎁스 한정, 설계는 N뎁스 가능). 컬럼은 미리 두되 동작은 막아, 데이터 구조 변경 없이 확장 가능(SC-005).
- **Alternatives**: parent_id 없이 v1 출시 후 나중에 컬럼 추가 — 사용자 요구("설계만 N뎁스 가능")에 미달. 컬럼 미리 보유가 정답.

## R-7. 신규 에러코드 0 — 기존 404/400 재사용 (409 회귀 방지)

- **Decision**: 새 도메인 에러코드를 만들지 않는다. 소유 아님/미존재 = `RESOURCE_NOT_FOUND`(404, 기존 `ResourceNotFoundException`). 이름 빈값·parentId 비허용 = `VALIDATION_FAILED`(400, 기존 `ValidationException` + Bean Validation). 409 신설 없음.
- **Rationale**: 409 신규 분기는 `client.ts` 의 기존 409(`DOCUMENT_VERSION_CONFLICT` 등) 와 충돌 위험(code-quality 회귀 사례). 본 기능은 충돌 개념이 없어 404/400 으로 충분.
- **Alternatives**: 신규 코드(CATEGORY_NOT_FOUND 등) — 불필요한 매트릭스 확장, 기각.

## R-8. 프론트 드래그 = 기존 `@dnd-kit` 재사용 (신규 의존성 0)

- **Decision**: `@dnd-kit/core`(이미 의존성, `ExportDialog` 에서 React 19 환경 검증됨) 의 `DndContext` + `useDraggable`(작품 카드) + `useDroppable`(모음 타일·경로 "내 작품"). 포인터+터치 센서, activation distance 로 클릭(폴더 열기)과 드래그(이동) 구분.
- **Rationale**: 신규 라이브러리 도입 0. dnd-kit 은 키보드·터치 센서를 갖춰 접근성 기반. 단 키보드/터치 정밀 이동은 카드 `⋯ 이동` 메뉴를 1급 경로로 병행(드래그가 유일 경로가 되지 않게).
- **Alternatives**: 네이티브 HTML5 DnD — 터치 미지원·고스트 추함. react-dnd — 이미 dnd-kit 보유라 불필요.

## R-9. 드릴인 상태 = URL 반영 `/library?folder=<categoryId>`

- **Decision**: 폴더(모음) 진입 상태를 URL 쿼리 `?folder=<id>` 로 반영. 루트 = 파라미터 없음. `useSearchParams` + `router.push`(shallow).
- **Rationale**: 브라우저 뒤로가기·새로고침 보존·링크 공유. 모달/로컬state 만 쓰면 새로고침 시 위치 유실. 제품 원칙(재진입 비용 0)과 정합.
- **Alternatives**: Zustand 로컬 상태만 — 새로고침에 휘발, 기각.

## R-10. 배포 순서 = BE 선행 → FE 후행

- **Decision**: 백엔드(V20 마이그레이션 + 카테고리 CRUD + 이동 엔드포인트 + 응답 categoryId)를 먼저 배포, 프론트는 그 뒤.
- **Rationale**: BE 가 새 계약(엔드포인트·필드)을 받아들이게 한 뒤 FE 가 그걸 호출/표시(deployment 방향 의존: "BE 가 새 계약 수용 후 FE 가 보냄"). 본 변경은 순수 additive(기존 PATCH·응답에 필드 추가만, 제거·의미변경 0)라 구 FE 와도 하위호환. 전용 엔드포인트라 기존 PATCH 계약 무변경 → 구 BE 가 신규 키로 400 거부할 위험도 없음.
- **Alternatives**: FE 선행 — 신 FE 가 없는 엔드포인트 호출로 404, 기각.

## R-11. 보관(archive) 작품과 카테고리

- **Decision**: `category_id` 는 보관 여부와 독립. 보관 작품도 category_id 유지. 단 v1 의 카테고리 그룹 표시는 **활성 작품 화면(`/cards` 기반)에만** 적용, 보관 목록(`?archived=true`)은 기존 동작 유지.
- **Rationale**: spec Assumptions. 보관함까지 폴더 뷰를 넓히면 범위 팽창. category_id 는 보관해도 보존되므로 보관 해제 시 원래 모음으로 복귀.
- **Alternatives**: 보관 시 category_id NULL 화 — 복귀 시 분류 유실, 기각.
