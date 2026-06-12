package com.writenote.components

import com.writenote.enums.AuthErrorCode
import com.writenote.error.AuthException
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class PasswordPolicyValidatorTest {
    private val validator = PasswordPolicyValidator()

    @Test
    fun `8자 영문숫자 통과`() {
        // 8자 + 영문 + 숫자 (특수문자 없어도 충족)
        assertThatCode { validator.validate("abcd1234") }
            .doesNotThrowAnyException()
    }

    @Test
    fun `특수문자 없어도 통과`() {
        // 특수문자 요건 폐지 — 영문+숫자 8자 이상이면 통과
        assertThatCode { validator.validate("passcode99") }
            .doesNotThrowAnyException()
    }

    @Test
    fun `특수문자 포함 강한 비밀번호도 통과`() {
        assertThatCode { validator.validate("MyP@ssw0rd12!") }
            .doesNotThrowAnyException()
    }

    @Test
    fun `8자 미만 거부`() {
        // 7자 (영문+숫자 포함이지만 길이 부족)
        assertThatThrownBy { validator.validate("abc1234") }
            .isInstanceOf(AuthException::class.java)
            .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.PASSWORD_TOO_WEAK)
    }

    @Test
    fun `영문 누락 거부`() {
        // 8자 + 숫자만, 영문 없음
        assertThatThrownBy { validator.validate("12345678") }
            .isInstanceOf(AuthException::class.java)
            .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.PASSWORD_TOO_WEAK)
    }

    @Test
    fun `숫자 누락 거부`() {
        // 8자 + 영문만, 숫자 없음
        assertThatThrownBy { validator.validate("abcdefgh") }
            .isInstanceOf(AuthException::class.java)
            .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.PASSWORD_TOO_WEAK)
    }
}
