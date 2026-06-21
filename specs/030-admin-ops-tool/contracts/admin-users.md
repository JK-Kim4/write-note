# Contract: 어드민 회원 조회 (읽기 전용)

`/api/admin/users` — 단일 관리자만. 쓰기 액션 없음(FR-011). `Result<T>` envelope.

## GET /api/admin/users
가입자 목록(가입일 최신순) + 이메일 검색.

**Query**: `page`(기본 0), `size`(기본 20, 1..100), `q`(선택, 이메일 부분일치 `ILIKE %q%`)

**200** — `data: PageResponse<AdminUserResponse>`
```json
{
  "id": 42,
  "email": "writer@example.com",
  "kakaoLinked": false,
  "emailVerified": true,
  "lastLoginAt": "2026-06-20T12:30:00Z",
  "createdAt": "2026-06-01T09:00:00Z",
  "projectCount": 3
}
```
검색 결과 없음 → `content: []`(오류 아님).

## GET /api/admin/users/{id}
회원 상세. 없음 → 404 `USER_NOT_FOUND`. 응답 필드는 위 `AdminUserResponse` 동일.

## 비밀값 미노출 (FR-010 / SC-006) — 계약 불변
응답에 **절대 포함 금지**: `passwordHash`, `kakaoId` 원문, `failedLoginCount`, `lockoutUntil`, 인증/리프레시 토큰. DTO 화이트리스트 방식으로만 직렬화(엔티티 직접 직렬화 금지).

## 인가 (공통)
비인증 401 / 비관리자 403 / 관리자 200.
