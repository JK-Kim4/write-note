-- V24 — 플롯 보드(038). 작품/시리즈와 독립인 사용자 소유 캔버스 + 보드 전용 카드 + 카드 간 연결(링크).
-- 보드↔작품, 보드↔시리즈 매핑은 모두 0~1:0~1. 대상당 보드 1개 = 부분 유니크. 대상 삭제 시 보드 보존(SET NULL).
-- 카드는 쪽지 책상 캡처 메모(memos)와 완전 별개(무참조). 보드 삭제 시 카드·링크 cascade, 카드 삭제 시 링크 cascade.
CREATE TABLE boards (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    category_id BIGINT,
    project_id BIGINT,
    viewport_zoom DOUBLE PRECISION NOT NULL DEFAULT 1,
    viewport_x DOUBLE PRECISION NOT NULL DEFAULT 0,
    viewport_y DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_boards_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_boards_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
    CONSTRAINT fk_boards_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL
);
CREATE INDEX idx_boards_user ON boards (user_id, id);
-- 대상당 보드 최대 1개(미매핑 다수 허용) — FR-026
CREATE UNIQUE INDEX uq_boards_project ON boards (project_id) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX uq_boards_category ON boards (category_id) WHERE category_id IS NOT NULL;

CREATE TABLE cards (
    id BIGSERIAL PRIMARY KEY,
    board_id BIGINT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    pos_x DOUBLE PRECISION NOT NULL,
    pos_y DOUBLE PRECISION NOT NULL,
    z_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cards_board FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
);
CREATE INDEX idx_cards_board ON cards (board_id);

CREATE TABLE links (
    id BIGSERIAL PRIMARY KEY,
    board_id BIGINT NOT NULL,
    source_card_id BIGINT NOT NULL,
    target_card_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_links_board FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE,
    CONSTRAINT fk_links_source FOREIGN KEY (source_card_id) REFERENCES cards (id) ON DELETE CASCADE,
    CONSTRAINT fk_links_target FOREIGN KEY (target_card_id) REFERENCES cards (id) ON DELETE CASCADE,
    CONSTRAINT uq_links_triplet UNIQUE (board_id, source_card_id, target_card_id),
    CONSTRAINT ck_links_no_self CHECK (source_card_id <> target_card_id)
);
CREATE INDEX idx_links_board ON links (board_id);
