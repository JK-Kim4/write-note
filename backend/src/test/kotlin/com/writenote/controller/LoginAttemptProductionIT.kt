package com.writenote.controller

import com.writenote.entity.User
import com.writenote.model.request.LoginRequest
import com.writenote.repository.UserRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import tools.jackson.databind.ObjectMapper
import java.time.Instant
import java.util.UUID

/**
 * Production stack 의 LoginAttempt 잠금 회귀 차단 (ISSUE-014).
 *
 * 본 IT 는 의도적으로 **클래스 레벨 `@Transactional` 미박음** — production stack 의
 * 실제 트랜잭션 흐름 (매 HTTP 요청 = 별도 트랜잭션, AuthService.login 의 rollback 시 user 변경 미반영) 을
 * 재현. 클래스 `@Transactional` 박은 LoginLockoutWebTest 가 본 회귀를 못 잡은 어긋남 회피.
 *
 * 본 IT 의 user 는 UUID email 박음 + `@AfterEach` 에서 본인 user row 삭제 (FK CASCADE 로 auth_tokens 자동 정리).
 *
 * 출처: contracts/security-filter-chain.md §3 (잠금 분기) + vault ISSUE-014.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LoginAttemptProductionIT
    @Autowired
    constructor(
        private val mockMvc: MockMvc,
        private val objectMapper: ObjectMapper,
        private val userRepository: UserRepository,
        private val passwordEncoder: PasswordEncoder,
    ) {
        private var createdUserId: Long? = null

        private fun savedUser(): User {
            val user =
                userRepository.saveAndFlush(
                    User(
                        email = "lock-production-${UUID.randomUUID()}@example.com",
                        passwordHash = requireNotNull(passwordEncoder.encode("Correct!Pass1234")),
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

        private fun loginPayload(
            email: String,
            password: String,
        ): String = objectMapper.writeValueAsString(LoginRequest(email = email, password = password))

        @Test
        @DisplayName("Production stack 5회 wrong password → DB failed_login_count=5 + lockout_until 박힘 (ISSUE-014 회귀)")
        fun `5회 wrong production stack 에서 failed_login_count 누적 박힘`() {
            val user = savedUser()
            val userId = requireNotNull(user.id)

            repeat(5) {
                mockMvc
                    .perform(
                        post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(loginPayload(user.email, "Wrong!Pass5678")),
                    ).andExpect(status().isUnauthorized)
                    .andExpect(jsonPath("$.error.code").value("LOGIN_FAILED"))
            }

            val locked = userRepository.findById(userId).orElseThrow()
            assertThat(locked.failedLoginCount)
                .describedAs("5회 wrong production stack 후 DB failed_login_count")
                .isEqualTo(5)
            assertThat(locked.lockoutUntil)
                .describedAs("5회 wrong production stack 후 DB lockout_until 박힘")
                .isNotNull()
            assertThat(locked.lockoutUntil!!.isAfter(Instant.now())).isTrue()
        }

        @Test
        @DisplayName("Production stack 5회 wrong → 6번째 정확한 비번 시도 → LOGIN_LOCKED (ISSUE-014 회귀)")
        fun `5회 wrong + 6번째 정확한 비번 production stack 잠금 거부`() {
            val user = savedUser()

            repeat(5) {
                mockMvc
                    .perform(
                        post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(loginPayload(user.email, "Wrong!Pass5678")),
                    ).andExpect(status().isUnauthorized)
            }

            // 6번째 — 정확한 비번이라도 LoginAttemptFilter 가 차단 의무 (잠금 우선)
            mockMvc
                .perform(
                    post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginPayload(user.email, "Correct!Pass1234")),
                ).andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("LOGIN_LOCKED"))
        }
    }
