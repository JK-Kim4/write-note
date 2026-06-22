-- V21 — 시리즈(카테고리, 032) 출판 메타 확장(033). 전부 nullable·순수 additive(기존 시리즈 무영향).
-- paper_size/layout_mode 는 R2(판형·출판방식 시리즈 종속), genre/synopsis/target_length 는 R3/R4 에서 사용.
-- 작품(Project) 의 동명 컬럼은 보존하되 effective 해석에서 미사용(무손실·롤백 여지).
ALTER TABLE categories
    ADD COLUMN paper_size VARCHAR(16),
    ADD COLUMN layout_mode VARCHAR(16),
    ADD COLUMN genre VARCHAR(100),
    ADD COLUMN synopsis TEXT,
    ADD COLUMN target_length INTEGER;
