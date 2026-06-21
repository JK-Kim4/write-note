-- V18 — 작품 용지 크기에 출판 판형 4종 추가(031). 기존 ISO 4종 + 신국판/국판/46판/문고판.
-- 'sinkukpan'(9자)이 기존 VARCHAR(8)을 초과하므로 컬럼을 16자로 넓힌다.
-- V12 의 inline CHECK(자동명 projects_paper_size_check)를 8종으로 교체. 기존 행(ISO)은 무손상.
ALTER TABLE projects DROP CONSTRAINT projects_paper_size_check;
ALTER TABLE projects ALTER COLUMN paper_size TYPE VARCHAR(16);
ALTER TABLE projects
    ADD CONSTRAINT projects_paper_size_check
        CHECK (paper_size IN ('A4', 'A3', 'A2', 'B4', 'sinkukpan', 'kukpan', 'pan46', 'mungopan'));
