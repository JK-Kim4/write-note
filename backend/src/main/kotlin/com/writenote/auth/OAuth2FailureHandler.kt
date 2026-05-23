package com.writenote.auth

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.core.AuthenticationException
import org.springframework.security.oauth2.core.OAuth2AuthenticationException
import org.springframework.security.web.authentication.AuthenticationFailureHandler
import org.springframework.stereotype.Component

/**
 * 카카오 OAuth2 인증 실패 시 프론트 에러 페이지로 redirect.
 *
 * - [KakaoOAuth2UserService] 가 throw 한 `KAKAO_EMAIL_ALREADY_REGISTERED` → 같은 code 로 redirect (FR-022)
 * - 그 외 OAuth 표준 실패 → `OAUTH_FAILED` (contracts/auth-endpoints.md §5)
 */
@Component
class OAuth2FailureHandler(
    @Value("\${app.frontend.base-url}") private val frontendBaseUrl: String,
) : AuthenticationFailureHandler {
    override fun onAuthenticationFailure(
        request: HttpServletRequest,
        response: HttpServletResponse,
        exception: AuthenticationException,
    ) {
        val code =
            if (exception is OAuth2AuthenticationException && exception.error.errorCode.isNotEmpty()) {
                exception.error.errorCode
            } else {
                "OAUTH_FAILED"
            }
        response.sendRedirect("$frontendBaseUrl/auth/login-error?code=$code")
    }
}
