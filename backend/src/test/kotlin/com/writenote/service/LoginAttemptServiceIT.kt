package com.writenote.service

import com.writenote.entity.User
import com.writenote.repository.UserRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.test.context.ActiveProfiles
import java.time.Duration
import java.time.Instant
import java.util.UUID

/**
 * LoginAttemptService 단위/IT.
 *
 * **클래스 레벨 `@Transactional` 미박음** — recordFailure 의 REQUIRES_NEW 가 별도
 * 트랜잭션 commit 박힘. 본 IT 가 트랜잭션 박혀있으면 user fixture 가 uncommitted state
 * → recordFailure 가 user 못 찾아 silent return (ISSUE-014 fix 영역).
 *
 * 격리 = UUID email + `@AfterEach` user 삭제 (FK CASCADE).
 */
@SpringBootTest
@ActiveProfiles("test")
class LoginAttemptServiceIT
    @Autowired
    constructor(
        private val loginAttemptService: LoginAttemptService,
        private val userRepository: UserRepository,
        private val passwordEncoder: PasswordEncoder,
    ) {
        private var createdUserId: Long? = null

        private fun savedUser(): User {
            val user =
                userRepository.saveAndFlush(
                    User(
                        email = "lock-${UUID.randomUUID()}@example.com",
                        passwordHash = requireNotNull(passwordEncoder.encode("Pass!1234567")),
                        emailVerifiedAt = Instant.now(),
                    ),
                )
            createdUserId = user.id
            return user
        }

        @AfterEach
        fun cleanup() {
            createdUserId?.let { id ->
                if (userRepository.existsById(id)) {
                    userRepository.deleteById(id)
                }
            }
            createdUserId = null
        }

        @Test
        @DisplayName("5회 실패 → failed_login_count=5 + lockout_until 박힘 + isLocked=true (FR-013)")
        fun `5회 실패 후 잠금`() {
            val user = savedUser()

            repeat(5) {
                loginAttemptService.recordFailure(user.email)
            }

            val locked = userRepository.findById(requireNotNull(user.id)).orElseThrow()
            assertThat(locked.failedLoginCount).isEqualTo(5)
            assertThat(locked.lockoutUntil).isNotNull()
            assertThat(loginAttemptService.isLocked(user.email)).isTrue()
        }

        @Test
        @DisplayName("잠금 만료 후 isLocked=false + 다음 recordFailure 가 count=1 reset (잠금 자동 해제)")
        fun `잠금 만료 후 통과`() {
            val user = savedUser()

            repeat(5) { loginAttemptService.recordFailure(user.email) }

            // lockout_until 을 과거 시각으로 박음 (만료 시뮬레이션)
            val expired = userRepository.findById(requireNotNull(user.id)).orElseThrow()
            expired.lockoutUntil = Instant.now().minus(Duration.ofMinutes(1))
            userRepository.saveAndFlush(expired)

            assertThat(loginAttemptService.isLocked(user.email)).isFalse()

            // 다음 recordFailure 진입 → count = 1 reset + lockout NULL
            loginAttemptService.recordFailure(user.email)

            val reset = userRepository.findById(requireNotNull(user.id)).orElseThrow()
            assertThat(reset.failedLoginCount).isEqualTo(1)
            assertThat(reset.lockoutUntil).isNull()
        }

        @Test
        @DisplayName("4회 실패 후 5번째 성공 → count=0 + lockout NULL + lastLoginAt 박힘 (FR-014)")
        fun `4회 실패 후 성공 시 카운트 초기화`() {
            val user = savedUser()

            repeat(4) { loginAttemptService.recordFailure(user.email) }
            loginAttemptService.recordSuccess(user.email)

            val reset = userRepository.findById(requireNotNull(user.id)).orElseThrow()
            assertThat(reset.failedLoginCount).isEqualTo(0)
            assertThat(reset.lockoutUntil).isNull()
            assertThat(reset.lastLoginAt).isNotNull()
        }

        @Test
        @DisplayName("동시 실패 결정성 — pessimistic lock 으로 5회 누적 후 lockout 박힘 (FR-038, 직렬 검증)")
        fun `동시 실패 결정성`() {
            val user = savedUser()

            // 직렬 5회 호출 — findByEmailForUpdate 의 PESSIMISTIC_WRITE 호출 경로 적용 검증.
            // 멀티 스레드 시뮬레이션은 V1 dogfooding / Phase 9 polish 영역 (research.md R-5).
            repeat(5) { loginAttemptService.recordFailure(user.email) }

            val locked = userRepository.findById(requireNotNull(user.id)).orElseThrow()
            assertThat(locked.failedLoginCount).isEqualTo(5)
            assertThat(locked.lockoutUntil).isNotNull()
        }
    }
