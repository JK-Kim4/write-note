# Quickstart: Phase 2 Backend — Project Metadata & Character CRUD

**Date**: 2026-05-25
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

본 문서는 본 spec implement GREEN 후 **로컬 dogfooding 진입 절차** 박음. 사용자 (본인) 가 SC-001 ~ SC-010 검증할 때 따라가는 흐름.

---

## 0. 사전 조건

- macOS 호스트 (Darwin 25, Corretto 25)
- `docker` 명령 가능 + Docker Desktop 기동
- `cd /Users/jongwan-air/Desktop/workspaces/write-note` 시점에서 시작
- 로컬 Postgres 컨테이너 기동: `docker compose up -d --wait postgres`
- 003 Phase 1B Backend Auth 적용 완료 (V3 / V4 마이그레이션 박힘 + JWT 인증 흐름 GREEN)

---

## 1. V5 마이그레이션 적용 (HARD-GATE)

본 spec 의 `V5__expand_projects_and_create_character_document.sql` 적용은 **사용자 명시 컨펌 후만 가능** (`.claude/rules/infra/external-infra-safety.md`).

### 1-1. 적용 전 백업 (prod 환경 시)

로컬 dev = 신규 DB → 백업 불필요. prod (Supabase) 적용 시 Supabase 콘솔에서 백업 박은 후 진행.

### 1-2. dry-run 검증 (옵션)

```bash
# psql 로 트랜잭션 안에서 적용 + 의도적 rollback
docker compose exec -T postgres psql -U writenote -d writenote -1 -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
\i /docker-entrypoint-initdb.d/V5__expand_projects_and_create_character_document.sql
-- 검증 쿼리 박음
SELECT COUNT(*) AS projects_with_archived_at FROM projects WHERE archived_at IS NOT NULL;
SELECT COUNT(*) AS characters FROM characters;
SELECT COUNT(*) AS documents FROM documents;
ROLLBACK;
SQL
```

### 1-3. 정식 적용

```bash
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'
```

Spring Boot 부팅 시 Flyway 가 V5 자동 감지 + 적용. 로그에서 `Migrating schema "public" to version "5"` 확인.

---

## 2. 검증 게이트 (SC-007)

본 spec 종료 박는 단일 명령:

```bash
cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build
```

GREEN 의무. 회귀 시 stop + 디버그.

---

## 3. dogfooding 시나리오 (SC-001 ~ SC-010)

본 절차는 본 spec 의 13 endpoint 를 *작가 한 명* 시점에서 직접 호출. JWT 토큰은 003 의 `/api/auth/login` 으로 사전 발급 (`Bearer eyJ...`).

### 3-1. SC-001: 메타 5 필드 영속 (US1)

```bash
# 새 프로젝트 + 메타 5 필드
TOKEN="Bearer eyJ..."  # 003 로그인으로 사전 발급
curl -X POST http://localhost:8080/api/projects \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "단막극 — 손녀",
    "genre": "치유물",
    "targetLength": 4000,
    "toneNotes": "잔잔, 회상",
    "synopsis": "할머니와 손녀의 마지막 여름 카페 대화",
    "worldNotes": "1990 년대 후반 서울 변두리"
  }'
# 응답에서 id 캡처 (예: 13)

# 같은 토큰으로 다른 세션 시뮬레이션 — 즉시 단건 조회
curl http://localhost:8080/api/projects/13 -H "Authorization: $TOKEN"
# 응답 검증: 5 필드 모두 동일 값 반환
```

### 3-2. SC-002: lifecycle (US2)

