# Contract: GET /api/auth/me 확장 (additive)

기존 본인 정보 조회 응답에 `nickname`·`createdAt` 2개 필드를 **추가**(additive, 기존 필드 무변경).

## GET /api/auth/me

### Response — 200 (확장)

```json
{
  "success": true,
  "data": {
    "userId": 12,
    "email": "user@example.com",
    "nickname": "푸른고래4821",
    "kakaoLinked": false,
    "emailVerifiedAt": "2026-06-01T00:00:00Z",
    "activeApiTokenCount": 0,
    "createdAt": "2026-05-20T10:00:00Z"
  },
  "error": null
}
```

| 신규 필드 | 타입 | 의미 |
|---|---|---|
| `nickname` | string | 사용자 닉네임(항상 존재) |
| `createdAt` | string(ISO-8601) \| null | 가입일(마이페이지 표시) |

### 호환성
- **additive 변경** — 기존 클라이언트는 추가 필드를 무시하므로 BE 선행 배포 안전.
- FE 는 BE 배포 후 두 필드를 읽어 마이페이지에 표시(헤더 닉네임 표시 포함 가능).

### 마이페이지 표시 매핑
| 마이페이지 항목 | 출처 |
|---|---|
| 닉네임 | `nickname` |
| 이메일 | `email` |
| 가입 방식 | `kakaoLinked` true → "카카오", false → "이메일"(+`email`) |
| 가입일 | `createdAt` |
