package com.writenote.auth

/**
 * 메일 발송 포트 — profile 별 구현 선택.
 *
 * - local/test profile (`app.mail.mode = log`) → [LoggingMailSender]
 * - prod profile → JavaMailSender 기반 SMTP 어댑터 (별도 트랙에서 결선)
 *
 * 출처: research.md R-2, contracts/auth-endpoints.md §6.
 */
interface MailSenderPort {
    fun sendEmailVerification(
        toEmail: String,
        token: String,
    )

    fun sendPasswordReset(
        toEmail: String,
        token: String,
    )
}
