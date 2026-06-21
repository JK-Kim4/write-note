package com.writenote.controller.admin

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.Announcement
import com.writenote.entity.User
import com.writenote.repository.AnnouncementRepository
import com.writenote.repository.UserRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminAnnouncementControllerIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var announcementRepository: AnnouncementRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    @BeforeEach
    fun clean() {
        announcementRepository.deleteAll()
    }

    @Test
    fun `관리자는 공지를 작성한다`() {
        mockMvc
            .perform(
                post("/api/admin/announcements")
                    .header("Authorization", adminBearer())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"새 공지","body":"본문","isPublished":false,"isPinned":false}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.data.id").isNumber)
            .andExpect(jsonPath("$.data.isPublished").value(false))
    }

    @Test
    fun `제목이 비면 400`() {
        mockMvc
            .perform(
                post("/api/admin/announcements")
                    .header("Authorization", adminBearer())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"","body":"본문"}"""),
            ).andExpect(status().isBadRequest)
    }

    @Test
    fun `발행 전환 시 publishedAt 이 설정된다`() {
        val draft =
            announcementRepository.saveAndFlush(
                Announcement(title = "초안", body = "본문", isPublished = false),
            )

        mockMvc
            .perform(
                put("/api/admin/announcements/{id}", draft.id)
                    .header("Authorization", adminBearer())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"초안","body":"본문","isPublished":true,"isPinned":false}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.isPublished").value(true))
            .andExpect(jsonPath("$.data.publishedAt").isNotEmpty)
    }

    @Test
    fun `관리자는 공지를 삭제한다`() {
        val target =
            announcementRepository.saveAndFlush(
                Announcement(title = "삭제 대상", body = "본문", isPublished = false),
            )

        mockMvc
            .perform(delete("/api/admin/announcements/{id}", target.id).header("Authorization", adminBearer()))
            .andExpect(status().isNoContent)

        mockMvc
            .perform(get("/api/admin/announcements").header("Authorization", adminBearer()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalElements").value(0))
    }

    @Test
    fun `비관리자는 공지 작성이 403`() {
        val nonAdmin =
            userRepository.saveAndFlush(
                User(email = "user-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture"),
            )
        mockMvc
            .perform(
                post("/api/admin/announcements")
                    .header("Authorization", "Bearer ${jwtTokenProvider.createAccessToken(nonAdmin.id!!, nonAdmin.email)}")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"x","body":"y"}"""),
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
