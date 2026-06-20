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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/**
 * US2 (A3 / #37) — 설정 엔드포인트.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SettingsControllerWebTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "settings-web-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
        )

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"

    @Test
    fun `get returns empty then put persists and reflects`() {
        val user = createUser()
        val bearer = bearerFor(user)

        mockMvc
            .perform(get("/api/settings").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.settings").isMap)

        mockMvc
            .perform(
                put("/api/settings")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"settings":{"theme":"dark"}}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.settings.theme").value("dark"))
    }

    @Test
    fun `put with invalid value returns 400`() {
        val user = createUser()
        mockMvc
            .perform(
                put("/api/settings")
                    .header("Authorization", bearerFor(user))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"settings":{"theme":"neon"}}"""),
            ).andExpect(status().isBadRequest)
    }

    @Test
    fun `unauthenticated get returns 401`() {
        mockMvc
            .perform(get("/api/settings"))
            .andExpect(status().isUnauthorized)
    }
}
