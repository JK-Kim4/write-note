# Data Model: 에디터·원고지 + 메모 캡처 (Week 3+4 통합)

**Branch**: `006-phase-3-4-editor-memo` | **Date**: 2026-05-30
**SoT**: `docs/plan/03-backend-requirements.md` §2-2 (엔티티 상세). 본 문서는 SoT 를 본 spec scope(핀·세션노트 제외)로 좁혀 정합.

---

## 0. 변경 요약

| 엔티티 | 상태 | 비고 |
|---|---|---|
| **Document** | 기존 (변경 0) | V5 에서 신설됨. 본 spec 은 조회/저장 흐름만 신설(스키마 불변) |
| **Memo** | 신규 | 핀 컬럼(`pinned_document_id`) **제외** — Week 5 이연 |
| **MemoProject** | 신규 | 메모↔프로젝트 M:N |
| **MemoProjectCharacter** | 신규 | MemoProject↔Character M:N |
| **ApiToken** | 신규 | 모바일 캡처용 장기 토큰 |
| User / Project / Character | 기존 (변경 0) | FK 대상으로만 참조 |

마이그레이션: **`V6__create_memos_and_api_tokens.sql`** 단일 파일.

---

## 1. Document (기존 — 재사용, 스키마 변경 없음)

V5 `documents` 테이블 그대로. 필드: `id` / `project_id`(UNIQUE FK) / `title` / `body`(JSONB, ProseMirror) / `word_count` / `version`(@Version) / `created_at` / `updated_at`.

- **본 spec 의 동작 추가**(스키마 무변경):
  - 조회: `findByProjectId`(이미 `DocumentRepository` 에 존재) → nested endpoint(R-6)
  - 저장: PUT 시 `version` optimistic lock + `word_count` 서버 재계산(공백 제외) + `version`+1
  - 충돌: `OptimisticLockException` → 409 `DOCUMENT_VERSION_CONFLICT` + currentVersion/currentBody
- **검증 규칙**: title ≤ 120자. body 는 유효 ProseMirror doc JSON. word_count ≥ 0.

---

## 2. Memo (신규)

```
id                          BIGSERIAL PK
user_id                     BIGINT NOT NULL FK → users
body                        TEXT NOT NULL                         -- plain text, 캡처 본문
source                      VARCHAR(16) NOT NULL                  -- 'MOBILE' | 'DESKTOP' (문자열, enum 컬럼 X)
captured_at                 TIMESTAMPTZ NOT NULL                  -- 서버 도착 시각
active_project_at_capture   BIGINT NULL FK → projects             -- 데스크탑 캡처 시 활성 프로젝트
reason_note                 TEXT NULL                             -- 큐레이션 "왜 적었나"
tags                        TEXT[] NOT NULL DEFAULT '{}'
created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()

인덱스: (user_id, captured_at DESC), tags GIN
제외(Week 5): pinned_document_id  -- 핀 기능 진입 시 ADD COLUMN
```

- **검증 규칙**: body 비어있지 않음(캡처 본문 필수, FR-011). source ∈ {MOBILE, DESKTOP}. tags 각 원소 trim·비중복.
- **상태**: 미분류(MemoProject 0행) ↔ 분류(1+행). 미분류 영구 보존 허용(FR-019).
- **소유 격리**: 모든 조회/수정은 `user_id` 필터(FR-024).
- **삭제 cascade**: Memo 삭제 시 MemoProject(→ MemoProjectCharacter) 함께 정리(FR-020).

## 3. MemoProject (신규)

```
id          BIGSERIAL PK
memo_id     BIGINT NOT NULL FK → memos (ON DELETE CASCADE)
project_id  BIGINT NOT NULL FK → projects (ON DELETE CASCADE)
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE (memo_id, project_id)
인덱스: project_id, memo_id
```

- **미분류 정의**: 한 Memo 에 MemoProject 0행(DESIGN.md 258, FR-019).
- **cascade**: memo 삭제 또는 project 삭제 시 행 제거. project 연결 해제(큐레이션) = 해당 행 delete → MemoProjectCharacter cascade(clarify Q2 해소).

## 4. MemoProjectCharacter (신규)

```
id               BIGSERIAL PK
memo_project_id  BIGINT NOT NULL FK → memo_projects (ON DELETE CASCADE)
character_id     BIGINT NOT NULL FK → characters
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE (memo_project_id, character_id)
```

