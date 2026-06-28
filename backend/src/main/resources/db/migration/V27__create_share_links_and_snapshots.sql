-- V27 — 공유하기(046 R1). 작가가 작품/시리즈를 공유 링크로 내보내고(공유 시점 불변 스냅샷 동결),
-- 비로그인 외부인이 읽기 전용으로 열람한다. 토큰은 추측불가 base62 32자(URL 노출 값, 원문 저장 — 조회 키).
-- 스냅샷 본문(body_snapshot) = 공유 시점 documents.body 암호문(owner 키) 복사 — 재암호화 불필요, 공개 read 시 owner 키로 복호.
-- 대상(작품/시리즈) 삭제 시 보존(FR-025): project_id 는 진짜 FK 미설정(보드 다형 owner 선례) — 앱 훅(R3)이 링크 비활성, 스냅샷 보존.
CREATE TABLE share_link (
    id BIGSERIAL PRIMARY KEY,
    token TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id BIGINT NOT NULL,
    owner_id BIGINT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_share_link_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_share_link_target_type CHECK (target_type IN ('work', 'series'))
);
-- 토큰 역조회(공개 read) — unique. 목록 조회 — owner_id.
CREATE UNIQUE INDEX idx_share_link_token ON share_link (token);
CREATE INDEX idx_share_link_owner ON share_link (owner_id);

CREATE TABLE share_snapshot (
    id BIGSERIAL PRIMARY KEY,
    share_link_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    title_snapshot TEXT NOT NULL,
    body_snapshot TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_share_snapshot_link FOREIGN KEY (share_link_id) REFERENCES share_link (id) ON DELETE CASCADE,
    -- 링크당 작품 1회(work=1, series=N). project_id 는 진짜 FK 없음(대상 삭제 보존 — 앱레벨 정합).
    CONSTRAINT uq_share_snapshot_link_project UNIQUE (share_link_id, project_id)
);
CREATE INDEX idx_share_snapshot_link ON share_snapshot (share_link_id);
CREATE INDEX idx_share_snapshot_project ON share_snapshot (project_id);
