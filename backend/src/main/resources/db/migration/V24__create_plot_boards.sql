-- V24 — 플롯 보드(038, 041 트랙 C 매핑 모델 전환 반영). 작품/시리즈와 독립인 사용자 소유 캔버스 + 보드 전용 카드 + 카드 간 연결(링크).
-- 보드↔(작품|시리즈) 매핑 = 다형 단일소유(owner_type/owner_id, 041): owner_type='project'|'category'|NULL(아이디어). 한 대상에 보드 여러 개(1:N).
-- 다형이라 진짜 FK 없음 — owner 무결성은 앱 검증, 대상 hard delete 시 owner null 강등(앱 훅, 보드 보존)으로 처리.
-- 카드는 쪽지 책상 캡처 메모(memos)와 완전 별개(무참조). 보드 삭제 시 카드·링크 cascade, 카드 삭제 시 링크 cascade.
CREATE TABLE boards (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    owner_type VARCHAR(16),
    owner_id BIGINT,
    viewport_zoom DOUBLE PRECISION NOT NULL DEFAULT 1,
    viewport_x DOUBLE PRECISION NOT NULL DEFAULT 0,
    viewport_y DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_boards_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    -- owner_type/owner_id 는 항상 함께 채워지거나 함께 NULL(아이디어 보드)
    CONSTRAINT ck_boards_owner_pair CHECK (
        (owner_type IS NULL AND owner_id IS NULL)
        OR (owner_type IN ('project', 'category') AND owner_id IS NOT NULL)
    )
);
CREATE INDEX idx_boards_user ON boards (user_id, id);
-- 소속 대상 보드 조회(내부 탭·집필 참조 대비). 1:N — 유니크 아님.
CREATE INDEX idx_boards_owner ON boards (owner_type, owner_id);

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
