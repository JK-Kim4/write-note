# Research: Phase 2 Backend — Project Metadata & Character CRUD

**Date**: 2026-05-25
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

본 문서는 plan.md 작성 시점에 마주친 **9 개 결정 영역** 의 결정 + 근거 + 대안. 03-backend-requirements.md §2-2/§3-3 가 SoT 이지만 일부 detail 영역 미명시 → 본 research 에서 default 박음. spec.md / data-model.md / contracts/ 에서 본 research 결정 인용.

---

## R-1. Project `archived` boolean → `archived_at` timestamp 마이그레이션 정책

**Decision**: V5 마이그레이션 1개에서 다음 SQL 순서로 변환:
```sql
ALTER TABLE projects ADD COLUMN archived_at TIMESTAMPTZ;
UPDATE projects SET archived_at = updated_at WHERE archived = TRUE;
ALTER TABLE projects DROP COLUMN archived;
DROP INDEX IF EXISTS idx_projects_user_archived_updated_at;
CREATE INDEX idx_projects_user_archived_at_updated_at ON projects (user_id, archived_at NULLS FIRST, updated_at DESC);
```

**Rationale**:
- `archived=true` 행은 *언제 보관됐는지* 신호가 필요 (보관함 정렬 / "최근 보관한 항목" 표시 가능성). `updated_at` 시각이 합리적 근사 (보관 == 마지막 변경 가정).
- `archived=false` → `NULL` 직관적 (NULL == 미보관).
- 기존 boolean 인덱스 `idx_projects_user_archived_updated_at` 폐기 + 새 timestamp 인덱스 신설. `NULLS FIRST` 는 활성(NULL) 먼저 조회 자연스러움.
- 단일 마이그레이션 트랜잭션 안에서 ALTER + UPDATE + DROP 박음 → 부분 적용 회피.

**Alternatives considered**:
- `NOW()` 시각으로 일괄 박음 → 잘못된 보관 시각 (실제 보관일 != 마이그레이션일). 기각.
- `created_at` 박음 → 만든 시점부터 보관된 것처럼 보임. 기각.
- 두 컬럼 (boolean + timestamp) 병행 유지 → 데이터 일관성 부담 + DDL 한 번 더. 기각.

**Risk**: 기존 데이터 손실 가능성 — 마이그레이션 적용 전 사용자 명시 컨펌 의무 (`.claude/rules/infra/external-infra-safety.md` HARD-GATE). 로컬 dev 환경은 신규 DB 라 risk 없지만, prod (Supabase) 적용 시 백업 의무.

---

## R-2. 메타 5 필드 길이 상한 + 검증 규칙

**Decision**: 03-backend-requirements §2-2 미명시 → 본 research 에서 default 박음:

| 필드 | 컬럼 타입 | 길이 상한 | Validation 어노테이션 |
|---|---|---|---|
| `genre` | `VARCHAR(100)` | 100 자 | `@Size(max = 100)` |
| `target_length` | `INTEGER` | 1 ~ 100_000_000 | `@Min(1) @Max(100_000_000)` (nullable) |
| `tone_notes` | `TEXT` | 2000 자 | `@Size(max = 2000)` |
| `synopsis` | `TEXT` | 5000 자 | `@Size(max = 5000)` |
| `world_notes` | `TEXT` | 10000 자 (마크다운) | `@Size(max = 10000)` |
| `title` (기존) | `VARCHAR(120)` | 120 자 (변경 없음) | `@NotBlank @Size(max = 120)` |

**Rationale**:
- 단막극 시놉시스 ~500자 / 장편 ~2000자 예상 (DESIGN.md 79줄 "시놉시스 한 단락"). 5000 자 여유.
- 세계관 노트 = 마크다운 자유 (DESIGN.md 82줄) → 10000 자 = ~A4 5장 분량. 본인 dogfooding 충분.
- `target_length` 자수 단위 정수. 단편 1000~3000 자 / 장편 100000+ 자 가정. 상한 100M 자 (실용적 무한).
- 검증 실패 시 응답 = 400 + `VALIDATION_FAILED` + 메시지 (기존 envelope, 003 / 001 정합).

