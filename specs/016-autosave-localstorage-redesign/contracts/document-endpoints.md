# Contract: 본문(Document) 엔드포인트 — version 문자열 토큰 (016 개정)

**기준**: [006 document-endpoints.md](../../006-phase-3-4-editor-memo/contracts/document-endpoints.md) 의 후속 개정. 엔드포인트 경로·소유 격리(타인 자원 404)·`Result<T>` 래퍼·JWT 인증은 **불변**. 본 개정의 유일한 변경은 **`version`/`currentVersion` 의 와이어 타입을 정수 → ISO8601 문자열(불투명 토큰)로** 바꾸는 것.

| # | 메서드 | 경로 | 변경 |
|---|---|---|---|
| D1 | GET | `/api/projects/{projectId}/document` | 응답 `version` → string |
| D2 | GET | `/api/documents/{id}` | 응답 `version` → string |
| D3 | PUT | `/api/documents/{id}` | 요청·응답 `version` → string, 409 `currentVersion` → string |
| D4 | PATCH | `/api/documents/{id}/title` | 변경 없음 |

> `version` 토큰의 의미 = 문서 `updatedAt`(수정 시각). 클라이언트는 **불투명 토큰**으로 취급(파싱·증감 금지, 받은 값 그대로 비교·전달).

---

## D1. GET /api/projects/{projectId}/document

- **응답 200**: `{ id, projectId, title, body, wordCount, version: <ISO8601 string>, updatedAt: <ISO8601 string> }`
  - `version` 과 `updatedAt` 은 동일 값(겸용). 둘 다 노출 유지(기존 소비자 호환).
- **에러**: 401 `AUTH_TOKEN_MISSING`/`_INVALID` · 404 `RESOURCE_NOT_FOUND`(타인/미존재)

## D2. GET /api/documents/{id}

- **응답 200**: `{ id, projectId, title, body, wordCount, version: <string>, updatedAt: <string> }`
- **에러**: 401 · 404

## D3. PUT /api/documents/{id} — 자동 저장 (핵심)

- **요청**: `{ body: <ProseMirror JSON>, version: <ISO8601 string> }`
  - `version` = 클라이언트가 이 문서에 대해 마지막으로 받은 토큰(편집 세션 소유값).
- **처리**: `request.version`(Instant)을 현재 `document.updatedAt` 과 비교 → 일치 시 body 저장 + `wordCount` 서버 재계산(공백 제외) + flush(`@Version` 가 `updatedAt` 재set).
- **응답 200**: `{ id, body, wordCount, version: <새 updatedAt string>, updatedAt: <동일 string> }`
- **충돌 409 `DOCUMENT_VERSION_CONFLICT`**: `{ code, message, currentVersion: <현재 updatedAt string>, currentBody }`
  - 클라이언트는 자동 덮어쓰지 않고 "다시 불러오기 / 덮어쓰기" 선택(FR-006). 미동기화 작성분 보존(FR-007).
- **에러**: 400 `VALIDATION_FAILED`(잘못된 body JSON) · 401 · 404
- **클라이언트 동작(016)**: 매 타자 PUT 아님. localStorage draft 즉시 기록 후 "멈춤 1.5초 또는 최대 10초"에 1회 PUT. 덮어쓰기 선택 시 `currentVersion` 으로 재요청.

### 와이어 예시

```http
PUT /api/documents/540
{ "body": "{\"type\":\"doc\",...}", "version": "2026-06-09T12:34:56.789012Z" }
```
```http
200 OK
{ "id":540, "body":"...", "wordCount":1234,
  "version":"2026-06-09T12:35:07.114830Z", "updatedAt":"2026-06-09T12:35:07.114830Z" }
```
```http
409 Conflict
{ "code":"DOCUMENT_VERSION_CONFLICT", "message":"...",
  "currentVersion":"2026-06-09T12:35:01.220011Z", "currentBody":"..." }
```

## D4. PATCH /api/documents/{id}/title

- **변경 없음**. 요청 `{ title: <string ≤120> }` → 응답 `{ id, title, updatedAt: <string> }`.
- 제목 수정은 자동저장 PUT 과 분리(빈도 다름). title PATCH 도 `@Version` 대상이므로 `updatedAt` 갱신됨 — 본 개정에서 동작 변화 없음(version 토큰 자연 전진).

---

## DTO 영향 (백엔드)

| DTO | 필드 변경 |
|---|---|
| `DocumentResponse` | `version: Int → Instant` |
| `SaveDocumentRequest` | `version: Int → Instant` |
| `DocumentSaveResponse` | `version: Int → Instant` |
| `DocumentConflictResponse` | `currentVersion: Int → Instant` |
| `DocumentConflictException` | `currentVersion: Int → Instant` |

## DTO 영향 (프론트 `types/api.ts`)

| 타입 | 필드 변경 |
|---|---|
| `DocumentResponse` / `DocumentSaveResponse` | `version: number → string` |
| `DocumentConflictResponse` | `currentVersion: number → string` |
| `ConflictError`(`client.ts`) | `currentVersion: number → string` |

## 회귀 가드 (HARD-GATE)

- `client.ts` 의 409 분기는 **`error.code === "DOCUMENT_VERSION_CONFLICT"` 일 때만** ConflictError. 이메일 중복(`EMAIL_ALREADY_REGISTERED`)·카카오(`KAKAO_ALREADY_LINKED`)도 409 공유 → status 단독 분기 금지(006 회귀 사례).
