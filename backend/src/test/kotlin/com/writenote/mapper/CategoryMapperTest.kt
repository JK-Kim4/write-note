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

        val response = mapper.toResponse(category, projectCount = 5)

        assertThat(response.id).isEqualTo(3L)
        assertThat(response.name).isEqualTo("장편 판타지")
        assertThat(response.parentId).isNull()
        assertThat(response.sortOrder).isEqualTo(2)
        assertThat(response.projectCount).isEqualTo(5)
        assertThat(response.createdAt).isEqualTo(now)
        assertThat(response.updatedAt).isEqualTo(now)
    }
}