- **무결성(애플리케이션 검증)**: `character.project_id` = 해당 `memo_project.project_id` 일치(FR-017). 불일치 시 400 `VALIDATION_FAILED`.
- **cascade**: memo_project 행 삭제 시 자동 제거(프로젝트 연결 해제 시 인물 연결도 정리 — clarify Q2).

## 5. ApiToken (신규)

```
id            BIGSERIAL PK
user_id       BIGINT NOT NULL FK → users
token_hash    VARCHAR(64) NOT NULL UNIQUE            -- SHA-256 hex
token_prefix  VARCHAR(8) NOT NULL                    -- UI 식별용 평문 접두 (wnt_ 포함 8자)
label         VARCHAR(120) NOT NULL DEFAULT '새 토큰'
last_used_at  TIMESTAMPTZ NULL                       -- 매 캡처 시 갱신
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
revoked_at    TIMESTAMPTZ NULL                       -- 해지 시각

인덱스: token_hash UNIQUE, (user_id, revoked_at)
```

- **토큰 형태**: `wnt_` + base62 32자(총 36자). 발급 시 원본 1회만 응답(FR-021), 이후 미저장.
- **검증**: 캡처 요청 토큰 SHA-256 → token_hash 조회 + `revoked_at IS NULL`. 해지/미존재/형식오류 → 401(FR-023).
- **해지**: `revoked_at = now()`, DB row 유지(감사).

---

## 6. 관계도 (본 spec scope)

```
User ─1:N─ Memo ─1:N─ MemoProject ─N:1─ Project
                          │
                          └─1:N─ MemoProjectCharacter ─N:1─ Character (project 소속 검증)

User ─1:N─ ApiToken

Project ─1:1─ Document   (기존, 본 spec 은 조회/저장만)
Memo.active_project_at_capture ─N:1─ Project (nullable)
```

---

## 7. V6 마이그레이션 SQL 스케치

> **HARD-GATE**: 작성·리뷰 OK. **적용(`flywayMigrate`/boot 자동)은 사용자 명시 컨펌 후만**(`.claude/rules/infra/external-infra-safety.md`). 로컬 docker postgres 선행 기동.

```sql
-- V6 Week 4 — 메모 캡처 + 모바일 캡처용 토큰
-- SoT: docs/plan/03-backend-requirements.md §2-2 / specs/006 data-model.md
-- 핀(pinned_document_id) 컬럼은 Week 5 영역 — 본 마이그레이션 제외

CREATE TABLE memos (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    source VARCHAR(16) NOT NULL CHECK (source IN ('MOBILE', 'DESKTOP')),
    captured_at TIMESTAMPTZ NOT NULL,
    active_project_at_capture BIGINT REFERENCES projects(id) ON DELETE SET NULL,
    reason_note TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_memos_user_captured ON memos (user_id, captured_at DESC);
CREATE INDEX idx_memos_tags ON memos USING GIN (tags);

CREATE TABLE memo_projects (
    id BIGSERIAL PRIMARY KEY,
    memo_id BIGINT NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_memo_project UNIQUE (memo_id, project_id)
);
CREATE INDEX idx_memo_projects_project ON memo_projects (project_id);
CREATE INDEX idx_memo_projects_memo ON memo_projects (memo_id);

CREATE TABLE memo_project_characters (
    id BIGSERIAL PRIMARY KEY,
    memo_project_id BIGINT NOT NULL REFERENCES memo_projects(id) ON DELETE CASCADE,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_memo_project_character UNIQUE (memo_project_id, character_id)
);

CREATE TABLE api_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    token_prefix VARCHAR(8) NOT NULL,
    label VARCHAR(120) NOT NULL DEFAULT '새 토큰',
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_api_tokens_user_revoked ON api_tokens (user_id, revoked_at);
```

**JPA 정합 의무**(`.claude/rules/kotlin/`): 모든 연관 `LAZY`. 쓰기 `@Transactional(rollbackFor = [Exception::class])`, 읽기 `readOnly = true`. tags `TEXT[]` ↔ Kotlin `List<String>` 매핑(Hibernate `SqlTypes.ARRAY` 또는 `@JdbcTypeCode`). entity 스타일은 기존 `Document.kt`/`Character.kt` 패턴(`@PrePersist`/`@PreUpdate`) 정합.
