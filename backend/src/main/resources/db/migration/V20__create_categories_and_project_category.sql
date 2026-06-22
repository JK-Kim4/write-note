-- V20 — 작품 카테고리(UI "모음", 032). 폴더형 1:N + N뎁스 설계(parent_id 보유, v1 앱레벨 1뎁스 강제).
-- 기존 작품은 category_id NULL = 미분류로 자동 정합(무손실). 모음 삭제 시 작품은 SET NULL 로 보존(작품 무손실).
CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(60) NOT NULL,
    parent_id BIGINT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE CASCADE
);
CREATE INDEX idx_categories_user_sort ON categories (user_id, sort_order, id);

ALTER TABLE projects
    ADD COLUMN category_id BIGINT,
    ADD CONSTRAINT fk_projects_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL;
CREATE INDEX idx_projects_user_category ON projects (user_id, category_id);
