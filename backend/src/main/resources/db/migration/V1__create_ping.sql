CREATE TABLE ping (
    id         BIGSERIAL    PRIMARY KEY,
    message    VARCHAR(100) NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);
