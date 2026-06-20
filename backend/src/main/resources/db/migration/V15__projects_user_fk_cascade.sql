-- V15__projects_user_fk_cascade.sql
-- projects → users FK에 ON DELETE CASCADE 추가 (회원 탈퇴 시 User 한 번 삭제로 projects(→documents/characters) cascade 삭제).
-- 기존 제약명: fk_projects_user (V2). 나머지 FK(memos/api_tokens/auth_tokens/user_settings/work_sessions/project_logs)는 이미 CASCADE.

ALTER TABLE projects DROP CONSTRAINT fk_projects_user;
ALTER TABLE projects ADD CONSTRAINT fk_projects_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
