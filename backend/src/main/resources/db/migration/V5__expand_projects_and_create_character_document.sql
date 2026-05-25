-- V5 Phase 2 Backend — Project metadata extension + archived 변환 + Character/Document 신설
-- SoT: specs/004-phase-2-backend-project-character/data-model.md §4
-- research: R-1 (archived 마이그레이션) / R-2 (메타 검증) / R-3 (Document body default) / R-4 (display_order) / R-5 (cascade)

-- 1. projects 메타 5 컬럼 추가
ALTER TABLE projects ADD COLUMN genre VARCHAR(100);
ALTER TABLE projects ADD COLUMN target_length INTEGER
	CHECK (target_length IS NULL OR (target_length >= 1 AND target_length <= 100000000));
ALTER TABLE projects ADD COLUMN tone_notes TEXT
	CHECK (tone_notes IS NULL OR length(tone_notes) <= 2000);
ALTER TABLE projects ADD COLUMN synopsis TEXT
	CHECK (synopsis IS NULL OR length(synopsis) <= 5000);
ALTER TABLE projects ADD COLUMN world_notes TEXT
	CHECK (world_notes IS NULL OR length(world_notes) <= 10000);

-- 2. archived boolean → archived_at timestamp (research R-1)
ALTER TABLE projects ADD COLUMN archived_at TIMESTAMPTZ;
UPDATE projects SET archived_at = updated_at WHERE archived = TRUE;
ALTER TABLE projects DROP COLUMN archived;

-- 3. projects 인덱스 교체
DROP INDEX IF EXISTS idx_projects_user_archived_updated_at;
CREATE INDEX idx_projects_user_archived_at_updated_at
	ON projects (user_id, archived_at NULLS FIRST, updated_at DESC);

-- 4. characters 테이블 신설 (research R-4, R-5)
CREATE TABLE characters (
	id BIGSERIAL PRIMARY KEY,
	project_id BIGINT NOT NULL,
	name VARCHAR(80) NOT NULL,
	short_description VARCHAR(255),
	notes TEXT CHECK (notes IS NULL OR length(notes) <= 10000),
	display_order INTEGER NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_characters_project FOREIGN KEY (project_id)
		REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_characters_project_order
	ON characters (project_id, display_order ASC, created_at ASC);

-- 5. documents 테이블 신설 (research R-3, R-5)
CREATE TABLE documents (
	id BIGSERIAL PRIMARY KEY,
	project_id BIGINT NOT NULL UNIQUE,
	title VARCHAR(120) NOT NULL DEFAULT '',
	body JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
	word_count INTEGER NOT NULL DEFAULT 0,
	version INTEGER NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_documents_project FOREIGN KEY (project_id)
		REFERENCES projects(id) ON DELETE CASCADE
);
