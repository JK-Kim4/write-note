package com.writenote.components

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Instant

@DisplayName("IdempotencyCache 단위 테스트")
class IdempotencyCacheTest {
    @Test
    fun `같은 key 로 두 번 조회하면 첫 번째 저장된 응답을 반환한다`() {
        val cache = IdempotencyCache(ttlSeconds = 300)
        cache.put("key-1", "response-1")

        assertThat(cache.get("key-1")).isEqualTo("response-1")
    }

    @Test
    fun `존재하지 않는 key 조회 시 null 을 반환한다`() {
        val cache = IdempotencyCache(ttlSeconds = 300)

        assertThat(cache.get("no-such-key")).isNull()
    }

    @Test
    fun `TTL 이 지난 항목은 null 을 반환한다`() {
        // ttlSeconds=0 으로 즉시 만료 설정 후 저장
        val cache = IdempotencyCache(ttlSeconds = 0)
        cache.putWithTimestamp("key-exp", "response-exp", Instant.now().minusSeconds(1))

        assertThat(cache.get("key-exp")).isNull()
    }

    @Test
    fun `TTL 이 남은 항목은 정상 반환한다`() {
        val cache = IdempotencyCache(ttlSeconds = 300)
        cache.putWithTimestamp("key-alive", "response-alive", Instant.now())

        assertThat(cache.get("key-alive")).isEqualTo("response-alive")
    }
}
