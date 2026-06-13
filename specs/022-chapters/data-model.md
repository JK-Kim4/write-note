# Data Model: 챕터(Chapter) — 작품 1:N 본문 구조

**Phase 1 산출** — 기존 `documents` 테이블 1:N 확장. 신규 테이블·신규 엔티티 없음.

## 엔티티: Document (= 챕터)

기존 `Document` 엔티티에 2개 필드 추가, UNIQUE 제약 제거. **챕터 = Document 행 1개.**

| 필드 | 타입 | 변경 | 설명 |
|---|---|---|---|
| `id` | Long (PK, IDENTITY) | 불변 | 챕터 식별자 |
| `projectId` | Long | **`unique=true` 제거** | 소속 작품. 1:1 → 1:N |
| `title` | String(120) | 불변(재사용) | 챕터 제목 (빈 허용) |
| `body` | String(jsonb) | 불변 | 본문 ProseMirror JSON |
| `wordCount` | Int | 불변 | 글자수(서버 계산, 공백 제외) |
| `createdAt` | Instant | 불변 | 생성 시각 |
| `updatedAt` | Instant `@Version` | 불변 | 수정 시각 + 낙관적 잠금 토큰 겸용(V8) |
| **`sortOrder`** | Int | **신설** | 작품 안 순서(0부터). DEFAULT 0 |
| **`deletedAt`** | Instant? | **신설** | soft-delete 표시. NULL=활성 |

### 엔티티 변경 (`Document.kt`)

```kotlin
// project_id: unique=true 제거
@Column(name = "project_id", nullable = false)
var projectId: Long = 0,

// 신설 2필드
@Column(name = "sort_order", nullable = false)
var sortOrder: Int = 0,

@Column(name = "deleted_at")
var deletedAt: Instant? = null,
```

## 불변식 (Invariants)

- **INV-1**: 각 작품은 활성(`deletedAt IS NULL`) 챕터를 **항상 최소 1개** 가진다. 마지막 활성 챕터 삭제 거부.
- **INV-2**: 작품 생성 시 챕터 1개 자동 생성(기존 `ProjectService.createProject` 의 document 자동 프로비저닝 유지).
- **INV-3**: 챕터는 자기 작품에만 속한다(`projectId` 고정, 작품 횡단 이동 없음).
- **INV-4**: 활성 챕터의 `sortOrder` 는 작품 내에서 표시 순서를 결정(ASC). 중복 허용하되 reorder 로 정규화.

## 상태 전이 (soft-delete)

```
[활성 deletedAt=NULL]  --삭제-->  [삭제됨 deletedAt=now()]
[삭제됨]               --복구-->  [활성 deletedAt=NULL, sortOrder=활성 맨 뒤]
```

- 삭제: 마지막 활성 챕터가 아닐 때만 허용. 연결행(있다면) 보존.
- 복구: 활성 목록 맨 뒤로 재배치(원위치 보존은 비범위).

## 마이그레이션: V14__documents_chapters.sql

```sql
-- 1:1 강제 해제 (V5 컬럼 인라인 UNIQUE 의 Postgres 자동 명명)
ALTER TABLE documents DROP CONSTRAINT documents_project_id_key;
-- 작품 안 챕터 순서 (0부터)
ALTER TABLE documents ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
-- soft-delete 표시
ALTER TABLE documents ADD COLUMN deleted_at TIMESTAMPTZ NULL;
-- 목록 조회 정렬 인덱스
CREATE INDEX idx_documents_project_sort ON documents (project_id, sort_order);
-- 활성 필터 부분 인덱스 (Memo V9 패턴)
CREATE INDEX idx_documents_project_active ON documents (project_id) WHERE deleted_at IS NULL;
```

- 기존 행: `sort_order=0`·`deleted_at=NULL` 로 1번 챕터 무손실 편입(별도 이관 불필요).
- `ON DELETE CASCADE`(작품 삭제 → 챕터 전체) V5 그대로 유지.
- **적용 범위**: 로컬 dev DB 만. 운영(Supabase) 은 Round 4 D1 일괄(사용자 컨펌). `flywayMigrate` 실행은 사용자 컨펌 필수(external-infra-safety).

> **제약명 검증 필요**: `documents_project_id_key` 는 V5 인라인 UNIQUE 의 Postgres 자동 명명 추정 — 구현 시 `\d documents` 또는 `information_schema.table_constraints` 로 실제 제약명 확인 후 확정(읽기 전용, 컨펌 불필요).

## Repository 메서드 변경 (`DocumentRepository`)

| 변경 | 메서드 | 용도 |
|---|---|---|
| 제거/대체 | `findByProjectId(): Optional<Document>` (단수) | 1:1 가정 — 목록 메서드로 대체 |
| 신설 | `findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId)` | 활성 챕터 목록(정렬) |
| 신설 | `findByProjectIdInAndDeletedAtIsNull(projectIds)` | 카드 집계 일괄(N+1 금지) |
| 신설 | `findByIdAndDeletedAtIsNull(id)` | 활성 단건(저장·전환) |
| 신설 | `findByIdAndProjectId(id, projectId)` | 복구용(삭제 포함) |

## 관계 영향 (1:1 가정 해제 지점)

설계 §9 체크리스트 — 구현 시 전수 확인:

| 레이어 | 지점 | 조치 |
|---|---|---|
| DB | `documents.project_id UNIQUE` (V5) | V14 에서 제거 |
| BE | `Document.projectId @Column(unique=true)` | 제거 + sortOrder·deletedAt |
| BE | `DocumentRepository.findByProjectId: Optional` | 목록 메서드로 대체 |
| BE | `ProjectService.listCards` 단건 lookup | 활성 챕터 합산 |
| BE | `ProjectService.createProject` document 자동 생성 | 1번 챕터(sortOrder=0)로 유지 |
| FE | `useProjectDocument(projectId)` 단수 | `useProjectChapters` + `useChapterDocument` |
| FE | `webElectronApi.documents.getByProject` | `list/create/reorder/remove/restore/get` |
