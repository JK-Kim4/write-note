# Data Model — Phase 1B Backend Auth Foundation

**Date**: 2026-05-23
**Spec**: [spec.md](./spec.md) / **Plan**: [plan.md](./plan.md)

본 문서는 `/speckit-plan` Phase 1 의 데이터 모델 산출물. 본 spec 의 두 영속 엔티티 (`Users` 확장 + `AuthToken` 신설) 와 Flyway 마이그레이션 (`V3`, `V4`) 스케치 + 인덱스 + 제약을 박는다. 출처는 백엔드 SoT `docs/plan/03-backend-requirements.md` §2-2.

---

## 1. Users (확장)

**기존 001 컬럼**: `id`, `email`, `created_at` (V1 마이그레이션, `docs/plan/02-progress.md §1 Phase 1A`).

**본 spec 에서 추가하는 컬럼**:

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `kakao_id` | `VARCHAR(255)` | NULLABLE, UNIQUE 부분 인덱스 | 카카오 계정 고유 식별자. NULL = 카카오 미연결. |
| `password_hash` | `VARCHAR(255)` | NULLABLE | BCrypt cost 12 해시. NULL = 비밀번호 미설정 (카카오 단독 가입자). |
| `email_verified_at` | `TIMESTAMPTZ` | NULLABLE | 이메일 인증 완료 시각. NULL = 미인증 (이메일 가입자) 또는 미적용 (카카오 가입자 — 즉시 채움). |
| `last_login_at` | `TIMESTAMPTZ` | NULLABLE | 마지막 성공 로그인 시각. 첫 로그인 전 NULL. |
| `failed_login_count` | `INTEGER` | NOT NULL DEFAULT 0 | 누적 비밀번호 실패 횟수. 성공 시 0 리셋. |
| `lockout_until` | `TIMESTAMPTZ` | NULLABLE | 잠금 만료 시각. NULL = 잠금 아님. `> now()` = 잠금 중. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT `now()` | JPA `@LastModifiedDate` 로 갱신. |

**Entity 제약** (CHECK):

```sql
CONSTRAINT users_credential_present CHECK (
    password_hash IS NOT NULL OR kakao_id IS NOT NULL
)
```

→ 비밀번호 해시와 카카오 식별자 중 최소 하나가 채워져야 한다 (SoT §2-2 Users).

**인덱스**:
- `users(email)` — UNIQUE (기존 001).
- `users(kakao_id)` — UNIQUE 부분 인덱스 `WHERE kakao_id IS NOT NULL` (NULL 다수 허용).

**Kotlin JPA 엔티티 시그니처 스케치**:

```kotlin
@Entity
@Table(name = "users")
@EntityListeners(AuditingEntityListener::class)
class User(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, unique = true, length = 255)
    var email: String,

    @Column(name = "kakao_id", unique = true, length = 255)
    var kakaoId: String? = null,

    @Column(name = "password_hash", length = 255)
    var passwordHash: String? = null,

    @Column(name = "email_verified_at")
    var emailVerifiedAt: Instant? = null,

    @Column(name = "last_login_at")
    var lastLoginAt: Instant? = null,

    @Column(name = "failed_login_count", nullable = false)
    var failedLoginCount: Int = 0,

    @Column(name = "lockout_until")
    var lockoutUntil: Instant? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreatedDate
    var createdAt: Instant? = null,

    @Column(name = "updated_at", nullable = false)
    @LastModifiedDate
    var updatedAt: Instant? = null,
)
```

→ 모든 변경 가능 필드 `var` (JPA dirty checking) / Spring Data JPA `@CreatedDate` + `@LastModifiedDate` 사용.

---

## 2. AuthToken (신설)

**컬럼**:

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `id` | `BIGSERIAL` | PK | 식별자. |
| `user_id` | `BIGINT` | NOT NULL, FK → `users(id)` ON DELETE CASCADE | 토큰 소유자. |
| `type` | `VARCHAR(32)` | NOT NULL | `'EMAIL_VERIFY'` / `'PASSWORD_RESET'` / `'REFRESH'`. |
| `token_hash` | `VARCHAR(64)` | NOT NULL, UNIQUE | SHA-256(평문 토큰) 의 hex (64자). |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | 만료 시각. |
| `used_at` | `TIMESTAMPTZ` | NULLABLE | 일회용 토큰 (EMAIL_VERIFY / PASSWORD_RESET) 사용 시각. REFRESH 는 사용 X (만료 또는 row 삭제). |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT `now()` | 발급 시각. |

**Entity 제약** (CHECK):

```sql
CONSTRAINT auth_tokens_type_value CHECK (
    type IN ('EMAIL_VERIFY', 'PASSWORD_RESET', 'REFRESH')
)
```

