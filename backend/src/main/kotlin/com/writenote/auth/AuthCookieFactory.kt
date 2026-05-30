package com.writenote.auth

import com.writenote.config.JwtProperties
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.ResponseCookie
import org.springframework.stereotype.Component

/**
 * 세션 토큰(access/refresh)을 httpOnly 쿠키로 발급·만료하는 helper.
 *
 * - SameSite=Lax + Path=/ + HttpOnly. Secure 는 환경별(`app.cookie.secure`).
 * - Domain 미지정(host-only) — same-origin 프록시 host 에 귀속.
 *
 * 출처: 005 contracts/auth-cookie-contract.md §1 + research R-2.
 */
@Component
class AuthCookieFactory(
    private val jwtProperties: JwtProperties,
    @Value("\${app.cookie.secure:false}") private val secure: Boolean,
) {
    fun accessTokenCookie(token: String): ResponseCookie = build(ACCESS_TOKEN_COOKIE, token, jwtProperties.accessTokenValiditySeconds)

    fun refreshTokenCookie(token: String): ResponseCookie = build(REFRESH_TOKEN_COOKIE, token, jwtProperties.refreshTokenValiditySeconds)

    fun expiredAccessTokenCookie(): ResponseCookie = build(ACCESS_TOKEN_COOKIE, "", 0)

    fun expiredRefreshTokenCookie(): ResponseCookie = build(REFRESH_TOKEN_COOKIE, "", 0)

    private fun build(
        name: String,
        value: String,
        maxAgeSeconds: Long,
    ): ResponseCookie =
        ResponseCookie
            .from(name, value)
            .httpOnly(true)
            .secure(secure)
            .path("/")
            .sameSite("Lax")
            .maxAge(maxAgeSeconds)
            .build()

    companion object {
        const val ACCESS_TOKEN_COOKIE = "access_token"
        const val REFRESH_TOKEN_COOKIE = "refresh_token"
    }
}
