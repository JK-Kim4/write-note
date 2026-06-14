package com.writenote.components.documents

import com.writenote.entity.Document
import com.writenote.error.ValidationException
import com.writenote.model.request.ReorderDocumentsRequest
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Instant

class ChapterReorderValidatorTest {
    private lateinit var validator: ChapterReorderValidator

    @BeforeEach
    fun setUp() {
        validator = ChapterReorderValidator()
    }

    private fun chapter(id: Long): Document =
        Document(
            id = id,
            projectId = 10L,
            title = "chapter-$id",
            sortOrder = 0,
        ).also { it.createdAt = Instant.now() }

    @Test
    @DisplayName("happy — 전체 챕터 ID permutation 통과 (C3)")
    fun `validates full permutation`() {
        val existing = listOf(chapter(101L), chapter(102L), chapter(103L))
        val request = ReorderDocumentsRequest(documentIds = listOf(102L, 101L, 103L))

        assertThatCode { validator.validate(request, existing) }.doesNotThrowAnyException()
    }

    @Test
    @DisplayName("빈 배열 + 챕터 0개 = no-op 통과")
    fun `empty request with no chapters is no-op`() {
        assertThatCode {
            validator.validate(ReorderDocumentsRequest(documentIds = emptyList()), emptyList())
        }.doesNotThrowAnyException()
    }

    @Test
    @DisplayName("누락 — 전체 N개 중 일부만 전송 시 400 VALIDATION_FAILED")
    fun `rejects missing document ids`() {
        val existing = listOf(chapter(101L), chapter(102L), chapter(103L))
        val request = ReorderDocumentsRequest(documentIds = listOf(101L, 102L))

        assertThatThrownBy { validator.validate(request, existing) }
            .isInstanceOf(ValidationException::class.java)
    }

    @Test
    @DisplayName("중복 — 같은 ID 두 번 전송 시 400")
    fun `rejects duplicate ids`() {
        val existing = listOf(chapter(101L), chapter(102L))
        val request = ReorderDocumentsRequest(documentIds = listOf(101L, 101L))

        assertThatThrownBy { validator.validate(request, existing) }
            .isInstanceOf(ValidationException::class.java)
    }

    @Test
    @DisplayName("외부 ID — 다른 projectId 의 챕터 ID 포함 시 400")
    fun `rejects foreign document id`() {
        val existing = listOf(chapter(101L), chapter(102L))
        val request = ReorderDocumentsRequest(documentIds = listOf(101L, 999L))

        assertThatThrownBy { validator.validate(request, existing) }
            .isInstanceOf(ValidationException::class.java)
    }
}
