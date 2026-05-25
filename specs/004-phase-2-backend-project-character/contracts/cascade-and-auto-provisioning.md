# Contract: Cascade Policy & Document Auto-Provisioning

**Date**: 2026-05-25
**Spec**: [../spec.md](../spec.md)
**Research**: [../research.md R-1, R-3, R-5, R-9](../research.md)

본 문서는 본 spec 의 **횡단 관심사 3 개** 박음:
1. Project 생성 시 Document 1:1 자동 행 (FR-009/010)
2. Project 영구 삭제 시 cascade 정책 (FR-007/011)
3. `archived` boolean → `archived_at` timestamp 마이그레이션 정책 (FR-002)

---

## 1. Document Auto-Provisioning

### 1-1. 본질

새 Project 생성 = `projects` 행 1개 + `documents` 행 1개 (1:1 매핑) 가 **단일 트랜잭션** 안에 박힘. 본문 자동 생성 실패 시 Project 도 롤백 (반쪽 상태 회피, FR-010).

### 1-2. 코드 형태 (ProjectService.createProject)

```kotlin
@Service
class ProjectService(
    private val projectRepository: ProjectRepository,
    private val documentRepository: DocumentRepository,
) {
    @Transactional(rollbackFor = [Exception::class])
    fun createProject(userId: Long, req: CreateProjectRequest): ProjectResponse {
        val project = projectRepository.save(
            Project(
                userId = userId,
                title = req.title,
                genre = req.genre,
                targetLength = req.targetLength,
                toneNotes = req.toneNotes,
                synopsis = req.synopsis,
                worldNotes = req.worldNotes,
            )
        )
        // Document 자동 행 — 같은 트랜잭션 안. 실패 시 projects INSERT 도 롤백
        documentRepository.save(Document(projectId = project.id!!))
        return ProjectResponse.from(project)
    }
}
```

### 1-3. 검증 시나리오 (통합 IT)

| 시나리오 | 검증 |
|---|---|
| Happy: POST /api/projects 성공 | `projects` 행 1 + `documents` 행 1 (project_id 일치) 모두 존재 |
| Document INSERT 실패 (예: UNIQUE 위반 강제 — 같은 project_id 두 번 박는 mock) | `projects` 행도 미존재 (트랜잭션 롤백) |
| 본문 default 값 | `documents.body = {"type":"doc","content":[]}`, `word_count = 0`, `version = 0`, `title = ""` |

### 1-4. 회피 패턴

- **금지**: ProjectService 외부에서 Document 신설 (Controller / 다른 Service 가 Document INSERT 박는 흐름) — 트랜잭션 분리 시 반쪽 상태 위험. Document INSERT 는 ProjectService.createProject 내부에서만.
- **금지**: `@Transactional` 누락 → Document INSERT 가 별개 트랜잭션 + 본문만 commit + Project 롤백 시 고아 Document 발생. `@Transactional(rollbackFor = [Exception::class])` 의무.
- **금지**: `documentRepository.save` 를 `try-catch` 로 swallow → 실패 무시. throw 그대로 박아서 트랜잭션 롤백 유도.

---

## 2. Cascade Policy

### 2-1. 본질

Project 영구 삭제 → DB FK `ON DELETE CASCADE` 가 자식 정리 (research R-5). Service 레이어 명시 삭제 / JPA `@OneToMany(cascade = REMOVE)` 박지 않음.

### 2-2. 본 spec 시점 cascade 대상

| 자식 entity | 본 spec 시점 영향 | 마이그레이션 |
|---|---|---|
| `characters` | 본 spec V5 에서 FK CASCADE 박음 | V5 |
| `documents` | 본 spec V5 에서 FK CASCADE 박음 | V5 |
| `session_notes` | 본 spec 시점 entity 미존재 → 영향 없음 | Week 5 진입 시 V7 에서 FK CASCADE 박음 |
| `memo_projects` | 본 spec 시점 entity 미존재 → 영향 없음 | Week 4 진입 시 V6 에서 FK CASCADE 박음 |
| `memo_project_characters` | 본 spec 시점 entity 미존재 → 영향 없음 | Week 4 진입 시 V6 에서 FK CASCADE 박음 (간접 — `memo_projects` cascade 따라감) |

본 spec 의 `spec.md FR-007` 의 "자식 데이터 (등장인물 / 본문 / 세션 노트 / 메모 연결) 도 함께 사라져야" 명시 = *Week 4/5 entity 신설 후 자동 만족* (DB FK CASCADE 가 마이그레이션 시점에 박혀서 본 spec 의 Service 코드 변경 없이 작동).

### 2-3. 코드 형태 (ProjectService.deleteProject)

```kotlin
@Transactional(rollbackFor = [Exception::class])
fun deleteProject(userId: Long, projectId: Long) {
    val project = projectRepository.findByIdAndUserId(projectId, userId)
        ?: throw ResourceNotFoundException()
    projectRepository.delete(project)  // DB FK CASCADE 가 자식 정리
}
```

JPA `cascade = [CascadeType.REMOVE]` / `orphanRemoval = true` 박지 않음 — DB FK CASCADE 가 유일한 cascade 메커니즘.

