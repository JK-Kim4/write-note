package com.writenote.error

/**
 * 본문 봉투 복호 실패 — fail-closed 표현용 예외.
 *
 * 복호 실패(키 부재/불일치·GCM 태그 불일치·알 수 없는 봉투 형태) 시 throw.
 * 평문이나 빈 값을 반환하지 않는다(fail-closed 원칙).
 * [GlobalExceptionHandler]가 500 DOCUMENT_DECRYPTION_FAILED로 매핑 (US2 완료 후).
 */
class BodyDecryptionException(
    message: String,
    cause: Throwable? = null,
) : RuntimeException(message, cause)
