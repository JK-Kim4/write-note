# API Contracts: 작품 카테고리 분류 (032)

모든 엔드포인트 JWT 필수(`AuthenticatedPrincipal`), owner = principal.userId. 응답은 기존 `Result<T>` envelope. 신규 에러코드 0(404 `RESOURCE_NOT_FOUND` / 400 `VALIDATION_FAILED` 재사용).

## 신규 컨트롤러: `CategoryController` (`/api/categories`)

### 1. `POST /api/categories` — 모음 생성

- Body: `CreateCategoryRequest { name: String, parentId: Long? = null }`
- 검증: `name` trim 후 1..60(NotBlank+Size); `parentId` 비-null 이면 400(v1 1뎁스 강제, FR-010)
- 동작: `Category(userId=principal, name=trim, parentId=null, sortOrder=<max+1 또는 0>)` 저장
- 201 → `Result<CategoryResponse>` (projectCount=0)
- 에러: 400 VALIDATION_FAILED, 401 AUTH_TOKEN_*

### 2. `GET /api/categories` — 모음 목록

- 동작: 본인 카테고리 전량 `sort_order, id` 순 + 각 `projectCount`(활성 작품 수, group-by 1쿼리)
- 200 → `Result<List<CategoryResponse>>` (빈 모음도 포함, projectCount=0)
- 에러: 401

### 3. `PATCH /api/categories/{categoryId}` — 이름 변경 / 순서

- Body: `UpdateCategoryRequest { name: String? = null, sortOrder: Int? = null }` (null=미변경)
- 검증: `name` 명시 시 trim 1..60
- 동작: 본인 카테고리만(`findByIdAndUserId`, 아니면 404). 명시 필드 갱신
- 200 → `Result<CategoryResponse>`
- 에러: 400, 401, 404 RESOURCE_NOT_FOUND

### 4. `DELETE /api/categories/{categoryId}` — 모음 삭제 (작품 보존)

- 동작: 본인 카테고리만. `delete(category)` → FK `ON DELETE SET NULL` 로 소속 작품 `category_id` 자동 NULL(미분류 전환, FR-007)
- 204 (body 없음)
- 에러: 401, 404

## 기존 컨트롤러 확장: `ProjectController`

### 5. `PATCH /api/projects/{projectId}/category` — 작품을 모음으로 이동 (신규)

- Body: `MoveProjectCategoryRequest { categoryId: Long? }` — **null/생략 = 미분류로 빼냄**
- 동작:
  1. 본인 작품(`findByIdAndUserId`, 아니면 404)
  2. `categoryId` 비-null 이면 본인 카테고리 존재 확인(아니면 404 — 남의/없는 모음으로 이동 금지)
  3. `project.categoryId = categoryId` 설정(@PreUpdate)
- 200 → `Result<ProjectResponse>` (categoryId 반영)
- 에러: 401, 404 RESOURCE_NOT_FOUND
- 비고: 드래그 드롭 1회 = 본 호출 1회. `⋯ 이동` 메뉴도 동일 호출. 기존 `PATCH /api/projects/{id}`(UpdateProjectRequest) 무변경 — null-vs-absent 모호 회피(R-3)

### 6. 응답 필드 추가 (계약 변경 — additive)

- `GET /api/projects/cards` → `ProjectCardResponse` 에 `categoryId: Long?` 추가
- `GET /api/projects/{id}` · `PATCH` 등 → `ProjectResponse` 에 `categoryId: Long?` 추가
- 하위호환: 구 FE 는 추가 필드 무시. BE 선행 안전.

## 에러코드 매트릭스 (신규 0)

| status | code | 발생 |
|---|---|---|
| 400 | VALIDATION_FAILED | name 빈값/길이초과; parentId 비-null(v1) |
| 401 | AUTH_TOKEN_* | 인증 |
| 404 | RESOURCE_NOT_FOUND | 본인 소유 아닌/없는 작품·카테고리 |

> 409 신설 없음 → `client.ts` 409 분기(DOCUMENT_VERSION_CONFLICT) 무영향(code-quality 회귀 방지).
