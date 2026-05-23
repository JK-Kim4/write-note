package com.writenote.components

import com.writenote.enums.AuthErrorCode
import com.writenote.error.AuthException
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class PasswordPolicyValidatorTest {
    private val validator = PasswordPolicyValidator()

    @Test
    fun `강한 비밀번호 통과`() {
        // 12자 + 영문 + 숫자 + 특수문자 모두 충족
        assertThatCode { validator.validate("MyP@ssw0rd12!") }
            .doesNotThrowAnyException()
    }

    @Test
    fun `12자 미만 거부`() {
        // 11자 (영문+숫자+특수문자 포함이지만 길이 부족)
        assertThatThrownBy { validator.validate("Short1!Pass") }
            .isInstanceOf(AuthException::class.java)
            .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.PASSWORD_TOO_WEAK)
    }

    @Test
    fun `영문 누락 거부`() {
        // 12자 + 숫자 + 특수문자, 영문 없음
        assertThatThrownBy { validator.validate("12345678901!") }
            .isInstanceOf(AuthException::class.java)
            .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.PASSWORD_TOO_WEAK)
    }

    @Test
    fun `숫자 누락 거부`() {
        // 12자 + 영문 + 특수문자, 숫자 없음
        assertThatThrownBy { validator.validate("abcdefghijk!") }
            .isInstanceOf(AuthException::class.java)
            .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.PASSWORD_TOO_WEAK)
    }

    @Test
    fun `특수문자 누락 거부`() {
        // 12자 + 영문 + 숫자, 특수문자 없음
        assertThatThrownBy { validator.validate("abcdefghij12") }
            .isInstanceOf(AuthException::class.java)
            .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.PASSWORD_TOO_WEAK)
    }
}
