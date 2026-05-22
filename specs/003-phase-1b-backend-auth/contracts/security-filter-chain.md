# Security Filter Chain Contract — Phase 1B Backend Auth Foundation

**Date**: 2026-05-23
**Spec**: [../spec.md](../spec.md) / **Plan**: [../plan.md](../plan.md)

본 문서는 백엔드 SoT (`docs/plan/03-backend-requirements.md`) §4-4 의 Spring Security 필터 체인 구조 + 공개/보호 endpoint 매핑 + 401 응답 5종 코드를 박는다.

---

## 1. 필터 체인 구조

```
요청
  │
  ▼
1. CORS Filter
    └─ V1 정책: 와일드카드 origin, credentials=false, 6 메서드 + 4 허용 헤더 (R-8)
  │
  ▼
2. CSRF disabled (REST + JWT 표준)
  │
  ▼
3. LoginAttemptFilter         ← 본 spec 신설
    └─ URL = `POST /api/auth/login` 한정
    └─ Request body 의 email 추출 → users.lockout_until > now 인 경우 즉시 401 + `LOGIN_LOCKED`
    └─ pass-through 인 경우 다음 필터로
  │
  ▼
4. JwtAuthenticationFilter    ← 본 spec 신설
    └─ Authorization header 가 `Bearer eyJ...` (JWT 접두사) 매칭
    └─ JwtTokenProvider.parseAccessToken() — 서명 검증 / 만료 검증
    └─ 성공 → SecurityContext 에 AuthenticatedPrincipal(userId, email) 박음
    └─ 실패 → 401 + AUTH_TOKEN_INVALID / AUTH_TOKEN_EXPIRED
    └─ Authorization 헤더 없음 → pass-through (다음 필터로)
  │
  ▼
5. ApiTokenAuthenticationFilter   ← 본 spec 신설 (골격만, Week 4 본격화)
    └─ URL = `POST /api/capture` 한정 + Authorization = `Bearer wnt_...`
    └─ ApiToken 테이블 아직 미존재 (Week 4 신설) → 본 spec 진입 시점 = 항상 401 + `AUTH_TOKEN_INVALID`
    └─ 본 spec 의 필터 체인 골격만 박음, 검증 로직은 Week 4 진입 시 결선
  │
  ▼
6. AuthorizationFilter (Spring 표준)
    └─ 공개 endpoint vs 보호 endpoint 분기 (matcher 기반)
    └─ 보호 endpoint + SecurityContext 비어 있음 → 401 + AUTH_TOKEN_MISSING
  │
  ▼
7. Controller 도달
```

**핵심 결정**:
- 3 필터 분리 — `LoginAttemptFilter` (잠금) / `JwtAuthenticationFilter` (브라우저 토큰) / `ApiTokenAuthenticationFilter` (모바일 토큰) 의 책임 명확 분리. SoT §4-4 + Q④-4 B 박힘.
- 필터 순서 — LoginAttempt 가 가장 먼저 (controller 진입 전 차단), 그 다음 JWT, 마지막 ApiToken (특정 URL 한정).
- 두 인증 필터 (JWT + ApiToken) 는 OR — 둘 중 하나가 SecurityContext 채우면 통과. 둘 다 안 되면 AuthorizationFilter 에서 401.

---

## 2. 공개 / 보호 endpoint 매핑

### 공개 (인증 불필요)

