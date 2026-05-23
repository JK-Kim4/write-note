package com.writenote.auth

import com.writenote.components.AuthTokenGenerator
import com.writenote.config.JwtProperties
import com.writenote.entity.AuthToken
import com.writenote.enums.AuthTokenType
import com.writenote.repository.AuthTokenRepository
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.security.web.authentication.AuthenticationSuccessHandler
import org.springframework.stereotype.Component
import java.net.URLEncoder
import java.nio.charset.StandardCharsets.UTF_8
import java.time.Instant

/**
 * 카카오 OAuth2 로그인 성공 시 JWT access + refresh 발급 + 프론트로 URL fragment redirect.
 *
 * 응답: `302 Found` Location:
 * `{frontend}/auth/success#access=<jwt>&refresh=<plaintext>&accessExpiresIn=<sec>&refreshExpiresIn=<sec>`
 *
 * Fragment 사용 — 토큰이 서버 로그·리퍼러에 남지 않는 표준 패턴 (research.md R-3).
 */
@Component
class OAuth2SuccessHandler(
    private val jwtTokenProvider: JwtTokenProvider,
    private val authTokenGenerator: AuthTokenGenerator,
    private val authTokenRepository: AuthTokenRepository,
    private val jwtProperties: JwtProperties,
    @Value("\${app.frontend.base-url}") private val frontendBaseUrl: String,
) : AuthenticationSuccessHandler {
    override fun onAuthenticationSuccess(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authentication: Authentication,
    ) {
        val oauth2User = authentication.principal as OAuth2User
        val userId = oauth2User.attributes["userId"] as Long

        @Suppress("UNCHECKED_CAST")
        val email = (oauth2User.attributes["kakao_account"] as Map<String, Any>)["email"] as String

        val accessToken = jwtTokenProvider.createAccessToken(userId = userId, email = email)
        val refreshPair = authTokenGenerator.generate()
        val now = Instant.now()
        authTokenRepository.save(
            AuthToken(
                userId = userId,
                type = AuthTokenType.REFRESH,
                tokenHash = refreshPair.hash,
                expiresAt = now.plusSeconds(jwtProperties.refreshTokenValiditySeconds),
            ),
        )

        response.sendRedirect(buildRedirectUrl(accessToken, refreshPair.plaintext))
    }

    private fun buildRedirectUrl(
        accessToken: String,
        refreshToken: String,
    ): String =
        buildString {
            append(frontendBaseUrl)
            append("/auth/success#access=")
            append(URLEncoder.encode(accessToken, UTF_8))
            append("&refresh=")
            append(URLEncoder.encode(refreshToken, UTF_8))
            append("&accessExpiresIn=").append(jwtProperties.accessTokenValiditySeconds)
            append("&refreshExpiresIn=").append(jwtProperties.refreshTokenValiditySeconds)
        }
}
