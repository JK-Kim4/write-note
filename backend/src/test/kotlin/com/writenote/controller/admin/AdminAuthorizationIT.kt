package com.writenote.controller.admin

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.repository.UserRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminAuthorizationIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    @Test
    fun `비인증 어드민 요청은 401`() {
        mockMvc
            .perform(get("/api/admin/announcements"))
            .andExpect(status().isUnauthorized)
    }

    @Test
    fun `비관리자 JWT 어드민 요청은 403`() {
        val nonAdmin =
            userRepository.saveAndFlush(
                User(email = "user-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture"),
            )
        mockMvc
            .perform(get("/api/admin/announcements").header("Authorization", bearerFor(nonAdmin)))
            .andExpect(status().isForbidden)
    }

    @Test
    fun `관리자 JWT 어드민 요청은 200`() {
        val admin = findOrCreateAdmin()
        mockMvc
            .perform(get("/api/admin/announcements").header("Authorization", bearerFor(admin)))
            .andExpect(status().isOk)
    }

    private fun findOrCreateAdmin(): User =
        userRepository.findByEmail(ADMIN_EMAIL)
            ?: userRepository.saveAndFlush(User(email = ADMIN_EMAIL, passwordHash = "test-fixture"))

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"

    private companion object {
        // application-test.yml app.admin.email 과 일치해야 함
        const val ADMIN_EMAIL = "admin@writenote.test"
    }
}
