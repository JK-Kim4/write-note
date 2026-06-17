package com.writenote.auth

import io.mockk.Runs
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.verify
import jakarta.mail.internet.MimeMessage
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.mail.javamail.JavaMailSenderImpl

class SmtpMailSenderTest {
    private val mailSender = mockk<JavaMailSender>()
    private val sut =
        SmtpMailSender(
            mailSender = mailSender,
            frontendBaseUrl = "https://app.example.com",
            from = "no-reply@narae.com",
        )

    private fun stubMimeMessage(): MimeMessage {
        val mime = JavaMailSenderImpl().createMimeMessage()
        every { mailSender.createMimeMessage() } returns mime
        every { mailSender.send(any<MimeMessage>()) } just Runs
        return mime
    }

    @Test
    fun `이메일 인증 메일을 수신자·발신자·HTML 인증 링크로 발송한다`() {
        val mime = stubMimeMessage()

        sut.sendEmailVerification("user@test.com", "tok-123")

        verify(exactly = 1) { mailSender.send(mime) }
        assertThat(mime.allRecipients.map { it.toString() }).contains("user@test.com")
        assertThat(mime.from.map { it.toString() }).contains("no-reply@narae.com")
        assertThat(mime.subject).contains("이메일 인증")
        val body = mime.content.toString()
        assertThat(body).contains("https://app.example.com/auth/verify?token=tok-123")
    }

    @Test
    fun `비밀번호 재설정 메일을 재설정 링크로 발송한다`() {
        val mime = stubMimeMessage()

        sut.sendPasswordReset("user@test.com", "reset-456")

        verify(exactly = 1) { mailSender.send(mime) }
        assertThat(mime.allRecipients.map { it.toString() }).contains("user@test.com")
        assertThat(mime.subject).contains("비밀번호 재설정")
        val body = mime.content.toString()
        assertThat(body).contains("https://app.example.com/auth/reset-new?token=reset-456")
    }
}
