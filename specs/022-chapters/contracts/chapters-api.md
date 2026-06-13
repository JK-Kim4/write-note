# API Contracts: 챕터(Chapter)

**Phase 1 산출** — 챕터 5 endpoint 신설/대체 + 대시보드 카드 집계 변경. 모든 응답은 기존 `Result<T>` envelope(`{success, data, error}`). 소유권 검증 = documentId/projectId 경유 기존 패턴.

## 공통

- 인증: 기존 JWT bearer. 미인증 401.
- 소유권: 타 사용자 작품/챕터 접근 404(노출 최소화).
- 에러 envelope: `{ "success": false, "error": { "code": "...", "message": "..." } }`
- **endpoint 위치(실측 2026-06-13)**: 모든 document/챕터 endpoint 는 기존 `DocumentController.kt` 에 둔다(현재 4 endpoint 가 모두 여기 존재 — 단수 조회 32행·단건 47행·자동저장 62행·제목 79행). 신규 목록/생성/순서/삭제/복구도 동일 컨트롤러에 추가. `ProjectController` 는 손대지 않는다(작품 생성 시 1번 챕터 자동 생성은 `ProjectService` 책임).

## C1. 챕터 목록 — `GET /api/projects/{projectId}/documents`

활성 챕터(`deleted_at IS NULL`)를 `sort_order ASC` 로. **본문(body) 제외** 메타만(전송량 절약).

**200 응답**
```json
{ "success": true, "data": [
  { "id": 12, "title": "1장", "sortOrder": 0, "wordCount": 1820, "updatedAt": "2026-06-13T..." },
  { "id": 15, "title": "2장", "sortOrder": 1, "wordCount": 940,  "updatedAt": "2026-06-12T..." }
] }
```

## C2. 챕터 생성 — `POST /api/projects/{projectId}/documents`

`title` 받아 `sort_order = (활성 최대값)+1` 맨 뒤 추가. **응답에 본문 포함**(생성 직후 진입용).

**요청** `{ "title": "3장" }` — title 미지정/빈 값이면 기본 `새 챕터`(고정 문구, 인터뷰 확정). FE "새 챕터" 버튼은 title 없이 호출 → 서버가 `새 챕터` 채움.
**201 응답** `{ "success": true, "data": { "id": 18, "title": "3장", "sortOrder": 2, "body": "{\"type\":\"doc\",\"content\":[]}", "wordCount": 0, "updatedAt": "..." } }`

## C3. 순서 일괄 변경 — `PUT /api/projects/{projectId}/documents/order`

활성 챕터 id 전량 배열. 누락·중복·소속 불일치 검증(`ChapterReorderValidator`) 후 배열 index 를 `sort_order` 로 대입.

**요청** `{ "documentIds": [15, 12, 18] }`
**200 응답** `{ "success": true, "data": null }` (또는 갱신된 목록)
**400** `VALIDATION_FAILED` — 누락/중복/외부 소속 id

## C4. 챕터 삭제(soft) — `DELETE /api/documents/{id}`

`deleted_at = now()`. **마지막 활성 챕터면 거부.**

**200 응답** `{ "success": true, "data": null }`
**409** `LAST_CHAPTER_UNDELETABLE` — 활성 챕터 1개일 때
> ⚠️ FE 분기는 `error.code === "LAST_CHAPTER_UNDELETABLE"` 기준(409 status 단독 분기 금지 — `DOCUMENT_VERSION_CONFLICT` 등과 공유).

## C5. 챕터 복구 — `POST /api/documents/{id}/restore`

`deleted_at = NULL`. `sort_order` = 활성 맨 뒤 재배치.

**200 응답** `{ "success": true, "data": { "id": 15, ...활성 복귀 } }`
**404** 대상 없음

## C6. (대체) 단수 조회 제거 — `GET /api/projects/{projectId}/document`

**제거.** 기존 `DocumentController.getDocumentByProject`(DocumentController.kt:32) 가 대상 — C1 목록 + C7 단건으로 대체. 소비자가 자사 프론트뿐이라 호환 유지 불필요.

## C7. 챕터 본문 단건 — `GET /api/documents/{id}` (기존 수정)

**기존 `DocumentController.getDocumentById`(DocumentController.kt:47) 존재 — 신설 아님.** 본문 포함 단건. **삭제(soft-delete)된 챕터 조회는 404** 가드 추가(기존엔 1:1이라 삭제 개념 없었음).

## C8. 자동저장(불변) — `PUT /api/documents/{id}` / 제목 `PATCH /api/documents/{id}/title`

이미 document id 단위 → 챕터별 자동저장·제목 변경으로 그대로 동작. 단 **삭제된 챕터 저장은 404**.

## C9. 대시보드 카드 집계 변경 — `GET /api/projects/cards`

endpoint·요청·응답 스키마(`ProjectCardResponse`) **불변**. 내부 집계만 교체:

| 필드 | 기존(1:1) | 변경(1:N) |
|---|---|---|
| `wordCount` | document.word_count | **활성 챕터 word_count 합** |
| `documentUpdatedAt` | document.updated_at | **활성 챕터 중 최신 updated_at** |
| 마지막 문장 | document.body 파생 | **최근 수정 활성 챕터 body 파생** |

- `findByProjectIdIn` 에 `deletedAt IS NULL` 필터 추가 후 메모리 그룹 집계(3쿼리 일괄·N+1 금지 유지).
- 응답 스키마 불변 → **프론트 대시보드 표시 코드 변경 0**.

## 신규 에러 코드

| 코드 | status | 의미 |
|---|---|---|
| `LAST_CHAPTER_UNDELETABLE` | 409 | 마지막 활성 챕터 삭제 시도 |

reorder 검증 실패는 기존 `VALIDATION_FAILED`(400) 재사용.

## 프론트 shim/훅 계약

| 변경 | 대상 | 내용 |
|---|---|---|
| 재구성 | `webElectronApi.documents` | `getByProject`(단수) 제거 → `list`/`create`/`reorder`/`remove`/`restore`/`get`. `update`(자동저장) 불변 |
| 분리 | React Query 훅 | `useProjectDocument` → `useProjectChapters(projectId)` + `useChapterDocument(documentId)`(staleTime:Infinity 승계) |
| 추가 | `client.ts` | `LAST_CHAPTER_UNDELETABLE` error.code 분기 |
