package com.writenote.service

import org.springframework.stereotype.Component
import java.security.SecureRandom

/**
 * 공유 링크 토큰 생성기(046 R-6). [com.writenote.components.ApiTokenHasher] 패턴 답습 — 단 prefix 없는
 * base62 32자 추측불가 값을 **원문 그대로** 저장(URL 노출 capability — 해시 저장 아님, 공개 read 가 토큰으로 역조회).
 */
@Component
class ShareTokenGenerator {
    private val secureRandom = SecureRandom()

    /** 추측불가 base62 32자 토큰을 생성한다. */
    fun generate(): String {
        val sb = StringBuilder(TOKEN_LENGTH)
        repeat(TOKEN_LENGTH) {
            sb.append(BASE62_CHARS[secureRandom.nextInt(BASE62_CHARS.length)])
        }
        return sb.toString()
    }

    companion object {
        const val TOKEN_LENGTH = 32

        private const val BASE62_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    }
}
