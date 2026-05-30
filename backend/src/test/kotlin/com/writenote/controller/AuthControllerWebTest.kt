package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.components.AuthTokenGenerator
import com.writenote.entity.AuthToken
import com.writenote.entity.User
import com.writenote.enums.AuthTokenType
import com.writenote.model.request.LoginRequest
import com.writenote.model.request.LogoutRequest
import com.writenote.model.request.RefreshTokenRequest
import com.writenote.model.request.SignupEmailRequest
import com.writenote.model.request.VerifyEmailRequest
import com.writenote.repository.AuthTokenRepository
import com.writenote.repository.UserRepository
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.time.Duration
import java.time.Instant
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthControllerWebTest
    @Autowired
    constructor(
        private val mockMvc: MockMvc,
        private val objectMapper: ObjectMapper,
        private val userRepository: UserRepository,
        private val authTokenRepository: AuthTokenRepository,
        private val passwordEncoder: PasswordEncoder,
        private val authTokenGenerator: AuthTokenGenerator,
        private val jwtTokenProvider: JwtTokenProvider,
        private val entityManager: EntityManager,
    ) {
        // ─── fixtures ─────────────────────────────────────────────────────────────

        private fun createVerifiedUser(
            emailSuffix: String,
            plainPassword: String = "Strong!Pass123",
        ): User {
            val user =
                userRepository.saveAndFlush(
                    User(
                        email = "wt-$emailSuffix-${UUID.randomUUID()}@example.com",
                        passwordHash = passwordEncoder.encode(plainPassword),
                        emailVerifiedAt = Instant.now(),
                    ),
                )
            entityManager.flush()
            entityManager.clear()
            return userRepository.findById(user.id!!).orElseThrow()
        }

        private fun jwtFor(user: User): String =
            jwtTokenProvider.createAccessToken(
                userId = user.id!!,
                email = user.email,
            )

        // ─── signup-email ─────────────────────────────────────────────────────────

        @Test
        fun `signup-email happy — 201 + userId + emailVerifySent`() {
            val email = "signup-happy-${UUID.randomUUID()}@example.com"
            val request = SignupEmailRequest(email = email, password = "Strong!Pass123")
            mockMvc
                .perform(
                    post("/api/auth/signup/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)),
                ).andExpect(status().isCreated)
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value(email))
                .andExpect(jsonPath("$.data.emailVerifySent").value(true))
        }

        @Test
        fun `signup-email 이메일 형식 오류 — 400 VALIDATION_FAILED`() {
            val request = SignupEmailRequest(email = "not-an-email", password = "Strong!Pass123")
            mockMvc
                .perform(
                    post("/api/auth/signup/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)),
                ).andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"))
        }

        @Test
        fun `signup-email 약한 비밀번호 — 400 PASSWORD_TOO_WEAK`() {
            val request =
                SignupEmailRequest(
                    email = "signup-weak-${UUID.randomUUID()}@example.com",
                    password = "weak",
                )
            mockMvc
                .perform(
                    post("/api/auth/signup/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)),
                ).andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("PASSWORD_TOO_WEAK"))
        }

        @Test
        fun `signup-email 중복 가입 — 409 EMAIL_ALREADY_REGISTERED`() {
            val email = "signup-dup-${UUID.randomUUID()}@example.com"
            val request = SignupEmailRequest(email = email, password = "Strong!Pass123")
            mockMvc
                .perform(
                    post("/api/auth/signup/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)),
                ).andExpect(status().isCreated)
            mockMvc
                .perform(
                    post("/api/auth/signup/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)),
                ).andExpect(status().isConflict)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("EMAIL_ALREADY_REGISTERED"))
        }

        // ─── verify-email ─────────────────────────────────────────────────────────

        @Test
        fun `verify-email happy — 200 data null`() {
            val user =
                userRepository.saveAndFlush(
                    User(
                        email = "verify-happy-${UUID.randomUUID()}@example.com",
                        passwordHash = "dummy",
                    ),
                )
            val tokenPair = authTokenGenerator.generate()
            authTokenRepository.saveAndFlush(
                AuthToken(
                    userId = user.id!!,
                    type = AuthTokenType.EMAIL_VERIFY,
                    tokenHash = tokenPair.hash,
                    expiresAt = Instant.now().plus(Duration.ofHours(24)),
                ),
            )
            entityManager.flush()
            entityManager.clear()
            mockMvc
                .perform(
                    post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            objectMapper.writeValueAsString(
                                VerifyEmailRequest(token = tokenPair.plaintext),
                            ),
                        ),
                ).andExpect(status().isOk)
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isEmpty)
        }

        @Test
        fun `verify-email 만료 토큰 — 401 AUTH_TOKEN_EXPIRED`() {
            val user =
                userRepository.saveAndFlush(
                    User(
                        email = "verify-expired-${UUID.randomUUID()}@example.com",
                        passwordHash = "dummy",
                    ),
                )
            val tokenPair = authTokenGenerator.generate()
            authTokenRepository.saveAndFlush(
                AuthToken(
                    userId = user.id!!,
                    type = AuthTokenType.EMAIL_VERIFY,
                    tokenHash = tokenPair.hash,
                    expiresAt = Instant.now().minus(Duration.ofHours(1)),
                ),
            )
            entityManager.flush()
            entityManager.clear()
            mockMvc
                .perform(
                    post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            objectMapper.writeValueAsString(
                                VerifyEmailRequest(token = tokenPair.plaintext),
                            ),
                        ),
                ).andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("AUTH_TOKEN_EXPIRED"))
        }

        @Test
        fun `verify-email 재사용 — 409 AUTH_TOKEN_ALREADY_USED`() {
            val user =
                userRepository.saveAndFlush(
                    User(
                        email = "verify-reuse-${UUID.randomUUID()}@example.com",
                        passwordHash = "dummy",
                    ),
                )
            val tokenPair = authTokenGenerator.generate()
            authTokenRepository.saveAndFlush(
                AuthToken(
                    userId = user.id!!,
                    type = AuthTokenType.EMAIL_VERIFY,
                    tokenHash = tokenPair.hash,
                    expiresAt = Instant.now().plus(Duration.ofHours(24)),
                ),
            )
            entityManager.flush()
            entityManager.clear()
            val requestBody =
                objectMapper.writeValueAsString(
                    VerifyEmailRequest(token = tokenPair.plaintext),
                )
            // 첫 번째 호출 — 성공
            mockMvc
                .perform(
                    post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody),
                ).andExpect(status().isOk)
            // 두 번째 호출 — 재사용 409
            mockMvc
                .perform(
                    post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody),
                ).andExpect(status().isConflict)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("AUTH_TOKEN_ALREADY_USED"))
        }

        // ─── login ────────────────────────────────────────────────────────────────

        @Test
        fun `login happy — 200 accessToken + refreshToken`() {
            val user = createVerifiedUser("login-happy")
            val request = LoginRequest(email = user.email, password = "Strong!Pass123")
            mockMvc
                .perform(
                    post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)),
                ).andExpect(status().isOk)
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty)
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty)
                .andExpect(jsonPath("$.data.accessTokenExpiresIn").isNumber)
                .andExpect(jsonPath("$.data.refreshTokenExpiresIn").isNumber)
        }

        @Test
        fun `login 이메일 미인증 — 401 EMAIL_NOT_VERIFIED`() {
            val unverifiedUser =
                userRepository.saveAndFlush(
                    User(
                        email = "login-unverified-${UUID.randomUUID()}@example.com",
                        passwordHash = passwordEncoder.encode("Strong!Pass123"),
                    ),
                )
            entityManager.flush()
            entityManager.clear()
            val request = LoginRequest(email = unverifiedUser.email, password = "Strong!Pass123")
            mockMvc
                .perform(
                    post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)),
                ).andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("EMAIL_NOT_VERIFIED"))
        }

        @Test
        fun `login 비밀번호 불일치 — 401 LOGIN_FAILED`() {
            val user = createVerifiedUser("login-wrong-pw")
            val request = LoginRequest(email = user.email, password = "WrongPassword!999")
            mockMvc
                .perform(
                    post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)),
                ).andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("LOGIN_FAILED"))
        }

        @Test
        fun `login 성공 — access_token + refresh_token httpOnly 쿠키 발급 (값은 body 토큰과 일치)`() {
            val user = createVerifiedUser("login-cookie")
            val request = LoginRequest(email = user.email, password = "Strong!Pass123")
            val response =
                mockMvc
                    .perform(
                        post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)),
                    ).andExpect(status().isOk)
                    .andExpect(cookie().exists("access_token"))
                    .andExpect(cookie().httpOnly("access_token", true))
                    .andExpect(cookie().path("access_token", "/"))
                    .andExpect(cookie().exists("refresh_token"))
                    .andExpect(cookie().httpOnly("refresh_token", true))
                    .andReturn()
                    .response
            val body = response.contentAsString
            assertThat(response.getCookie("access_token")?.value)
                .isEqualTo(extractJsonField(body, "accessToken"))
            assertThat(response.getCookie("refresh_token")?.value)
                .isEqualTo(extractJsonField(body, "refreshToken"))
        }

        // ─── refresh + logout ─────────────────────────────────────────────────────

        @Test
        fun `refresh happy — 200 새 accessToken + 같은 refreshToken`() {
            val user = createVerifiedUser("refresh-happy")
            val loginRequest = LoginRequest(email = user.email, password = "Strong!Pass123")
            val loginResponse =
                mockMvc
                    .perform(
                        post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(loginRequest)),
                    ).andExpect(status().isOk)
                    .andReturn()
                    .response
                    .contentAsString
            val refreshToken = extractJsonField(loginResponse, "refreshToken")
            mockMvc
                .perform(
                    post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            objectMapper.writeValueAsString(
                                RefreshTokenRequest(refreshToken = refreshToken),
                            ),
                        ),
                ).andExpect(status().isOk)
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty)
        }

        @Test
        fun `refresh 성공 — 회전된 새 access_token + refresh_token 쿠키 발급`() {
            val user = createVerifiedUser("refresh-cookie")
            val loginRequest = LoginRequest(email = user.email, password = "Strong!Pass123")
            val loginResponse =
                mockMvc
                    .perform(
                        post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(loginRequest)),
                    ).andExpect(status().isOk)
                    .andReturn()
                    .response
                    .contentAsString
            val refreshToken = extractJsonField(loginResponse, "refreshToken")
            mockMvc
                .perform(
                    post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            objectMapper.writeValueAsString(
                                RefreshTokenRequest(refreshToken = refreshToken),
                            ),
                        ),
                ).andExpect(status().isOk)
                .andExpect(cookie().exists("access_token"))
                .andExpect(cookie().httpOnly("access_token", true))
                .andExpect(cookie().exists("refresh_token"))
                .andExpect(cookie().httpOnly("refresh_token", true))
        }

        @Test
        fun `refresh — body 없이 refresh_token 쿠키만으로 회전 (reactive refresh, 005 R-4)`() {
            val user = createVerifiedUser("refresh-cookie-only")
            val loginRequest = LoginRequest(email = user.email, password = "Strong!Pass123")
            val refreshCookie =
                mockMvc
                    .perform(
                        post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(loginRequest)),
                    ).andExpect(status().isOk)
                    .andReturn()
                    .response
                    .getCookie("refresh_token")!!
            mockMvc
                .perform(post("/api/auth/refresh").cookie(refreshCookie))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty)
                .andExpect(cookie().exists("access_token"))
                .andExpect(cookie().httpOnly("access_token", true))
        }

        @Test
        fun `refresh — body·쿠키 모두 부재 — 401 AUTH_TOKEN_MISSING`() {
            mockMvc
                .perform(post("/api/auth/refresh"))
                .andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("AUTH_TOKEN_MISSING"))
        }

        @Test
        fun `logout 성공 — access_token + refresh_token 만료 쿠키 (Max-Age=0)`() {
            val user = createVerifiedUser("logout-cookie")
            val loginRequest = LoginRequest(email = user.email, password = "Strong!Pass123")
            val loginResponse =
                mockMvc
                    .perform(
                        post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(loginRequest)),
                    ).andExpect(status().isOk)
                    .andReturn()
                    .response
                    .contentAsString
            val accessToken = extractJsonField(loginResponse, "accessToken")
            val refreshToken = extractJsonField(loginResponse, "refreshToken")
            mockMvc
                .perform(
                    post("/api/auth/logout")
                        .header("Authorization", "Bearer $accessToken")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            objectMapper.writeValueAsString(
                                LogoutRequest(refreshToken = refreshToken),
                            ),
                        ),
                ).andExpect(status().isOk)
                .andExpect(cookie().maxAge("access_token", 0))
                .andExpect(cookie().maxAge("refresh_token", 0))
        }

        @Test
        fun `logout — body 없이 access·refresh 쿠키만으로 인증·폐기 후 refresh revoked`() {
            val user = createVerifiedUser("logout-cookie-only")
            val loginRequest = LoginRequest(email = user.email, password = "Strong!Pass123")
            val loginResponse =
                mockMvc
                    .perform(
                        post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(loginRequest)),
                    ).andExpect(status().isOk)
                    .andReturn()
                    .response
            val accessCookie = loginResponse.getCookie("access_token")!!
            val refreshCookie = loginResponse.getCookie("refresh_token")!!
            mockMvc
                .perform(post("/api/auth/logout").cookie(accessCookie, refreshCookie))
                .andExpect(status().isOk)
                .andExpect(cookie().maxAge("refresh_token", 0))
            // 폐기된 refresh 쿠키로 재시도 → revoked
            mockMvc
                .perform(post("/api/auth/refresh").cookie(refreshCookie))
                .andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.error.code").value("AUTH_TOKEN_REVOKED"))
        }

        @Test
        fun `logout 후 refresh 시도 — 401 AUTH_TOKEN_REVOKED`() {
            val user = createVerifiedUser("logout-refresh")
            val loginRequest = LoginRequest(email = user.email, password = "Strong!Pass123")
            val loginResponse =
                mockMvc
                    .perform(
                        post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(loginRequest)),
                    ).andExpect(status().isOk)
                    .andReturn()
                    .response
                    .contentAsString
            val accessToken = extractJsonField(loginResponse, "accessToken")
            val refreshToken = extractJsonField(loginResponse, "refreshToken")
            // 로그아웃
            mockMvc
                .perform(
                    post("/api/auth/logout")
                        .header("Authorization", "Bearer $accessToken")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            objectMapper.writeValueAsString(
                                LogoutRequest(refreshToken = refreshToken),
                            ),
                        ),
                ).andExpect(status().isOk)
            // refresh 시도 → revoked
            mockMvc
                .perform(
                    post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            objectMapper.writeValueAsString(
                                RefreshTokenRequest(refreshToken = refreshToken),
                            ),
                        ),
                ).andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("AUTH_TOKEN_REVOKED"))
        }

        @Test
        fun `logout 미인증 — 401 AUTH_TOKEN_MISSING`() {
            mockMvc
                .perform(
                    post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            objectMapper.writeValueAsString(
                                LogoutRequest(refreshToken = "any-token"),
                            ),
                        ),
                ).andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("AUTH_TOKEN_MISSING"))
        }

        // ─── me ───────────────────────────────────────────────────────────────────

        @Test
        fun `me happy — 200 userId + email + kakaoLinked false + activeApiTokenCount 0`() {
            val user = createVerifiedUser("me-happy")
            val token = jwtFor(user)
            mockMvc
                .perform(
                    get("/api/auth/me")
                        .header("Authorization", "Bearer $token"),
                ).andExpect(status().isOk)
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.userId").value(user.id))
                .andExpect(jsonPath("$.data.email").value(user.email))
                .andExpect(jsonPath("$.data.kakaoLinked").value(false))
                .andExpect(jsonPath("$.data.activeApiTokenCount").value(0))
        }

        @Test
        fun `me 미인증 — 401 AUTH_TOKEN_MISSING`() {
            mockMvc
                .perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("AUTH_TOKEN_MISSING"))
        }

        // ─── helpers ─────────────────────────────────────────────────────────────

        /**
         * 응답 JSON 에서 최상위가 아닌 data 내의 특정 필드 값 추출.
         * 간단한 regex 기반 — 중첩 객체 없을 때 충분.
         */
        private fun extractJsonField(
            json: String,
            field: String,
        ): String =
            requireNotNull(Regex(""""$field"\s*:\s*"([^"]+)"""").find(json)) {
                "Field '$field' not found in: $json"
            }.groupValues[1]
    }
