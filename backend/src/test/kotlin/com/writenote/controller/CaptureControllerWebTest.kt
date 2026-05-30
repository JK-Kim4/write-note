package com.writenote.controller

import com.writenote.components.ApiTokenHasher
import com.writenote.entity.ApiToken
import com.writenote.entity.User
import com.writenote.repository.ApiTokenRepository
import com.writenote.repository.MemoRepository
import com.writenote.repository.UserRepository
import org.assertj.core.api.Assertions.assertThat
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
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("CaptureController 멱등성 통합 테스트")
class CaptureControllerWebTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var apiTokenRepository: ApiTokenRepository

    @Autowired
    private lateinit var apiTokenHasher: ApiTokenHasher

    @Autowired
    private lateinit var memoRepository: MemoRepository

    @Test
    fun `같은 Idempotency-Key 로 두 번 요청하면 메모가 1건만 생성된다`() {
        val user = createUser()
        val suffix =
            UUID
                .randomUUID()
                .toString()
                .replace("-", "")
                .take(32)
        val plainToken = "wnt_$suffix"
        createActiveToken(user, plainToken)
        val idempotencyKey = UUID.randomUUID().toString()

        mockMvc
            .perform(
                post("/api/capture")
                    .header("Authorization", "Bearer $plainToken")
                    .header("Idempotency-Key", idempotencyKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"첫 번째 캡처"}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.success").value(true))

        mockMvc
            .perform(
                post("/api/capture")
                    .header("Authorization", "Bearer $plainToken")
                    .header("Idempotency-Key", idempotencyKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"두 번째 같은 키"}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.success").value(true))

        val count = memoRepository.findAll().count { it.userId == user.id!! && it.source == "MOBILE" }
        assertThat(count).isEqualTo(1)
    }

    @Test
    fun `서로 다른 Idempotency-Key 로 요청하면 메모가 각각 생성된다`() {
        val user = createUser()
        val suffix2 =
            UUID
                .randomUUID()
                .toString()
                .replace("-", "")
                .take(32)
        val plainToken = "wnt_$suffix2"
        createActiveToken(user, plainToken)

        mockMvc
            .perform(
                post("/api/capture")
                    .header("Authorization", "Bearer $plainToken")
                    .header("Idempotency-Key", UUID.randomUUID().toString())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"첫 캡처"}"""),
            ).andExpect(status().isCreated)

        mockMvc
            .perform(
                post("/api/capture")
                    .header("Authorization", "Bearer $plainToken")
                    .header("Idempotency-Key", UUID.randomUUID().toString())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"두 번째 캡처"}"""),
            ).andExpect(status().isCreated)

        val count = memoRepository.findAll().count { it.userId == user.id!! && it.source == "MOBILE" }
        assertThat(count).isEqualTo(2)
    }

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "capturect-${UUID.randomUUID()}@example.com", passwordHash = "hash"),
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
                label = "멱등 테스트 토큰",
            ),
        )
}
