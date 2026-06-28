-- V28 — 공유하기(046 R2). 공개 공유본(불변 스냅샷)의 텍스트 구간에 회원이 다는 위치 지정 댓글.
-- 가시성 = 작가 전용(R-3): 공개 read 는 요청자 본인 댓글만, 작가 인박스만 전체 — 스키마 아닌 조회 레이어에서 강제.
-- 앵커 = 불변 스냅샷의 (top-level 블록 인덱스 + 문단 내 시작·길이). 스냅샷이 불변이라 세 값 영구 안정.
-- 댓글 content 는 평문(R-3, 열람자 피드백 — 작가에게만 노출, 낮은 민감도). 대상 작품 삭제 후에도 스냅샷·댓글 보존(FR-025).
CREATE TABLE share_comment (
    id BIGSERIAL PRIMARY KEY,
    share_snapshot_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    anchor_block_index INT NOT NULL,
    anchor_start INT NOT NULL,
    anchor_length INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_share_comment_snapshot FOREIGN KEY (share_snapshot_id) REFERENCES share_snapshot (id) ON DELETE CASCADE,
    CONSTRAINT fk_share_comment_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_share_comment_block_index CHECK (anchor_block_index >= 0),
    CONSTRAINT ck_share_comment_start CHECK (anchor_start >= 0),
    CONSTRAINT ck_share_comment_length CHECK (anchor_length >= 0)
);
-- 스냅샷별 댓글(공개 read), 작가 인박스(project_id 집계), 작성자별 조회.
CREATE INDEX idx_share_comment_snapshot ON share_comment (share_snapshot_id);
CREATE INDEX idx_share_comment_project ON share_comment (project_id);
CREATE INDEX idx_share_comment_author ON share_comment (author_id);