**Alternatives considered**:
- 검증 규칙 본 spec scope 외 → dogfooding 시점에 박음. 기각 — TDD HARD-GATE 영역 (도메인 분기 / 매핑) 이라 spec 작성 시점에 박는 게 정합.
- 더 짧은 상한 (예: synopsis 2000자) → 사용자가 긴 시놉시스 쓰고 싶을 때 차단. 기각.

---

## R-3. Document `body` JSONB 초기값

**Decision**: DB DEFAULT = `'{"type":"doc","content":[]}'::jsonb`. TipTap / ProseMirror 빈 문서의 *최소 정합 JSON*.

**Rationale**:
- PoC 0-1 (`docs/poc/0-1-tiptap-korean.md`) 에서 TipTap 초기화 시 `editor.getJSON()` 반환 default 가 `{"type":"doc","content":[]}` 박힘 — TipTap default 빈 doc.
- DB DEFAULT 로 박으면 Document auto-provisioning (FR-009) 시 application 코드에서 `body` 누락해도 안전 + 마이그레이션 시점에 기존 행 (없음) 도 안전.
- NULL 허용 X (`NOT NULL`) — body 가 NULL 이면 클라이언트 TipTap 초기화 부담.

**Alternatives considered**:
- `'{}'` 빈 객체 → TipTap 초기화 시 `type=doc` 보정 필요. 기각.
- Application 레이어에서 `Document(body = ProseMirrorDoc.empty())` 박음 → 정합하지만 DB DEFAULT 로 박는 게 더 견고. 채택 + 둘 다 박음 (Defense in depth).

**Note**: 본 spec 은 Document body 의 *구조 검증* (ProseMirror JSON schema) 은 박지 않음. Week 3 에서 본문 CRUD 진입 시 결정.

---

## R-4. Character `display_order` 초기값 + 동순위 처리

**Decision**:
- Character 생성 시 `displayOrder` 미지정 → DB DEFAULT `0` 적용. 사용자가 명시 지정도 가능 (CreateCharacterRequest 의 `displayOrder` nullable).
- 동순위 (`display_order` 동일) 발생 시 → `created_at ASC` 으로 정렬 (FR-013 정합).
- 정렬 쿼리: `findAllByProjectIdOrderByDisplayOrderAscCreatedAtAsc(projectId)`.

**Rationale**:
- 인물 추가 시 사용자 의도 = "맨 뒤에 추가". 그러나 `display_order` 자동 계산 (`MAX + 1`) 박으면 race condition + 추가 쿼리 1회. default 0 + 동순위 처리로 단순화.
- reorder (FR-016) 호출로 사용자가 명시 정렬 가능 → 자동 계산 불필요.
- 인물 ~5 명 환경 (V1) 에서 동순위 처리 비용 무시 가능.

**Alternatives considered**:
- 자동 `MAX + 1` 박음 → race condition + 추가 쿼리. 기각.
- `position FLOAT` 박아 중간 삽입 무한 가능 → 본 spec scope 과잉. 기각 (V1 본인 1명, 명시 reorder 충분).

---

## R-5. Project 영구 삭제 cascade 정책

**Decision**: **DB FK `ON DELETE CASCADE`** 박음. JPA `@OneToMany(cascade = [REMOVE])` / `orphanRemoval` 은 부가 layer 로 박지 않음.

```sql
-- V5 마이그레이션
ALTER TABLE characters ADD CONSTRAINT fk_characters_project
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE documents ADD CONSTRAINT fk_documents_project
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
```

JPA entity:
```kotlin
@Entity
class Character(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    val project: Project,
    // ...
)
```

Service:
```kotlin
@Transactional(rollbackFor = [Exception::class])
fun deleteProject(userId: Long, projectId: Long) {
    val project = projectRepository.findByIdAndUserId(projectId, userId)
        ?: throw ResourceNotFoundException()
    projectRepository.delete(project)  // DB FK CASCADE 위임
}
```

