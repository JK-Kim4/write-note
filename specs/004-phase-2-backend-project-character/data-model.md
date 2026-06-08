# Data Model: Phase 2 Backend — Project Metadata & Character CRUD

**Date**: 2026-05-25
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**SoT**: [docs/plan/03-backend-requirements.md §2-2](../../docs/plan/03-backend-requirements.md)

본 문서는 본 spec 의 3 entity (Project 확장 / Character 신설 / Document 신설) detail + V5 마이그레이션 SQL 스케치. 모든 형태는 SoT §2-2 인용. 본 spec 미명시 detail 은 [research.md](./research.md) R-1 ~ R-9 결정 인용.

---

## 1. Project (확장)

### 1-1. 컬럼

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| `id` | `BIGSERIAL` | PK | 기존 (V2) |
| `user_id` | `BIGINT` | NOT NULL, FK → `users(id)` ON DELETE CASCADE | 기존 (V2) |
| `title` | `VARCHAR(120)` | NOT NULL | 기존 (V2) |
| `genre` | `VARCHAR(100)` | nullable | **신규** (research R-2) |
| `target_length` | `INTEGER` | nullable, CHECK ≥ 1 AND ≤ 100_000_000 | **신규** — 자수 단위 (research R-2) |
| `tone_notes` | `TEXT` | nullable, CHECK length ≤ 2000 | **신규** (research R-2) |
| `synopsis` | `TEXT` | nullable, CHECK length ≤ 5000 | **신규** (research R-2) |
| `world_notes` | `TEXT` | nullable, CHECK length ≤ 10000 | **신규** — 마크다운 (research R-2) |
| `archived_at` | `TIMESTAMPTZ` | nullable | **신규** — NULL = 미보관 (research R-1) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | 기존 (V2) |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | 기존 (V2) |

**Drop**: `archived BOOLEAN` (V2 컬럼) — V5 마이그레이션에서 `archived=true` 행을 `archived_at = updated_at` 로 변환 후 DROP (research R-1).

### 1-2. 인덱스

| 인덱스 | 컬럼 | 용도 |
|---|---|---|
| `idx_projects_user_archived_at_updated_at` | `(user_id, archived_at NULLS FIRST, updated_at DESC)` | 홈 활성 목록 + 보관함 분리 조회 (NULL = 활성 먼저) |

**Drop**: `idx_projects_user_archived_updated_at` (V2 인덱스 — `archived` boolean 기반).

### 1-3. JPA entity 스케치 (Kotlin)

```kotlin
@Entity
@Table(name = "projects")
class Project(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(nullable = false)
    var title: String,

    var genre: String? = null,

    @Column(name = "target_length")
    var targetLength: Int? = null,

    @Column(name = "tone_notes", columnDefinition = "TEXT")
    var toneNotes: String? = null,

    @Column(columnDefinition = "TEXT")
    var synopsis: String? = null,

    @Column(name = "world_notes", columnDefinition = "TEXT")
    var worldNotes: String? = null,

    @Column(name = "archived_at")
    var archivedAt: Instant? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),
) {
    fun isArchived(): Boolean = archivedAt != null
    fun archive(now: Instant) { if (archivedAt == null) archivedAt = now }
    fun unarchive() { archivedAt = null }
    fun applyMetadata(req: UpdateProjectRequest) {
        req.title?.let { title = it }
        req.genre?.let { genre = it }
        req.targetLength?.let { targetLength = it }
        req.toneNotes?.let { toneNotes = it }
        req.synopsis?.let { synopsis = it }
        req.worldNotes?.let { worldNotes = it }
    }
}
```

**부분 수정 규약**: `UpdateProjectRequest` 필드가 `null` 이면 미변경, 명시값 (빈 문자열 포함) 이면 갱신. 빈 문자열 ↔ NULL 구분은 application 영역 — `""` 명시 시 빈 문자열 저장 (사용자가 의도적으로 비우는 케이스). 단, `title` 은 `@NotBlank` 검증.

---

## 2. Character (신설)

### 2-1. 컬럼

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| `id` | `BIGSERIAL` | PK | |
| `project_id` | `BIGINT` | NOT NULL, FK → `projects(id)` ON DELETE CASCADE | |
| `name` | `VARCHAR(80)` | NOT NULL | |
| `short_description` | `VARCHAR(255)` | nullable | DESIGN.md 80 "한 줄 설명" |
| `notes` | `TEXT` | nullable, CHECK length ≤ 10000 | DESIGN.md 80 "자유 노트", 마크다운 |
| `display_order` | `INTEGER` | NOT NULL, DEFAULT 0 | research R-4 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | |

