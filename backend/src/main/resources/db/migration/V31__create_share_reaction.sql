-- V31 — 공유 페이지 고도화(050 US3). 공유 스냅샷 구간에 대한 회원 이모지 반응(공개 집계).
-- 반응은 공개(가시성 제한 없음, 집계는 개수만) — 열람자 누구나 봄. 삭제 = 토글 off.
-- UNIQUE(스냅샷+앵커+이모지+반응자) — 회원·구간·이모지당 1개(토글의 멱등 근거).
-- 대상 삭제 후에도 스냅샷이 보존되는 한(046 정책) 반응도 접근 가능 — FK는 스냅샷 기준 CASCADE.
CREATE TABLE share_reaction (
    id BIGSERIAL PRIMARY KEY,
    share_snapshot_id BIGINT NOT NULL,
    anchor_block_index INT NOT NULL,
    anchor_start INT NOT NULL,
    anchor_length INT NOT NULL,
    emoji TEXT NOT NULL,
    reactor_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_share_reaction_snapshot FOREIGN KEY (share_snapshot_id) REFERENCES share_snapshot (id) ON DELETE CASCADE,
    CONSTRAINT fk_share_reaction_reactor FOREIGN KEY (reactor_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_share_reaction_anchor_reactor
        UNIQUE (share_snapshot_id, anchor_block_index, anchor_start, anchor_length, emoji, reactor_id)
);
-- 스냅샷별 반응 집계 조회(공개 열람 embed·작가 맥락 뷰).
CREATE INDEX idx_share_reaction_snapshot ON share_reaction (share_snapshot_id);