**Rationale**:
- DB FK CASCADE = 단일 DELETE SQL 로 자식 정리. 성능 + 정합성 모두 우수.
- JPA cascade = N+1 (Project → Children 로딩 → 각각 DELETE) 가능성. 기각.
- Service 명시 삭제 = 코드 분기 추가 + 자식 entity 확장 시 누락 위험. 기각.
- Memo / SessionNote / MemoProject (본 spec scope 외 — Week 4/5 entity 미구현) 는 신설 시점 (Week 4/5) 에 FK CASCADE 박음. 본 spec 시점에는 적용 영역 없음 (entity 자체 없음).

**Alternatives considered**:
- JPA `orphanRemoval = true` 박음 + Service 에서 `project.characters.clear()` → JPA 영속 컨텍스트 동기 부담 + 본 spec scope 과잉. 기각.

**Risk**: FK CASCADE 는 *조용한 자식 삭제* — 통합 테스트에서 명시 검증 의무 (US2 Acceptance 3, FR-007/011, SC-002).

---

## R-6. ProjectController + CharacterController 분리 vs 통합

**Decision**: **분리**. ProjectController + CharacterController 두 클래스.

**Rationale**:
- 003 패턴 정합 — AuthController 단일 / ProjectController 분리. 도메인 분리 일관성.
- Character endpoint = `/api/projects/{projectId}/characters/...` nested 경로 → CharacterController 가 명확.
- 단일 controller (`ProjectController` 가 13 endpoint 모두) = 클래스 비대화 + Phase 4/5 메모 / 세션 노트 진입 시 controller 분리 부담.
- 03-backend-requirements §3-3 의 endpoint 그룹 자체가 "프로젝트" / "등장인물" 로 분리됨.

**Alternatives considered**:
- 통합 ProjectController 13 endpoint → 클래스 비대화 (FR 글로벌 룰 §"파일 300줄 이하" 위반 가능성). 기각.

---

## R-7. 테스트 전략 정합

**Decision** (003 양식 + JPA test pattern 룰 정합):

| 영역 | 테스트 종류 | 비고 |
|---|---|---|
| Project / Character / Document entity (DB DEFAULT / FK CASCADE) | Repository IT | `EntityManager.flush() + clear()` 후 SELECT 의무 (jpa-test-patterns.md §1) |
| ProjectService 메타 부분 수정 매핑 | 단위 (MockK) | `any()` 금지 — `eq()` / `match {}` |
| ProjectService Document auto-provisioning 트랜잭션 | 통합 (Spring + DB) | rollback 검증 — 본문 실패 시 Project 도 롤백 |
| ProjectService cascade | 통합 | DB FK CASCADE 동작 명시 검증 (자식 행 수 before/after) |
| CharacterService reorder | 단위 + 통합 | 단위 = ReorderValidator 호출 검증 / 통합 = 트랜잭션 안에서 N rows 모두 갱신 |
| ProjectController / CharacterController | Web IT (`@AutoConfigureMockMvc`) | 003 양식 정합 — JWT 헤더 + happy / forbidden / not-found 케이스 |
| ProjectControllerOwnerCleanupTest (003 박힘) | 회귀 유지 | 본 spec 의 5 endpoint → 7 endpoint 확장 시 owner 격리 회귀 확인 |
| N+1 회피 (SC-009) | Repository IT | Hibernate SQL 로그 카운트 또는 `@DataJpaTest` 안 SQL 통계 assertion |

클래스 레벨 `@Transactional` 박힌 표준 fixture 사용 가능 — 본 spec 영역에는 `REQUIRES_NEW` / `AFTER_COMMIT` 흐름 없음 (`jpa-test-patterns.md` §3 미적용).

---

## R-8. Project archive / unarchive endpoint 양식 (POST vs PATCH)

**Decision**: **POST** 채택 — 03-backend-requirements §3-3 의 #17 `POST /api/projects/{id}/archive` + #18 `POST /api/projects/{id}/unarchive` 정합.

