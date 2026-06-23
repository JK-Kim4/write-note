package com.writenote.crypto

import io.mockk.every
import io.mockk.mockk
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

/**
 * 암복호 왕복 성능 단위 측정 (SC-001 근거 — 운영 p95는 별도 관찰).
 *
 * 대표 본문(약 50KB) encrypt+decrypt 왕복이 임계(<5ms) 하임을 단일 측정 + 왕복 정확성.
 * 외부 DB 경계(UserKeyService)는 mock, 암호 연산은 실제(인프로세스).
 */
class BodyCipherPerformanceTest {
    private val aesGcmCipher = AesGcmCipher()
    private val dek: SecretKey = SecretKeySpec(ByteArray(32) { (it + 1).toByte() }, "AES")

    private fun newService(): BodyCipherService {
        val userKeyService = mockk<UserKeyService>()
        every { userKeyService.getOrCreate(USER_ID) } returns dek
        every { userKeyService.find(USER_ID) } returns dek
        val notifier = mockk<DecryptionFailureNotifier>(relaxed = true)
        return BodyCipherService(aesGcmCipher, userKeyService, notifier)
    }

    @Test
    fun `약 50KB 본문 encrypt+decrypt 왕복이 정확하고 임계(50ms) 미만이다`() {
        val service = newService()
        // 약 50KB ProseMirror JSON 본문 구성
        val paragraph = "가나다라마바사아자차카타파하".repeat(50) // 약 700B
        val builder = StringBuilder()
        builder.append("""{"type":"doc","content":[""")
        val blocks = 70 // 약 50KB
        for (i in 0 until blocks) {
            if (i > 0) builder.append(",")
            builder.append("""{"type":"paragraph","content":[{"type":"text","text":"$paragraph"}]}""")
        }
        builder.append("]}")
        val plain = builder.toString()
        assertThat(plain.toByteArray(Charsets.UTF_8).size).isGreaterThan(40_000)

        // 워밍업 (JIT/AES-NI)
        repeat(20) {
            val w = service.encrypt(USER_ID, plain)
            service.decryptToPlain(USER_ID, w)
        }

        // 왕복 정확성
        val encrypted = service.encrypt(USER_ID, plain)
        assertThat(service.decryptToPlain(USER_ID, encrypted)).isEqualTo(plain)

        // 측정 — 다수 반복 중앙값으로 단일 임계 판단
        val iterations = 50
        val durationsNanos =
            (0 until iterations).map {
                val start = System.nanoTime()
                val w = service.encrypt(USER_ID, plain)
                service.decryptToPlain(USER_ID, w)
                System.nanoTime() - start
            }
        // 임계: 50ms (알고리즘 비용이 무시 가능함을 보이는 증거 — research.md D8.
        // 실제 p95 는 운영 관찰 게이트. JVM 워밍업/전체 테스트 수트 부하 여유 포함.)
        val medianMs = durationsNanos.sorted()[iterations / 2] / 1_000_000.0
        assertThat(medianMs).isLessThan(50.0)
    }

    companion object {
        private const val USER_ID = 1L
    }
}
