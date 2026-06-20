package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.model.request.WithdrawRequest
import com.writenote.repository.UserRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie
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
class AuthControllerWithdrawIT
    @Autowired
    constructor(
        private val mockMvc: MockMvc,
        private val objectMapper: ObjectMapper,
        private val userRepository: UserRepository,
        private val passwordEncoder: PasswordEncoder,
        private val jwtTokenProvider: JwtTokenProvider,
    ) {
        private fun createVerifiedUser(emailSuffix: String): User {
            val user =
                userRepository.saveAndFlush(
                    User(
                        email = "wd-$emailSuffix-${UUID.randomUUID()}@example.com",
                        passwordHash = passwordEncoder.encode("Strong!Pass123"),
                        emailVerifiedAt = Instant.now(),
                    ),
                )
            return userRepository.findById(user.id!!).orElseThrow()
        }

        private fun jwtFor(user: User): String =
            jwtTokenProvider.createAccessToken(
                userId = user.id!!,
                email = user.email,
            )

        @Test
        fun `확인 문구 일치 시 탈퇴되고 쿠키가 만료된다`() {
            val user = createVerifiedUser("ok")
            val userId = user.id!!
            val token = jwtFor(user)

            mockMvc
                .perform(
                    delete("/api/auth/me")
                        .header("Authorization", "Bearer $token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(WithdrawRequest(confirmation = "탈퇴합니다"))),
                ).andExpect(status().isOk)
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(cookie().maxAge("access_token", 0))
                .andExpect(cookie().maxAge("refresh_token", 0))

            assertThat(userRepository.existsById(userId)).isFalse()
        }

        @Test
        fun `확인 문구 불일치 시 400 WITHDRAWAL_CONFIRMATION_MISMATCH`() {
            val user = createVerifiedUser("mismatch")
            val userId = user.id!!
            val token = jwtFor(user)

            mockMvc
                .perform(
                    delete("/api/auth/me")
                        .header("Authorization", "Bearer $token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(WithdrawRequest(confirmation = "틀린문구"))),
                ).andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("WITHDRAWAL_CONFIRMATION_MISMATCH"))

            assertThat(userRepository.existsById(userId)).isTrue()
        }

        @Test
        fun `미인증 시 401`() {
            mockMvc
                .perform(
                    delete("/api/auth/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(WithdrawRequest(confirmation = "탈퇴합니다"))),
                ).andExpect(status().isUnauthorized)
        }
    }
