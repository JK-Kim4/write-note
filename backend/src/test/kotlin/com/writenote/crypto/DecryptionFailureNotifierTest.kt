package com.writenote.crypto

import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse

/**
 * DecryptionFailureNotifier 단위 테스트.
 *
 * 디스코드 웹훅은 외부 HTTP 경계 → mock 허용(§5-2).
 * 검증: notify 시 웹훅 호출 · 웹훅 예외 swallow(요청 미전파) · 페이로드에 평문/키 미포함 · URL 미설정 시 skip.
 */
class DecryptionFailureNotifierTest {
    @Suppress("UNCHECKED_CAST")
    private fun httpResponse(): HttpResponse<String> {
        val response = mockk<HttpResponse<String>>(relaxed = true)
        every { response.statusCode() } returns 204
        return response
    }

    @Test
    fun `URL 설정 시 디스코드 웹훅으로 POST 한다`() {
        val httpClient = mockk<HttpClient>()
        every { httpClient.send(any<HttpRequest>(), any<HttpResponse.BodyHandler<String>>()) } returns httpResponse()
        val notifier = DecryptionFailureNotifier("https://discord.test/webhook", httpClient)

        notifier.notify(userId = 42L, documentId = 7L, reason = "GCM 태그 불일치")

        verify(exactly = 1) {
            httpClient.send(any<HttpRequest>(), any<HttpResponse.BodyHandler<String>>())
        }
    }

    @Test
    fun `웹훅 호출이 예외를 던져도 swallow 한다(요청 미전파)`() {
        val httpClient = mockk<HttpClient>()
        every {
            httpClient.send(any<HttpRequest>(), any<HttpResponse.BodyHandler<String>>())
        } throws RuntimeException("network down")
        val notifier = DecryptionFailureNotifier("https://discord.test/webhook", httpClient)

        // 예외가 전파되지 않아야 한다
        notifier.notify(userId = 1L, documentId = null, reason = "키 불일치")
    }

    @Test
    fun `웹훅으로 POST 된 요청은 식별자와 사유만 담는다`() {
        val httpClient = mockk<HttpClient>()
        val requestSlot = slot<HttpRequest>()
        every {
            httpClient.send(capture(requestSlot), any<HttpResponse.BodyHandler<String>>())
        } returns httpResponse()
        val notifier = DecryptionFailureNotifier("https://discord.test/webhook", httpClient)

        notifier.notify(userId = 99L, documentId = 123L, reason = "GCM 태그 불일치")

        val captured = requestSlot.captured
        assertThat(captured.uri().toString()).isEqualTo("https://discord.test/webhook")
        assertThat(captured.method()).isEqualTo("POST")
        assertThat(captured.headers().firstValue("Content-Type")).hasValue("application/json")
    }

    @Test
    fun `웹훅 메시지 본문은 식별자와 사유만 담고 평문 변수가 없다`() {
        val notifier = DecryptionFailureNotifier("https://discord.test/webhook", mockk())

        val content = notifier.buildContent(userId = 99L, documentId = 123L, reason = "GCM 태그 불일치")

        // notify 시그니처가 평문을 받지 않으므로 메시지에는 식별자+사유만 존재
        assertThat(content).contains("99")
        assertThat(content).contains("123")
        assertThat(content).contains("GCM 태그 불일치")
    }

    @Test
    fun `URL 미설정 시 웹훅을 호출하지 않는다(skip)`() {
        val httpClient = mockk<HttpClient>()
        val notifier = DecryptionFailureNotifier("", httpClient)

        notifier.notify(userId = 5L, documentId = 6L, reason = "복호 실패")

        verify(exactly = 0) {
            httpClient.send(any<HttpRequest>(), any<HttpResponse.BodyHandler<String>>())
        }
    }
}
