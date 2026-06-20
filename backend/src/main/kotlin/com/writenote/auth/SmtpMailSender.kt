package com.writenote.auth

import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.mail.javamail.MimeMessageHelper
import org.springframework.stereotype.Component

/**
 * 운영용 메일 발송 구현 — Gmail SMTP(STARTTLS) 위에서 HTML 메일 발송.
 *
 * `app.mail.mode = smtp` 프로파일에서만 활성화 (local/test 는 [LoggingMailSender]).
 * 링크는 frontend 라우트(`{frontend}/auth/verify`, `/auth/reset-new`)를 가리킨다 —
 * [LoggingMailSender] 와 동일 경로 (005 US5 메일 링크 frontend 라우트 정합).
 */
@Component
@ConditionalOnProperty(prefix = "app.mail", name = ["mode"], havingValue = "smtp", matchIfMissing = false)
class SmtpMailSender(
    private val mailSender: JavaMailSender,
    @Value("\${app.frontend.base-url}") private val frontendBaseUrl: String,
    @Value("\${app.mail.from}") private val from: String,
) : MailSenderPort {
    override fun sendEmailVerification(
        toEmail: String,
        token: String,
    ) {
        val link = "$frontendBaseUrl/auth/verify?token=$token"
        send(toEmail, "[소설비] 이메일 인증", verificationHtml(link))
    }

    override fun sendPasswordReset(
        toEmail: String,
        token: String,
    ) {
        val link = "$frontendBaseUrl/auth/reset-new?token=$token"
        send(toEmail, "[소설비] 비밀번호 재설정", passwordResetHtml(link))
    }

    private fun send(
        to: String,
        subject: String,
        html: String,
    ) {
        val mime = mailSender.createMimeMessage()
        val helper = MimeMessageHelper(mime, false, "UTF-8")
        helper.setFrom(from)
        helper.setTo(to)
        helper.setSubject(subject)
        helper.setText(html, true)
        mailSender.send(mime)
    }

    private fun verificationHtml(link: String): String =
        """
        <div style="font-family: sans-serif; line-height: 1.6;">
          <h2>소설비 이메일 인증</h2>
          <p>아래 버튼을 눌러 이메일 인증을 완료해 주세요.</p>
          <p><a href="$link" style="display:inline-block;padding:10px 18px;background:#3b4cca;color:#fff;text-decoration:none;border-radius:6px;">이메일 인증하기</a></p>
          <p style="color:#888;font-size:13px;">버튼이 열리지 않으면 다음 주소를 복사해 주세요:<br>$link</p>
        </div>
        """.trimIndent()

    private fun passwordResetHtml(link: String): String =
        """
        <div style="font-family: sans-serif; line-height: 1.6;">
          <h2>소설비 비밀번호 재설정</h2>
          <p>아래 버튼을 눌러 새 비밀번호를 설정해 주세요. 본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
          <p><a href="$link" style="display:inline-block;padding:10px 18px;background:#3b4cca;color:#fff;text-decoration:none;border-radius:6px;">비밀번호 재설정</a></p>
          <p style="color:#888;font-size:13px;">버튼이 열리지 않으면 다음 주소를 복사해 주세요:<br>$link</p>
        </div>
        """.trimIndent()
}