**인덱스**:
- `auth_tokens(token_hash)` — UNIQUE.
- `auth_tokens(user_id, type)` — 사용자별 type 조회용 (예: 활성 refresh row 목록).
- `auth_tokens(expires_at)` — 일일 청소 작업의 만료 행 스캔용.

**상태 전이** (일회용 토큰 — EMAIL_VERIFY / PASSWORD_RESET):

```
[발급] created_at=now, used_at=NULL, expires_at=now+24h(EMAIL_VERIFY) or now+30min(PASSWORD_RESET)
   │
   ├─ [검증 성공] → used_at=now (재사용 거부 시작)
   │
   ├─ [만료] expires_at < now → 거부
   │
   └─ [재사용 시도] used_at IS NOT NULL → 거부
```

**상태 전이** (REFRESH):

```
[발급] created_at=now, used_at=NULL (REFRESH 는 used_at 사용 X), expires_at=now+30d
   │
   ├─ [refresh 요청] row 존재 + 만료 아님 → 새 access token 발급 (row 보존)
   │
   ├─ [로그아웃] row 삭제 → 다음 요청 거부 (`AUTH_TOKEN_REVOKED`)
   │
   └─ [만료] expires_at < now → 거부 + 일일 청소 시 row 삭제
```

**Kotlin JPA 엔티티 시그니처 스케치**:

```kotlin
@Entity
@Table(
    name = "auth_tokens",
    indexes = [
        Index(name = "idx_auth_tokens_user_type", columnList = "user_id, type"),
        Index(name = "idx_auth_tokens_expires_at", columnList = "expires_at"),
    ],
)
class AuthToken(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    val type: AuthTokenType,

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    val tokenHash: String,

    @Column(name = "expires_at", nullable = false)
    val expiresAt: Instant,

    @Column(name = "used_at")
    var usedAt: Instant? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreatedDate
    var createdAt: Instant? = null,
)
```

`AuthTokenType` enum:

```kotlin
enum class AuthTokenType { EMAIL_VERIFY, PASSWORD_RESET, REFRESH }
```

→ `user_id` 는 FK 컬럼 직접 저장 (객체 참조 `@ManyToOne` 미사용 — 토큰 단독 조회가 일반적 + LAZY 로딩 obj graph 단순화).

---

## 3. Flyway 마이그레이션 — `V3__expand_users_for_auth.sql`

```sql
-- V3: Phase 1B 백엔드 인증 — Users 확장 (kakao_id / password_hash / 인증 시각 / 잠금 / updated_at)
-- 출처: docs/plan/03-backend-requirements.md §2-2 Users
ALTER TABLE users
    ADD COLUMN kakao_id           VARCHAR(255),
    ADD COLUMN password_hash      VARCHAR(255),
    ADD COLUMN email_verified_at  TIMESTAMPTZ,
    ADD COLUMN last_login_at      TIMESTAMPTZ,
    ADD COLUMN failed_login_count INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN lockout_until      TIMESTAMPTZ,
    ADD COLUMN updated_at         TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX idx_users_kakao_id_not_null
    ON users (kakao_id)
    WHERE kakao_id IS NOT NULL;

ALTER TABLE users
    ADD CONSTRAINT users_credential_present
    CHECK (password_hash IS NOT NULL OR kakao_id IS NOT NULL);
```

**적용 주의 (HARD-GATE)**: 본 마이그레이션의 **적용**(`./gradlew flywayMigrate` 또는 Spring Boot start 시 자동 migrate) 은 `.claude/rules/infra/external-infra-safety.md` §1 의 쓰기 작업이다. **사용자 명시 컨펌 후만 가능**. 작성·리뷰는 OK.

기존 행 호환성:
- 001 단계의 `users` 기존 행은 `password_hash` / `kakao_id` 둘 다 NULL → `users_credential_present` CHECK 위반 가능.
- 본 spec 진입 시점 = 001 끝난 직후 dogfooding 단계라 기존 사용자 행 거의 없음 (개발자 본인 테스트 행 정도). 본 마이그레이션 적용 시점 dev DB / test DB 의 기존 사용자 행은 사용자 컨펌 후 수동 정리 또는 dummy `password_hash` 채워 넣기.
- 운영 DB 는 아직 없음 (Phase 1A 완료, dogfooding 대기) → 신규 적용 안전.

---

## 4. Flyway 마이그레이션 — `V4__create_auth_tokens.sql`

