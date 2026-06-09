# REST API 계약 — Web 포팅 Backend 확장 (014)

공통 규약(기존 정합):
- 모든 응답 envelope = `Result<T>`(`{ success, data, error }`). 출처 `model/response/Result.kt`.
- 인증 = `@AuthenticationPrincipal AuthenticatedPrincipal`(JWT). 미인증 → 401 `AUTH_TOKEN_*`.
- 소유권 실패(타 계정/미존재) → 404 `RESOURCE_NOT_FOUND`(`ResourceNotFoundException`).
- 검증 실패 → 400 `VALIDATION_FAILED`.
- 시각 = ISO-8601(`Instant`).

---

## US1 — 다음 장면 (기존 endpoint 확장)

### `PATCH /api/projects/{projectId}` (기존, 필드 추가)
- **Request**(`UpdateProjectRequest`, 필드 추가): `{ ..., "nextScene": string|null }` — null=미변경, `""`=비우기, max 500.
- **Response 200**(`ProjectResponse`, 필드 추가): `{ ..., "nextScene": string }`
- 기타 메타 미변경(부분 수정, FR-003). 소유권 404.
- `GET /api/projects/{projectId}`·`GET /api/projects` 응답도 `nextScene` 포함(FR-004).

---

## US2 — 곁쪽지 고정 (신규)

### `PUT /api/projects/{projectId}/memos/{memoId}/pin`
- 그 작품 맥락에서 메모 고정 상태 설정. desktop `memos:setPin(memoId, projectId, pinned)` 대응.
- **Request**: `{ "pinned": boolean }`
- **동작**: `pinned=true` 면 그 작품의 다른 고정 해제 후 대상 고정(작품당 1개, FR-007). `pinned=false` 면 해제.
- **Response 200**(`ProjectMemoResponse`): `{ "memoId": long, "projectId": long, "pinned": boolean, ... }`(갱신 결과)
- **소유권**: memo·project 둘 다 본인 + (memo,project) 링크 존재. 아니면 404.

### `GET /api/projects/{projectId}/memos` (신규, FR-009/R7)
- 작품에 연결된 메모 목록(각 pinned 포함). desktop `memos:listByProject`→`ProjectMemo[]` 대응.
- **Response 200**: `Result<List<ProjectMemoResponse>>` — 고정 메모 우선/최신순(정렬 plan 확정).
- `ProjectMemoResponse` = `MemoResponse` 필드 + `pinned: boolean`.

---

## US3 — 집필 기록 (신규)

### `POST /api/projects/{projectId}/logs` (독립 생성, Q1)
- **Request**: `{ "body": string }`(NotBlank, max 2000)
- **Response 201**(`ProjectLogResponse`): `{ "id": long, "projectId": long, "body": string, "createdAt": instant }`
- 소유권 404.

### `GET /api/projects/{projectId}/logs` (최신순, FR-011)
- desktop `logs:listByProject` 대응.
- **Response 200**: `Result<List<ProjectLogResponse>>`(created_at DESC).

### `GET /api/projects/{projectId}/logs/latest` (최신 1, FR-012)
- 카드 집계용. **Response 200**: `Result<ProjectLogResponse|null>`(없으면 `data: null`).

---

## US4 — 작업 세션 (신규)

### `POST /api/projects/{projectId}/work-sessions/start`
- desktop `sessions:start`. 그 작품의 기존 열린 세션 정리 후 새 세션 시작(작품당 1개, FR-016).
- **Response 200**(`WorkSessionResponse`): `{ "id": long, "projectId": long, "startedAt": instant, "endedAt": null }`
- 소유권 404.

### `POST /api/projects/{projectId}/work-sessions/end`
- desktop `sessions:end`. 그 작품 열린 세션 자동 종료. duration<30s → 폐기(통계 미포함, FR-017), ≥30s → ended_at 기록(FR-018). 열린 세션 없으면 no-op.
- **Response 200**: `Result<WorkSessionResponse|null>`(보존 시 세션, 폐기/없음 시 `data: null`).

### `POST /api/projects/{projectId}/work-sessions/end-with-log`
- desktop `sessions:endWithLog`. 세션 종료(짧아도 보존, 30s 우회) + 집필 기록 생성을 **단일 트랜잭션**(FR-019/020).
- **Request**: `{ "body": string }`(NotBlank, max 2000)
- **Response 200**(`EndWithLogResponse`): `{ "session": WorkSessionResponse|null, "log": ProjectLogResponse }`
- 로그 생성 실패 시 세션 종료 롤백(부분 적용 없음).

### `GET /api/projects/{projectId}/work-sessions/total`
- 카드 집계용 총 작업시간(종료 세션 합, 진행중·폐기 제외, R6).
- **Response 200**: `Result<{ "totalDurationMs": long }>`

### (스케줄러, endpoint 아님) dangling 정리
- `@Scheduled` 작업이 `started_at < now - maxOpenHours` 인 열린 세션 폐기(FR-021, R4). HTTP 노출 없음.

---

## 신규 DTO 요약

| DTO | 필드 |
|---|---|
| `ProjectLogResponse` | id, projectId, body, createdAt |
| `WorkSessionResponse` | id, projectId, startedAt, endedAt(nullable) |
| `EndWithLogResponse` | session(WorkSessionResponse?), log(ProjectLogResponse) |
| `ProjectMemoResponse` | (MemoResponse 필드) + pinned |
| `CreateProjectLogRequest` | body(NotBlank, max 2000) |
| `EndWithLogRequest` | body(NotBlank, max 2000) |
| `SetPinRequest` | pinned(boolean) |
| `UpdateProjectRequest`(확장) | + nextScene(Size max 500, nullable) |
| `ProjectResponse`(확장) | + nextScene |

## 에러 코드(기존 재사용)
`RESOURCE_NOT_FOUND`(404), `VALIDATION_FAILED`(400), `AUTH_TOKEN_*`(401), `INTERNAL_ERROR`(500). 신규 도메인 에러코드 불필요(기존 `ErrorCode` enum + `ResourceNotFoundException` 충분).
