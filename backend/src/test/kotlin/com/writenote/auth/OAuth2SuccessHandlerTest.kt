package com.writenote.auth

import com.writenote.components.AuthTokenGenerator
import com.writenote.config.JwtProperties
import com.writenote.entity.AuthToken
import com.writenote.enums.AuthTokenType
import com.writenote.repository.AuthTokenRepository
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.http.HttpHeaders
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.core.user.OAuth2User

class OAuth2SuccessHandlerTest {
    private val jwtTokenProvider = mockk<JwtTokenProvider>()
    private val authTokenGenerator = mockk<AuthTokenGenerator>()
    private val authTokenRepository = mockk<AuthTokenRepository>(relaxed = true)
    private val jwtProperties =
        JwtProperties(
            secret = "test-secret-must-be-32-bytes-or-more-padding",
            accessTokenValiditySeconds = 3600L,
            refreshTokenValiditySeconds = 2592000L,
        )
    private val authCookieFactory = AuthCookieFactory(jwtProperties, secure = false)
    private val handler =
        OAuth2SuccessHandler(
            jwtTokenProvider = jwtTokenProvider,
            authTokenGenerator = authTokenGenerator,
            authTokenRepository = authTokenRepository,
            jwtProperties = jwtProperties,
            authCookieFactory = authCookieFactory,
            frontendBaseUrl = "http://localhost:3000",
        )

    @Test
    fun `OAuth 성공 시 JWT 발급 + REFRESH AuthToken INSERT + 세션 쿠키 발급 + entering redirect`() {
        val oauth2User =
            mockk<OAuth2User>().also {
                every { it.attributes } returns
                    mapOf(
                        "userId" to 42L,
                        "id" to 123L,
                        "kakao_account" to mapOf("email" to "user@example.com"),
                    )
            }
        val authentication =
            mockk<Authentication>().also {
                every { it.principal } returns oauth2User
            }
        val request = mockk<HttpServletRequest>()
        val response = mockk<HttpServletResponse>(relaxed = true)

        every {
            jwtTokenProvider.createAccessToken(userId = eq(42L), email = eq("user@example.com"), now = any())
        } returns "fake.jwt.access"
        every { authTokenGenerator.generate() } returns
            AuthTokenGenerator.TokenPair(plaintext = "plain-refresh-token", hash = "sha256-hex")

        val savedToken = slot<AuthToken>()
        every { authTokenRepository.save(capture(savedToken)) } answers { savedToken.captured }
        val cookieHeaders = mutableListOf<String>()
        every { response.addHeader(eq(HttpHeaders.SET_COOKIE), capture(cookieHeaders)) } returns Unit
        val redirectedUrl = slot<String>()
        every { response.sendRedirect(capture(redirectedUrl)) } returns Unit

        handler.onAuthenticationSuccess(request, response, authentication)

        // AuthToken INSERT 검증
        assertThat(savedToken.captured.userId).isEqualTo(42L)
        assertThat(savedToken.captured.type).isEqualTo(AuthTokenType.REFRESH)
        assertThat(savedToken.captured.tokenHash).isEqualTo("sha256-hex")
        assertThat(savedToken.captured.expiresAt).isAfter(java.time.Instant.now())

        // 세션 쿠키 발급 검증 (URL fragment → Set-Cookie 전환)
        assertThat(cookieHeaders).anyMatch {
            it.startsWith("access_token=fake.jwt.access") && it.contains("HttpOnly")
        }
        assertThat(cookieHeaders).anyMatch {
            it.startsWith("refresh_token=plain-refresh-token") && it.contains("SameSite=Lax")
        }

        // fragment 없는 /entering redirect (로그인 중 트랜지션 → 홈)
        assertThat(redirectedUrl.captured).isEqualTo("http://localhost:3000/entering")

        verify(exactly = 1) { authTokenRepository.save(any<AuthToken>()) }
        verify(exactly = 1) { response.sendRedirect(any()) }
    }
}