```sql
-- V4: Phase 1B 백엔드 인증 — AuthToken 통합 보조 테이블 (EMAIL_VERIFY / PASSWORD_RESET / REFRESH)
-- 출처: docs/plan/03-backend-requirements.md §2-2 AuthToken
CREATE TABLE auth_tokens (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type        VARCHAR(32)  NOT NULL,
    token_hash  VARCHAR(64)  NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT auth_tokens_type_value CHECK (type IN ('EMAIL_VERIFY', 'PASSWORD_RESET', 'REFRESH'))
);

CREATE INDEX idx_auth_tokens_user_type   ON auth_tokens (user_id, type);
CREATE INDEX idx_auth_tokens_expires_at  ON auth_tokens (expires_at);
```

**적용 주의**: 위 `V3` 와 동일 — 사용자 명시 컨펌 후 적용.

---

## 5. 일일 청소 작업

본 spec 의 `TokenCleanupService.kt` (`@Scheduled(cron = "0 0 0 * * *")` — 매일 자정 UTC) 가 다음 행을 삭제:

```sql
DELETE FROM auth_tokens
WHERE expires_at < now()
   OR (type IN ('EMAIL_VERIFY', 'PASSWORD_RESET') AND used_at IS NOT NULL);
```

- 만료된 모든 행 (`EMAIL_VERIFY`, `PASSWORD_RESET`, `REFRESH`) 삭제.
- `REFRESH` 는 사용 완료 개념 없음 (만료 또는 로그아웃 시 row 삭제) → 만료 조건만 적용.
- `EMAIL_VERIFY` / `PASSWORD_RESET` 의 `used_at IS NOT NULL` 도 삭제.

본 `DELETE` 는 본 spec 의 일일 작업이라 사용자 명시 컨펌 없이 운영 시점 자동 수행. 본 `DELETE` 의 의도 자체가 작성·리뷰 단계에서 spec 으로 컨펌 받은 영역 → `.claude/rules/infra/external-infra-safety.md` §1 의 "사용자가 본 세션에서 명시적으로 실행 컨펌" 의 범위는 **본 spec 의 적용 컨펌이 곧 일일 청소 컨펌** 으로 본다 (적용 컨펌 시 사용자에게 본 항목 명시).

---

## 6. 도메인 invariants 요약

| invariant | 어디서 강제 |
|---|---|
| 이메일 유일 | `users(email)` UNIQUE 인덱스 (V1) |
| 카카오 식별자 유일 | `users(kakao_id)` UNIQUE 부분 인덱스 (V3) |
| 비밀번호 또는 카카오 중 최소 하나 | `users_credential_present` CHECK 제약 (V3) |
| 토큰 해시 유일 | `auth_tokens(token_hash)` UNIQUE (V4) |
| 토큰 type 닫힌 집합 | `auth_tokens_type_value` CHECK (V4) + Kotlin enum `AuthTokenType` (애플리케이션) |
| `used_at` 일회용 토큰만 사용 | 애플리케이션 검증 (`AuthTokenLifecycleManager.kt`) — DB CHECK 박지 않음 (type 별 분기) |
| 비밀번호 정책 (12자 + 조합) | 애플리케이션 검증 (`PasswordPolicyValidator.kt`) — 해시 저장 후 DB 검증 불가 |
| 잠금 카운트 동시성 | `@Lock(LockModeType.PESSIMISTIC_WRITE)` 로 갱신 (FR-038) |
| 토큰 평문 비저장 | 애플리케이션 — `AuthTokenGenerator` 가 발급 시 해시만 반환, 평문은 호출자가 응답으로 반환 |

---

## 7. Repository 인터페이스 스케치

### `UserRepository`

```kotlin
interface UserRepository : JpaRepository<User, Long> {
    fun findByEmail(email: String): User?
    fun findByKakaoId(kakaoId: String): User?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.email = :email")
    fun findByEmailForUpdate(email: String): User?
}
```

→ `findByEmailForUpdate` 가 로그인 시도 시 잠금 카운트 갱신용 (FR-038).

### `AuthTokenRepository`

```kotlin
interface AuthTokenRepository : JpaRepository<AuthToken, Long> {
    fun findByTokenHashAndType(tokenHash: String, type: AuthTokenType): AuthToken?
    fun deleteByUserIdAndType(userId: Long, type: AuthTokenType): Int
    fun deleteByTokenHashAndType(tokenHash: String, type: AuthTokenType): Int

    @Modifying
    @Query("""
        DELETE FROM AuthToken t
         WHERE t.expiresAt < :now
            OR (t.type IN ('EMAIL_VERIFY', 'PASSWORD_RESET') AND t.usedAt IS NOT NULL)
    """)
    fun cleanupExpiredAndUsed(now: Instant): Int
}
```

→ `cleanupExpiredAndUsed` 는 일일 청소 작업 호출용 (§5 의 DELETE 와 정합).