| 경로 | 메서드 | 비고 |
|---|---|---|
| `/api/auth/signup/email` | POST | 회원가입 (SoT #1) |
| `/api/auth/verify-email` | POST | 이메일 인증 토큰 검증 (SoT #2) |
| `/api/auth/login` | POST | 로그인 — LoginAttemptFilter 통과 후 (SoT #3) |
| `/api/auth/oauth/kakao` | GET | 카카오 진입 (SoT #4, Spring Security 자동) |
| `/api/auth/oauth/kakao/callback` | GET | 카카오 콜백 (SoT #5) |
| `/api/auth/password-reset/request` | POST | 재설정 요청 (SoT #6) |
| `/api/auth/password-reset/confirm` | POST | 재설정 확정 (SoT #7) |
| `/api/auth/refresh` | POST | 토큰 갱신 (SoT #8) |
| `/actuator/health` | GET | (기존 001) — 헬스 체크 |
| `/swagger-ui.html`, `/api-docs/**` | GET | 개발/스테이징 profile 만 |

### 보호 (access token 필요)

| 경로 | 메서드 | 비고 |
|---|---|---|
| `/api/auth/logout` | POST | 로그아웃 (SoT #9) |
| `/api/auth/me` | GET | 본인 정보 조회 (SoT #10) |
| `/api/auth/link/kakao` | POST | 카카오 추가 연결 시작 (SoT #11) |
| `/api/auth/link/email` | POST | 이메일·비밀번호 추가 등록 (SoT #12) |
| `/api/projects/**` | * | (기존 001) — 본 spec 에서 owner context 교체 |
| 그 외 모든 `/api/**` | * | 본 spec 의 default deny — 명시 공개 list 외 보호 |

### ApiToken (`wnt_*`) 허용

| 경로 | 메서드 | 비고 |
|---|---|---|
| `/api/capture` | POST | 모바일 캡처 (Week 4) — 본 spec 의 필터 골격만, 실제 검증은 Week 4 |

---

## 3. 401 응답 5종 코드 매핑

| 코드 | HTTP | 트리거 조건 | 응답 시점 | 클라이언트 처리 (DESIGN.md / SoT §4-4) |
|---|---|---|---|---|
| `AUTH_TOKEN_MISSING` | 401 | Authorization 헤더 자체 부재 + 보호 endpoint | AuthorizationFilter | 로그인 페이지로 |
| `AUTH_TOKEN_INVALID` | 401 | JWT 서명 검증 실패 / 형식 오류 / 만료 외 모든 무효 | JwtAuthenticationFilter | 로그인 페이지로 |
| `AUTH_TOKEN_EXPIRED` | 401 | JWT exp claim < now | JwtAuthenticationFilter | 자동 refresh 시도 |
| `AUTH_TOKEN_REVOKED` | 401 | refresh token row 미존재 (로그아웃) — `/api/auth/refresh` 한정 | AuthController | 로그인 페이지로 + 토큰 정리 |
| `LOGIN_LOCKED` | 401 | `users.lockout_until > now()` — `/api/auth/login` 한정 | LoginAttemptFilter | 안내 ("30분 후 다시 시도") |

→ FR-030 / FR-036.

**응답 envelope**:
```json
{
    "success": false,
    "error": {
        "code": "AUTH_TOKEN_EXPIRED",
        "message": "토큰이 만료되었습니다. 다시 로그인해주세요."
    }
}
```

→ 메시지는 한국어 (1차 사용자 = 한국어 작가, `DESIGN.md` 전제 #5). 본 메시지 list 는 `enums/AuthErrorCode.kt` 에 박힘.

---

## 4. CORS 정책 (SoT §4-6)

```kotlin
// CorsConfig.kt 의 결정 사항
CorsConfiguration().apply {
    allowedOrigins = listOf("*")
    allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
    allowedHeaders = listOf("Authorization", "Content-Type", "Idempotency-Key", "Accept")
    exposedHeaders = listOf("Location")
    allowCredentials = false
    maxAge = 3600
}
```

→ V1 본인 1명 + credentials=false → 와일드카드 안전. V2 외부 사용자 진입 시 명시 origin list 또는 패턴으로 좁힘 (SoT §4-6).

**SecurityFilterChain 등록**: CORS 는 Spring Security 의 `cors {}` DSL 로 위 `CorsConfiguration` 등록 + 모든 필터 가장 앞에 배치.

---

## 5. `@AuthenticationPrincipal` 사용 패턴

본 spec 의 모든 보호 endpoint 는 다음 패턴으로 owner 식별:

```kotlin
@RestController
@RequestMapping("/api/projects")
class ProjectController(
    private val projectService: ProjectService,
) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PageableDefault(size = 20, sort = ["updatedAt"], direction = Sort.Direction.DESC) pageable: Pageable,
    ): ResponseEntity<Result<Page<ProjectResponse>>> =
        ResponseEntity.ok(Result.ok(projectService.list(principal.userId, pageable)))

    // ...
}
```

→ 001 의 `X-User-Id` header 처리 코드는 모두 제거. owner 식별은 `principal.userId` 만 사용. 상세는 [`owner-context-migration.md`](./owner-context-migration.md).

`AuthenticatedPrincipal` 데이터 클래스:

```kotlin
data class AuthenticatedPrincipal(
    val userId: Long,
    val email: String,
)
```

→ JWT payload 의 `sub`, `email` 에서 추출. JwtAuthenticationFilter 가 SecurityContext 에 박음.

---

## 6. AuthenticationEntryPoint / AccessDeniedHandler

**Decision**: 본 spec 의 Spring Security `SecurityFilterChain` 에 커스텀 `AuthenticationEntryPoint` 등록 — 인증 실패 시 응답을 `Result<T>` envelope 으로 통일.

```kotlin
class AuthErrorEntryPoint(
    private val objectMapper: ObjectMapper,
) : AuthenticationEntryPoint {
    override fun commence(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authException: AuthenticationException,
    ) {
        val code = when (authException) {
            is BadCredentialsException -> "AUTH_TOKEN_INVALID"
            is CredentialsExpiredException -> "AUTH_TOKEN_EXPIRED"
            // ... 5 종 매핑
            else -> "AUTH_TOKEN_MISSING"
        }
        response.status = HttpStatus.UNAUTHORIZED.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.writer.write(objectMapper.writeValueAsString(Result.error(code, AuthErrorCode.messageOf(code))))
    }
}
```

→ Spring Security 기본 401 응답이 envelope 미준수라 커스텀 entry point 박음. FR-030 / FR-036 정합.

---

## 7. Open API (springdoc) 보안 schema

springdoc-openapi 의 `OpenApi` 빈에 두 보안 schema 추가:

```yaml
components:
  securitySchemes:
    BearerJwt:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: 브라우저 access token (Bearer eyJ...)
    BearerApiToken:
      type: http
      scheme: bearer
      description: 모바일 캡처 장기 토큰 (Bearer wnt_...), POST /api/capture 한정
```

→ Swagger UI 의 "Authorize" 버튼에서 각 schema 별 토큰 입력 가능. 개발 dogfooding 편의.

---

## 8. 본 contract 의 회귀 테스트 cover 목표

다음 시나리오의 자동 회귀 테스트가 본 spec 의 GREEN 게이트:

1. 공개 endpoint 8 종 — 비인증 호출 GREEN
2. 보호 endpoint 일반 — 비인증 호출 → 401 `AUTH_TOKEN_MISSING`
3. 보호 endpoint — 유효 JWT → 200
4. 보호 endpoint — 만료 JWT → 401 `AUTH_TOKEN_EXPIRED`
5. 보호 endpoint — 변조 JWT → 401 `AUTH_TOKEN_INVALID`
6. `/api/auth/login` — 5회 실패 후 6번째 → 401 `LOGIN_LOCKED` (LoginAttemptFilter)
7. `/api/auth/refresh` — 로그아웃 후 같은 refresh token → 401 `AUTH_TOKEN_REVOKED`
8. CORS preflight (OPTIONS) — 모든 인증/보호 endpoint 통과
9. `/api/capture` 에 JWT (eyJ*) 사용 → ApiToken 필터 적용 X, JWT 필터 통과 시 → 본 spec 진입 시점 컨트롤러 미존재라 404 (Week 4 영역)
10. `/api/auth/me` 에 ApiToken (wnt_*) 사용 → JWT 필터 매칭 안 됨 + ApiToken 필터는 `/api/capture` 한정 → 401 `AUTH_TOKEN_MISSING`
