package com.writenote.controller

import com.writenote.entity.User
import com.writenote.model.request.LoginRequest
import com.writenote.repository.UserRepository
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
 * LoginAttempt 잠금 Web 회귀 검증.
 *
 * **클래스 레벨 `@Transactional` 미박음** — production stack 의 트랜잭션 흐름 정합
 * (LoginAttemptService.recordFailure REQUIRES_NEW 가 별도 트랜잭션 commit, 호출자 rollback
 * 영향 차단). 이전 `@Transactional` 박힘은 ISSUE-014 production 회귀 못 잡음.
 *
 * 격리 = UUID email + `@AfterEach` user 삭제 (FK CASCADE 로 auth_tokens 자동 정리).
 *
 * 출처: contracts/security-filter-chain.md §1 + §3, vault ISSUE-014 fix.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LoginLockoutWebTest
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
                        email = "lockout-${UUID.randomUUID()}@example.com",
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
        @DisplayName("5회 실패 → 6번째 시도 401 LOGIN_LOCKED + envelope (FR-013, FR-015)")
        fun `5회 실패 후 6번째 LOGIN_LOCKED`() {
            val user = savedUser()

            // 5회 잘못된 비밀번호 시도 → 각 401 LOGIN_FAILED + count 누적
            repeat(5) {
                mockMvc
                    .perform(
                        post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(loginPayload(user.email, "Wrong!Pass5678")),
                    ).andExpect(status().isUnauthorized)
                    .andExpect(jsonPath("$.error.code").value("LOGIN_FAILED"))
            }

            // 6번째 시도 — LoginAttemptFilter 가 controller 진입 전 차단
            mockMvc
                .perform(
                    post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginPayload(user.email, "Wrong!Pass5678")),
                ).andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("LOGIN_LOCKED"))
                .andExpect(jsonPath("$.error.message").exists())
        }

        @Test
        @DisplayName("잠금 상태에서 정확한 비밀번호도 거부 (잠금 우선, controller 미진입)")
        fun `잠금 상태에서 정확한 비밀번호 거부`() {
            val user = savedUser()

            // 5회 실패로 잠금 진입
            repeat(5) {
                mockMvc
                    .perform(
                        post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(loginPayload(user.email, "Wrong!Pass5678")),
                    ).andExpect(status().isUnauthorized)
            }

            // 정확한 비밀번호로 시도 → LOGIN_LOCKED (Filter 차단)
            mockMvc
                .perform(
                    post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginPayload(user.email, "Correct!Pass1234")),
                ).andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.error.code").value("LOGIN_LOCKED"))
        }
    }
