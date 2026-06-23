package com.writenote.crypto

import com.writenote.error.BodyDecryptionException
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * AES-256-GCM 기반 순수 암호 컴포넌트.
 *
 * 상태 없음. 외부 라이브러리 없음(JDK javax.crypto만 사용).
 * 모든 암복호 실패는 [BodyDecryptionException]으로 변환(fail-closed — 평문/빈값 반환 금지).
 *
 * 봉투 포맷(v1): `{"v":1,"alg":"A256GCM","iv":"<base64url>","ct":"<base64url ct‖tag>"}`
 * 판별: 최상위 `"type":"doc"` → 레거시 평문 통과, `"v"`+`"iv"` 보유 → 봉투 복호.
 */
@Component
class AesGcmCipher {
    private val jsonMapper = JsonMapper.builder().addModule(kotlinModule()).build()
    private val secureRandom = SecureRandom()
    private val b64Enc = Base64.getUrlEncoder().withoutPadding()
    private val b64Dec = Base64.getUrlDecoder()

    /**
     * [plaintext]를 [key]로 AES-256-GCM 암호화하여 봉투 JSON 문자열 반환.
     * 매 호출마다 랜덤 IV를 생성하므로 같은 평문도 상이한 암호문 산출.
     */
    fun seal(
        key: SecretKey,
        plaintext: String,
    ): String {
        val iv = ByteArray(IV_SIZE).also { secureRandom.nextBytes(it) }
        val cipher = newCipher().apply { init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(TAG_BIT_SIZE, iv)) }
        val ctAndTag = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        return jsonMapper.writeValueAsString(
            mapOf(
                "v" to 1,
                "alg" to "A256GCM",
                "iv" to b64Enc.encodeToString(iv),
                "ct" to b64Enc.encodeToString(ctAndTag),
            ),
        )
    }

    /**
     * [stored] 판별:
     * - 최상위 `"type":"doc"` → 레거시 평문, 그대로 반환.
     * - `"v"`+`"iv"` 보유 → 봉투 v1 복호 후 반환.
     * - 알 수 없는 형태 → [BodyDecryptionException] (fail-closed).
     */
    fun openOrPassthrough(
        key: SecretKey,
        stored: String,
    ): String {
        val root =
            try {
                jsonMapper.readTree(stored)
            } catch (e: Exception) {
                throw BodyDecryptionException("본문 JSON 파싱 실패", e)
            }
        // 레거시 평문 판별: 최상위 type=doc
        if (root.path("type").asText("") == "doc") {
            return stored
        }
        // 봉투 v1 판별
        if (root.has("v") && root.has("iv")) {
            val version = root.path("v").asInt(0)
            if (version != 1) {
                throw BodyDecryptionException("지원하지 않는 봉투 버전: $version")
            }
            return decryptEnvelope(key, root)
        }
        throw BodyDecryptionException("알 수 없는 본문 봉투 형태")
    }

    /**
     * [stored]가 레거시 평문(최상위 `type=doc`)인지 순수 판별.
     * 봉투/비JSON/알 수 없는 형태는 false. 복호 경로가 **키 접근 없이** 레거시 평문을 통과시키기 위함.
     */
    fun isLegacyPlaintext(stored: String): Boolean {
        val root =
            try {
                jsonMapper.readTree(stored)
            } catch (e: Exception) {
                return false
            }
        return root.path("type").asText("") == "doc"
    }

    /**
     * [kek]로 [dek]를 AES-256-GCM wrap하여 `iv‖ct‖tag` 바이트 배열 반환 (60B).
     */
    fun wrap(
        kek: SecretKey,
        dek: SecretKey,
    ): ByteArray {
        val iv = ByteArray(IV_SIZE).also { secureRandom.nextBytes(it) }
        val cipher = newCipher().apply { init(Cipher.ENCRYPT_MODE, kek, GCMParameterSpec(TAG_BIT_SIZE, iv)) }
        val ctAndTag = cipher.doFinal(dek.encoded)
        return iv + ctAndTag
    }

    /**
     * [wrapped] (`iv‖ct‖tag`)를 [kek]로 unwrap하여 AES DEK 반환.
     * 실패 시 [BodyDecryptionException].
     */
    fun unwrap(
        kek: SecretKey,
        wrapped: ByteArray,
    ): SecretKey {
        require(wrapped.size > IV_SIZE) { "wrapped DEK 크기 오류: ${wrapped.size}" }
        val iv = wrapped.copyOfRange(0, IV_SIZE)
        val ctAndTag = wrapped.copyOfRange(IV_SIZE, wrapped.size)
        return try {
            val cipher = newCipher().apply { init(Cipher.DECRYPT_MODE, kek, GCMParameterSpec(TAG_BIT_SIZE, iv)) }
            val dekBytes = cipher.doFinal(ctAndTag)
            SecretKeySpec(dekBytes, "AES")
        } catch (e: AEADBadTagException) {
            throw BodyDecryptionException("DEK unwrap 실패: GCM 인증 태그 불일치", e)
        } catch (e: Exception) {
            throw BodyDecryptionException("DEK unwrap 실패: ${e.message}", e)
        }
    }

    private fun decryptEnvelope(
        key: SecretKey,
        root: JsonNode,
    ): String {
        val ivB64 = root.path("iv").asText("")
        val ctB64 = root.path("ct").asText("")
        if (ivB64.isEmpty() || ctB64.isEmpty()) {
            throw BodyDecryptionException("봉투 필드 누락: iv 또는 ct")
        }
        return try {
            val iv = b64Dec.decode(ivB64)
            val ctAndTag = b64Dec.decode(ctB64)
            val cipher = newCipher().apply { init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_BIT_SIZE, iv)) }
            cipher.doFinal(ctAndTag).toString(Charsets.UTF_8)
        } catch (e: AEADBadTagException) {
            throw BodyDecryptionException("본문 복호 실패: GCM 인증 태그 불일치", e)
        } catch (e: BodyDecryptionException) {
            throw e
        } catch (e: Exception) {
            throw BodyDecryptionException("본문 복호 실패: ${e.message}", e)
        }
    }

    private fun newCipher() = Cipher.getInstance(CIPHER_SPEC)

    companion object {
        private const val CIPHER_SPEC = "AES/GCM/NoPadding"
        private const val IV_SIZE = 12
        private const val TAG_BIT_SIZE = 128
    }
}
