package com.writenote.auth

import com.writenote.error.ErrorCode
import com.writenote.model.response.Result
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import tools.jackson.databind.ObjectMapper

/**
 * CSRF 심층방어 필터 (SameSite=Lax 단일 의존 보강).
 *
 * 쿠키 기반 인증은 브라우저가 쿠키를 자동 동봉하므로 cross-site 위조 요청에 노출된다.
 * SameSite=Lax 가 1차 방어이나, 본 필터가 커스텀 헤더 요구로 2차 방어를 더한다 —
 * cross-site form-POST 는 커스텀 요청 헤더를 설정할 수 없기 때문.
 *
 * **검사 대상** (모두 충족 시 [CSRF_HEADER] 필수, 없으면 403):
 * - 상태 변경 메서드 (POST/PUT/PATCH/DELETE)
 * - Authorization Bearer 헤더가 **아님** (헤더 기반 인증은 cross-site 에서 설정 불가 → CSRF 비대상)
 * - 인증 쿠키([AuthCookieFactory.ACCESS_TOKEN_COOKIE]) 보유 (= 쿠키 기반 세션)
 *
 * 위 조건을 벗어나면 (안전 메서드 / Bearer 인증 / 비로그인) pass-through.
 */
@Component
class CsrfDefenseFilter(
    private val objectMapper: ObjectMapper,
) : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        if (requiresCsrfHeader(request) && !hasCsrfHeader(request)) {
            writeForbidden(response)
            return
        }
        filterChain.doFilter(request, response)
    }

    private fun requiresCsrfHeader(request: HttpServletRequest): Boolean {
        if (request.method !in UNSAFE_METHODS) return false
        // Bearer 헤더 인증은 cross-site 에서 설정 불가 → CSRF 비대상
        val authorization = request.getHeader(AUTHORIZATION_HEADER)
        if (authorization != null && authorization.startsWith(BEARER_PREFIX)) return false
        // 인증 쿠키 보유 시에만 검사 (쿠키 기반 세션 = CSRF 표적)
        return request.cookies
            ?.any { it.name == AuthCookieFactory.ACCESS_TOKEN_COOKIE && it.value.isNotBlank() } == true
    }

    private fun hasCsrfHeader(request: HttpServletRequest): Boolean = !request.getHeader(CSRF_HEADER).isNullOrBlank()

    private fun writeForbidden(response: HttpServletResponse) {
        response.status = HttpStatus.FORBIDDEN.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.characterEncoding = Charsets.UTF_8.name()
        val body = Result.failure(ErrorCode.FORBIDDEN, "요청 위조 방지 헤더가 필요합니다.")
        response.writer.write(objectMapper.writeValueAsString(body))
    }

    companion object {
        const val CSRF_HEADER = "X-WriteNote-Client"
        private const val AUTHORIZATION_HEADER = "Authorization"
        private const val BEARER_PREFIX = "Bearer "
        private val UNSAFE_METHODS = setOf("POST", "PUT", "PATCH", "DELETE")
    }
}
