package com.writenote.crypto

import com.writenote.error.BodyDecryptionException
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule
import java.util.Base64
import javax.crypto.spec.SecretKeySpec

class AesGcmCipherTest {
    private lateinit var cipher: AesGcmCipher
    private lateinit var testKey: javax.crypto.SecretKey
    private lateinit var otherKey: javax.crypto.SecretKey

    @BeforeEach
    fun setUp() {
        cipher = AesGcmCipher()
        // 테스트 전용 고정 32바이트 키
        testKey = SecretKeySpec(ByteArray(32) { it.toByte() }, "AES")
        otherKey = SecretKeySpec(ByteArray(32) { (it + 1).toByte() }, "AES")
    }

    @Test
    fun `seal open 왕복 무손실 - 평문이 그대로 복원된다`() {
        val plaintext = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"안녕하세요"}]}]}"""
        val envelope = cipher.seal(testKey, plaintext)
        val restored = cipher.openOrPassthrough(testKey, envelope)
        assertThat(restored).isEqualTo(plaintext)
    }

    @Test
    fun `연속 seal 시 IV가 달라 암호문이 상이하다`() {
        val plaintext = """{"type":"doc","content":[]}"""
        val envelope1 = cipher.seal(testKey, plaintext)
        val envelope2 = cipher.seal(testKey, plaintext)
        assertThat(envelope1).isNotEqualTo(envelope2)
    }

    @Test
    fun `봉투 ct 1바이트 변조 시 BodyDecryptionException`() {
        val plaintext = """{"type":"doc","content":[]}"""
        val envelope = cipher.seal(testKey, plaintext)
        val tampered = tamperCt(envelope)
        assertThatThrownBy { cipher.openOrPassthrough(testKey, tampered) }
            .isInstanceOf(BodyDecryptionException::class.java)
    }

    @Test
    fun `다른 키로 복호 시 BodyDecryptionException`() {
        val plaintext = """{"type":"doc","content":[]}"""
        val envelope = cipher.seal(testKey, plaintext)
        assertThatThrownBy { cipher.openOrPassthrough(otherKey, envelope) }
            .isInstanceOf(BodyDecryptionException::class.java)
    }

    @Test
    fun `레거시 평문(type=doc)은 openOrPassthrough에서 그대로 반환된다`() {
        val legacy = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"기존 본문"}]}]}"""
        val result = cipher.openOrPassthrough(testKey, legacy)
        assertThat(result).isEqualTo(legacy)
    }

    @Test
    fun `알 수 없는 봉투 형태는 BodyDecryptionException`() {
        val unknown = """{"v":2,"alg":"UNKNOWN","iv":"abc","ct":"def"}"""
        assertThatThrownBy { cipher.openOrPassthrough(testKey, unknown) }
            .isInstanceOf(BodyDecryptionException::class.java)
    }

    @Test
    fun `wrap unwrap 왕복 - 동일 키로 DEK가 그대로 복원된다`() {
        val dek = SecretKeySpec(ByteArray(32) { (it * 3).toByte() }, "AES")
        val wrapped = cipher.wrap(testKey, dek)
        val unwrapped = cipher.unwrap(testKey, wrapped)
        assertThat(unwrapped.encoded).isEqualTo(dek.encoded)
    }

    @Test
    fun `wrap 후 다른 KEK로 unwrap 시 BodyDecryptionException`() {
        val dek = SecretKeySpec(ByteArray(32) { (it * 3).toByte() }, "AES")
        val wrapped = cipher.wrap(testKey, dek)
        assertThatThrownBy { cipher.unwrap(otherKey, wrapped) }
            .isInstanceOf(BodyDecryptionException::class.java)
    }

    @Test
    fun `빈 문서도 seal open 왕복 무손실`() {
        val empty = """{"type":"doc","content":[]}"""
        // 빈 문서도 봉투 생성은 가능해야 함 (plaintext를 기존 EMPTY_DOC_JSON과 다르게)
        // 단, openOrPassthrough는 type=doc이므로 passthrough. seal 후 envelope을 open해야 함.
        val envelope = cipher.seal(testKey, empty)
        // envelope은 봉투 JSON이어야 함 (type=doc 없음)
        assertThat(envelope).doesNotContain(""""type":"doc"""")
        val restored = cipher.openOrPassthrough(testKey, envelope)
        assertThat(restored).isEqualTo(empty)
    }

    /** ct 필드를 추출해 1바이트 변조한 봉투 JSON을 반환 */
    private fun tamperCt(envelope: String): String {
        val mapper = JsonMapper.builder().addModule(kotlinModule()).build()
        val node = mapper.readTree(envelope)
        val ctB64 = node.get("ct").asText()
        val ctBytes = Base64.getUrlDecoder().decode(ctB64)
        ctBytes[0] = (ctBytes[0].toInt() xor 0xFF).toByte()
        val tamperedB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(ctBytes)
        return envelope.replace(ctB64, tamperedB64)
    }
}
