-- V19 — 작품별 글자 크기 5단(031 US5). 판형 기본 폰트 위에 작가가 덮어쓰는 스케일.
-- xs/s/m/l/xl = 아주작게/작게/보통(판형 기본)/크게/아주크게. 기본 'm'(판형 기본 그대로).
-- 기존 작품은 'm'으로 채워져 판형 기본 폰트 유지(무손상).
ALTER TABLE projects
    ADD COLUMN font_scale VARCHAR(2) NOT NULL DEFAULT 'm'
        CHECK (font_scale IN ('xs', 's', 'm', 'l', 'xl'));
