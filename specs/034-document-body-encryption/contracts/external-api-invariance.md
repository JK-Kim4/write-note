# Contract: 외부 API 계약 불변 (Invariance)

본 기능은 **새 endpoint·DTO·status 를 추가하지 않는다**(예외: 복호 실패 500 1종). 기존 본문 API 의 요청/응답 형태는 **바이트 단위로 동일**해야 하며, 이것이 본 기능의 가장 중요한 계약이다(FR-006). 프론트는 변경 0.

## 불변 endpoint (기존 — `controller/DocumentController.kt`)

| 메서드 | 경로 | 요청 | 응답 | 암복호 위치 |
|---|---|---|---|---|
| GET | `/api/projects/{projectId}/document` | — | `DocumentResponse{ id, projectId, title, body(평문), wordCount, version, updatedAt }` | 서버 내부에서 `body` 복호 후 응답 |
| GET | `/api/documents/{id}` | — | 동 `DocumentResponse` | 동일 |
| PUT | `/api/documents/{id}` | `SaveDocumentRequest{ body(평문), version }` | `DocumentSaveResponse{ id, body(평문), wordCount, version, updatedAt }` | 서버가 `body` 암호화 저장, 응답 `body` 는 평문 |

- 요청 `body` = 평문 ProseMirror JSON(클라이언트는 암호화 모름).
- 응답 `body` = 평문 ProseMirror JSON(서버가 복호 후 전달).
- `version`(Instant updatedAt 토큰)·409 충돌 동작 불변. 409 응답의 `currentBody` 도 **복호된 평문**.

## 영향받는 기존 표시 경로 (계약 불변, 내부 복호 추가)

| 경로 | 위치 | 표시값 | 처리 |
|---|---|---|---|
| 작품 카드 "마지막 문장" | `service/ProjectService.kt` `listCards()` | `lastSentenceSource` | `body` 복호 후 `extractPlainText` (레거시는 통과) |
| 내보내기(DOCX/HWPX) | `controller/ExportController.kt` | — | 클라이언트가 블록 구조 전송 → **서버 본문 평문 미사용 → 영향 없음**(회귀 점검만) |

## 신규 에러 (최소)

| status | code | 발생 | 비고 |
|---|---|---|---|
| 500 | `DOCUMENT_DECRYPTION_FAILED` | 본문 복호 실패(키 부재/불일치·변조) | fail-closed. 평문 미노출. 동시 디스코드 알림 |

> 기존 409 `DOCUMENT_VERSION_CONFLICT`, 400 `VALIDATION_FAILED` 등은 불변. 신규 코드는 기존 에러 코드 매트릭스에 1행 추가.
