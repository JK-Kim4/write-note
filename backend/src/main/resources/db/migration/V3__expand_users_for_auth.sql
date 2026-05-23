-- V3: Phase 1B Backend Auth Foundation — Users 인증 메타 추가
-- 출처: docs/plan/03-backend-requirements.md §2-2 Users
-- 본 마이그레이션 적용 주의:
--   - V1 이 이미 kakao_id / password_hash 박음 (uk_users_kakao_id UNIQUE 포함)
--   - 본 V3 는 인증 흐름에 필요한 5 컬럼 + CHECK 제약 1개만 추가
--   - 기존 user row 가 있을 경우 password_hash + kakao_id 가 둘 다 NULL 이면 CHECK 위반 가능

ALTER TABLE users
    ADD COLUMN email_verified_at  TIMESTAMPTZ,
    ADD COLUMN last_login_at      TIMESTAMPTZ,
    ADD COLUMN failed_login_count INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN lockout_until      TIMESTAMPTZ,
    ADD COLUMN updated_at         TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE users
    ADD CONSTRAINT users_credential_present
        CHECK (password_hash IS NOT NULL OR kakao_id IS NOT NULL);
