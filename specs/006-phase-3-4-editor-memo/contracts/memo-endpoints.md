# Contract: 메모(Memo) / 캡처 / 큐레이션 엔드포인트

**SoT**: `docs/plan/03-backend-requirements.md` §3-5 (핀 #36/#37 **제외** — Week 5). 응답 = `Result<T>`. 인증 = JWT, 단 `POST /api/capture` 는 ApiToken. 소유 격리 = 타인 자원 404.

본 spec 신규: **7 endpoint** (§3-5 의 9 − 핀 2).

| # | 메서드 | 경로 | 인증 | 본질 |
|---|---|---|---|---|
| M1 | GET | `/api/memos` | JWT | 메모 목록 (필터 + 페이지네이션, N+1 회피) |
| M2 | GET | `/api/memos/{id}` | JWT | 단건 조회 |
| M3 | POST | `/api/memos` | JWT | 데스크탑 ⌘+N 캡처 (source=DESKTOP) |
| M4 | PATCH | `/api/memos/{id}` | JWT | 본문/태그/이유 수정 |
| M5 | DELETE | `/api/memos/{id}` | JWT | 삭제 (연결 cascade 정리) |
| M6 | POST | `/api/capture` | ApiToken | 모바일 캡처 (source=MOBILE, 멱등) |
| M7 | PUT | `/api/memos/{id}/curation` | JWT | 큐레이션 1회 저장 (차이 계산) |

---

## M1. GET /api/memos

- **쿼리 필터**: `unclassified=true` / `projectId=X` / `characterId=Y` / `tag=Z` / `q=텍스트` + 페이지네이션(`page`/`size`≤100/`sort=capturedAt,desc`). (`pinned` 필터는 Week 5)
- **응답 200**: `Page<MemoResponse>`. 각 `MemoResponse` = `{ id, body, source, capturedAt, activeProjectAtCapture, reasonNote, tags, projects: [{ projectId, title, characters: [{ characterId, name }] }] }`
- **N+1 회피(HARD-GATE)**: 연결 프로젝트/인물/태그 = `@EntityGraph`/`JOIN FETCH` (R-13, SC). IT 에서 쿼리 카운트 검증.
- **에러**: 401

## M2. GET /api/memos/{id}
- **응답 200**: `MemoResponse` · **에러**: 401 · 404

## M3. POST /api/memos  — 데스크탑 캡처
- **요청**: `{ body: <string, 필수>, activeProjectId?: <Long|null> }`
- **처리**: source=DESKTOP, capturedAt=서버 now, active_project_at_capture = activeProjectId(작성 중 프로젝트)
- **응답 201**: `MemoResponse` · **에러**: 400(빈 body) · 401

## M4. PATCH /api/memos/{id}
- **요청**(부분): `{ body?, reasonNote?, tags? }` (null=미변경)
- **응답 200**: `MemoResponse` · **에러**: 400 · 401 · 404

## M5. DELETE /api/memos/{id}
- **처리**: Memo 삭제 → MemoProject·MemoProjectCharacter cascade 정리(FR-020). (Week 5: Document.body 핀 mark 청소는 본 spec 제외)
- **응답 204** · **에러**: 401 · 404

## M6. POST /api/capture  — 모바일 캡처 (ApiToken)
- **인증**: `Authorization: Bearer wnt_...` → `ApiTokenAuthenticationFilter`(R-11) 검증 + last_used_at 갱신
- **헤더**: `Idempotency-Key`(필수 권장) — 5분 TTL 캐시(R-9, SC-007)
- **요청**: `{ body: <string, 필수> }` (source=MOBILE 자동, active_project 없음)
- **응답 201**: `MemoResponse`. 같은 Idempotency-Key 재요청 = 이전 응답 그대로(중복 생성 0)
- **에러**: 400(빈 body) · 401 `AUTH_TOKEN_INVALID`/`_REVOKED`(해지·형식오류, FR-023)

## M7. PUT /api/memos/{id}/curation  — 큐레이션 (단일 트랜잭션)
- **요청**: `{ projectConnections: [{ projectId, characterIds: [Long] }], tags: [string], reasonNote: <string|null> }`
- **처리**(R-12, 선언적 전체 상태): 서버가 현재 연결과 차이 계산 → MemoProject add/remove + MemoProjectCharacter add/remove + tags/reasonNote 갱신을 **단일 트랜잭션**. 인물은 해당 projectId 소속 검증(FR-017) — 불일치 400 `VALIDATION_FAILED`.
- **응답 200**: `MemoResponse`(갱신된 연결 포함)
- **에러**: 400(인물-프로젝트 불일치/빈 projectId) · 401 · 404
- **미분류**: `projectConnections: []` → 미분류 상태(FR-019)

---

## DTO 네이밍

- `MemoResponse`, `CaptureMemoRequest`(M3 데스크탑), `MobileCaptureRequest`(M6), `UpdateMemoRequest`(M4), `CurateMemoRequest`(M7, nested `ProjectConnectionDto`).
