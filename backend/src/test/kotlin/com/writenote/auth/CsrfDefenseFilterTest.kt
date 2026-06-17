package com.writenote.auth

import jakarta.servlet.http.Cookie
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockFilterChain
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule

/**
 * CSRF 심층방어 필터 단위 테스트.
 *
 * 검사 조건: 상태변경 메서드 + 비-Bearer + 인증 쿠키 보유 → 커스텀 헤더 필수.
 */
class CsrfDefenseFilterTest {
    private val filter = CsrfDefenseFilter(JsonMapper.builder().addModule(kotlinModule()).build())

    private fun accessCookie() = Cookie(AuthCookieFactory.ACCESS_TOKEN_COOKIE, "header.payload.sig")

    @Test
    @DisplayName("쿠키 인증 상태변경 요청에 CSRF 헤더 없으면 403 + 체인 차단")
    fun `blocks cookie-authenticated mutation without csrf header`() {
        val request = MockHttpServletRequest("POST", "/api/projects")
        request.setCookies(accessCookie())
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(response.status).isEqualTo(403)
        assertThat(chain.request).isNull() // 체인 미진행
    }

    @Test
    @DisplayName("쿠키 인증 상태변경 요청에 CSRF 헤더 있으면 통과")
    fun `allows cookie-authenticated mutation with csrf header`() {
        val request = MockHttpServletRequest("POST", "/api/projects")
        request.setCookies(accessCookie())
        request.addHeader(CsrfDefenseFilter.CSRF_HEADER, "web")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(response.status).isNotEqualTo(403)
        assertThat(chain.request).isNotNull() // 체인 진행
    }

    @Test
    @DisplayName("Bearer 헤더 인증은 CSRF 비대상 — 헤더 없어도 통과")
    fun `skips check for bearer-authenticated request`() {
        val request = MockHttpServletRequest("POST", "/api/capture")
        request.addHeader("Authorization", "Bearer wnt_sometoken")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(chain.request).isNotNull()
    }

    @Test
    @DisplayName("안전 메서드(GET)는 쿠키 있어도 통과")
    fun `skips check for safe method`() {
        val request = MockHttpServletRequest("GET", "/api/projects")
        request.setCookies(accessCookie())
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(chain.request).isNotNull()
    }

    @Test
    @DisplayName("인증 쿠키 없는 요청(로그인 등)은 헤더 없어도 통과")
    fun `skips check when no auth cookie present`() {
        val request = MockHttpServletRequest("POST", "/api/auth/login")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(chain.request).isNotNull()
    }
}
