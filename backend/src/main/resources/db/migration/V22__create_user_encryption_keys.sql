-- V22: 사용자별 DEK(데이터 암호화 키) 봉투 저장
-- wrapped_dek = KEK(마스터 키)로 AES-256-GCM wrap한 DEK 바이트 (iv‖ct‖tag = 60B)
-- key_version = KEK 회전 구조 지원용 버전 식별자 (현재 1 고정)
CREATE TABLE user_encryption_keys (
    user_id     BIGINT      NOT NULL,
    wrapped_dek BYTEA       NOT NULL,
    key_version INTEGER     NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_user_encryption_keys PRIMARY KEY (user_id),
    CONSTRAINT fk_uek_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
