-- V17 — 작품별 출판 방식(031). paper=종이 출판(페이지 분할+판형), web=웹 출판(연속+글자수).
-- 기존 작품 행은 기본값 'paper' 로 채워진다(무손상 — 지금까지 페이지 분할로 작동했으므로 동작 보존).
-- 허용값은 CHECK 로 강제. 작품 생성 시 강제 선택은 프론트 UX 계층에서 보장(BE 는 null→'paper').
ALTER TABLE projects
    ADD COLUMN layout_mode VARCHAR(16) NOT NULL DEFAULT 'paper'
        CHECK (layout_mode IN ('paper', 'web'));
