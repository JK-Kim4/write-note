# Data Model — 보드 트랙 C 코어

## 1. `boards` 테이블 (V24 in-place 편집)

### Before (현행)
```sql
category_id BIGINT,
project_id  BIGINT,
CONSTRAINT fk_boards_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
CONSTRAINT fk_boards_project  FOREIGN KEY (project_id)  REFERENCES projects (id)  ON DELETE SET NULL,
CREATE UNIQUE INDEX uq_boards_project  ON boards (project_id)  WHERE project_id  IS NOT NULL;
CREATE UNIQUE INDEX uq_boards_category ON boards (category_id) WHERE category_id IS NOT NULL;
```

### After
```sql
owner_type VARCHAR(16),   -- 'project'(작품) | 'category'(시리즈) | NULL(아이디어)
owner_id   BIGINT,        -- projects.id 또는 categories.id (진짜 FK 아님 — 다형)
CONSTRAINT ck_boards_owner_pair CHECK (
    (owner_type IS NULL AND owner_id IS NULL)
    OR (owner_type IN ('project','category') AND owner_id IS NOT NULL)
),
CREATE INDEX idx_boards_owner ON boards (owner_type, owner_id);
-- 제거: fk_boards_category, fk_boards_project, uq_boards_project, uq_boards_category
-- 유지: user_id FK(ON DELETE CASCADE), idx_boards_user, viewport, name, timestamps
-- cards/links 테이블 및 V25(card_type)·V26(link_handles) 불변
```

- **다형 FK 없음**: `owner_id` 무결성은 앱 검증(본인 작품/시리즈인지). 대상 삭제 시 보존은 앱 훅(§4).
- **1:N**: 유니크 인덱스 제거로 한 작품/시리즈가 보드 여러 개.
- **아이디어 보드**: owner_type=owner_id=null. CHECK가 짝 보장.

## 2. 엔티티 `Board.kt`

```kotlin
@Column(name = "owner_type", length = 16)
var ownerType: String? = null,   // "project" | "category" | null
@Column(name = "owner_id")
var ownerId: Long? = null,
// 제거: categoryId, projectId
```
- 나머지(id·userId·name·viewport·timestamps·@PrePersist/@PreUpdate) 불변.

## 3. Repository `BoardRepository.kt`

- **제거**: `findByProjectId`·`findByCategoryId`(매핑충돌 409용), `findByUserIdAndProjectIdOrderByUpdatedAtDesc`·`findByUserIdAndCategoryIdOrderByUpdatedAtDesc`·`findByUserIdAndProjectIdIsNullAndCategoryIdIsNullOrderByUpdatedAtDesc`.
- **유지**: `findByUserIdOrderByUpdatedAtDesc`(허브 = mine 기반), `findByIdAndUserId`.
- **추가**:
  - `findByUserIdAndOwnerTypeAndOwnerIdOrderByUpdatedAtDesc(userId, ownerType, ownerId)` — GET /boards 필터(내부 탭② 대비).
  - `findByUserIdAndOwnerTypeIsNullOrderByUpdatedAtDesc(userId)` — unmapped(아이디어) 필터.
  - `@Modifying @Query("UPDATE Board b SET b.ownerType = null, b.ownerId = null WHERE b.ownerType = :ownerType AND b.ownerId = :ownerId") fun clearOwner(ownerType, ownerId): Int` — 대상 삭제 보존 훅용.

## 4. 대상 삭제 보존 (앱 훅)

| 경로 | 위치 | 동작 |
|---|---|---|
| 작품 hard delete | `ProjectService.deleteProject`(L236) | `boardRepository.clearOwner("project", projectId)` 후(또는 전) `projectRepository.delete`. 같은 @Transactional |
| 시리즈 hard delete | `CategoryService.delete`(L134) | `boardRepository.clearOwner("category", categoryId)` 추가 |
| 작품 보관(archive) | `archiveProject` | 무처리(대상 살아있음 — 보드 owner 유지) |

- ProjectService·CategoryService에 `BoardRepository` 주입(단방향 유지).

## 5. DTO

### 응답 `BoardResponses.kt`
```kotlin
data class BoardResponse(
    val id: Long, val name: String,
    val ownerType: String?, val ownerId: Long?,   // ← projectId/categoryId 대체
    val viewport: ViewportDto, val createdAt: Instant, val updatedAt: Instant,
)
data class BoardSummary(          // 허브 항목 — 라벨 동봉
    val id: Long, val name: String,
    val ownerType: String?, val ownerId: Long?,
    val ownerLabel: String,       // 작품 title / 시리즈 name / "아이디어" (파생)
    val cardCount: Int, val updatedAt: Instant,
)
// BoardDetailResponse·CardResponse·LinkResponse·ViewportDto 불변
```
- 라벨 파생(R5): mine 목록 owner_id를 종류별 모아 `findAllById` 일괄 → id→name map → "아이디어"(null) / title / name.

### 요청 `BoardRequests.kt`
```kotlin
data class CreateBoardRequest(
    @field:NotBlank @field:Size(max = 120) val name: String,
    val ownerType: String? = null,   // ← projectId/categoryId 대체
    val ownerId: Long? = null,
)
data class PatchBoardRequest(        // PATCH /{id} — name·owner 통합(set/clear)
    @field:Size(max = 120) val name: String? = null,
    val ownerType: String? = null,
    val ownerId: Long? = null,
    // 구분: owner를 "변경 안 함" vs "아이디어로 해제"를 어떻게 표현?
    //  → 본 트랙: PATCH는 name·owner를 항상 함께 받는 단순 계약(허브 picker가 전체 전송)
    //    또는 명시 플래그. contracts/board-api.md §PATCH에서 확정.
)
// SetBoardProjectRequest·SetBoardCategoryRequest 제거. RenameBoardRequest는 PatchBoardRequest로 흡수 가능
```

## 6. 에러코드 `AuthErrorCode.kt`
- **제거**: `BOARD_PROJECT_ALREADY_MAPPED`·`BOARD_CATEGORY_ALREADY_MAPPED`(1:N으로 충돌 개념 소멸).
- **추가**: `BOARD_OWNER_INVALID(HttpStatus.BAD_REQUEST, "보드를 연결할 수 없습니다(없는·본인 아닌 작품/시리즈 또는 잘못된 소속).")`.
- **유지**: `BOARD_LINK_INVALID`(400)·`BOARD_LINK_DUPLICATE`(409).

## 7. owner 검증 규칙 (BoardService — 순수 분기, TDD 대상)
```
validateOwner(userId, ownerType, ownerId):
  (null, null)           → OK (아이디어)
  ("project", id≠null)   → projectRepository.findByIdAndUserId(id, userId) 없으면 BOARD_OWNER_INVALID
  ("category", id≠null)  → categoryRepository.existsByIdAndUserId(id, userId) 아니면 BOARD_OWNER_INVALID
  그 외(짝 불완전·미지원 type) → BOARD_OWNER_INVALID
```
- 매핑충돌(이미 매핑됨 409) 분기 **제거**(1:N). 본인 소유 검증만.
