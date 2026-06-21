package com.writenote.controller

import com.writenote.entity.Announcement
import com.writenote.repository.AnnouncementRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AnnouncementControllerIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var announcementRepository: AnnouncementRepository

    @BeforeEach
    fun clean() {
        announcementRepository.deleteAll()
    }

    @Test
    fun `공개 목록은 공개 공지만 노출한다`() {
        val published =
            announcementRepository.saveAndFlush(
                Announcement(title = "공개 공지", body = "본문", isPublished = true, publishedAt = Instant.now()),
            )
        announcementRepository.saveAndFlush(
            Announcement(title = "숨김 공지", body = "본문", isPublished = false),
        )

        mockMvc
            .perform(get("/api/announcements"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalElements").value(1))
            .andExpect(jsonPath("$.data.content[0].id").value(published.id!!))
            .andExpect(jsonPath("$.data.content[0].title").value("공개 공지"))
    }

    @Test
    fun `공개 공지 상세는 본문을 포함한다`() {
        val published =
            announcementRepository.saveAndFlush(
                Announcement(title = "공개 공지", body = "상세 본문", isPublished = true, publishedAt = Instant.now()),
            )

        mockMvc
            .perform(get("/api/announcements/{id}", published.id))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.body").value("상세 본문"))
    }

    @Test
    fun `비공개 공지 상세는 404`() {
        val hidden =
            announcementRepository.saveAndFlush(
                Announcement(title = "숨김", body = "본문", isPublished = false),
            )

        mockMvc
            .perform(get("/api/announcements/{id}", hidden.id))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `없는 공지 상세는 404`() {
        mockMvc
            .perform(get("/api/announcements/{id}", 999_999L))
            .andExpect(status().isNotFound)
    }
}
