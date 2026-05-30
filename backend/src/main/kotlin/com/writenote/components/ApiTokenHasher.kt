package com.writenote.components

import org.springframework.stereotype.Component
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * ApiToken 생성 및 해시 검증 컴포넌트.
 *
 * - 토큰 형태: `wnt_` + base62 32자 (총 36자)
 * - 해시: SHA-256 hex (JDK MessageDigest, 외부 라이브러리 미사용)
 */
@Component
class ApiTokenHasher {
    private val secureRandom = SecureRandom()

    /** 신규 평문 API 토큰을 생성한다. 발급 시 1회 노출 후 미저장. */
    fun generate(): String {
        val sb = StringBuilder(PREFIX)
        repeat(PLAIN_SUFFIX_LENGTH) {
            sb.append(BASE62_CHARS[secureRandom.nextInt(BASE62_CHARS.length)])
        }
        return sb.toString()
    }

    /** 평문 토큰을 SHA-256 hex 문자열로 변환한다. DB 저장 및 조회 키. */
    fun hash(plainToken: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val bytes = digest.digest(plainToken.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    companion object {
        const val PREFIX = "wnt_"
        private const val PLAIN_SUFFIX_LENGTH = 32

        private const val BASE62_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    }
}
