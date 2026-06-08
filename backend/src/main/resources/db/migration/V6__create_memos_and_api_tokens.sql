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
