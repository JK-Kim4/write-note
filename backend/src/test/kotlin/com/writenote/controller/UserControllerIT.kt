package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.repository.UserRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/**
 * US2 — 닉네임 변경 엔드포인트(PATCH /api/users/me/nickname).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserControllerIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    private fun createUser(nickname: String): User =
        userRepository.saveAndFlush(
            User(
                email = "user-ctrl-${UUID.randomUUID()}@example.com",
                nickname = nickname,
                passwordHash = "test-fixture-password-hash",
            ),
        )

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"

    private fun patchNickname(
        bearer: String?,
        nickname: String,
    ) = mockMvc.perform(
        patch("/api/users/me/nickname")
            .apply { if (bearer != null) header("Authorization", bearer) }
            .contentType(MediaType.APPLICATION_JSON)
            .content("""{"nickname":"$nickname"}"""),
    )

    @Test
    fun `유효한 닉네임으로 변경하면 200과 갱신된 닉네임을 반환한다`() {
        val user = createUser("기존닉네임${UUID.randomUUID().toString().take(4)}")

        patchNickname(bearerFor(user), "새필명${UUID.randomUUID().toString().take(4)}")
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.nickname").exists())
            .andExpect(jsonPath("$.success").value(true))
    }

    @Test
    fun `이미 사용 중인 닉네임이면 409 NICKNAME_ALREADY_REGISTERED`() {
        val taken = "점유닉네임${UUID.randomUUID().toString().take(6)}"
        createUser(taken)
        val user = createUser("나의닉네임${UUID.randomUUID().toString().take(4)}")

        patchNickname(bearerFor(user), taken)
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error.code").value("NICKNAME_ALREADY_REGISTERED"))
    }

    @Test
    fun `형식 위반 닉네임이면 400 NICKNAME_INVALID_FORMAT`() {
        val user = createUser("형식테스트${UUID.randomUUID().toString().take(4)}")

        patchNickname(bearerFor(user), "별★")
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("NICKNAME_INVALID_FORMAT"))
    }

    @Test
    fun `금칙어 포함 닉네임이면 400 NICKNAME_FORBIDDEN_WORD`() {
        val user = createUser("금칙어테스트${UUID.randomUUID().toString().take(2)}")

        patchNickname(bearerFor(user), "씨발놈아")
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("NICKNAME_FORBIDDEN_WORD"))
    }

    @Test
    fun `현재 닉네임과 동일한 값은 수용하고 200을 반환한다`() {
        val same = "그대로유지${UUID.randomUUID().toString().take(4)}"
        val user = createUser(same)

        patchNickname(bearerFor(user), same)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.nickname").value(same))
    }

    @Test
    fun `비로그인 변경 요청은 401`() {
        patchNickname(null, "익명변경시도")
            .andExpect(status().isUnauthorized)
    }
}
