package com.writenote.mapper

import com.writenote.entity.Category
import com.writenote.entity.Project
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Instant

class ProjectMapperTest {
    private val mapper = ProjectMapper()

    private fun project(categoryId: Long? = null): Project =
        Project(
            id = 1L,
            userId = 1L,
            title = "작품",
            categoryId = categoryId,
            createdAt = Instant.now(),
            updatedAt = Instant.now(),
        )

    @Test
    @DisplayName("toResponse — 시리즈 판형/출판방식 설정 시 effective = 시리즈값")
    fun `effective uses series values when category configured`() {
        val category =
            Category(id = 5L, userId = 1L, name = "시리즈", paperSize = "sinkukpan", layoutMode = "web")

        val response = mapper.toResponse(project(categoryId = 5L), category)

        assertThat(response.effectivePaperSize).isEqualTo("sinkukpan")
        assertThat(response.effectiveLayoutMode).isEqualTo("web")
    }

    @Test
    @DisplayName("toResponse — 미분류 작품(category null) 은 시스템 기본값 A4/paper")
    fun `effective falls back to defaults when uncategorized`() {
        val response = mapper.toResponse(project(categoryId = null), null)

        assertThat(response.effectivePaperSize).isEqualTo("A4")
        assertThat(response.effectiveLayoutMode).isEqualTo("paper")
    }

    @Test
    @DisplayName("toResponse — 시리즈 판형/출판방식 미설정(null) 은 시스템 기본값 fallback")
    fun `effective falls back to defaults when series values null`() {
        val category =
            Category(id = 5L, userId = 1L, name = "시리즈", paperSize = null, layoutMode = null)

        val response = mapper.toResponse(project(categoryId = 5L), category)

        assertThat(response.effectivePaperSize).isEqualTo("A4")
        assertThat(response.effectiveLayoutMode).isEqualTo("paper")
    }

    @Test
    @DisplayName("toResponse — 판형만 설정 시 판형은 시리즈값, 출판방식은 기본값(독립 해석)")
    fun `effective resolves paperSize and layoutMode independently`() {
        val category =
            Category(id = 5L, userId = 1L, name = "시리즈", paperSize = "kukpan", layoutMode = null)

        val response = mapper.toResponse(project(categoryId = 5L), category)

        assertThat(response.effectivePaperSize).isEqualTo("kukpan")
        assertThat(response.effectiveLayoutMode).isEqualTo("paper")
    }
}
