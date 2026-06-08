package com.writenote.auth

import com.writenote.enums.AuthErrorCode
import com.writenote.model.request.LoginRequest
import com.writenote.model.response.Result
import com.writenote.service.LoginAttemptService
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import tools.jackson.databind.ObjectMapper

/**
 * 로그인 잠금 검증 필터 (FR-013, FR-015).
 *
 * - URL = POST /api/auth/login 한정 (shouldNotFilter 로 다른 요청 skip)
 * - Request body 의 email 추출 → LoginAttemptService.isLocked() 검증
 * - 잠금 시 401 LOGIN_LOCKED + envelope 직접 응답 (Spring Security flow 외)
 * - 통과 시 ContentCachingRequestWrapper 박음 → controller 가 body 재읽기 가능
 *
 * 출처: contracts/security-filter-chain.md §1 + §3.
 */
@Component
class LoginAttemptFilter(
    private val loginAttemptService: LoginAttemptService,
    private val objectMapper: ObjectMapper,
) : OncePerRequestFilter() {
    override fun shouldNotFilter(request: HttpServletRequest): Boolean = !(request.method == "POST" && request.requestURI == LOGIN_PATH)

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val cachedRequest = CachedBodyHttpServletRequest(request)
        val email = extractEmail(cachedRequest.bodyBytes)
        if (email != null && loginAttemptService.isLocked(email)) {
            writeLockedResponse(response)
            return
        }
        filterChain.doFilter(cachedRequest, response)
    }

    private fun extractEmail(bodyBytes: ByteArray): String? =
        try {
            val email = objectMapper.readValue(bodyBytes, LoginRequest::class.java).email
            email.ifBlank { null }
        } catch (e: Exception) {
            null
        }

    private fun writeLockedResponse(response: HttpServletResponse) {
        response.status = HttpStatus.UNAUTHORIZED.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.characterEncoding = Charsets.UTF_8.name()
        val body =
            Result.failure(
                AuthErrorCode.LOGIN_LOCKED,
                AuthErrorCode.LOGIN_LOCKED.defaultMessage,
            )
        response.writer.write(objectMapper.writeValueAsString(body))
    }

    companion object {
        private const val LOGIN_PATH = "/api/auth/login"
    }
}