### 2-2. 인덱스

| 인덱스 | 컬럼 | 용도 |
|---|---|---|
| `idx_characters_project_order` | `(project_id, display_order ASC, created_at ASC)` | 목록 정렬 조회 (research R-4) |

### 2-3. JPA entity 스케치

```kotlin
@Entity
@Table(name = "characters")
class Character(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "project_id", nullable = false)
    val projectId: Long,

    @Column(nullable = false)
    var name: String,

    @Column(name = "short_description")
    var shortDescription: String? = null,

    @Column(columnDefinition = "TEXT")
    var notes: String? = null,

    @Column(name = "display_order", nullable = false)
    var displayOrder: Int = 0,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),
)
```

Project ↔ Character 연관은 Service 레이어에서 `characterRepository.findAllByProjectId(...)` 로 처리. JPA `@OneToMany` 양방향 매핑 박지 않음 (N+1 / `LazyInitializationException` 회피, 단방향 ID 기반).

---

## 3. Document (신설)

### 3-1. 컬럼

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| `id` | `BIGSERIAL` | PK | |
| `project_id` | `BIGINT` | NOT NULL **UNIQUE**, FK → `projects(id)` ON DELETE CASCADE | 1:1 강제 |
| `title` | `VARCHAR(120)` | NOT NULL, DEFAULT `''` | 본 spec 시점 빈 문자열 default — Week 3 본문 CRUD 시점에 사용자 입력 |
| `body` | `JSONB` | NOT NULL, DEFAULT `'{"type":"doc","content":[]}'::jsonb` | research R-3, TipTap default |
| `word_count` | `INTEGER` | NOT NULL, DEFAULT 0 | Week 3 자동 계산 |
| `version` | `INTEGER` | NOT NULL, DEFAULT 0 | JPA `@Version` optimistic lock — Week 3 활용 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | |

### 3-2. 인덱스

| 인덱스 | 컬럼 | 용도 |
|---|---|---|
| `documents_project_id_key` (UNIQUE constraint 자동 인덱스) | `project_id` | 1:1 lookup + 1:1 강제 |

### 3-3. JPA entity 스케치

```kotlin
@Entity
@Table(name = "documents")
class Document(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "project_id", nullable = false, unique = true)
    val projectId: Long,

    @Column(nullable = false)
    var title: String = "",

    @Column(nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    var body: String = """{"type":"doc","content":[]}""",

    @Column(name = "word_count", nullable = false)
    var wordCount: Int = 0,

    @Version
    @Column(nullable = false)
    var version: Int = 0,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),
)
```

**Note**: 본 spec 은 Document entity / repository / Project 생성 시 자동 행 박는 영역만. body 직렬화·역직렬화 + 본문 CRUD endpoint (`GET /api/documents/{id}` / `PUT /api/documents/{id}` / `PATCH /api/documents/{id}/title`) 는 Week 3 영역. body 는 String 으로 박음 (JSONB native 매핑은 Week 3 에서 ProseMirror schema 결정 후 박음).

---

## 4. V5 마이그레이션 SQL 스케치

파일: `backend/src/main/resources/db/migration/V5__expand_projects_and_create_character_document.sql`

