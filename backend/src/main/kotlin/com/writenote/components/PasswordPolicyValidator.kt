package com.writenote.components

import com.writenote.enums.AuthErrorCode
import com.writenote.error.AuthException
import org.springframework.stereotype.Component

/**
 * 비밀번호 정책 검증 컴포넌트.
 *
 * 최소 8자 + 영문 + 숫자 강제 (특수문자 불요, SoT §4-3 — 2026-06-13 완화).
 * 회원가입 / 비밀번호 재설정 / 비밀번호 추가 등록 3 영역에서 재사용.
 */
@Component
class PasswordPolicyValidator {
    /**
     * 비밀번호 정책 위반 시 [AuthException] (`PASSWORD_TOO_WEAK`) throw.
     *
     * @param password 검증할 평문 비밀번호
     */
    fun validate(password: String) {
        val violations = mutableListOf<String>()
        if (password.length < MIN_LENGTH) violations += "8자 이상"
        if (!password.any { it.isLetter() }) violations += "영문 포함"
        if (!password.any { it.isDigit() }) violations += "숫자 포함"
        if (violations.isNotEmpty()) {
            throw AuthException(
                errorCode = AuthErrorCode.PASSWORD_TOO_WEAK,
                message = "비밀번호 정책 위반: ${violations.joinToString(", ")}",
            )
        }
    }

    companion object {
        private const val MIN_LENGTH = 8
    }
}
