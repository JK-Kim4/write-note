package com.writenote.model.request

import jakarta.validation.constraints.NotBlank

/**
 * 카카오 가입 사용자가 이메일·비밀번호 추가 등록 요청 (FR-024).
 *
 * 이메일은 카카오에서 받은 본인 이메일 그대로 사용 (Request 에서 받지 않음).
 * 비밀번호만 입력 — PasswordPolicyValidator 가 정책 검증.
 */
data class LinkEmailRequest(
    @field:NotBlank
    val password: String,
)
