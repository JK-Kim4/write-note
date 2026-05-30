package com.writenote.auth

import com.writenote.components.ApiTokenHasher
import com.writenote.entity.ApiToken
import com.writenote.entity.User
import com.writenote.repository.ApiTokenRepository
import com.writenote.repository.UserRepository
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("ApiTokenAuthenticationFilter 통합 테스트")
class ApiTokenAuthenticationFilterIT {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var apiTokenRepository: ApiTokenRepository

    @Autowired
    private lateinit var apiTokenHasher: ApiTokenHasher

    @Test
    fun `유효한 ApiToken 으로 POST capture 요청 시 401 이 아닌 응답을 받는다`() {
        val user = createUser()
        val suffix =
            UUID
                .randomUUID()
                .toString()
                .replace("-", "")
                .take(32)
        val plainToken = "wnt_$suffix"
        val token = createActiveToken(user, plainToken)

        mockMvc
            .perform(
                post("/api/capture")
                    .header("Authorization", "Bearer $plainToken")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"모바일 메모"}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.source").value("MOBILE"))

        // last_used_at 갱신 확인
        val updated = apiTokenRepository.findById(token.id!!).get()
        assert(updated.lastUsedAt != null) { "last_used_at 이 갱신되지 않았다" }
    }

    @Test
    fun `해지된 ApiToken 으로 요청 시 401 AUTH_TOKEN_REVOKED 를 반환한다`() {
        val user = createUser()
        val suffix =
            UUID
                .randomUUID()
                .toString()
                .replace("-", "")
                .take(32)
        val plainToken = "wnt_$suffix"
        createRevokedToken(user, plainToken)

        mockMvc
            .perform(
                post("/api/capture")
                    .header("Authorization", "Bearer $plainToken")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"해지 테스트"}"""),
            ).andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.error.code").value("AUTH_TOKEN_REVOKED"))
    }

    @Test
    fun `형식이 잘못된 토큰(wnt_ 접두사 없음) 으로 요청 시 401 AUTH_TOKEN_INVALID 를 반환한다`() {
        mockMvc
            .perform(
                post("/api/capture")
                    .header("Authorization", "Bearer invalid-format-token")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"형식 오류"}"""),
            ).andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.error.code").value("AUTH_TOKEN_INVALID"))
    }

    @Test
    fun `존재하지 않는 토큰으로 요청 시 401 AUTH_TOKEN_INVALID 를 반환한다`() {
        mockMvc
            .perform(
                post("/api/capture")
                    .header("Authorization", "Bearer wnt_nonexistenttoken1234567890")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"미존재"}"""),
            ).andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.error.code").value("AUTH_TOKEN_INVALID"))
    }

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "apitokentest-${UUID.randomUUID()}@example.com", passwordHash = "hash"),
        )

    private fun createActiveToken(
        user: User,
        plainToken: String,
    ): ApiToken =
        apiTokenRepository.saveAndFlush(
            ApiToken(
                userId = user.id!!,
                tokenHash = apiTokenHasher.hash(plainToken),
                tokenPrefix = plainToken.take(8),
                label = "테스트 토큰",
            ),
        )

    private fun createRevokedToken(
        user: User,
        plainToken: String,
    ): ApiToken =
        apiTokenRepository.saveAndFlush(
            ApiToken(
                userId = user.id!!,
                tokenHash = apiTokenHasher.hash(plainToken),
                tokenPrefix = plainToken.take(8),
                label = "해지 토큰",
                revokedAt = Instant.now().minusSeconds(3600),
            ),
        )
}
