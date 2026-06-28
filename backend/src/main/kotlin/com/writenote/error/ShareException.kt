package com.writenote.error

/**
 * 공유하기(046) 도메인 예외 — [GlobalExceptionHandler] 가 [ShareErrorCode.httpStatus] + Result.failure 로 변환.
 */
open class ShareException(
    val errorCode: ShareErrorCode,
    override val message: String = errorCode.defaultMessage,
) : RuntimeException(message)
