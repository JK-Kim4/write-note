package com.writenote.auth

import com.writenote.enums.AuthErrorCode
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
 * 모바일 캡처용 ApiToken 검증 필터.
 *
 * - URL: `POST /api/capture` 한정. 다른 경로는 pass-through.
 * - 토큰 형식: `Bearer wnt_*` (접두사 `wnt_`).
 * - 임시 — Week 4 진입 시 ApiTokenRepository 결선 + 실제 검증 로직 박음.
 *   본 spec 진입 시점: ApiToken 테이블 미존재 → 항상 401 + `AUTH_TOKEN_INVALID` 응답.
 *
 * TODO(#week4-api-token) Week 4: ApiTokenRepository 결선 + 실제 token lookup + SecurityContext 박음.
 *
 * 출처: docs/plan/03-backend-requirements.md §4-4, contracts/security-filter-chain.md §1.
 */
@Component
class ApiTokenAuthenticationFilter(
    private val objectMapper: ObjectMapper,
) : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        if (!isApiCaptureRequest(request)) {
            filterChain.doFilter(request, response)
            return
        }
        val header = request.getHeader("Authorization")
        if (header == null || !header.startsWith(BEARER_API_TOKEN_PREFIX)) {
            filterChain.doFilter(request, response)
            return
        }
        // 임시 — ApiToken 테이블 미존재 (Week 4 신설) → 항상 401
        response.status = HttpStatus.UNAUTHORIZED.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.characterEncoding = Charsets.UTF_8.name()
        val body =
            Result.failure(
                AuthErrorCode.AUTH_TOKEN_INVALID,
                "모바일 캡처 토큰은 Week 4 에서 활성화됩니다.",
            )
        response.writer.write(objectMapper.writeValueAsString(body))
    }

    private fun isApiCaptureRequest(request: HttpServletRequest): Boolean = request.method == "POST" && request.requestURI == "/api/capture"

    companion object {
        const val BEARER_API_TOKEN_PREFIX = "Bearer wnt_"
    }
}
