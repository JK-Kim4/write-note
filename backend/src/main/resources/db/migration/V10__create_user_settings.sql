-- V10 — 사용자 환경설정 서버 영속 (Round 1 / US2, A3 / #37)
-- SoT: specs/019-round1-schema-extensions/data-model.md §2
-- 테마·작성 모드·원고지 크기를 계정에 묶어 저장(다기기 동기화). key-value 행 — 항목 추가에 열린 구조.
-- setting_key: 'key' 는 SQL/HQL 예약어라 컬럼명 충돌 회피.

CREATE TABLE user_settings (
    user_id BIGINT NOT NULL,
    setting_key VARCHAR(64) NOT NULL,
    value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, setting_key),
    CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);