```sql
-- 1. projects 메타 5 컬럼 추가
ALTER TABLE projects ADD COLUMN genre VARCHAR(100);
ALTER TABLE projects ADD COLUMN target_length INTEGER CHECK (target_length IS NULL OR (target_length >= 1 AND target_length <= 100000000));
ALTER TABLE projects ADD COLUMN tone_notes TEXT CHECK (tone_notes IS NULL OR length(tone_notes) <= 2000);
ALTER TABLE projects ADD COLUMN synopsis TEXT CHECK (synopsis IS NULL OR length(synopsis) <= 5000);
ALTER TABLE projects ADD COLUMN world_notes TEXT CHECK (world_notes IS NULL OR length(world_notes) <= 10000);

-- 2. archived boolean → archived_at timestamp (research R-1)
ALTER TABLE projects ADD COLUMN archived_at TIMESTAMPTZ;
UPDATE projects SET archived_at = updated_at WHERE archived = TRUE;
ALTER TABLE projects DROP COLUMN archived;

-- 3. projects 인덱스 교체
DROP INDEX IF EXISTS idx_projects_user_archived_updated_at;
CREATE INDEX idx_projects_user_archived_at_updated_at
  ON projects (user_id, archived_at NULLS FIRST, updated_at DESC);

-- 4. characters 테이블 신설
CREATE TABLE characters (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL,
    name VARCHAR(80) NOT NULL,
    short_description VARCHAR(255),
    notes TEXT CHECK (notes IS NULL OR length(notes) <= 10000),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_characters_project FOREIGN KEY (project_id)
      REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_characters_project_order
  ON characters (project_id, display_order ASC, created_at ASC);

-- 5. documents 테이블 신설
CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL UNIQUE,
    title VARCHAR(120) NOT NULL DEFAULT '',
    body JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
    word_count INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_documents_project FOREIGN KEY (project_id)
      REFERENCES projects(id) ON DELETE CASCADE
);
```

**적용 정책**: 본 SQL 작성·리뷰는 OK, **적용은 사용자 명시 컨펌 후** (HARD-GATE — `.claude/rules/infra/external-infra-safety.md`). 적용 명령 후보:
- 로컬: `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'` (boot 시 자동 Flyway migrate)
- 또는 명시: `cd backend && ./gradlew flywayMigrate`

---

## 5. State Transitions

### Project lifecycle

```
created (archived_at = NULL)
  ├─ POST /api/projects/{id}/archive   → archived (archived_at = NOW())
  │     └─ POST /api/projects/{id}/unarchive → created (archived_at = NULL)
  └─ DELETE /api/projects/{id}         → deleted (cascade: characters / documents)
```

archive 멱등성: 이미 archived 상태에서 POST `/archive` 호출 → 200 OK + `archived_at` 값 유지 (덮어쓰기 X).
unarchive 멱등성: 미보관 상태에서 POST `/unarchive` 호출 → 200 OK + no-op.

### Character lifecycle

```
created (display_order = 사용자 지정 또는 0)
  ├─ PATCH /api/projects/{pId}/characters/{id}  → updated (부분 수정)
  ├─ PUT /api/projects/{pId}/characters/reorder → display_order 일괄 갱신
  └─ DELETE /api/projects/{pId}/characters/{id} → deleted
```

Project 영구 삭제 시 Character cascade 삭제 (DB FK).

### Document lifecycle (본 spec 영역)

```
auto-created (Project 생성 트랜잭션 안에서 빈 body + word_count=0 + version=0)
  └─ Project 영구 삭제 → Document cascade 삭제
```

Document body / title CRUD endpoint 는 Week 3 영역 — 본 spec scope 외.

---

## 6. Validation Rules

| 영역 | 규칙 | 위반 시 응답 |
|---|---|---|
| Project.title | `@NotBlank @Size(max = 120)` | 400 `VALIDATION_FAILED` |
| Project.genre | `@Size(max = 100)`, nullable | 400 `VALIDATION_FAILED` |
| Project.targetLength | `@Min(1) @Max(100_000_000)`, nullable | 400 `VALIDATION_FAILED` |
| Project.toneNotes / synopsis / worldNotes | `@Size(max = 2000/5000/10000)`, nullable | 400 `VALIDATION_FAILED` |
| Character.name | `@NotBlank @Size(max = 80)` | 400 `VALIDATION_FAILED` |
| Character.shortDescription | `@Size(max = 255)`, nullable | 400 `VALIDATION_FAILED` |
| Character.notes | `@Size(max = 10000)`, nullable | 400 `VALIDATION_FAILED` |
| Character reorder | `characterIds` = 해당 프로젝트의 모든 인물 ID 의 permutation. 누락 / 중복 / 외부 ID 시 거부 | 400 `VALIDATION_FAILED` (research R-4 정합, FR-016) |
| Project ownership | 모든 Project 동작에서 `findByIdAndUserId(...)` → null 시 차단 | 404 `RESOURCE_NOT_FOUND` (정보 노출 회피 — FR-008) |
| Character ownership (간접) | 모든 Character 동작에서 *해당 Project 의 owner 가 현 사용자인지* 검증 | 404 `RESOURCE_NOT_FOUND` (FR-015) |

검증 실패 envelope = 001 도입 표준 (`{ success: false, error: { code, message } }`).
