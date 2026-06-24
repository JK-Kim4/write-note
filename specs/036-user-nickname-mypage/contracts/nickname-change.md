# Contract: 닉네임 변경

## PATCH /api/users/me/nickname

로그인한 사용자가 자신의 닉네임을 변경한다. (신규 `UserController`)

### 인증
- Bearer JWT 필수. 미인증 → 401 `AUTH_TOKEN_MISSING`/`AUTH_TOKEN_INVALID`.

### Request

```json
{ "nickname": "푸른고래" }
```

| 필드 | 타입 | 검증 |
|---|---|---|
| `nickname` | string | NotBlank, 2~16자, `^[가-힣a-zA-Z0-9_]{2,16}$`, 금칙어 불포함, 미사용(고유) |

### Response (성공) — 200

변경된 본인 정보를 `AuthMeResponse` 로 반환(프론트가 캐시 갱신에 사용).

```json
{
  "success": true,
  "data": {
    "userId": 12,
    "email": "user@example.com",
    "nickname": "푸른고래",
    "kakaoLinked": false,
    "emailVerifiedAt": "2026-06-01T00:00:00Z",
    "activeApiTokenCount": 0,
    "createdAt": "2026-05-20T10:00:00Z"
  },
  "error": null
}
```

### Response (실패)

| 상황 | HTTP | code | message(예) |
|---|---|---|---|
| 길이/허용문자 위반 | 400 | `NICKNAME_INVALID_FORMAT` | "닉네임은 2~16자의 한글·영문·숫자·밑줄만 사용할 수 있습니다." |
| 금칙어 포함 | 400 | `NICKNAME_FORBIDDEN_WORD` | "사용할 수 없는 단어가 포함되어 있습니다." |
| 이미 사용 중 | 409 | `NICKNAME_ALREADY_REGISTERED` | "이미 사용 중인 닉네임입니다." |
| 미인증 | 401 | `AUTH_TOKEN_*` | 기존 |

에러 envelope:
```json
{ "success": false, "data": null, "error": { "code": "NICKNAME_ALREADY_REGISTERED", "message": "이미 사용 중인 닉네임입니다." } }
```

### 경계 동작
- 입력 앞뒤 공백은 trim 후 검증.
- 현재 닉네임과 동일 값 변경 시도 → 중복 충돌로 보지 않고 정상 처리(자기 자신 충돌 오인 방지).
- 동시 변경 경쟁 시 DB UNIQUE 제약으로 한쪽만 성공, 다른쪽 409.

### 프론트 처리 주의
- `client.ts` 의 409 분기는 **error.code 기준**(code-quality §409 회귀). `NICKNAME_ALREADY_REGISTERED`(409)는 `DOCUMENT_VERSION_CONFLICT` 분기에 걸리지 않고 일반 `ApiError(code,message)` 로 폼에 표시.
