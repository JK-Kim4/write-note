# Phase 1 Data Model: 사용자 닉네임 + 마이페이지

## 엔티티 변경

### User (변경)

`com.writenote.entity.User` 에 필드 1개 추가.

| 필드 | 타입 | 컬럼 | 제약 | 비고 |
|---|---|---|---|---|
| `nickname` | `String` (non-null) | `nickname VARCHAR(16)` | NOT NULL, UNIQUE(`uk_users_nickname`) | 신규. 모든 사용자 보유 |

기존 필드(id·email·kakaoId·passwordHash·emailVerifiedAt·lastLoginAt·failedLoginCount·lockoutUntil·createdAt·updatedAt)는 무변경. `createdAt`(AuditingEntityListener, 접근 가능)은 마이페이지 가입일 표시에 재사용.

엔티티 매핑 예:
```kotlin
@Column(name = "nickname", nullable = false, unique = true, length = 16)
var nickname: String,
```

## 마이그레이션 V23

`backend/src/main/resources/db/migration/V23__add_users_nickname.sql`

```sql
-- 1) nullable 컬럼 추가
ALTER TABLE users ADD COLUMN nickname VARCHAR(16);

-- 2) 기존 회원 백필 (id 기반 고유 단순값)
UPDATE users SET nickname = '사용자' || id WHERE nickname IS NULL;

-- 3) NOT NULL + UNIQUE 제약
ALTER TABLE users ALTER COLUMN nickname SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT uk_users_nickname UNIQUE (nickname);
```

> 운영 적용은 Flyway 자동(배포 시). 로컬은 Testcontainers 만(dev DB 직접 적용 금지).

## 검증 규칙 (NicknamePolicy)

| 규칙 | 값 | 위반 시 |
|---|---|---|
| 공백 처리 | 앞뒤 trim 후 검증 | — |
| 길이 | 2~16자 | `NICKNAME_INVALID_FORMAT`(400) |
| 허용 문자 | `^[가-힣a-zA-Z0-9_]{2,16}$` (한글·영문·숫자·밑줄) | `NICKNAME_INVALID_FORMAT`(400) |
| 금칙어 | `ForbiddenWords` 포함 검사(정규화 후) | `NICKNAME_FORBIDDEN_WORD`(400) |
| 중복 | `existsByNickname` 정확일치(대소문자 구분) | `NICKNAME_ALREADY_REGISTERED`(409) |
| 자기 동일값 | 현재 닉네임과 같으면 중복으로 보지 않음 | 수용(no-op 또는 정상 응답) |

요청 DTO 1차 검증(Bean Validation):
```kotlin
data class SetNicknameRequest(
    @field:NotBlank
    @field:Size(min = 2, max = 16)
    val nickname: String,
)
```
정규식·금칙어·중복은 서비스(UserService + NicknamePolicy)에서 검증.

## 닉네임 자동 생성 규칙 (NicknameGenerator)

- 형식: `{수식어}{명사}{4자리숫자}` (예: `푸른고래4821`)
- 수식어·명사 = `NicknameWords` 큐레이션 상수(비속어·차별·혐오·성적·정치/종교 갈등 어휘 배제)
- 숫자 = 1000~9999
- 고유성: 생성 후 `existsByNickname` 확인 → 충돌 시 숫자 재추첨(최대 N회, 예 10), 그래도 실패 시 숫자 자릿수 확장
- 호출 지점: `AuthService.signupEmail`, `KakaoUserRegistrar.registerAndCreateKey` 의 User 생성 시

## 응답 DTO 변경

### AuthMeResponse (확장)

```kotlin
data class AuthMeResponse(
    val userId: Long,
    val email: String,
    val nickname: String,        // ← 추가
    val kakaoLinked: Boolean,
    val emailVerifiedAt: Instant?,
    val activeApiTokenCount: Int,
    val createdAt: Instant?,     // ← 추가 (마이페이지 가입일)
)
```

`UserAuthConverter.toAuthMeResponse` 매핑에 `nickname = user.nickname`, `createdAt = user.createdAt` 추가.

프론트 `types/api.ts` 의 `AuthMeResponse` 인터페이스도 `nickname: string`, `createdAt: string | null` 동기.

## Repository

`UserRepository` 에 추가:
```kotlin
fun existsByNickname(nickname: String): Boolean
```
(기존 `existsByEmail` 패턴과 동일.)
