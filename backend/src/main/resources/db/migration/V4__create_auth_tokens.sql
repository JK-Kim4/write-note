-- V4: Phase 1B Backend Auth Foundation — AuthToken 통합 보조 테이블
-- 출처: docs/plan/03-backend-requirements.md §2-2 AuthToken
-- 본 마이그레이션 적용 주의:
--   - users 테이블 의존 (V1 + V3). V3 의 추가 컬럼은 본 V4 와 무관 (FK 만 의존)
--   - type 컬럼은 ENUM 대신 VARCHAR + CHECK 제약 (Spring JPA @Enumerated(EnumType.STRING) 매핑)

CREATE TABLE auth_tokens (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type       VARCHAR(32)  NOT NULL,
    token_hash VARCHAR(64)  NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ  NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT auth_tokens_type_value
        CHECK (type IN ('EMAIL_VERIFY', 'PASSWORD_RESET', 'REFRESH'))
);

CREATE INDEX idx_auth_tokens_user_type  ON auth_tokens (user_id, type);
CREATE INDEX idx_auth_tokens_expires_at ON auth_tokens (expires_at);
