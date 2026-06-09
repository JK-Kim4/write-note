-- V7 — Web 포팅 backend 확장: next_scene · pinned + project_logs · work_sessions
-- SoT: specs/014-web-port-backend-extension/data-model.md
-- desktop(electron/db/schema.ts v5·v6) 의 4종 기능을 서버 모델로 이식.

-- US1 — 다음 장면 (desktop projects.next_scene)
ALTER TABLE projects ADD COLUMN next_scene TEXT NOT NULL DEFAULT '';

-- US2 — 곁쪽지 고정 (desktop memo_projects.pinned). 작품당 1개 불변식 = partial unique index.
ALTER TABLE memo_projects ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX uq_memo_project_pinned ON memo_projects (project_id) WHERE pinned;

-- US3 — 집필 기록 (desktop project_logs)
CREATE TABLE project_logs (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_project_logs_project ON project_logs (project_id, created_at DESC);

-- US4 — 작업 세션 (desktop work_sessions). 작품당 열린 세션 1개 불변식 = partial unique index.
CREATE TABLE work_sessions (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ
);
CREATE INDEX idx_work_sessions_project ON work_sessions (project_id);
CREATE UNIQUE INDEX uq_work_session_open ON work_sessions (project_id) WHERE ended_at IS NULL;
