# Contract: 모바일 캡처용 토큰(ApiToken) 엔드포인트

**SoT**: `docs/plan/03-backend-requirements.md` §3-6 (ApiToken 관리 4). 세션 노트 5 endpoint 는 **제외**(Week 5). 응답 = `Result<T>`. 인증 = JWT. 소유 격리.

본 spec 신규: **4 endpoint**.

| # | 메서드 | 경로 | 본질 |
|---|---|---|---|
| T1 | POST | `/api/api-tokens` | 새 토큰 발급 — **원본 1회만 표시** |
| T2 | GET | `/api/api-tokens` | 본인 토큰 목록 (원본 미포함) |
| T3 | PATCH | `/api/api-tokens/{id}` | label 변경 |
| T4 | DELETE | `/api/api-tokens/{id}` | 해지 (revoked_at, row 유지) |

---

## T1. POST /api/api-tokens  — 발급

- **요청**: `{ label?: <string ≤120, default "새 토큰"> }`
- **처리**(R-10): `wnt_` + base62 32자 생성 → SHA-256 `token_hash` 저장 + `token_prefix`(8자). **원본 토큰은 응답에만, 미저장.**
- **응답 201**: `{ id, token: "wnt_xxxx...", tokenPrefix, label, createdAt }` ← `token` 필드는 **본 응답에서만 1회**
- **에러**: 400(label 길이) · 401

## T2. GET /api/api-tokens  — 목록

- **응답 200**: `[ { id, tokenPrefix, label, lastUsedAt, createdAt, revokedAt } ]` (원본 `token` **미포함**)
- **에러**: 401
- **비고**: 활성/해지 모두 반환(revokedAt 으로 구분). `/api/auth/me` 의 "활성 ApiToken 수"(003)와 정합.

## T3. PATCH /api/api-tokens/{id}  — label 변경

- **요청**: `{ label: <string ≤120> }`
- **응답 200**: `{ id, tokenPrefix, label, lastUsedAt, createdAt, revokedAt }`
- **에러**: 400 · 401 · 404

## T4. DELETE /api/api-tokens/{id}  — 해지

- **처리**: `revoked_at = now()`. **DB row 유지**(감사). 이후 그 토큰으로 `/api/capture` 거부(FR-023, SC-008).
- **응답 204** · **에러**: 401 · 404(타인/미존재)

---

## DTO 네이밍

- `CreateApiTokenRequest`(T1), `ApiTokenCreatedResponse`(T1 — `token` 포함), `ApiTokenResponse`(T2/T3 — `token` 미포함), `UpdateApiTokenRequest`(T3).

## 설정 페이지 UI(FR-021/022)

- 발급 모달: 원본 토큰 1회 표시 + "복사" + "다시 볼 수 없음" 경고
- 목록: prefix·label·마지막 사용·해지 상태 + label 편집 + 해지 버튼
- iOS Shortcut 가이드 링크(R-15, 사용자 실기기 셋업 영역)
