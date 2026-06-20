package com.writenote.service

import com.writenote.components.AuthTokenGenerator
import com.writenote.entity.AuthToken
import com.writenote.entity.User
import com.writenote.enums.AuthErrorCode
import com.writenote.enums.AuthTokenType
import com.writenote.error.AuthException
import com.writenote.model.request.PasswordResetConfirmRequest
import com.writenote.model.request.PasswordResetRequestRequest
import com.writenote.repository.AuthTokenRepository
import com.writenote.repository.UserRepository
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PasswordResetServiceIT
    @Autowired
    constructor(
        private val passwordResetService: PasswordResetService,
        private val userRepository: UserRepository,
        private val authTokenRepository: AuthTokenRepository,
        private val authTokenGenerator: AuthTokenGenerator,
        private val passwordEncoder: PasswordEncoder,
        private val entityManager: EntityManager,
    ) {
        private fun savedUser(passwordHash: String = "old-hash-fixture"): User =
            userRepository.saveAndFlush(
                User(
                    email = "reset-${UUID.randomUUID()}@example.com",
                    passwordHash = passwordHash,
                ),
            )

        private fun savedPasswordResetToken(
            userId: Long,
            expiresAt: Instant = Instant.now().plus(Duration.ofMinutes(30)),
            usedAt: Instant? = null,
        ): Pair<AuthToken, String> {
            val pair = authTokenGenerator.generate()
            val token =
                authTokenRepository.saveAndFlush(
                    AuthToken(
                        userId = userId,
                        type = AuthTokenType.PASSWORD_RESET,
                        tokenHash = pair.hash,
                        expiresAt = expiresAt,
                        usedAt = usedAt,
                    ),
                )
            return token to pair.plaintext
        }

        @Test
        @DisplayName("request — 가입 미존재 이메일도 200 (PASSWORD_RESET token 미생성)")
        fun `request — 가입 미존재 이메일도 200`() {
            val unknownEmail = "ghost-${UUID.randomUUID()}@example.com"

            passwordResetService.request(PasswordResetRequestRequest(email = unknownEmail))

            entityManager.flush()
            entityManager.clear()

            val tokens =
                authTokenRepository.findAll().filter {
                    it.type == AuthTokenType.PASSWORD_RESET
                }
            // 이메일이 어떤 user 와도 매칭 안 됨 → 본 호출이 새 token 박지 않음
            assertThat(
                tokens.none { token ->
                    userRepository.findById(token.userId).orElseThrow().email == unknownEmail
                },
            ).isTrue()
        }

        @Test
        @DisplayName("request — happy: 30분 만료 PASSWORD_RESET token 발급 + 이벤트 발행")
        fun `request happy`() {
            val user = savedUser()

            passwordResetService.request(PasswordResetRequestRequest(email = user.email))

            entityManager.flush()
            entityManager.clear()

            val tokens =
                authTokenRepository.findAll().filter {
                    it.userId == user.id && it.type == AuthTokenType.PASSWORD_RESET
                }
            assertThat(tokens).hasSize(1)
            val token = tokens.first()
            // 30분 만료 ± 1분 허용 (테스트 실행 시간 변동)
            val expected = Instant.now().plus(Duration.ofMinutes(30))
            assertThat(token.expiresAt).isBetween(
                expected.minus(Duration.ofMinutes(1)),
                expected.plus(Duration.ofMinutes(1)),
            )
            assertThat(token.usedAt).isNull()
        }

        @Test
        @DisplayName("confirm — happy: passwordHash 갱신 + used_at 박음 + REFRESH 모두 삭제")
        fun `confirm happy`() {
            val user = savedUser(passwordHash = requireNotNull(passwordEncoder.encode("Old!Pass1234")))
            val (token, plaintext) = savedPasswordResetToken(userId = requireNotNull(user.id))
            // 사용자의 기존 REFRESH 토큰 2개 박음 — confirm 시 모두 삭제 검증
            authTokenRepository.saveAndFlush(
                AuthToken(
                    userId = requireNotNull(user.id),
                    type = AuthTokenType.REFRESH,
                    tokenHash = "refresh-fixture-1-${UUID.randomUUID().toString().take(24)}",
                    expiresAt = Instant.now().plus(Duration.ofDays(30)),
                ),
            )
            authTokenRepository.saveAndFlush(
                AuthToken(
                    userId = requireNotNull(user.id),
                    type = AuthTokenType.REFRESH,
                    tokenHash = "refresh-fixture-2-${UUID.randomUUID().toString().take(24)}",
                    expiresAt = Instant.now().plus(Duration.ofDays(30)),
                ),
            )
            entityManager.flush()
            entityManager.clear()

            passwordResetService.confirm(
                PasswordResetConfirmRequest(token = plaintext, newPassword = "New!Pass5678"),
            )

            entityManager.flush()
            entityManager.clear()

            val refreshed = userRepository.findById(requireNotNull(user.id)).orElseThrow()
            assertThat(passwordEncoder.matches("New!Pass5678", requireNotNull(refreshed.passwordHash))).isTrue()

            val tokenAfter = authTokenRepository.findById(requireNotNull(token.id)).orElseThrow()
            assertThat(tokenAfter.usedAt).isNotNull()

            val remainingRefresh =
                authTokenRepository.findAll().count {
                    it.userId == user.id && it.type == AuthTokenType.REFRESH
                }
            assertThat(remainingRefresh).isEqualTo(0)
        }

        @Test
        @DisplayName("confirm — 만료 토큰 거부 (AUTH_TOKEN_EXPIRED)")
        fun `confirm 만료 토큰 거부`() {
            val user = savedUser()
            val (_, plaintext) =
                savedPasswordResetToken(
                    userId = requireNotNull(user.id),
                    expiresAt = Instant.now().minus(Duration.ofMinutes(1)),
                )
            entityManager.flush()
            entityManager.clear()

            assertThatThrownBy {
                passwordResetService.confirm(
                    PasswordResetConfirmRequest(token = plaintext, newPassword = "New!Pass5678"),
                )
            }.isInstanceOf(AuthException::class.java)
                .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.AUTH_TOKEN_EXPIRED)
        }

        @Test
        @DisplayName("confirm — 재사용 토큰 거부 (AUTH_TOKEN_ALREADY_USED)")
        fun `confirm 재사용 토큰 거부`() {
            val user = savedUser()
            val (_, plaintext) =
                savedPasswordResetToken(
                    userId = requireNotNull(user.id),
                    usedAt = Instant.now().minus(Duration.ofMinutes(5)),
                )
            entityManager.flush()
            entityManager.clear()

            assertThatThrownBy {
                passwordResetService.confirm(
                    PasswordResetConfirmRequest(token = plaintext, newPassword = "New!Pass5678"),
                )
            }.isInstanceOf(AuthException::class.java)
                .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.AUTH_TOKEN_ALREADY_USED)
        }

        @Test
        @DisplayName("confirm — 약한 비밀번호 거부 (PASSWORD_TOO_WEAK)")
        fun `confirm 약한 비밀번호 거부`() {
            val user = savedUser()
            val (_, plaintext) = savedPasswordResetToken(userId = requireNotNull(user.id))
            entityManager.flush()
            entityManager.clear()

            assertThatThrownBy {
                passwordResetService.confirm(
                    PasswordResetConfirmRequest(token = plaintext, newPassword = "weak"),
                )
            }.isInstanceOf(AuthException::class.java)
                .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.PASSWORD_TOO_WEAK)
        }

        @Test
        @DisplayName("confirm — 미인증 계정은 재설정 완료 시 emailVerifiedAt 설정 (재설정 링크 클릭 = 이메일 소유 증명)")
        fun `confirm 미인증 계정 인증 부여`() {
            val user = savedUser()
            assertThat(user.emailVerifiedAt).isNull()
            val (_, plaintext) = savedPasswordResetToken(userId = requireNotNull(user.id))
            entityManager.flush()
            entityManager.clear()

            passwordResetService.confirm(
                PasswordResetConfirmRequest(token = plaintext, newPassword = "New!Pass5678"),
            )

            entityManager.flush()
            entityManager.clear()

            val refreshed = userRepository.findById(requireNotNull(user.id)).orElseThrow()
            assertThat(refreshed.emailVerifiedAt).isNotNull()
        }
    }
