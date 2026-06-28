package com.writenote.model.request

import jakarta.validation.Validation
import jakarta.validation.Validator
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

/**
 * 댓글 content 상한(M1) 검증 — 순수 bean validation(@Size max=2000 + @NotBlank).
 * @Valid 가 컨트롤러에서 발동하면 위반은 400 VALIDATION_FAILED 로 매핑된다(GlobalExceptionHandler).
 */
@DisplayName("CreateCommentRequest 검증 — content 상한(M1)")
class CreateCommentRequestValidationTest {
    private val validator: Validator = Validation.buildDefaultValidatorFactory().validator

    private fun req(content: String) = CreateCommentRequest(anchorBlockIndex = 0, anchorStart = 0, anchorLength = 0, content = content)

    @Test
    fun `content 2000자는 통과한다`() {
        assertThat(validator.validate(req("가".repeat(2000)))).isEmpty()
    }

    @Test
    fun `content 2001자는 Size 위반이다`() {
        val violations = validator.validate(req("가".repeat(2001)))
        assertThat(violations).isNotEmpty()
        assertThat(violations).anyMatch { it.propertyPath.toString() == "content" }
    }

    @Test
    fun `빈 content 는 NotBlank 위반이다`() {
        assertThat(validator.validate(req(""))).isNotEmpty()
    }
}
