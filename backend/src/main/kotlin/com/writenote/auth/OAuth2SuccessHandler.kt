package com.writenote.auth

import com.writenote.components.AuthTokenGenerator
import com.writenote.config.JwtProperties
import com.writenote.entity.AuthToken
import com.writenote.enums.AuthTokenType
import com.writenote.model.request.LinkKakaoStateRequest
import com.writenote.repository.AuthTokenRepository
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.security.web.authentication.AuthenticationSuccessHandler
import org.springframework.stereotype.Component
import java.time.Instant

/**
 * 카카오 OAuth2 로그인 성공 시 JWT access + refresh 발급 + httpOnly 쿠키로 내린 뒤 프론트 홈으로 redirect.
 *
 * 응답: `302 Found` — `Set-Cookie: access_token`/`refresh_token` (httpOnly+SameSite=Lax) + Location `{frontend}/`.
 * link flow(`linkUserId`) 는 토큰 발급 없이 `{frontend}/auth/link-success` redirect.
 *
 * 쿠키 사용 — 이메일 로그인(AuthController)과 동일 인증 매체로 통일 (005 R-5, 헤더/fragment 폐기).
 */
@Component
class OAuth2SuccessHandler(
    private val jwtTokenProvider: JwtTokenProvider,
    private val authTokenGenerator: AuthTokenGenerator,
    private val authTokenRepository: AuthTokenRepository,
    private val jwtProperties: JwtProperties,
    private val authCookieFactory: AuthCookieFactory,
    @Value("\${app.frontend.base-url}") private val frontendBaseUrl: String,
) : AuthenticationSuccessHandler {
    override fun onAuthenticationSuccess(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authentication: Authentication,
    ) {
        val oauth2User = authentication.principal as OAuth2User

        // Link flow — session 의 linkUserId 가 KakaoOAuth2UserService 통해 attributes 에 박혀있으면
        // token 발급 X, link-success redirect (FR-023, R3 결정).
        val linkUserId = oauth2User.attributes["linkUserId"] as? Long
        if (linkUserId != null) {
            request.getSession(false)?.removeAttribute(LinkKakaoStateRequest.SESSION_ATTRIBUTE_KEY)
            response.sendRedirect("$frontendBaseUrl/auth/link-success")
            return
        }

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

        response.addHeader(
            HttpHeaders.SET_COOKIE,
            authCookieFactory.accessTokenCookie(accessToken).toString(),
        )
        response.addHeader(
            HttpHeaders.SET_COOKIE,
            authCookieFactory.refreshTokenCookie(refreshPair.plaintext).toString(),
        )
        response.sendRedirect("$frontendBaseUrl/")
    }
}
