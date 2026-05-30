package com.writenote.components

import org.springframework.stereotype.Component
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

/**
 * 모바일 캡처 멱등성 캐시 (메모리 단일 인스턴스).
 *
 * key → (저장된 응답 JSON 문자열, 저장 시각) 보관.
 * TTL 이 지난 항목은 조회 시 null 반환 (지연 제거 방식).
 *
 * @param ttlSeconds TTL 초. 기본값 300(5분). 테스트 시 주입 가능.
 */
@Component
class IdempotencyCache(
    val ttlSeconds: Long = 300,
) {
    private data class Entry(
        val value: String,
        val storedAt: Instant,
    )

    private val store = ConcurrentHashMap<String, Entry>()

    /** key 에 해당하는 캐시 값을 반환. TTL 만료 또는 미존재 시 null. */
    fun get(key: String): String? {
        val entry = store[key] ?: return null
        return if (isExpired(entry.storedAt)) {
            store.remove(key)
            null
        } else {
            entry.value
        }
    }

    /** key-value 를 현재 시각 기준으로 저장. */
    fun put(
        key: String,
        value: String,
    ) {
        store[key] = Entry(value = value, storedAt = Instant.now())
    }

    /**
     * 테스트 전용 — 저장 시각을 직접 지정하여 TTL 만료 시나리오를 재현.
     * 운영 코드에서는 [put] 을 사용한다.
     */
    fun putWithTimestamp(
        key: String,
        value: String,
        storedAt: Instant,
    ) {
        store[key] = Entry(value = value, storedAt = storedAt)
    }

    private fun isExpired(storedAt: Instant): Boolean = Instant.now().epochSecond - storedAt.epochSecond >= ttlSeconds
}
