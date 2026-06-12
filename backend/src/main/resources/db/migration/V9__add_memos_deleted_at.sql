-- V9 — 곁쪽지 soft-delete (Round 1 / US1, A1 / #36)
-- SoT: specs/019-round1-schema-extensions/data-model.md §1
-- 버리기 = deleted_at = now(), 되돌리기 = deleted_at = NULL. 연결행(memo_projects 등)은 보존.
-- desktop(electron/db/memoRepository.ts) 의 soft-delete 시맨틱을 서버로 이식.

ALTER TABLE memos ADD COLUMN deleted_at TIMESTAMPTZ;

-- 모든 목록 조회가 user_id + deleted_at IS NULL 을 거친다 — 정상행만 커버하는 부분 인덱스.
CREATE INDEX idx_memos_user_active ON memos (user_id) WHERE deleted_at IS NULL;
