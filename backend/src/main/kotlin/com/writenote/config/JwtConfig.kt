package com.writenote.config

import com.writenote.auth.JwtTokenProvider
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@ConfigurationProperties("app.auth.jwt")
data class JwtProperties(
    val secret: String = "",
    val accessTokenValiditySeconds: Long = 3600L,
    val refreshTokenValiditySeconds: Long = 2592000L,
)

@Configuration
@EnableConfigurationProperties(JwtProperties::class)
class JwtConfig(
    private val properties: JwtProperties,
) {
    @Bean
    fun jwtTokenProvider(): JwtTokenProvider {
        require(properties.secret.isNotBlank()) {
            "JWT_SECRET 환경 변수가 설정되지 않았습니다."
        }
        val keyBytes =
            java.util.Base64
                .getDecoder()
                .decode(properties.secret)
        require(keyBytes.size >= MIN_KEY_BYTES) {
            "JWT_SECRET 은 base64 디코딩 후 최소 32 바이트(256 비트)이어야 합니다." +
                " 현재: ${keyBytes.size}"
        }
        return JwtTokenProvider(keyBytes, properties.accessTokenValiditySeconds)
    }

    companion object {
        private const val MIN_KEY_BYTES = 32
    }
}
