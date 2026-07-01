-- V30 — 카드 관리(048). 보드 없는 독립 카드 허용:
--  (1) cards.user_id 신규(모든 카드 소유를 보드 경유가 아닌 카드 단위로 판별) — 기존 boards.user_id 에서 백필.
--  (2) cards.board_id 를 nullable 로(board_id IS NULL = 독립 카드).
-- additive/in-place. 기존 보드 카드 무손실(백필). 링크·보드 스키마 무변경.

-- (1) user_id 추가 → 백필 → NOT NULL + FK
ALTER TABLE cards ADD COLUMN user_id BIGINT;
UPDATE cards c SET user_id = b.user_id FROM boards b WHERE c.board_id = b.id;
ALTER TABLE cards ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE cards ADD CONSTRAINT fk_cards_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

-- (2) board_id nullable (독립 카드 = NULL). fk_cards_board(ON DELETE CASCADE) 유지 — 보드 삭제 시 그 보드 카드는 함께 삭제.
ALTER TABLE cards ALTER COLUMN board_id DROP NOT NULL;

-- (3) cross-board 카드 목록(생성일 내림차순) 인덱스
CREATE INDEX idx_cards_user ON cards (user_id, created_at DESC);
