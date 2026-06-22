# Data Model: 작품 카테고리 분류 (032)

코드 식별자는 영문 기술 명명(`category`). 사용자 노출 명칭만 "모음".

## 신규 엔티티: `Category` → 테이블 `categories`

작가가 작품을 묶는 분류 단위(UI = "모음").

| 필드 | 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|---|
| id | `id` | BIGSERIAL | PK | |
| userId | `user_id` | BIGINT | NOT NULL, FK→users(id) | 소유 작가. 작가 단위 격리(FR-002) |
| name | `name` | VARCHAR(60) | NOT NULL | 모음 이름. 빈값·공백만 거부(FR-012, 서비스 trim 후 검증) |
| parentId | `parent_id` | BIGINT | NULL, FK→categories(id) ON DELETE CASCADE | **N뎁스 설계용**(FR-010). v1 은 항상 NULL(앱레벨 강제) |
| sortOrder | `sort_order` | INT | NOT NULL DEFAULT 0 | 표시 순서(FR-011). 작은 값 먼저, 동률은 id |
| createdAt | `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now | |
| updatedAt | `updated_at` | TIMESTAMPTZ | NOT NULL | `@PreUpdate` 갱신 |

- **JPA**: `Project` 와 동일 스타일 — `@Entity @Table(name="categories")`, `@GeneratedValue(IDENTITY)`, `@PrePersist`/`@PreUpdate` 로 created/updated 채움.
- **인덱스**: `idx_categories_user_sort (user_id, sort_order, id)` — 작가별 정렬 목록.

### 검증 규칙 (Category)
- `name`: trim 후 길이 1..60. 빈값/공백만 → `VALIDATION_FAILED`(400). (Bean Validation `@field:NotBlank @field:Size(max=60)` + 서비스 trim)
- `parentId`: v1 에서 **비-null 이면 `VALIDATION_FAILED`(400)** — 1뎁스 강제(FR-010). (향후 N뎁스 = 이 검증만 완화)
- 소유: 모든 조회·수정·삭제는 `findByIdAndUserId` 로 본인 것만(404 otherwise).

## 기존 엔티티 확장: `Project` (+ `category_id`)

| 필드 | 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|---|
| categoryId | `category_id` | BIGINT | NULL, FK→categories(id) **ON DELETE SET NULL** | 소속 모음. NULL = 미분류(FR-004/008/009) |

- **무손실(FR-009)**: 컬럼 추가 시 기존 행은 NULL = 미분류 → 데이터 변경 0, 화면에 그대로 노출.
- **삭제 보존(FR-007/R-2)**: `ON DELETE SET NULL` 로 모음 삭제 시 작품의 `category_id` 자동 NULL.
- **인덱스**: `idx_projects_user_category (user_id, category_id)` — "이 모음의 작품" 조회.
- **엔티티 변경**: `Project` 에 `@Column(name="category_id") var categoryId: Long? = null` 추가(기존 필드 사이 적절 위치). 작품은 동시에 1개 모음만(단일 FK).

## 관계

```
User (1) ──< (N) Category          # 작가별 모음
Category (1) ──< (N) Project        # 모음당 작품 N개 (작품은 0|1 모음)
Category (1) ──< (N) Category       # parent_id 자기참조 (설계만, v1 미사용)
```

## 응답 DTO 확장

- `ProjectResponse` + `categoryId: Long?`
- `ProjectCardResponse` + `categoryId: Long?` (`/library` 가 카드로 그룹핑)
- `ProjectMapper.toResponse` 에 `categoryId = project.categoryId` 추가 → 두 응답 모두 자동 반영(`ProjectCardResponse.from(base=...)` 가 base 에서 가져가도록 필드 추가).

## 신규 응답 DTO: `CategoryResponse`

| 필드 | 타입 | 비고 |
|---|---|---|
| id | Long | |
| name | String | |
| parentId | Long? | v1 항상 null |
| sortOrder | Int | |
| projectCount | Int | 활성 작품 수(서버 집계, 빈 모음=0 도 표시) |
| createdAt | Instant | |
| updatedAt | Instant | |

## 마이그레이션 V20 (작성만 — 적용은 사용자 컨펌)

`backend/src/main/resources/db/migration/V20__create_categories_and_project_category.sql`

```sql
-- V20 — 작품 카테고리(UI "모음", 032). 폴더형 1:N + N뎁스 설계(parent_id 보유, v1 앱레벨 1뎁스 강제).
-- 기존 작품은 category_id NULL = 미분류로 자동 정합(무손실). 모음 삭제 시 작품은 SET NULL 로 보존.
CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(60) NOT NULL,
    parent_id BIGINT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE CASCADE
);
CREATE INDEX idx_categories_user_sort ON categories (user_id, sort_order, id);

ALTER TABLE projects
    ADD COLUMN category_id BIGINT,
    ADD CONSTRAINT fk_projects_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL;
CREATE INDEX idx_projects_user_category ON projects (user_id, category_id);
```

- `categories.fk_categories_user ON DELETE CASCADE`: 회원 탈퇴 시 모음 정리(기존 projects FK 는 cascade 없으나 회원 삭제 흐름은 본 범위 밖 — 안전한 기본값).
- 적용: `external-infra-safety` §1 — 마이그레이션 파일 작성은 OK, **로컬/운영 DB 적용은 사용자 컨펌**. IT 는 Testcontainers 에서 Flyway 자동.
