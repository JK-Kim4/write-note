-- V29 — 공유 사용성 개선(047). 작가의 받은 피드백 읽음 관리.
-- read_at = 작가가 이 피드백을 확인한 시각(NULL=안 읽음). "받은 피드백 N" = read_at IS NULL 개수.
-- 읽음 처리 단위 = 작품(project_id): 작가가 그 작품 '피드백 보기'를 열면 그 작품의 안 읽은 댓글 전체 read_at 채움.
-- 기존 댓글은 NULL(안 읽음)로 시작 — 백필 없음(작가가 새로 모아 봄). additive nullable, 운영 무손실.
ALTER TABLE share_comment ADD COLUMN read_at TIMESTAMPTZ NULL;
-- 안 읽은 수 group 집계(작품별) 가속 — 부분 인덱스(안 읽은 행만). 읽음 처리 후 행은 인덱스에서 빠짐.
CREATE INDEX idx_share_comment_unread ON share_comment (project_id) WHERE read_at IS NULL;
