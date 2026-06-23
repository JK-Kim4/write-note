package com.writenote.crypto

import com.writenote.error.BodyDecryptionException
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

/**
 * BodyCipherService 단위 테스트.
 *
 * UserKeyService는 외부 DB 경계이므로 mock. AesGcmCipher는 인프로세스라 실제 인스턴스 사용.
 */
class BodyCipherServiceTest {
    private lateinit var bodyCipherService: BodyCipherService
    private lateinit var userKeyService: UserKeyService
    private lateinit var aesGcmCipher: AesGcmCipher
    private lateinit var decryptionFailureNotifier: DecryptionFailureNotifier
    private lateinit var userDek: SecretKey

    @BeforeEach
    fun setUp() {
        aesGcmCipher = AesGcmCipher()
        userKeyService = mockk()
        decryptionFailureNotifier = mockk(relaxed = true)
        userDek = SecretKeySpec(ByteArray(32) { it.toByte() }, "AES")
        every { userKeyService.getOrCreate(USER_ID) } returns userDek
        every { userKeyService.find(USER_ID) } returns userDek
        bodyCipherService = BodyCipherService(aesGcmCipher, userKeyService, decryptionFailureNotifier)
    }

    @Test
    fun `encrypt 후 decryptToPlain 왕복 시 원문 일치`() {
        val plaintext = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"본문"}]}]}"""
        val encrypted = bodyCipherService.encrypt(USER_ID, plaintext)
        val decrypted = bodyCipherService.decryptToPlain(USER_ID, encrypted)
        assertThat(decrypted).isEqualTo(plaintext)
    }

    @Test
    fun `레거시 평문(type=doc)은 키 접근 없이 그대로 반환된다`() {
        val legacy = """{"type":"doc","content":[]}"""
        val result = bodyCipherService.decryptToPlain(USER_ID, legacy)
        assertThat(result).isEqualTo(legacy)
        // 회귀 가드: 복호 경로가 DEK 를 조회/생성하지 않아야 한다(readOnly 트랜잭션 INSERT 금지의 근원).
        verify(exactly = 0) { userKeyService.find(any()) }
        verify(exactly = 0) { userKeyService.getOrCreate(any()) }
    }

    @Test
    fun `암호문인데 DEK가 미존재하면 생성하지 않고 fail-closed로 차단한다`() {
        every { userKeyService.find(USER_ID) } returns null
        val envelope = """{"v":1,"alg":"A256GCM","iv":"AAAAAAAAAAAAAAAA","ct":"AAAAAAAAAAAAAAAA"}"""
        assertThatThrownBy { bodyCipherService.decryptToPlain(USER_ID, envelope) }
            .isInstanceOf(BodyDecryptionException::class.java)
        // 복호 경로는 절대 DEK 를 생성하지 않는다.
        verify(exactly = 0) { userKeyService.getOrCreate(any()) }
        verify(exactly = 1) { decryptionFailureNotifier.notify(userId = USER_ID, documentId = null, reason = any()) }
    }

    @Test
    fun `encrypt 산출물은 원문 부분문자열을 포함하지 않는다`() {
        val secret = "비밀내용입니다"
        val plaintext = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$secret"}]}]}"""
        val encrypted = bodyCipherService.encrypt(USER_ID, plaintext)
        assertThat(encrypted).doesNotContain(secret)
    }

    @Test
    fun `복호 실패 시 알림 후 BodyDecryptionException이 전파된다`() {
        val tampered = """{"v":1,"alg":"A256GCM","iv":"AAAAAAAAAAAAAAAA","ct":"AAAAAAAAAAAAAAAA"}"""
        assertThatThrownBy { bodyCipherService.decryptToPlain(USER_ID, tampered) }
            .isInstanceOf(BodyDecryptionException::class.java)
        verify(exactly = 1) { decryptionFailureNotifier.notify(userId = USER_ID, documentId = null, reason = any()) }
    }

    companion object {
        private const val USER_ID = 42L
    }
}
