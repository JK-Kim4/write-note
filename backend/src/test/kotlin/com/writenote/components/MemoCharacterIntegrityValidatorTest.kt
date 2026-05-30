package com.writenote.components

import com.writenote.error.ValidationException
import com.writenote.model.request.CurateMemoRequest
import com.writenote.model.request.ProjectConnectionDto
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

@DisplayName("MemoCharacterIntegrityValidator 단위 테스트")
class MemoCharacterIntegrityValidatorTest {
    private val validator = MemoCharacterIntegrityValidator()

    @Test
    @DisplayName("인물이 해당 프로젝트 소속이면 예외 없음")
    fun `validate passes when characters belong to correct project`() {
        // projectId=1 → characterIds=[10, 11]
        // characterProjectMap: 10→1, 11→1
        val request =
            CurateMemoRequest(
                projectConnections =
                    listOf(
                        ProjectConnectionDto(projectId = 1L, characterIds = listOf(10L, 11L)),
                    ),
                tags = emptyList(),
                reasonNote = null,
            )
        val characterProjectMap = mapOf(10L to 1L, 11L to 1L)

        assertThatCode { validator.validate(request, characterProjectMap) }.doesNotThrowAnyException()
    }

    @Test
    @DisplayName("인물이 다른 프로젝트 소속이면 VALIDATION_FAILED 예외")
    fun `validate throws when character belongs to wrong project`() {
        // projectId=1 에 characterId=99 가 포함 — 99는 projectId=2 소속
        val request =
            CurateMemoRequest(
                projectConnections =
                    listOf(
                        ProjectConnectionDto(projectId = 1L, characterIds = listOf(10L, 99L)),
                    ),
                tags = emptyList(),
                reasonNote = null,
            )
        val characterProjectMap = mapOf(10L to 1L, 99L to 2L)

        assertThatThrownBy { validator.validate(request, characterProjectMap) }
            .isInstanceOf(ValidationException::class.java)
            .hasMessageContaining("VALIDATION_FAILED")
    }

    @Test
    @DisplayName("존재하지 않는 characterId 가 포함되면 VALIDATION_FAILED 예외")
    fun `validate throws when characterId does not exist`() {
        val request =
            CurateMemoRequest(
                projectConnections =
                    listOf(
                        ProjectConnectionDto(projectId = 1L, characterIds = listOf(10L, 999L)),
                    ),
                tags = emptyList(),
                reasonNote = null,
            )
        // 999 는 characterProjectMap 에 없음 → 소속 불명
        val characterProjectMap = mapOf(10L to 1L)

        assertThatThrownBy { validator.validate(request, characterProjectMap) }
            .isInstanceOf(ValidationException::class.java)
    }

    @Test
    @DisplayName("projectConnections 빈 배열 — 미분류, 검증 통과")
    fun `validate passes for empty projectConnections`() {
        val request =
            CurateMemoRequest(
                projectConnections = emptyList(),
                tags = emptyList(),
                reasonNote = null,
            )
        assertThatCode { validator.validate(request, emptyMap()) }.doesNotThrowAnyException()
    }

    @Test
    @DisplayName("characterIds 빈 배열 — 프로젝트 연결만, 검증 통과")
    fun `validate passes when characterIds is empty`() {
        val request =
            CurateMemoRequest(
                projectConnections =
                    listOf(
                        ProjectConnectionDto(projectId = 1L, characterIds = emptyList()),
                    ),
                tags = emptyList(),
                reasonNote = null,
            )
        assertThatCode { validator.validate(request, emptyMap()) }.doesNotThrowAnyException()
    }

    @Test
    @DisplayName("다중 프로젝트 연결 — 모두 소속 일치하면 통과")
    fun `validate passes for multiple projects with correct characters`() {
        val request =
            CurateMemoRequest(
                projectConnections =
                    listOf(
                        ProjectConnectionDto(projectId = 1L, characterIds = listOf(10L, 11L)),
                        ProjectConnectionDto(projectId = 2L, characterIds = listOf(20L)),
                    ),
                tags = listOf("draft"),
                reasonNote = "양쪽 등장",
            )
        val characterProjectMap = mapOf(10L to 1L, 11L to 1L, 20L to 2L)

        assertThatCode { validator.validate(request, characterProjectMap) }.doesNotThrowAnyException()
    }

    @Test
    @DisplayName("다중 프로젝트 연결 — 어느 하나라도 불일치면 예외")
    fun `validate throws when one of multiple projects has wrong character`() {
        val request =
            CurateMemoRequest(
                projectConnections =
                    listOf(
                        ProjectConnectionDto(projectId = 1L, characterIds = listOf(10L)),
                        ProjectConnectionDto(projectId = 2L, characterIds = listOf(10L)),
                    ),
                tags = emptyList(),
                reasonNote = null,
            )
        // characterId=10 은 projectId=1 소속. projectId=2 에 넣으면 불일치
        val characterProjectMap = mapOf(10L to 1L)

        assertThatThrownBy { validator.validate(request, characterProjectMap) }
            .isInstanceOf(ValidationException::class.java)
    }
}
