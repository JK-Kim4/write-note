package com.writenote.service

import com.writenote.components.AuthTokenGenerator
import com.writenote.entity.AuthToken
import com.writenote.entity.User
import com.writenote.enums.AuthErrorCode
import com.writenote.enums.AuthTokenType
import com.writenote.error.AuthException
import com.writenote.model.request.LoginRequest
import com.writenote.model.request.RefreshTokenRequest
import com.writenote.model.request.SignupEmailRequest
import com.writenote.model.request.VerifyEmailRequest
import com.writenote.repository.AuthTokenRepository
import com.writenote.repository.UserRepository
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AuthServiceIT
    @Autowired
    constructor(
        private val authService: AuthService,
        private val userRepository: UserRepository,
        private val authTokenRepository: AuthTokenRepository,
        private val authTokenGenerator: AuthTokenGenerator,
        private val entityManager: EntityManager,
    ) {
        @Test
        fun `이메일 회원가입 성공 — User INSERT + EMAIL_VERIFY token INSERT + 이벤트 발행`() {
            // given
            val email = "newuser-${UUID.randomUUID()}@example.com"
            val request = SignupEmailRequest(email = email, password = "Strong!Pass123")

            // when
            val response = authService.signupEmail(request)

            entityManager.flush()
            entityManager.clear()

            // then
            assertThat(response.email).isEqualTo(email)
            assertThat(response.emailVerifySent).isTrue()
            val saved = userRepository.findByEmail(email)!!
            assertThat(saved.passwordHash).isNotNull()
            assertThat(saved.emailVerifiedAt).isNull()
            // EMAIL_VERIFY token row 존재 — by user_id+type 조회
            val tokenCount =
                authTokenRepository.findAll().count {
                    it.userId == saved.id && it.type == AuthTokenType.EMAIL_VERIFY
                }
            assertThat(tokenCount).isEqualTo(1)
        }

        @Test
        fun `이메일 중복 가입 — EMAIL_ALREADY_REGISTERED`() {
            // given
            val email = "duplicate-${UUID.randomUUID()}@example.com"
            authService.signupEmail(SignupEmailRequest(email = email, password = "Strong!Pass123"))
            entityManager.flush()

            // when & then
            assertThatThrownBy {
                authService.signupEmail(SignupEmailRequest(email = email, password = "Strong!Pass456"))
            }.isInstanceOf(AuthException::class.java)
                .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.EMAIL_ALREADY_REGISTERED)
        }

        @Test
        fun `약한 비밀번호 거부 — PASSWORD_TOO_WEAK`() {
            // given
            val email = "weak-${UUID.randomUUID()}@example.com"

            // when & then
            assertThatThrownBy {
                authService.signupEmail(SignupEmailRequest(email = email, password = "weak"))
            }.isInstanceOf(AuthException::class.java)
                .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.PASSWORD_TOO_WEAK)
        }

        @Test
        fun `이메일 인증 + 로그인 + refresh + 로그아웃 사이클`() {
            // given: signup
            val email = "lifecycle-${UUID.randomUUID()}@example.com"
            val plainPassword = "Strong!Pass123"
            authService.signupEmail(SignupEmailRequest(email = email, password = plainPassword))
            entityManager.flush()
            entityManager.clear()

            // emailVerifiedAt 을 직접 set — verifyEmail plaintext 는 이벤트 listener 경유라
            // 단일 트랜잭션 IT 안에서 얻기 어려움.
            // verifyEmail 자체 검증은 시나리오 5에서 수행.
            val user = userRepository.findByEmail(email)!!
            user.emailVerifiedAt = Instant.now()
            userRepository.saveAndFlush(user)
            entityManager.clear()

            // when: login
            val loginResponse = authService.login(LoginRequest(email = email, password = plainPassword))
            entityManager.flush()
            entityManager.clear()

            assertThat(loginResponse.accessToken).isNotBlank()
            assertThat(loginResponse.refreshToken).isNotBlank()
            val refreshToken = loginResponse.refreshToken

            // then: refresh — V1 = rotation 미적용, 동일 refreshToken 반환
            val refreshResponse = authService.refresh(RefreshTokenRequest(refreshToken = refreshToken))
            assertThat(refreshResponse.accessToken).isNotBlank()
            assertThat(refreshResponse.refreshToken).isEqualTo(refreshToken)

            // when: logout
            authService.logout(refreshToken)
            entityManager.flush()
            entityManager.clear()

            // then: 다음 refresh 시도 — AUTH_TOKEN_REVOKED
            assertThatThrownBy {
                authService.refresh(RefreshTokenRequest(refreshToken = refreshToken))
            }.isInstanceOf(AuthException::class.java)
                .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.AUTH_TOKEN_REVOKED)
        }

        @Test
        fun `이메일 인증 토큰 검증 + 재사용 거부`() {
            // given: user + EMAIL_VERIFY token (직접 setup)
            val user =
                userRepository.saveAndFlush(
                    User(
                        email = "verify-${UUID.randomUUID()}@example.com",
                        passwordHash = "dummy-not-used-here",
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

            // when: verify
            authService.verifyEmail(VerifyEmailRequest(token = tokenPair.plaintext))
            entityManager.flush()
            entityManager.clear()

            // then: user emailVerifiedAt 박힘
            val verified = userRepository.findById(user.id!!).orElseThrow()
            assertThat(verified.emailVerifiedAt).isNotNull()

            // 재사용 거부 (AUTH_TOKEN_ALREADY_USED)
            assertThatThrownBy {
                authService.verifyEmail(VerifyEmailRequest(token = tokenPair.plaintext))
            }.isInstanceOf(AuthException::class.java)
                .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.AUTH_TOKEN_ALREADY_USED)
        }
    }
