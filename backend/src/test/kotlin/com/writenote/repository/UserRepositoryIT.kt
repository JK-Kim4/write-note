package com.writenote.repository

import com.writenote.entity.User
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class UserRepositoryIT
    @Autowired
    constructor(
        private val userRepository: UserRepository,
        private val entityManager: EntityManager,
    ) {
        @Test
        fun `insert flush clear and select user with database created timestamp`() {
            val saved =
                userRepository.save(
                    User(email = "writer@example.com", passwordHash = "test-fixture-password-hash"),
                )

            entityManager.flush()
            entityManager.clear()

            val found = userRepository.findById(saved.id!!).orElseThrow()

            assertThat(found.email).isEqualTo("writer@example.com")
            assertThat(found.createdAt).isNotNull()
        }

        @Test
        fun `email must be unique`() {
            userRepository.save(User(email = "duplicate@example.com", passwordHash = "test-fixture-password-hash"))
            entityManager.flush()

            assertThatThrownBy {
                userRepository.saveAndFlush(
                    User(email = "duplicate@example.com", passwordHash = "test-fixture-password-hash"),
                )
            }.isInstanceOf(DataIntegrityViolationException::class.java)
        }

        @Test
        fun `v3 updated_at is set after flush and clear`() {
            val saved =
                userRepository.save(
                    User(email = "updated-at-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )

            entityManager.flush()
            entityManager.clear()

            val found = userRepository.findById(saved.id!!).orElseThrow()

            assertThat(found.updatedAt).isNotNull()
        }

        @Test
        fun `v3 failed_login_count defaults to zero`() {
            val saved =
                userRepository.save(
                    User(email = "fcount-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )

            entityManager.flush()
            entityManager.clear()

            val found = userRepository.findById(saved.id!!).orElseThrow()

            assertThat(found.failedLoginCount).isEqualTo(0)
        }

        @Test
        fun `users_credential_present check violation when both password_hash and kakao_id are null`() {
            assertThatThrownBy {
                userRepository.saveAndFlush(User(email = "no-cred-${UUID.randomUUID()}@example.com"))
            }.isInstanceOf(DataIntegrityViolationException::class.java)
        }

        @Test
        fun `findByEmail returns user for existing email and null for unknown email`() {
            val email = "find-by-email-${UUID.randomUUID()}@example.com"
            userRepository.save(User(email = email, passwordHash = "test-fixture-password-hash"))

            entityManager.flush()
            entityManager.clear()

            assertThat(userRepository.findByEmail(email)).isNotNull()
            assertThat(userRepository.findByEmail("no-such-${UUID.randomUUID()}@example.com")).isNull()
        }

        @Test
        fun `findByKakaoId returns user for existing kakaoId and null for unknown kakaoId`() {
            val kakaoId = "kakao-${UUID.randomUUID()}"
            userRepository.save(
                User(
                    email = "kakao-user-${UUID.randomUUID()}@example.com",
                    kakaoId = kakaoId,
                ),
            )

            entityManager.flush()
            entityManager.clear()

            assertThat(userRepository.findByKakaoId(kakaoId)).isNotNull()
            assertThat(userRepository.findByKakaoId("no-such-kakao-${UUID.randomUUID()}")).isNull()
        }

        @Test
        fun `findByEmailForUpdate returns user for existing email and null for unknown email`() {
            val email = "lock-${UUID.randomUUID()}@example.com"
            userRepository.save(User(email = email, passwordHash = "test-fixture-password-hash"))

            entityManager.flush()
            entityManager.clear()

            assertThat(userRepository.findByEmailForUpdate(email)).isNotNull()
            assertThat(userRepository.findByEmailForUpdate("no-such-${UUID.randomUUID()}@example.com")).isNull()
        }

        @Test
        fun `kakao only user without password_hash satisfies credential present check`() {
            val kakaoId = "kakao-only-${UUID.randomUUID()}"
            val saved =
                userRepository.save(
                    User(
                        email = "kakao-only-${UUID.randomUUID()}@example.com",
                        kakaoId = kakaoId,
                    ),
                )

            entityManager.flush()
            entityManager.clear()

            val found = userRepository.findById(saved.id!!).orElseThrow()

            assertThat(found.kakaoId).isEqualTo(kakaoId)
            assertThat(found.passwordHash).isNull()
        }
    }
