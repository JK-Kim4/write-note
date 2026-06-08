package com.writenote.auth

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component

/**
 * 개발/직접점검 환경용 메일 발송 구현 — 콘솔 로그로 인증/재설정 링크 출력.
 *
 * `app.mail.mode = log` 프로파일에서만 활성화. prod 환경에서는 SMTP 어댑터로 교체.
 *
 * 링크는 frontend 라우트(`{frontend}/auth/verify`, `/auth/reset-new`)를 가리킨다 —
 * 사용자가 클릭하면 frontend 가 token 을 읽어 verifyEmail / confirmPasswordReset API 를 호출 (005 US5).
 *
 * 출처: research.md R-2 + 005 US5 메일 링크 frontend 라우트 정합.
 */
@Component
@ConditionalOnProperty(prefix = "app.mail", name = ["mode"], havingValue = "log", matchIfMissing = false)
class LoggingMailSender(
    @Value("\${app.frontend.base-url}") private val frontendBaseUrl: String,
) : MailSenderPort {
    private val logger = LoggerFactory.getLogger(LoggingMailSender::class.java)

    override fun sendEmailVerification(
        toEmail: String,
        token: String,
    ) {
        logger.info(
            "[MAIL] Email verify link for {}: {}/auth/verify?token={}",
            toEmail,
            frontendBaseUrl,
            token,
        )
    }

    override fun sendPasswordReset(
        toEmail: String,
        token: String,
    ) {
        logger.info(
            "[MAIL] Password reset link for {}: {}/auth/reset-new?token={}",
            toEmail,
            frontendBaseUrl,
            token,
        )
    }
}
