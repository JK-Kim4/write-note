package com.writenote.error

/**
 * 도메인 검증 실패 — 400 VALIDATION_FAILED (GlobalExceptionHandler 정합).
 * Spring `@Valid` 영역 외 (도메인 규칙 위반, e.g., reorder 의 누락 / 중복 / 외부 ID).
 */
class ValidationException(
    message: String,
) : RuntimeException(message)
