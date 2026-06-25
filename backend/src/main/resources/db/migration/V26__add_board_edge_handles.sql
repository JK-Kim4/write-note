-- V26 — 연결(엣지) 앵커(039 트랙 A). 사용자가 드래그로 고른 시작/종료 테두리(top/right/bottom/left)를
-- 저장해 재진입에도 같은 테두리에 연결선이 붙게 한다. 무방향 의미는 불변(화살표 없음) — 시각 앵커일 뿐.
-- 기존 엣지는 NULL(렌더 시 기본 핸들로 폴백). 값 검증은 FE 가 담당(잘못된 값은 렌더 무시).
ALTER TABLE board_edges ADD COLUMN source_handle VARCHAR(8);
ALTER TABLE board_edges ADD COLUMN target_handle VARCHAR(8);
