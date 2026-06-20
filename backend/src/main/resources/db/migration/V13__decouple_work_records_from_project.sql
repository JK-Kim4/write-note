-- V13 — 작업 기록(작업 세션·집필 기록)을 작품 삭제와 분리 (트랙2).
-- 사용자 의도: "집필 기록이 작품과 연관되면 안 됨" — 작품을 삭제해도 전체 작업 기록(시간·로그)은 user 단위로 보존.
-- 작품별 작업 시간은 project_id 기준으로 여전히 조회 가능(활성 작품만 — 삭제 작품은 project_id=NULL 로 떨어짐).
--
-- 변경: work_sessions·project_logs 에 user_id 추가(기존 행은 project.user_id 로 backfill),
-- project_id 를 nullable 로, FK 를 ON DELETE CASCADE → ON DELETE SET NULL 로 교체.

-- ── work_sessions ────────────────────────────────────────────────
ALTER TABLE work_sessions ADD COLUMN user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;
UPDATE work_sessions ws SET user_id = p.user_id FROM projects p WHERE p.id = ws.project_id;
ALTER TABLE work_sessions ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE work_sessions ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE work_sessions DROP CONSTRAINT work_sessions_project_id_fkey;
ALTER TABLE work_sessions ADD CONSTRAINT work_sessions_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX idx_work_sessions_user ON work_sessions (user_id);

-- ── project_logs ─────────────────────────────────────────────────
ALTER TABLE project_logs ADD COLUMN user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;
UPDATE project_logs pl SET user_id = p.user_id FROM projects p WHERE p.id = pl.project_id;
ALTER TABLE project_logs ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE project_logs ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE project_logs DROP CONSTRAINT project_logs_project_id_fkey;
ALTER TABLE project_logs ADD CONSTRAINT project_logs_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX idx_project_logs_user ON project_logs (user_id, created_at DESC);
