package com.writenote.repository

import com.writenote.entity.AuthToken
import com.writenote.entity.User
import com.writenote.enums.AuthTokenType
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AuthTokenRepositoryIT
    @Autowired
    constructor(
        private val authTokenRepository: AuthTokenRepository,
        private val userRepository: UserRepository,
        private val entityManager: EntityManager,
    ) {
        private fun savedUser(): User =
            userRepository.save(
                User(
                    email = "token-user-${UUID.randomUUID()}@example.com",
                    passwordHash = "test-fixture-password-hash",
                ),
            )

        private fun futureInstant(): Instant = Instant.now().plusSeconds(3600)

        @BeforeEach
        fun isolateFromCommittedRows() {
            authTokenRepository.deleteAll()
            entityManager.flush()
        }

        @Test
        fun `insert flush clear and findByTokenHashAndType returns token with db default createdAt`() {
            val user = savedUser()
            val tokenHash = "hash-${UUID.randomUUID().toString().replace("-", "").take(32)}"
            val saved =
                authTokenRepository.save(
                    AuthToken(
                        userId = user.id!!,
                        type = AuthTokenType.REFRESH,
                        tokenHash = tokenHash,
                        expiresAt = futureInstant(),
                    ),
                )

            entityManager.flush()
            entityManager.clear()

            val found = authTokenRepository.findByTokenHashAndType(tokenHash, AuthTokenType.REFRESH)

            assertThat(found).isNotNull()
            assertThat(found!!.id).isEqualTo(saved.id)
            assertThat(found.createdAt).isNotNull()
        }

        @Test
        fun `token_hash unique constraint violation on duplicate hash`() {
            val user = savedUser()
            val tokenHash = "dup-hash-${UUID.randomUUID().toString().replace("-", "").take(24)}"
            authTokenRepository.save(
                AuthToken(
                    userId = user.id!!,
                    type = AuthTokenType.REFRESH,
                    tokenHash = tokenHash,
                    expiresAt = futureInstant(),
                ),
            )
            entityManager.flush()

            assertThatThrownBy {
                authTokenRepository.saveAndFlush(
                    AuthToken(
                        userId = user.id!!,
                        type = AuthTokenType.EMAIL_VERIFY,
                        tokenHash = tokenHash,
                        expiresAt = futureInstant(),
                    ),
                )
            }.isInstanceOf(DataIntegrityViolationException::class.java)
        }

        @Test
        fun `deleteByTokenHashAndType removes the row and findById returns empty`() {
            val user = savedUser()
            val tokenHash = "del-hash-${UUID.randomUUID().toString().replace("-", "").take(24)}"
            val saved =
                authTokenRepository.save(
                    AuthToken(
                        userId = user.id!!,
                        type = AuthTokenType.PASSWORD_RESET,
                        tokenHash = tokenHash,
                        expiresAt = futureInstant(),
                    ),
                )
            entityManager.flush()

            authTokenRepository.deleteByTokenHashAndType(tokenHash, AuthTokenType.PASSWORD_RESET)
            entityManager.flush()
            entityManager.clear()

            assertThat(authTokenRepository.findById(saved.id!!)).isEmpty()
        }

        @Test
        fun `cleanupExpiredAndUsed deletes expired and used tokens and keeps valid refresh token`() {
            val user = savedUser()
            val expiredToken =
                authTokenRepository.save(
                    AuthToken(
                        userId = user.id!!,
                        type = AuthTokenType.REFRESH,
                        tokenHash = "expired-${UUID.randomUUID().toString().replace("-", "").take(24)}",
                        expiresAt = Instant.now().minusSeconds(1),
                    ),
                )
            val usedEmailVerify =
                authTokenRepository.save(
                    AuthToken(
                        userId = user.id!!,
                        type = AuthTokenType.EMAIL_VERIFY,
                        tokenHash = "used-ev-${UUID.randomUUID().toString().replace("-", "").take(24)}",
                        expiresAt = futureInstant(),
                        usedAt = Instant.now().minusSeconds(60),
                    ),
                )
            val validRefresh =
                authTokenRepository.save(
                    AuthToken(
                        userId = user.id!!,
                        type = AuthTokenType.REFRESH,
                        tokenHash = "valid-rf-${UUID.randomUUID().toString().replace("-", "").take(24)}",
                        expiresAt = futureInstant(),
                    ),
                )
            entityManager.flush()
            entityManager.clear()

            val deleted = authTokenRepository.cleanupExpiredAndUsed(Instant.now())

            entityManager.flush()
            entityManager.clear()

            assertThat(deleted).isEqualTo(2)
            assertThat(authTokenRepository.findById(expiredToken.id!!)).isEmpty()
            assertThat(authTokenRepository.findById(usedEmailVerify.id!!)).isEmpty()
            assertThat(authTokenRepository.findById(validRefresh.id!!)).isPresent()
        }

        @Test
        fun `findByTokenHashAndType returns null when type does not match stored token`() {
            val user = savedUser()
            val tokenHash = "type-check-${UUID.randomUUID().toString().replace("-", "").take(20)}"
            authTokenRepository.save(
                AuthToken(
                    userId = user.id!!,
                    type = AuthTokenType.EMAIL_VERIFY,
                    tokenHash = tokenHash,
                    expiresAt = futureInstant(),
                ),
            )
            entityManager.flush()
            entityManager.clear()

            assertThat(
                authTokenRepository.findByTokenHashAndType(tokenHash, AuthTokenType.PASSWORD_RESET),
            ).isNull()
        }
    }