### 2-4. 검증 시나리오 (통합 IT)

| 시나리오 | 검증 |
|---|---|
| 인물 2명 + 본문 1행 가진 Project 삭제 | DELETE 후 `projects` / `characters` / `documents` 모두 0행 |
| 본인 소유 아닌 Project 삭제 시도 | 404 `RESOURCE_NOT_FOUND` + 모든 행 그대로 |
| DB FK CASCADE 정합 검증 | 통합 IT 에서 raw SQL count 또는 Repository count 호출로 0행 assertion |

### 2-5. 회피 패턴

- **금지**: JPA `@OneToMany(cascade = [CascadeType.REMOVE])` 양방향 매핑 + `projectRepository.delete` 호출 → JPA 가 자식 SELECT + N+1 DELETE 박음. DB FK CASCADE 가 한 SQL 로 처리하는 게 더 빠름.
- **금지**: Service 에서 `characterRepository.deleteAllByProjectId` + `documentRepository.deleteByProjectId` + `projectRepository.delete` 명시 호출 → 자식 entity 확장 시 (Week 4/5) 누락 위험 + 코드 분기 증가. DB FK CASCADE 가 단일 진실 출처.

---

## 3. Project `archived` 마이그레이션 정책 (V5)

### 3-1. 본질

V2 의 `projects.archived BOOLEAN NOT NULL DEFAULT FALSE` → 본 spec V5 의 `projects.archived_at TIMESTAMPTZ NULL` 로 변환 (research R-1).

### 3-2. SQL (V5 마이그레이션 일부)

```sql
-- 1. archived_at 컬럼 추가
ALTER TABLE projects ADD COLUMN archived_at TIMESTAMPTZ;

-- 2. 기존 archived=true 행을 archived_at = updated_at 으로 변환 (research R-1)
UPDATE projects SET archived_at = updated_at WHERE archived = TRUE;

-- 3. 기존 archived 컬럼 DROP
ALTER TABLE projects DROP COLUMN archived;

-- 4. 인덱스 교체
DROP INDEX IF EXISTS idx_projects_user_archived_updated_at;
CREATE INDEX idx_projects_user_archived_at_updated_at
  ON projects (user_id, archived_at NULLS FIRST, updated_at DESC);
```

### 3-3. 적용 정책

- **HARD-GATE** (`.claude/rules/infra/external-infra-safety.md`): SQL 작성·리뷰 OK, **적용은 사용자 명시 컨펌 후**
- 로컬 dev: 신규 DB 환경 → 기존 `archived=true` 행 없음 → UPDATE 빈 효과 + DROP / 인덱스 교체만 적용. risk 최소
- prod (Supabase): 적용 전 백업 의무 — 사용자 컨펌 시점에 백업 명시 + 마이그레이션 dry-run (트랜잭션 안에서 적용 + 검증 + 의도적 rollback) 검토

### 3-4. 회피 패턴

- **금지**: 두 컬럼 (`archived` boolean + `archived_at` timestamp) 병행 유지 → 데이터 일관성 부담 + 마이그레이션 한 번 더
- **금지**: `NOW()` 시각으로 일괄 박음 (실제 보관일 != 마이그레이션 시각) — research R-1
- **금지**: V5 마이그레이션을 SQL 2 파일로 분리 (예: V5 = ALTER + V6 = DROP) → 부분 적용 시 두 컬럼 공존 상태. 단일 마이그레이션 트랜잭션 안에서 박음

### 3-5. 검증 시나리오 (수동 / dry-run)

| 시나리오 | 검증 |
|---|---|
| 마이그레이션 전 `archived=true` 행 N개 + `false` 행 M개 | 마이그레이션 후 `archived_at IS NOT NULL` 행 N개 + `IS NULL` 행 M개 |
| 마이그레이션 후 application 의 활성 목록 쿼리 | 003 의 `ProjectControllerIT` 의 "활성 프로젝트 N+M 개 표시" 케이스 GREEN |

---

## 종합 — 트랜잭션 / 정합 매트릭스

| 영역 | 트랜잭션 | 정합 메커니즘 | 위반 시 |
|---|---|---|---|
| Project 생성 + Document 자동 행 | 단일 트랜잭션 (rollbackFor=Exception) | `@Transactional` + `try` 안에서 throw 그대로 | 반쪽 상태 → spec.md FR-010 위반 |
| Project 영구 삭제 + cascade | 단일 트랜잭션 | DB FK CASCADE (research R-5) | 고아 자식 행 → spec.md FR-007/011 위반 |
| archived 마이그레이션 | 단일 마이그레이션 (Flyway 단일 트랜잭션) | UPDATE → DROP 순서 박음 | 두 컬럼 공존 상태 → 데이터 일관성 부담 |
| Character reorder | 단일 트랜잭션 | `CharacterReorderValidator` + `@Transactional` 안에서 N rows UPDATE | 부분 갱신 → spec.md FR-016 위반 |
| 메타 부분 수정 | 단일 트랜잭션 | `applyMetadata(req)` null 분기 + dirty checking | 의도 외 필드 변경 → spec.md FR-004 위반 |
