package com.writenote.controller.admin

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.Project
import com.writenote.entity.User
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
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
class AdminUserControllerIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var projectRepository: ProjectRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    @Test
    fun `이메일 검색은 일치 회원과 작품 수를 반환하고 비밀값은 미노출`() {
        val token = UUID.randomUUID().toString().substring(0, 8)
        val user = userRepository.saveAndFlush(User(email = "search-$token@example.com", passwordHash = "test-fixture"))
        projectRepository.saveAndFlush(Project(userId = user.id!!, title = "작품1"))
        projectRepository.saveAndFlush(Project(userId = user.id!!, title = "작품2"))

        mockMvc
            .perform(get("/api/admin/users").param("q", token).header("Authorization", adminBearer()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalElements").value(1))
            .andExpect(jsonPath("$.data.content[0].email").value("search-$token@example.com"))
            .andExpect(jsonPath("$.data.content[0].projectCount").value(2))
            .andExpect(jsonPath("$.data.content[0].emailVerified").value(false))
            .andExpect(jsonPath("$.data.content[0].kakaoLinked").value(false))
            .andExpect(jsonPath("$.data.content[0].passwordHash").doesNotExist())
            .andExpect(jsonPath("$.data.content[0].kakaoId").doesNotExist())
    }

    @Test
    fun `검색 결과가 없으면 빈 목록`() {
        mockMvc
            .perform(get("/api/admin/users").param("q", "no-such-${UUID.randomUUID()}").header("Authorization", adminBearer()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalElements").value(0))
            .andExpect(jsonPath("$.data.content").isEmpty)
    }

    @Test
    fun `회원 상세는 작품 수 포함 비밀값 미노출`() {
        val user = userRepository.saveAndFlush(User(email = "detail-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture"))
        projectRepository.saveAndFlush(Project(userId = user.id!!, title = "작품"))

        mockMvc
            .perform(get("/api/admin/users/{id}", user.id).header("Authorization", adminBearer()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.id").value(user.id!!))
            .andExpect(jsonPath("$.data.projectCount").value(1))
            .andExpect(jsonPath("$.data.passwordHash").doesNotExist())
    }

    @Test
    fun `없는 회원 상세는 404`() {
        mockMvc
            .perform(get("/api/admin/users/{id}", 999_999_999L).header("Authorization", adminBearer()))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `목록은 가입일 최신순 페이지네이션`() {
        mockMvc
            .perform(get("/api/admin/users").param("page", "0").param("size", "5").header("Authorization", adminBearer()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.size").value(5))
            .andExpect(jsonPath("$.data.content[0].passwordHash").doesNotExist())
    }

    @Test
    fun `비관리자는 회원 조회가 403`() {
        val nonAdmin = userRepository.saveAndFlush(User(email = "user-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture"))
        mockMvc
            .perform(
                get("/api/admin/users")
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
