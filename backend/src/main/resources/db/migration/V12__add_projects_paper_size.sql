-- V12 — 작품별 용지 크기 (Round 2 / 트랙3). 전역 설정(user_settings.paperSize) → 작품당.
-- 기존 작품 행은 기본값 'A4' 로 채워진다(무손상). 허용값은 CHECK 로 강제.
ALTER TABLE projects
    ADD COLUMN paper_size VARCHAR(8) NOT NULL DEFAULT 'A4'
        CHECK (paper_size IN ('A4', 'A3', 'A2', 'B4'));
