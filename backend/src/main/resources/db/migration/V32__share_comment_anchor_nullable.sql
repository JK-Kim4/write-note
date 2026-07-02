-- V32 — 공유 페이지 고도화(050 US3). 구간 미지정 "전체 의견" 지원을 위해 share_comment 앵커 3컬럼을 nullable화.
-- 셋 다 NULL = 전체 의견(구간 미지정), 셋 다 값 = 구간 댓글 — 서버가 판정(부분 NULL은 애플리케이션 레이어에서 400 거부).
-- 제약 완화 방향이라 기존 데이터(전부 non-null) 무손상. CHECK(>= 0) 제약은 NULL 을 만족으로 취급해 그대로 둔다.
ALTER TABLE share_comment ALTER COLUMN anchor_block_index DROP NOT NULL;
ALTER TABLE share_comment ALTER COLUMN anchor_start       DROP NOT NULL;
ALTER TABLE share_comment ALTER COLUMN anchor_length      DROP NOT NULL;
