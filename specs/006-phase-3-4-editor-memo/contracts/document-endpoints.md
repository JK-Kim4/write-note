# Contract: 본문(Document) 엔드포인트

**SoT**: `docs/plan/03-backend-requirements.md` §3-4 + clarify Q1(nested 추가). 응답 래퍼 = `Result<T>`(success/data | success:false/error). 인증 = JWT(쿠키/헤더). 소유 격리 = 타인 자원 404.

본 spec 신규: **4 endpoint** (§3-4 의 3 + nested 조회 1). nested 추가는 03-backend §6 변경이력 기록 의무.

| # | 메서드 | 경로 | 본질 |
|---|---|---|---|
| D1 | GET | `/api/projects/{projectId}/document` | **(신규, clarify Q1)** 프로젝트의 본문 1건 조회 (projectId 기준) |
| D2 | GET | `/api/documents/{id}` | 본문 단건 조회 (본문 id 기준, §3-4 #26) |
| D3 | PUT | `/api/documents/{id}` | 자동 저장 (optimistic lock + word_count 서버 갱신, §3-4 #27) |
| D4 | PATCH | `/api/documents/{id}/title` | 제목 수정 (§3-4 #28) |

---

## D1. GET /api/projects/{projectId}/document

- **목적**: 작성 화면이 활성 프로젝트의 본문을 한 번에 연다(R-6). 프로젝트↔본문 1:1.
- **응답 200**: `{ id, projectId, title, body, wordCount, version, updatedAt }`
- **에러**: 401 `AUTH_TOKEN_MISSING`/`_INVALID` · 404 `RESOURCE_NOT_FOUND`(타인/미존재 프로젝트 — 정보 노출 회피)
- **비고**: 본문은 프로젝트 생성 시 자동 생성(004)되어 항상 존재. 없으면 404(데이터 정합 이상).

## D2. GET /api/documents/{id}

- **응답 200**: `{ id, projectId, title, body, wordCount, version, updatedAt }`
- **에러**: 401 · 404(타인/미존재)

## D3. PUT /api/documents/{id}  — 자동 저장 (핵심)

- **요청**: `{ body: <ProseMirror JSON>, version: <int> }`
- **처리**: optimistic lock(`@Version`) 검사 → 일치 시 body 저장 + `word_count` 서버 재계산(공백 제외) + `version`+1
- **응답 200**: `{ id, body, wordCount, version: <newVersion>, updatedAt }`
- **충돌 409 `DOCUMENT_VERSION_CONFLICT`**: `{ code, message, currentVersion, currentBody }` → 클라이언트는 자동 덮어쓰지 않고 "다시 불러오기 / 덮어쓰기" 선택 UI(FR-006)
- **에러**: 400 `VALIDATION_FAILED`(잘못된 body JSON) · 401 · 404
- **클라이언트**: 800ms debounce(R-5). 덮어쓰기 선택 시 최신 version 으로 재요청.

## D4. PATCH /api/documents/{id}/title

- **요청**: `{ title: <string ≤120> }`
- **응답 200**: `{ id, title, updatedAt }`
- **에러**: 400(길이 초과) · 401 · 404
- **비고**: 제목은 자동저장 PUT 과 분리(빈도 다름, §3-4).

---

## DTO 네이밍(`api-contract.md` 정합)

- `DocumentResponse` (D1/D2), `SaveDocumentRequest`/`DocumentSaveResponse` (D3), `UpdateDocumentTitleRequest` (D4), `DocumentConflictResponse`(409 body).
