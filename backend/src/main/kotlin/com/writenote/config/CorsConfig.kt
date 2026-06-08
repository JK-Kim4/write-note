package com.writenote.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

/**
 * CORS 설정 — V1 와일드카드 정책.
 *
 * credentials=false + origin 와일드카드. 토큰을 localStorage + Authorization 헤더로 전달하므로
 * Cookie 미사용 → credentials=false 안전.
 *
 * SecurityFilterChain 의 cors DSL 결선은 R-G (T031) 에서.
 *
 * 출처: research.md R-8, contracts/security-filter-chain.md §4.
 */
@Configuration
class CorsConfig {
    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val configuration =
            CorsConfiguration().apply {
                allowedOrigins = listOf("*")
                allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                allowedHeaders = listOf("Authorization", "Content-Type", "Idempotency-Key", "Accept")
                exposedHeaders = listOf("Location")
                allowCredentials = false
                maxAge = 3600L
            }
        return UrlBasedCorsConfigurationSource().apply {
            registerCorsConfiguration("/**", configuration)
        }
    }
}
