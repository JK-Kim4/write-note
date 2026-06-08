CREATE TABLE users (
	id BIGSERIAL PRIMARY KEY,
	email VARCHAR(320) NOT NULL,
	kakao_id VARCHAR(100),
	password_hash VARCHAR(255),
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT uk_users_email UNIQUE (email),
	CONSTRAINT uk_users_kakao_id UNIQUE (kakao_id)
);
