package com.writenote.crypto

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Component
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

/**
 * 본문 복호 실패를 운영자에게 알린다(best-effort).
 *
 * - `log.error`(평문·키 미포함, 식별자+사유만) → 항상.
 * - 디스코드 Incoming Webhook POST(`{"content": "..."}`) → URL 설정 시.
 * - 전 구간 try/catch swallow + 짧은 타임아웃. 본 기능 가용성·예외 흐름에 영향 0(FR-014).
 *
 * [httpClient]는 생성자 주입(테스트에서 외부 HTTP 경계 mock 가능).
 */
@Component
class DecryptionFailureNotifier(
    @Value("\${app.alerts.discord-webhook-url:}") private val webhookUrl: String,
    private val httpClient: HttpClient = defaultHttpClient(),
) {
    private val log = LoggerFactory.getLogger(DecryptionFailureNotifier::class.java)
    private val jsonMapper = JsonMapper.builder().addModule(kotlinModule()).build()

    /**
     * 복호 실패 알림. [userId]/[documentId]/[reason]만 사용(평문·키 미포함).
     * @Async — 요청 스레드 비차단. 전 구간 swallow.
     */
    @Async("alertExecutor")
    fun notify(
        userId: Long,
        documentId: Long?,
        reason: String,
    ) {
        val content = buildContent(userId, documentId, reason)
        log.error("본문 복호 실패: {}", content)
        if (webhookUrl.isBlank()) {
            return
        }
        try {
            val payload = jsonMapper.writeValueAsString(mapOf("content" to content))
            val request =
                HttpRequest
                    .newBuilder()
                    .uri(URI.create(webhookUrl))
                    .timeout(REQUEST_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build()
            httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        } catch (e: Exception) {
            // best-effort — 알림 실패는 요청 흐름에 영향 0
            log.warn("디스코드 복호 실패 알림 전송 실패(swallow): {}", e.message)
        }
    }

    /** 알림 메시지 본문 — 식별자+사유만(평문·키 미포함). */
    fun buildContent(
        userId: Long,
        documentId: Long?,
        reason: String,
    ): String = "[복호 실패] userId=$userId, documentId=${documentId ?: "-"}, reason=$reason"

    companion object {
        private val CONNECT_TIMEOUT = Duration.ofSeconds(3)
        private val REQUEST_TIMEOUT = Duration.ofSeconds(5)

        private fun defaultHttpClient(): HttpClient =
            HttpClient
                .newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .build()
    }
}
