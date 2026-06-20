-- V11 — 등장인물 필드 확장 (Round 1 / US3, F1 / #38)
-- SoT: specs/019-round1-schema-extensions/data-model.md §3
-- 나이(자유 텍스트)·성별(코드+CHECK)·특징(자유 텍스트) 추가. "소개"는 기존 short_description 이 담당.
-- 3컬럼 모두 NULL 허용 → 기존 인물 행 무변경.

ALTER TABLE characters
    ADD COLUMN age VARCHAR(80),
    ADD COLUMN gender VARCHAR(16) CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
    ADD COLUMN traits TEXT CHECK (traits IS NULL OR length(traits) <= 10000);
