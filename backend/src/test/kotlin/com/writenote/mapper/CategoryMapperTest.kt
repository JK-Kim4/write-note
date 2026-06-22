package com.writenote.mapper

import com.writenote.entity.Category
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Instant

class CategoryMapperTest {
    private val mapper = CategoryMapper()

    @Test
    @DisplayName("toResponse — 엔티티 필드 + projectCount 매핑")
    fun `toResponse maps fields and projectCount`() {
        val now = Instant.parse("2026-06-22T00:00:00Z")
        val category =
            Category(id = 3L, userId = 1L, name = "장편 판타지", parentId = null, sortOrder = 2, createdAt = now, updatedAt = now)

        val response = mapper.toResponse(category, projectCount = 5, totalWordCount = 8000)

        assertThat(response.id).isEqualTo(3L)
        assertThat(response.name).isEqualTo("장편 판타지")
        assertThat(response.parentId).isNull()
        assertThat(response.sortOrder).isEqualTo(2)
        assertThat(response.projectCount).isEqualTo(5)
        assertThat(response.paperSize).isNull()
        assertThat(response.layoutMode).isNull()
        assertThat(response.targetLength).isNull()
        assertThat(response.totalWordCount).isEqualTo(8000)
        assertThat(response.createdAt).isEqualTo(now)
        assertThat(response.updatedAt).isEqualTo(now)
    }

    @Test
    @DisplayName("toResponse — 시리즈 총 목표 분량 매핑(033 R4)")
    fun `toResponse maps series targetLength and totalWordCount`() {
        val now = Instant.parse("2026-06-22T00:00:00Z")
        val category =
            Category(
                id = 3L,
                userId = 1L,
                name = "대하소설",
                targetLength = 500000,
                createdAt = now,
                updatedAt = now,
            )

        val response = mapper.toResponse(category, projectCount = 2, totalWordCount = 123400)

        assertThat(response.targetLength).isEqualTo(500000)
        assertThat(response.totalWordCount).isEqualTo(123400)
    }

    @Test
    @DisplayName("toResponse — 시리즈 판형·출판방식 매핑(033 R2)")
    fun `toResponse maps series paperSize and layoutMode`() {
        val now = Instant.parse("2026-06-22T00:00:00Z")
        val category =
            Category(
                id = 3L,
                userId = 1L,
                name = "웹소설 시리즈",
                paperSize = "kukpan",
                layoutMode = "web",
                createdAt = now,
                updatedAt = now,
            )

        val response = mapper.toResponse(category, projectCount = 2)

        assertThat(response.paperSize).isEqualTo("kukpan")
        assertThat(response.layoutMode).isEqualTo("web")
    }

    @Test
    @DisplayName("toResponse — 시리즈 장르·줄거리 매핑(033 R3)")
    fun `toResponse maps series genre and synopsis`() {
        val now = Instant.parse("2026-06-22T00:00:00Z")
        val category =
            Category(
                id = 3L,
                userId = 1L,
                name = "판타지 시리즈",
                genre = "판타지",
                synopsis = "용과 마법사 이야기",
                createdAt = now,
                updatedAt = now,
            )

        val response = mapper.toResponse(category, projectCount = 2)

        assertThat(response.genre).isEqualTo("판타지")
        assertThat(response.synopsis).isEqualTo("용과 마법사 이야기")
    }
}
