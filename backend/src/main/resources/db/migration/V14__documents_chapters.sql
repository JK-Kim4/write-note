-- V14 챕터(Chapter) — documents 1:1 → 1:N 확장
-- SoT: specs/022-chapters/data-model.md
-- 제약명: documents_project_id_key (V5 인라인 UNIQUE 의 Postgres 자동 명명)

-- 1:1 강제 해제
ALTER TABLE documents DROP CONSTRAINT documents_project_id_key;

-- 작품 안 챕터 순서 (0부터). 기존 행은 sort_order=0 무손실 편입.
ALTER TABLE documents ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- soft-delete 표시. NULL=활성. 기존 행은 deleted_at=NULL 무손실 편입.
ALTER TABLE documents ADD COLUMN deleted_at TIMESTAMPTZ NULL;

-- 목록 조회 정렬 인덱스
CREATE INDEX idx_documents_project_sort ON documents (project_id, sort_order);

-- 활성 필터 부분 인덱스 (V9 memos 패턴)
CREATE INDEX idx_documents_project_active ON documents (project_id) WHERE deleted_at IS NULL;
