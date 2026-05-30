package com.writenote.auth

import jakarta.servlet.http.Cookie
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockFilterChain
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule

class JwtAuthenticationFilterTest {
    private val objectMapper = JsonMapper.builder().addModule(kotlinModule()).build()
    private val provider = JwtTokenProvider(ByteArray(KEY_SIZE) { 1 }, ACCESS_VALIDITY)
    private val filter = JwtAuthenticationFilter(provider, objectMapper)

    @BeforeEach
    fun clearContext() {
        SecurityContextHolder.clearContext()
    }

    @Test
    @DisplayName("Authorization 헤더의 Bearer 토큰으로 인증 컨텍스트를 박는다 (003 회귀)")
    fun `authenticates via Authorization header`() {
        val token = provider.createAccessToken(userId = 42, email = "u@e.com")
        val request = MockHttpServletRequest()
        request.addHeader("Authorization", "Bearer $token")

        filter.doFilter(request, MockHttpServletResponse(), MockFilterChain())

        val principal =
            SecurityContextHolder.getContext().authentication?.principal as? AuthenticatedPrincipal
        assertThat(principal?.userId).isEqualTo(42L)
    }

    @Test
    @DisplayName("헤더 부재 시 access_token 쿠키로 인증한다")
    fun `authenticates via cookie when header absent`() {
        val token = provider.createAccessToken(userId = 7, email = "c@e.com")
        val request = MockHttpServletRequest()
        request.setCookies(Cookie(AuthCookieFactory.ACCESS_TOKEN_COOKIE, token))

        filter.doFilter(request, MockHttpServletResponse(), MockFilterChain())

        val principal =
            SecurityContextHolder.getContext().authentication?.principal as? AuthenticatedPrincipal
        assertThat(principal?.userId).isEqualTo(7L)
    }

    @Test
    @DisplayName("헤더와 쿠키가 둘 다 있으면 헤더를 우선한다")
    fun `header takes precedence over cookie`() {
        val headerToken = provider.createAccessToken(userId = 1, email = "h@e.com")
        val cookieToken = provider.createAccessToken(userId = 2, email = "c@e.com")
        val request = MockHttpServletRequest()
        request.addHeader("Authorization", "Bearer $headerToken")
        request.setCookies(Cookie(AuthCookieFactory.ACCESS_TOKEN_COOKIE, cookieToken))

        filter.doFilter(request, MockHttpServletResponse(), MockFilterChain())

        val principal =
            SecurityContextHolder.getContext().authentication?.principal as? AuthenticatedPrincipal
        assertThat(principal?.userId).isEqualTo(1L)
    }

    @Test
    @DisplayName("토큰이 전혀 없으면 인증 없이 통과한다")
    fun `passes through without token`() {
        val chain = MockFilterChain()

        filter.doFilter(MockHttpServletRequest(), MockHttpServletResponse(), chain)

        assertThat(SecurityContextHolder.getContext().authentication).isNull()
        assertThat(chain.request).isNotNull()
    }

    @Test
    @DisplayName("무효 토큰은 401 응답 + 컨텍스트 비움")
    fun `invalid token yields 401`() {
        val request = MockHttpServletRequest()
        request.addHeader("Authorization", "Bearer eyJ-invalid-token")
        val response = MockHttpServletResponse()

        filter.doFilter(request, response, MockFilterChain())

        assertThat(response.status).isEqualTo(401)
        assertThat(SecurityContextHolder.getContext().authentication).isNull()
    }

    companion object {
        private const val KEY_SIZE = 32
        private const val ACCESS_VALIDITY = 3600L
    }
}
