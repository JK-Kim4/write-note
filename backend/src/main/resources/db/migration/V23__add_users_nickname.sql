-- 036 사용자 닉네임 — 고유·필수 nickname 컬럼.
-- 운영 안전 순서: nullable 추가 → 기존 회원 백필 → NOT NULL + UNIQUE.

-- 1) nullable 컬럼 추가
ALTER TABLE users ADD COLUMN nickname VARCHAR(16);

-- 2) 기존 회원 백필 — id 기반 고유 단순값(상호 충돌 0). 사용자는 마이페이지에서 변경 가능.
UPDATE users SET nickname = '사용자' || id WHERE nickname IS NULL;

-- 3) NOT NULL + UNIQUE 제약
ALTER TABLE users ALTER COLUMN nickname SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT uk_users_nickname UNIQUE (nickname);