```bash
# 활성 목록 (보관 전)
curl 'http://localhost:8080/api/projects?archived=false' -H "Authorization: $TOKEN"
# 응답: content 에 13 포함

# 보관
curl -X POST http://localhost:8080/api/projects/13/archive -H "Authorization: $TOKEN"
# 응답: archivedAt 시각 박힘

# 활성 목록 (보관 후)
curl 'http://localhost:8080/api/projects?archived=false' -H "Authorization: $TOKEN"
# 응답: content 에 13 없음

# 보관함 조회
curl 'http://localhost:8080/api/projects?archived=true' -H "Authorization: $TOKEN"
# 응답: content 에 13 등장

# 보관 해제
curl -X POST http://localhost:8080/api/projects/13/unarchive -H "Authorization: $TOKEN"

# 영구 삭제
curl -X DELETE http://localhost:8080/api/projects/13 -H "Authorization: $TOKEN"
# 204 No Content
```

### 3-3. SC-003: Document auto-provisioning (US3)

```bash
# 새 프로젝트 생성 직후 DB 검증
docker compose exec -T postgres psql -U writenote -d writenote -c \
  "SELECT p.id, p.title, d.id AS doc_id, d.body FROM projects p \
   LEFT JOIN documents d ON d.project_id = p.id \
   WHERE p.id = 13"
# 응답: doc_id NOT NULL + body = '{"type":"doc","content":[]}'
```

### 3-4. SC-004: Character CRUD + reorder (US4 + US5)

```bash
# 인물 3명 추가
curl -X POST http://localhost:8080/api/projects/13/characters \
  -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"민지","shortDescription":"주인공, 22세 손녀"}'
# id 101 캡처

curl -X POST http://localhost:8080/api/projects/13/characters \
  -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"할머니","shortDescription":"민지의 할머니"}'
# id 102 캡처

curl -X POST http://localhost:8080/api/projects/13/characters \
  -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"옆집 아저씨","shortDescription":"단역"}'
# id 103 캡처

# 목록 조회 — 추가 순 (display_order 모두 0, created_at ASC)
curl http://localhost:8080/api/projects/13/characters -H "Authorization: $TOKEN"
# 응답 순서: [민지, 할머니, 옆집 아저씨]

# reorder — [할머니, 민지, 옆집 아저씨]
curl -X PUT http://localhost:8080/api/projects/13/characters/reorder \
  -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"characterIds":[102,101,103]}'
# 응답: [할머니(displayOrder=0), 민지(=1), 옆집(=2)]

# 부분 수정 — 민지 description 갱신
curl -X PATCH http://localhost:8080/api/projects/13/characters/101 \
  -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  -d '{"shortDescription":"주인공, 24세로 갱신"}'

# 삭제
curl -X DELETE http://localhost:8080/api/projects/13/characters/103 \
  -H "Authorization: $TOKEN"
# 204
```

### 3-5. SC-005: ownership 격리 (US1 / US2 / US4 ACC #3)

```bash
# 다른 사용자 계정으로 로그인 — TOKEN_B 발급
TOKEN_B="Bearer eyJ..."  # 003 의 다른 사용자 로그인

# 사용자 A 의 프로젝트 13 을 사용자 B 가 접근 시도
curl http://localhost:8080/api/projects/13 -H "Authorization: $TOKEN_B"
# 응답: 404 RESOURCE_NOT_FOUND (정보 노출 회피)

# 사용자 A 의 인물 101 을 사용자 B 가 접근 시도
curl http://localhost:8080/api/projects/13/characters/101 -H "Authorization: $TOKEN_B"
# 응답: 404 RESOURCE_NOT_FOUND

# 사용자 A 의 프로젝트 13 을 사용자 B 가 삭제 시도
curl -X DELETE http://localhost:8080/api/projects/13 -H "Authorization: $TOKEN_B"
# 응답: 404 + 사용자 A 의 프로젝트 그대로
```

### 3-6. SC-006: 마이그레이션 데이터 무손실

V2 → V5 마이그레이션 후 기존 데이터 (`title` / `created_at`) 정합 보존 + `archived=true` 행이 `archived_at IS NOT NULL` 로 변환됐는지 검증. 본 절차는 V5 적용 직전 / 직후 DB snapshot 비교.

