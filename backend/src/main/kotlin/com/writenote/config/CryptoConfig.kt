package com.writenote.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.util.Base64
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

/**
 * 봉투 암호화 마스터 KEK(Key Encryption Key) 설정.
 *
 * [app.crypto.master-key]에 Base64 인코딩된 32바이트 AES-256 키를 설정해야 함.
 * 미설정(빈 문자열) 또는 32바이트 미만 시 애플리케이션 기동 실패(fail-fast).
 */
@Configuration
class CryptoConfig {
    @Bean
    fun masterKey(
        @Value("\${app.crypto.master-key:}") masterKeyBase64: String,
    ): SecretKey {
        require(masterKeyBase64.isNotBlank()) {
            "app.crypto.master-key가 설정되지 않았습니다. BODY_ENCRYPTION_KEY 환경변수를 확인하세요."
        }
        val keyBytes =
            try {
                Base64.getDecoder().decode(masterKeyBase64)
            } catch (e: IllegalArgumentException) {
                throw IllegalStateException("app.crypto.master-key가 유효한 Base64 형식이 아닙니다.", e)
            }
        require(keyBytes.size == KEY_BYTES) {
            "app.crypto.master-key는 정확히 32바이트(256비트)여야 합니다. 현재: ${keyBytes.size}바이트"
        }
        return SecretKeySpec(keyBytes, ALGORITHM)
    }

    companion object {
        private const val KEY_BYTES = 32
        private const val ALGORITHM = "AES"
    }
}