**Rationale**:
- 03-backend-requirements §3-3 가 SoT — 명시 POST. 본 research 는 정합 확인만.
- archive 동작 = *상태 전이 액션* (boolean 토글이 아니라 시각 박는 의미). POST 가 RESTful action endpoint 양식.
- PATCH `archived: true` 패턴 = 단순 상태 토글에 가까움. archive 시각 자동 박기 의미 약화.
- 멱등성: POST `/archive` 두 번 호출 시 → 두 번째는 200 OK 응답 + `archived_at` 값 유지 (멱등 박음. 두 번째 호출이 시각 갱신하지 않음 — research R-1 의 `WHERE archived_at IS NULL` 조건 검증).

**Alternatives considered**:
- PATCH `archived: true|false` → SoT 위반. 기각.

---

## R-9. 메모 / SessionNote / MemoProject 등 미구현 entity 의 cascade 정책

**Decision**: 본 spec 시점에는 적용 영역 없음 — Memo / SessionNote / MemoProject / MemoProjectCharacter entity 자체가 미존재 (Week 4/5 영역). V5 마이그레이션에서 이들 테이블 사전 생성 박지 않음. 본 spec scope = Project / Character / Document 3 entity 한정.

미래 entity 신설 (Week 4 = Memo / MemoProject / MemoProjectCharacter / ApiToken / V6 마이그레이션; Week 5 = SessionNote / V7) 시점에 해당 마이그레이션 안에 `FK ... ON DELETE CASCADE` 박음 — 본 spec 의 cascade 정책과 정합.

**Rationale**:
- spec scope 분리 — 본 spec 은 Phase 2-1/2-2/2-3 한정. Phase 4 (Week 4 / Memo) / Phase 5 (Week 5 / SessionNote) 는 별도 spec.
- 미래 entity 의 FK 정책을 본 spec 마이그레이션에 박으면 *작동하지 않는 SQL* (참조 대상 테이블 없음 → 본인이 본인 테이블에 FK 박는 양식 불가). 기각.

**Note**: 본 spec 의 Project 영구 삭제 동작 (`DELETE /api/projects/{id}`) 은 미래 시점 (Week 4/5 entity 신설 후) cascade 영역 자동 확장. 그 시점에는 본 spec 의 Service 코드 변경 없이도 DB FK CASCADE 가 모든 자식 처리. spec.md FR-007 의 "자식 데이터 (등장인물 / 본문 / 세션 노트 / 메모 연결) 도 함께 사라져야" 명시는 *Week 4/5 진입 후 자동 만족* 의미.

---

## 종합

| Decision | SoT 정합 | TDD HARD-GATE 영역? | 회피 패턴 박혔나 |
|---|---|---|---|
| R-1 archived 마이그레이션 | 부분 (SoT 미명시 detail) | ✗ (DDL 영역) | 사용자 컨펌 의무 (external-infra-safety.md) |
| R-2 메타 검증 규칙 | 부분 (SoT 미명시) | ✓ (도메인 분기) | `@Size` / `@Min` / `@Max` 단위 테스트 |
| R-3 Document body default | ✓ (PoC 0-1 정합) | ✗ (DB DEFAULT) | DB IT 검증 |
| R-4 display_order default | 부분 (SoT 미명시) | ✓ (정렬 매핑) | Repository IT |
| R-5 cascade 정책 | ✓ (자명한 정합) | ✓ (상태 전이) | 통합 IT 명시 검증 |
| R-6 Controller 분리 | ✓ (003 패턴) | ✗ (구조) | — |
| R-7 테스트 전략 | ✓ (jpa-test-patterns) | — | jpa-test-patterns §1 적용 |
| R-8 archive POST | ✓ (SoT §3-3 명시) | ✗ (URL) | 멱등성 IT |
| R-9 미래 entity cascade | scope 외 박음 | — | Week 4/5 마이그레이션 시점에 박음 |

R-1 / R-2 / R-4 의 SoT 미명시 영역은 본 spec 의 plan/data-model/contracts 산출 후 사용자 dogfooding 회귀 시 03-backend-requirements §6 변경 이력에 행 추가 가능 (SoT §7 정합).
