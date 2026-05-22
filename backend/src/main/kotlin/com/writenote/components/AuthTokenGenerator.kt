package com.writenote.components

import org.springframework.stereotype.Component
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * 보조 토큰 (refresh / email verify / password reset) 생성 컴포넌트.
 *
 * 32 바이트 무작위 → base64url 인코딩 (padding 제거 → 43자).
 * 평문은 호출자에게 1회 노출. DB 저장은 SHA-256 hex 만 (research.md R-6, SoT §2-2).
 */
@Component
class AuthTokenGenerator {
    private val random = SecureRandom()

    /**
     * 신규 토큰 쌍을 생성한다.
     *
     * @return [TokenPair] — [TokenPair.plaintext] 은 발급 시 1회만 노출, [TokenPair.hash] 만 DB 저장
     */
    fun generate(): TokenPair {
        val bytes = ByteArray(TOKEN_BYTES)
        random.nextBytes(bytes)
        val plaintext = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        val hash = sha256Hex(plaintext)
        return TokenPair(plaintext = plaintext, hash = hash)
    }

    /**
     * 평문 토큰의 SHA-256 hex 해시를 반환한다.
     *
     * DB 조회 시 클라이언트가 보낸 평문을 해시로 변환하는 용도.
     */
    fun hash(plaintext: String): String = sha256Hex(plaintext)

    private fun sha256Hex(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val bytes = digest.digest(input.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { byte -> "%02x".format(byte) }
    }

    data class TokenPair(
        val plaintext: String,
        val hash: String,
    )

    companion object {
        private const val TOKEN_BYTES = 32
    }
}
