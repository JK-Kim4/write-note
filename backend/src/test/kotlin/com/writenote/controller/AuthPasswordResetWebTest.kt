package com.writenote.controller

import com.writenote.components.AuthTokenGenerator
import com.writenote.entity.AuthToken
import com.writenote.entity.User
import com.writenote.enums.AuthTokenType
import com.writenote.model.request.PasswordResetConfirmRequest
import com.writenote.model.request.PasswordResetRequestRequest
import com.writenote.repository.AuthTokenRepository
import com.writenote.repository.UserRepository
import jakarta.persistence.EntityManager
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
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.time.Duration
import java.time.Instant
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthPasswordResetWebTest
    @Autowired
    constructor(
        private val mockMvc: MockMvc,
        private val objectMapper: ObjectMapper,
        private val userRepository: UserRepository,
        private val authTokenRepository: AuthTokenRepository,
        private val authTokenGenerator: AuthTokenGenerator,
        private val passwordEncoder: PasswordEncoder,
        private val entityManager: EntityManager,
    ) {
        private fun savedUser(): User =
            userRepository.saveAndFlush(
                User(
                    email = "reset-web-${UUID.randomUUID()}@example.com",
                    passwordHash = requireNotNull(passwordEncoder.encode("Old!Pass1234")),
                    emailVerifiedAt = Instant.now(),
                ),
            )

        private fun savedPasswordResetToken(
            userId: Long,
            expiresAt: Instant = Instant.now().plus(Duration.ofMinutes(30)),
            usedAt: Instant? = null,
        ): String {
            val pair = authTokenGenerator.generate()
            authTokenRepository.saveAndFlush(
                AuthToken(
                    userId = userId,
                    type = AuthTokenType.PASSWORD_RESET,
                    tokenHash = pair.hash,
                    expiresAt = expiresAt,
                    usedAt = usedAt,
                ),
            )
            return pair.plaintext
        }

        @Test
        @DisplayName("password-reset/request happy — 200 + envelope")
        fun `request happy`() {
            val user = savedUser()
            entityManager.flush()
            entityManager.clear()

            mockMvc
                .perform(
                    post("/api/auth/password-reset/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            objectMapper.writeValueAsString(
                                PasswordResetRequestRequest(email = user.email),
                            ),
                        ),
                ).andExpect(status().isOk)
                .andExpect(jsonPath("$.success").value(true))
        }

        @Test
        @DisplayName("password-reset/confirm happy — 200")
        fun `confirm happy`() {
            val user = savedUser()
            val plaintext = savedPasswordResetToken(userId = requireNotNull(user.id))
            entityManager.flush()
            entityManager.clear()

            mockMvc
                .perform(
                    post("/api/auth/password-reset/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            objectMapper.writeValueAsString(
                                PasswordResetConfirmRequest(
                                    token = plaintext,
                                    newPassword = "New!Pass5678",
                                ),
                            ),
                        ),
                ).andExpect(status().isOk)
                .andExpect(jsonPath("$.success").value(true))
        }

        @Test
        @DisplayName("password-reset/confirm 만료 토큰 — 401 AUTH_TOKEN_EXPIRED")
        fun `confirm 만료 토큰`() {
            val user = savedUser()
            val plaintext =
                savedPasswordResetToken(
                    userId = requireNotNull(user.id),
                    expiresAt = Instant.now().minus(Duration.ofMinutes(1)),
                )
            entityManager.flush()
            entityManager.clear()

            mockMvc
                .perform(
                    post("/api/auth/password-reset/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            objectMapper.writeValueAsString(
                                PasswordResetConfirmRequest(
                                    token = plaintext,
                                    newPassword = "New!Pass5678",
                                ),
                            ),
                        ),
                ).andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("AUTH_TOKEN_EXPIRED"))
        }

        @Test
        @DisplayName("password-reset/confirm 재사용 토큰 — 409 AUTH_TOKEN_ALREADY_USED")
        fun `confirm 재사용 토큰`() {
            val user = savedUser()
            val plaintext =
                savedPasswordResetToken(
                    userId = requireNotNull(user.id),
                    usedAt = Instant.now().minus(Duration.ofMinutes(5)),
                )
            entityManager.flush()
            entityManager.clear()

            mockMvc
                .perform(
                    post("/api/auth/password-reset/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            objectMapper.writeValueAsString(
                                PasswordResetConfirmRequest(
                                    token = plaintext,
                                    newPassword = "New!Pass5678",
                                ),
                            ),
                        ),
                ).andExpect(status().isConflict)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("AUTH_TOKEN_ALREADY_USED"))
        }

        @Test
        @DisplayName("password-reset/confirm 약한 비밀번호 — 400 PASSWORD_TOO_WEAK")
        fun `confirm 약한 비밀번호`() {
            val user = savedUser()
            val plaintext = savedPasswordResetToken(userId = requireNotNull(user.id))
            entityManager.flush()
            entityManager.clear()

            mockMvc
                .perform(
                    post("/api/auth/password-reset/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            objectMapper.writeValueAsString(
                                PasswordResetConfirmRequest(
                                    token = plaintext,
                                    newPassword = "weak",
                                ),
                            ),
                        ),
                ).andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("PASSWORD_TOO_WEAK"))
        }
    }
