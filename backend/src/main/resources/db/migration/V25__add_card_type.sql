-- V25 — 카드 역할 타입(038 후속). 생성 시 타입 선택, 타입별 색상/라벨로 구분.
-- 허용: plot(플롯/사건, 기본)·character(인물)·place(장소)·theme(테마/소재)·note(메모). 기존 카드는 'plot'.
ALTER TABLE cards ADD COLUMN type VARCHAR(16) NOT NULL DEFAULT 'plot';
