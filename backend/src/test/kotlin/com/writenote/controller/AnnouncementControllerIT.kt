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

    // --- 홈 두 슬롯 (GET /api/announcements/home) ---

    private fun save(
        title: String,
        published: Boolean,
        pinned: Boolean,
        publishedAt: Instant?,
    ) = announcementRepository.saveAndFlush(
        Announcement(title = title, body = "본문", isPublished = published, isPinned = pinned, publishedAt = publishedAt),
    )

    @Test
    fun `홈은 고정과 최신을 두 슬롯으로 내려준다`() {
        val now = Instant.now()
        val pinned = save("고정공지", published = true, pinned = true, publishedAt = now.minusSeconds(100))
        val latest = save("최신공지", published = true, pinned = false, publishedAt = now)

        mockMvc
            .perform(get("/api/announcements/home"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.pinned.id").value(pinned.id!!))
            .andExpect(jsonPath("$.data.pinned.title").value("고정공지"))
            .andExpect(jsonPath("$.data.latest.id").value(latest.id!!))
            .andExpect(jsonPath("$.data.latest.title").value("최신공지"))
    }

    @Test
    fun `고정이 여러 건이면 공개일 최신 고정 1건만 고정 슬롯에 노출한다`() {
        val now = Instant.now()
        save("고정옛", published = true, pinned = true, publishedAt = now.minusSeconds(200))
        val newestPin = save("고정최신", published = true, pinned = true, publishedAt = now.minusSeconds(50))
        val plain = save("일반", published = true, pinned = false, publishedAt = now.minusSeconds(100))

        mockMvc
            .perform(get("/api/announcements/home"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.pinned.id").value(newestPin.id!!))
            .andExpect(jsonPath("$.data.latest.id").value(plain.id!!))
    }

    @Test
    fun `고정이 곧 공개일 최신이면 최신 슬롯은 그다음 공지다 (중복 제외)`() {
        val now = Instant.now()
        val pinnedNewest = save("고정이자최신", published = true, pinned = true, publishedAt = now)
        val second = save("둘째", published = true, pinned = false, publishedAt = now.minusSeconds(100))

        mockMvc
            .perform(get("/api/announcements/home"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.pinned.id").value(pinnedNewest.id!!))
            .andExpect(jsonPath("$.data.latest.id").value(second.id!!))
    }

    @Test
    fun `공개 공지가 고정 1건뿐이면 최신 슬롯은 null 이다`() {
        val only = save("유일고정", published = true, pinned = true, publishedAt = Instant.now())

        mockMvc
            .perform(get("/api/announcements/home"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.pinned.id").value(only.id!!))
            .andExpect(jsonPath("$.data.latest.id").doesNotExist())
    }

    @Test
    fun `고정이 없으면 고정 슬롯은 null 이고 최신만 노출한다`() {
        val now = Instant.now()
        val latest = save("최신", published = true, pinned = false, publishedAt = now)
        save("이전", published = true, pinned = false, publishedAt = now.minusSeconds(100))

        mockMvc
            .perform(get("/api/announcements/home"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.pinned.id").doesNotExist())
            .andExpect(jsonPath("$.data.latest.id").value(latest.id!!))
    }

    @Test
    fun `공개 공지가 없으면 두 슬롯 모두 null 이고 200 이다 (비인증)`() {
        save("숨김", published = false, pinned = false, publishedAt = null)

        mockMvc
            .perform(get("/api/announcements/home"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.pinned.id").doesNotExist())
            .andExpect(jsonPath("$.data.latest.id").doesNotExist())
    }

    @Test
    fun `미공개 고정 공지는 고정 슬롯에 노출되지 않는다`() {
        save("숨김고정", published = false, pinned = true, publishedAt = null)
        val visible = save("공개비고정", published = true, pinned = false, publishedAt = Instant.now())

        mockMvc
            .perform(get("/api/announcements/home"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.pinned.id").doesNotExist())
            .andExpect(jsonPath("$.data.latest.id").value(visible.id!!))
    }
}
