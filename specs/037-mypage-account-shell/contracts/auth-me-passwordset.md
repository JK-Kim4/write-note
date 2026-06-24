# Contract: GET /api/auth/me — passwordSet 추가 (additive)

`AuthMeResponse` 에 `passwordSet`(비밀번호 설정 여부) boolean 1개를 **추가**. 기존 필드 무변경.

## GET /api/auth/me — 200 (확장)

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
    "createdAt": "2026-05-20T10:00:00Z",
    "passwordSet": true
  },
  "error": null
}
```

| 신규 필드 | 타입 | 의미 |
|---|---|---|
| `passwordSet` | boolean | 비밀번호(이메일 로그인) 설정 여부 = `passwordHash != null` |

### 호환성
- **additive** — 기존 클라이언트 무영향. BE 선행 배포 안전(R2 BE → FE).
- 비밀번호 해시 자체는 노출하지 않는다(boolean 만).

### 계정 연결 UI 매핑
| 상태 | 표시 | 액션 |
|---|---|---|
| `passwordSet=true` | 이메일 로그인 연결됨 | (없음) |
| `passwordSet=false` | 이메일 로그인 미설정 | 비밀번호 추가 등록 |
| `kakaoLinked=true` | 카카오 연결됨 | (없음) |
| `kakaoLinked=false` | 카카오 미연결 | 카카오 연결 |
