package com.writenote.model.response

/**
 * 카카오 가입 사용자가 이메일·비밀번호 추가 등록 응답 (FR-024, contracts/auth-endpoints.md §12).
 */
data class LinkEmailResponse(
    val userId: Long,
    val email: String,
    val passwordSet: Boolean,
)
