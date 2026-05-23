package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.model.request.LinkEmailRequest
import com.writenote.model.request.LinkKakaoStateRequest
import com.writenote.repository.UserRepository
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
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
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.time.Instant
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AccountLinkWebTest
    @Autowired
    constructor(
        private val mockMvc: MockMvc,
        private val objectMapper: ObjectMapper,
        private val userRepository: UserRepository,
        private val passwordEncoder: PasswordEncoder,
        private val jwtTokenProvider: JwtTokenProvider,
        private val entityManager: EntityManager,
    ) {
        private fun savedKakaoOnlyUser(): User =
            userRepository.saveAndFlush(
                User(
                    email = "link-web-${UUID.randomUUID()}@example.com",
                    kakaoId = "kakao-${UUID.randomUUID().toString().take(16)}",
                    passwordHash = null,
                    emailVerifiedAt = Instant.now(),
                ),
            )

        private fun savedEmailOnlyUser(): User =
            userRepository.saveAndFlush(
                User(
                    email = "link-web-${UUID.randomUUID()}@example.com",
                    passwordHash = requireNotNull(passwordEncoder.encode("Old!Pass1234")),
                    emailVerifiedAt = Instant.now(),
                ),
            )

        private fun jwtFor(user: User): String = jwtTokenProvider.createAccessToken(userId = requireNotNull(user.id), email = user.email)

        @Test
        @DisplayName("POST /api/auth/link/email happy — 200 + userId + email + passwordSet")
        fun `linkEmail happy`() {
            val user = savedKakaoOnlyUser()
            entityManager.flush()
            entityManager.clear()
            val token = jwtFor(user)

            mockMvc
                .perform(
                    post("/api/auth/link/email")
                        .header("Authorization", "Bearer $token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(LinkEmailRequest(password = "Strong!Pass1234"))),
                ).andExpect(status().isOk)
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.userId").value(user.id))
                .andExpect(jsonPath("$.data.email").value(user.email))
                .andExpect(jsonPath("$.data.passwordSet").value(true))
        }

        @Test
        @DisplayName("POST /api/auth/link/email — 이미 비밀번호 설정됨 409 PASSWORD_ALREADY_SET")
        fun `linkEmail PASSWORD_ALREADY_SET`() {
            val user = savedEmailOnlyUser()
            entityManager.flush()
            entityManager.clear()
            val token = jwtFor(user)

            mockMvc
                .perform(
                    post("/api/auth/link/email")
                        .header("Authorization", "Bearer $token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(LinkEmailRequest(password = "Strong!Pass1234"))),
                ).andExpect(status().isConflict)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("PASSWORD_ALREADY_SET"))
        }

        @Test
        @DisplayName("POST /api/auth/link/kakao — 302 redirect + session linkUserId 박힘")
        fun `linkKakao start 302 + session`() {
            val user = savedEmailOnlyUser()
            entityManager.flush()
            entityManager.clear()
            val token = jwtFor(user)

            val result =
                mockMvc
                    .perform(
                        post("/api/auth/link/kakao")
                            .header("Authorization", "Bearer $token"),
                    ).andExpect(status().isFound)
                    .andExpect(header().string("Location", "/api/auth/oauth/kakao"))
                    .andReturn()

            val state =
                result.request.session?.getAttribute(LinkKakaoStateRequest.SESSION_ATTRIBUTE_KEY)
                    as? LinkKakaoStateRequest
            assertThat(state).isNotNull()
            assertThat(state?.linkUserId).isEqualTo(user.id)
        }

        @Test
        @DisplayName("POST /api/auth/link/email — 비인증 401 AUTH_TOKEN_MISSING")
        fun `linkEmail 비인증 거부`() {
            mockMvc
                .perform(
                    post("/api/auth/link/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(LinkEmailRequest(password = "Strong!Pass1234"))),
                ).andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.error.code").value("AUTH_TOKEN_MISSING"))
        }
    }
