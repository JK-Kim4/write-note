-- V8 — 자동저장 재설계: 정수 version 컬럼 제거, updatedAt(@Version) 을 잠금 토큰 겸용으로
-- SoT: specs/016-autosave-localstorage-redesign/data-model.md §1
-- documents.version(INTEGER) 폐기. 낙관적 잠금 토큰은 updated_at(TIMESTAMPTZ, 이미 존재) 이 겸한다.
-- updated_at 은 V5 에서 NOT NULL DEFAULT CURRENT_TIMESTAMP 로 생성됨 — 타입/제약 변경 불필요.
-- ⚠️ 적용(flywayMigrate)은 사용자 명시 컨펌 후에만 (외부 DB 안전 HARD-GATE).

ALTER TABLE documents DROP COLUMN version;
