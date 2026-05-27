package com.writenote.components.characters

import com.writenote.entity.Character
import com.writenote.error.ValidationException
import com.writenote.model.request.ReorderCharactersRequest
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Instant

class CharacterReorderValidatorTest {
    private lateinit var validator: CharacterReorderValidator

    @BeforeEach
    fun setUp() {
        validator = CharacterReorderValidator()
    }

    private fun character(id: Long): Character =
        Character(
            id = id,
            projectId = 10L,
            name = "char-$id",
            displayOrder = 0,
            createdAt = Instant.now(),
            updatedAt = Instant.now(),
        )

    @Test
    @DisplayName("happy — 전체 인물 ID permutation 통과 (FR-016)")
    fun `validates full permutation`() {
        val existing = listOf(character(101L), character(102L), character(103L))
        val request = ReorderCharactersRequest(characterIds = listOf(102L, 101L, 103L))

        assertThatCode { validator.validate(request, existing) }.doesNotThrowAnyException()
    }

    @Test
    @DisplayName("빈 배열 + 인물 0명 = no-op 통과 (Edge case — contracts #24)")
    fun `empty request with no characters is no-op`() {
        assertThatCode {
            validator.validate(ReorderCharactersRequest(characterIds = emptyList()), emptyList())
        }.doesNotThrowAnyException()
    }

    @Test
    @DisplayName("누락 — 전체 N명 중 일부만 전송 시 400 VALIDATION_FAILED")
    fun `rejects missing character ids`() {
        val existing = listOf(character(101L), character(102L), character(103L))
        val request = ReorderCharactersRequest(characterIds = listOf(101L, 102L))

        assertThatThrownBy { validator.validate(request, existing) }
            .isInstanceOf(ValidationException::class.java)
    }

    @Test
    @DisplayName("중복 — 같은 ID 두 번 전송 시 400")
    fun `rejects duplicate ids`() {
        val existing = listOf(character(101L), character(102L))
        val request = ReorderCharactersRequest(characterIds = listOf(101L, 101L))

        assertThatThrownBy { validator.validate(request, existing) }
            .isInstanceOf(ValidationException::class.java)
    }

    @Test
    @DisplayName("외부 ID — 다른 projectId 의 인물 ID 포함 시 400")
    fun `rejects foreign character id`() {
        val existing = listOf(character(101L), character(102L))
        val request = ReorderCharactersRequest(characterIds = listOf(101L, 999L))

        assertThatThrownBy { validator.validate(request, existing) }
            .isInstanceOf(ValidationException::class.java)
    }
}
