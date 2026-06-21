CREATE TABLE announcements (
    id            BIGSERIAL PRIMARY KEY,
    title         VARCHAR(200) NOT NULL,
    body          TEXT         NOT NULL,
    is_published  BOOLEAN      NOT NULL DEFAULT FALSE,
    is_pinned     BOOLEAN      NOT NULL DEFAULT FALSE,
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 공개 공지 최신순 조회 최적화(배너·목록)
CREATE INDEX idx_announcements_published
    ON announcements (is_published, published_at DESC);
