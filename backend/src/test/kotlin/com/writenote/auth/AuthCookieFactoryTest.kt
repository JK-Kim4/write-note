package com.writenote.auth

import com.writenote.config.JwtProperties
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

class AuthCookieFactoryTest {
    private val jwtProperties =
        JwtProperties(
            secret = "test-secret",
            accessTokenValiditySeconds = 3600,
            refreshTokenValiditySeconds = 2592000,
        )

    @Test
    @DisplayName("access token 쿠키는 httpOnly + SameSite=Lax + Path=/ + access validity maxAge 를 박는다")
    fun `access token cookie attributes`() {
        val factory = AuthCookieFactory(jwtProperties, secure = false)

        val cookie = factory.accessTokenCookie("jwt-value")

        assertThat(cookie.name).isEqualTo("access_token")
        assertThat(cookie.value).isEqualTo("jwt-value")
        assertThat(cookie.isHttpOnly).isTrue()
        assertThat(cookie.sameSite).isEqualTo("Lax")
        assertThat(cookie.path).isEqualTo("/")
        assertThat(cookie.isSecure).isFalse()
        assertThat(cookie.maxAge.seconds).isEqualTo(3600)
    }

    @Test
    @DisplayName("refresh token 쿠키는 refresh validity maxAge 를 박는다")
    fun `refresh token cookie max age`() {
        val factory = AuthCookieFactory(jwtProperties, secure = false)

        val cookie = factory.refreshTokenCookie("refresh-value")

        assertThat(cookie.name).isEqualTo("refresh_token")
        assertThat(cookie.value).isEqualTo("refresh-value")
        assertThat(cookie.maxAge.seconds).isEqualTo(2592000)
    }

    @Test
    @DisplayName("만료 쿠키는 빈 값 + maxAge 0")
    fun `expired cookies have empty value and zero max age`() {
        val factory = AuthCookieFactory(jwtProperties, secure = false)

        assertThat(factory.expiredAccessTokenCookie().value).isEmpty()
        assertThat(factory.expiredAccessTokenCookie().maxAge.seconds).isEqualTo(0)
        assertThat(factory.expiredRefreshTokenCookie().name).isEqualTo("refresh_token")
        assertThat(factory.expiredRefreshTokenCookie().maxAge.seconds).isEqualTo(0)
    }

    @Test
    @DisplayName("secure=true 면 Secure 속성을 박는다 (배포 환경)")
    fun `secure flag is respected`() {
        val secureFactory = AuthCookieFactory(jwtProperties, secure = true)

        assertThat(secureFactory.accessTokenCookie("x").isSecure).isTrue()
    }
}
