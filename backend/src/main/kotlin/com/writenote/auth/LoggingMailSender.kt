package com.writenote.auth

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component

/**
 * 개발/테스트 환경용 메일 발송 구현 — 콘솔 로그로 출력.
 *
 * `app.mail.mode = log` 프로파일에서만 활성화. prod 환경에서는 SMTP 어댑터로 교체.
 *
 * 출처: research.md R-2.
 */
@Component
@ConditionalOnProperty(prefix = "app.mail", name = ["mode"], havingValue = "log", matchIfMissing = false)
class LoggingMailSender(
    @Value("\${app.mail.base-url}") private val baseUrl: String,
) : MailSenderPort {
    private val logger = LoggerFactory.getLogger(LoggingMailSender::class.java)

    override fun sendEmailVerification(
        toEmail: String,
        token: String,
    ) {
        logger.info(
            "[MAIL] Email verify link for {}: {}/api/auth/verify-email?token={}",
            toEmail,
            baseUrl,
            token,
        )
    }

    override fun sendPasswordReset(
        toEmail: String,
        token: String,
    ) {
        logger.info(
            "[MAIL] Password reset link for {}: {}/api/auth/password-reset/confirm?token={}",
            toEmail,
            baseUrl,
            token,
        )
    }
}
