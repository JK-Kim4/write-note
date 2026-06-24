-- V24 — 플롯 보드(038). 작품/시리즈와 독립인 사용자 소유 캔버스 + 보드 전용 노드 + 노드 간 방향 연결(엣지).
-- 보드↔작품, 보드↔시리즈 매핑은 모두 0~1:0~1. 대상당 보드 1개 = 부분 유니크. 대상 삭제 시 보드 보존(SET NULL).
-- 노드는 쪽지 책상 캡처 메모(memos)와 완전 별개(무참조). 보드 삭제 시 노드·엣지 cascade, 노드 삭제 시 엣지 cascade.
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

CREATE TABLE board_nodes (
    id BIGSERIAL PRIMARY KEY,
    board_id BIGINT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    pos_x DOUBLE PRECISION NOT NULL,
    pos_y DOUBLE PRECISION NOT NULL,
    z_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_board_nodes_board FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
);
CREATE INDEX idx_board_nodes_board ON board_nodes (board_id);

CREATE TABLE board_edges (
    id BIGSERIAL PRIMARY KEY,
    board_id BIGINT NOT NULL,
    source_node_id BIGINT NOT NULL,
    target_node_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_board_edges_board FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE,
    CONSTRAINT fk_board_edges_source FOREIGN KEY (source_node_id) REFERENCES board_nodes (id) ON DELETE CASCADE,
    CONSTRAINT fk_board_edges_target FOREIGN KEY (target_node_id) REFERENCES board_nodes (id) ON DELETE CASCADE,
    CONSTRAINT uq_board_edges_triplet UNIQUE (board_id, source_node_id, target_node_id),
    CONSTRAINT ck_board_edges_no_self CHECK (source_node_id <> target_node_id)
);
CREATE INDEX idx_board_edges_board ON board_edges (board_id);
