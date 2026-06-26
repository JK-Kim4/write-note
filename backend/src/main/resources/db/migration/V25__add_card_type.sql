-- V25 — 카드 역할 종류(트랙 D). 카드 선택 후 칩으로 부여·해제, 종류별 색/라벨로 구분.
-- 허용: character(인물)·place(장소)·event(사건)·theme(테마). NULL=무지정(기본, 생성 시 안 물음). 검증은 앱 레벨(ALLOWED_CARD_TYPES).
ALTER TABLE cards ADD COLUMN type VARCHAR(16);
