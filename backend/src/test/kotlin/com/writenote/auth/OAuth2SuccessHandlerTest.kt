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
    private val handler =
        OAuth2SuccessHandler(
            jwtTokenProvider = jwtTokenProvider,
            authTokenGenerator = authTokenGenerator,
            authTokenRepository = authTokenRepository,
            jwtProperties = jwtProperties,
            frontendBaseUrl = "http://localhost:3000",
        )

    @Test
    fun `OAuth 성공 시 JWT 발급 + REFRESH AuthToken INSERT + URL fragment redirect`() {
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
        val redirectedUrl = slot<String>()
        every { response.sendRedirect(capture(redirectedUrl)) } returns Unit

        handler.onAuthenticationSuccess(request, response, authentication)

        // AuthToken INSERT 검증
        assertThat(savedToken.captured.userId).isEqualTo(42L)
        assertThat(savedToken.captured.type).isEqualTo(AuthTokenType.REFRESH)
        assertThat(savedToken.captured.tokenHash).isEqualTo("sha256-hex")
        assertThat(savedToken.captured.expiresAt).isAfter(java.time.Instant.now())

        // redirect URL fragment 정합
        assertThat(redirectedUrl.captured)
            .startsWith("http://localhost:3000/auth/success#")
            .contains("access=fake.jwt.access")
            .contains("refresh=plain-refresh-token")
            .contains("accessExpiresIn=3600")
            .contains("refreshExpiresIn=2592000")

        verify(exactly = 1) { authTokenRepository.save(any<AuthToken>()) }
        verify(exactly = 1) { response.sendRedirect(any()) }
    }
}
