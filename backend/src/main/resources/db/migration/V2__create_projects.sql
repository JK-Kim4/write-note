CREATE TABLE projects (
	id BIGSERIAL PRIMARY KEY,
	user_id BIGINT NOT NULL,
	title VARCHAR(120) NOT NULL,
	archived BOOLEAN NOT NULL DEFAULT FALSE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_projects_user_updated_at ON projects (user_id, updated_at DESC);
CREATE INDEX idx_projects_user_archived_updated_at ON projects (user_id, archived, updated_at DESC);