```bash
# V5 적용 전 (003 시점) — projects 행 N개 기존 박혀있다 가정
docker compose exec -T postgres psql -U writenote -d writenote -c \
  "SELECT id, title, archived, created_at FROM projects ORDER BY id" \
  > /tmp/projects_before_v5.txt

# V5 적용

# V5 적용 후
docker compose exec -T postgres psql -U writenote -d writenote -c \
  "SELECT id, title, archived_at IS NOT NULL AS was_archived, created_at FROM projects ORDER BY id" \
  > /tmp/projects_after_v5.txt

# 비교
diff /tmp/projects_before_v5.txt /tmp/projects_after_v5.txt
# 기대: title / created_at 정합 / archived ↔ was_archived 일치
```

### 3-7. SC-008: 페이지네이션 + 최대 size

```bash
# size 초과 요청
curl 'http://localhost:8080/api/projects?size=200' -H "Authorization: $TOKEN"
# 응답: 400 VALIDATION_FAILED (최대 100 강제)

# 정상 페이지네이션
curl 'http://localhost:8080/api/projects?page=0&size=20&sort=updatedAt,desc' \
  -H "Authorization: $TOKEN"
# 응답: totalElements / totalPages / page / size / content 정합
```

### 3-8. SC-009: N+1 회피

`./gradlew test --tests "*ProjectRepositoryIT*N+1*"` 가 GREEN 인지 확인 (Hibernate SQL 로그 카운트 또는 assertion).

### 3-9. SC-010: 인증 없이 호출 차단

```bash
curl http://localhost:8080/api/projects
# 응답: 401 AUTH_TOKEN_MISSING

curl http://localhost:8080/api/projects -H "Authorization: Bearer invalid"
# 응답: 401 AUTH_TOKEN_INVALID
```

---

## 4. 본 spec 종료 시점 액션 (Frontend Trigger)

본 spec 의 자동·수동 dogfooding 모두 GREEN 시점에 다음 액션 의무 (spec.md Assumptions §2 / plan.md Constitution Check §"Frontend trigger gate"):

1. **vault `~/obsidian/write-note/02-PROGRESS.md` 갱신**:
   - §1 "완료된 Phase" 에 "004 Phase 2 Backend (2026-MM-DD)" 항목 추가
   - §2 "현재 진입점" 에 frontend spec 진입 명시 (예: "다음 진입 = 005 Phase 2 Frontend Views — `01-phase-breakdown.md §5 Phase 2-4~2-7`")
2. **본 repo `docs/plan/02-progress.md` 갱신**:
   - §1 "완료된 Phase" 에 004 항목
   - frontend 트리거 한 줄 박음
3. **회고 작성** (`.claude/skills/retrospective/SKILL.md` 정합) — `docs/retrospectives/2026-MM-DD-004-phase-2-backend.md`

---

## 5. 회피 트러블슈팅

| 증상 | 원인 추정 | 대응 |
|---|---|---|
| `./gradlew test` 안 GREEN — Repository IT fail | JPA 1차 캐시 우회 누락 (`flush + clear`) | `~/.claude/rules/kotlin/spring/jpa-test-patterns.md §1` 적용 |
| `documents` INSERT 시 `body` JSON parse error | `JdbcTypeCode(SqlTypes.JSON)` 누락 | Document entity 의 body 컬럼 annotation 확인 |
| Project 영구 삭제 후 `documents` / `characters` 행 잔존 | FK CASCADE 누락 (V5 마이그레이션 미적용 또는 entity FK constraint 오류) | V5 SQL 의 `ON DELETE CASCADE` 확인 + 마이그레이션 재적용 |
| `archived=true` 행이 `archived_at IS NULL` 로 변환됨 | V5 마이그레이션의 `UPDATE` 단계 누락 | 본 spec data-model.md §4 SQL 정합 |
| 다른 사용자의 인물 조회 시 200 응답 | `CharacterService` ownership 검증 누락 | FR-015 정합 — projectId → userId 검증 박힘? |
| Hibernate SQL 로그에 N+1 쿼리 발견 | `@EntityGraph` 또는 `JOIN FETCH` 누락 | FR-019 정합 — Repository 쿼리 메서드 검토 |
