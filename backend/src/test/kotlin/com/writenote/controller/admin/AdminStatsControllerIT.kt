package com.writenote.controller.admin

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.repository.UserRepository
import org.hamcrest.Matchers.greaterThanOrEqualTo
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminStatsControllerIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    @Test
    fun `요약 카운트를 반환한다`() {
        userRepository.saveAndFlush(User(email = "stats-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture"))

        mockMvc
            .perform(get("/api/admin/stats/summary").header("Authorization", adminBearer()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalUsers").value(greaterThanOrEqualTo(1)))
            .andExpect(jsonPath("$.data.newUsersToday").value(greaterThanOrEqualTo(1)))
            .andExpect(jsonPath("$.data.newUsersThisWeek").value(greaterThanOrEqualTo(1)))
            .andExpect(jsonPath("$.data.activeUsers").isNumber)
            .andExpect(jsonPath("$.data.totalProjects").isNumber)
    }

    @Test
    fun `가입 추이는 빈 날 0 으로 days 개를 반환한다`() {
        mockMvc
            .perform(get("/api/admin/stats/signups").param("days", "7").header("Authorization", adminBearer()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.points.length()").value(7))
            .andExpect(jsonPath("$.data.points[0].date").isString)
            .andExpect(jsonPath("$.data.points[0].count").isNumber)
    }

    @Test
    fun `비관리자는 통계가 403`() {
        val nonAdmin = userRepository.saveAndFlush(User(email = "user-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture"))
        mockMvc
            .perform(
                get("/api/admin/stats/summary")
                    .header("Authorization", "Bearer ${jwtTokenProvider.createAccessToken(nonAdmin.id!!, nonAdmin.email)}"),
            ).andExpect(status().isForbidden)
    }

    private fun adminBearer(): String {
        val admin =
            userRepository.findByEmail(ADMIN_EMAIL)
                ?: userRepository.saveAndFlush(User(email = ADMIN_EMAIL, passwordHash = "test-fixture"))
        return "Bearer ${jwtTokenProvider.createAccessToken(admin.id!!, admin.email)}"
    }

    private companion object {
        const val ADMIN_EMAIL = "admin@writenote.test"
    }
}
