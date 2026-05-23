package com.writenote.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder

@Configuration
class PasswordEncoderConfig {
    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder(BCRYPT_STRENGTH)

    companion object {
        /** BCrypt cost factor — SoT §4-3 박힘. 2026 기준 200~400ms 응답. */
        const val BCRYPT_STRENGTH = 12
    }
}
