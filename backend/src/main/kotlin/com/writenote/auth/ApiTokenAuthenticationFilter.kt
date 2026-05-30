package com.writenote.auth

import com.writenote.components.ApiTokenHasher
import com.writenote.enums.AuthErrorCode
import com.writenote.model.response.Result
import com.writenote.repository.ApiTokenRepository
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import tools.jackson.databind.ObjectMapper
import java.time.Instant

/**
 * 모바일 캡처용 ApiToken 검증 필터.
 *
 * - URL: `POST /api/capture` 한정. 다른 경로는 pass-through.
 * - 토큰 형식: `Bearer wnt_*` (접두사 `wnt_`). `/api/capture` 는 ApiToken 전용이라 형식 누락/불일치 시 401.
 * - 성공: SHA-256 hash → DB 조회 → revoked_at IS NULL 검증 → SecurityContext 에 userId 박음
 *         + last_used_at 갱신.
 * - 실패: 401 `AUTH_TOKEN_REVOKED` (해지) / `AUTH_TOKEN_INVALID` (미존재·형식오류).
 *
 * 출처: docs/plan/03-backend-requirements.md §4-4, contracts/security-filter-chain.md §1.
 */
@Component
class ApiTokenAuthenticationFilter(
    private val objectMapper: ObjectMapper,
    private val apiTokenRepository: ApiTokenRepository,
    private val apiTokenHasher: ApiTokenHasher,
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
            // wnt_ 접두사 없음 → 형식 오류 → 401
            writeError(response, AuthErrorCode.AUTH_TOKEN_INVALID, "토큰 형식이 올바르지 않습니다.")
            return
        }

        val plainToken = header.substring(BEARER_PREFIX_LENGTH)
        val tokenHash = apiTokenHasher.hash(plainToken)
        val apiToken = apiTokenRepository.findByTokenHash(tokenHash)

        if (apiToken == null) {
            writeError(response, AuthErrorCode.AUTH_TOKEN_INVALID, AuthErrorCode.AUTH_TOKEN_INVALID.defaultMessage)
            return
        }
        if (apiToken.revokedAt != null) {
            writeError(response, AuthErrorCode.AUTH_TOKEN_REVOKED, AuthErrorCode.AUTH_TOKEN_REVOKED.defaultMessage)
            return
        }

        // 인증 성공 — SecurityContext 에 userId 박음
        val principal = AuthenticatedPrincipal(userId = apiToken.userId, email = "")
        val authentication =
            UsernamePasswordAuthenticationToken(
                principal,
                null,
                listOf(SimpleGrantedAuthority("ROLE_USER")),
            )
        SecurityContextHolder.getContext().authentication = authentication

        // last_used_at 갱신
        apiToken.lastUsedAt = Instant.now()
        apiTokenRepository.save(apiToken)

        filterChain.doFilter(request, response)
    }

    private fun writeError(
        response: HttpServletResponse,
        code: AuthErrorCode,
        message: String,
    ) {
        response.status = HttpStatus.UNAUTHORIZED.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.characterEncoding = Charsets.UTF_8.name()
        response.writer.write(objectMapper.writeValueAsString(Result.failure(code, message)))
    }

    private fun isApiCaptureRequest(request: HttpServletRequest): Boolean = request.method == "POST" && request.requestURI == "/api/capture"

    companion object {
        const val BEARER_API_TOKEN_PREFIX = "Bearer wnt_"
        private const val BEARER_PREFIX_LENGTH = 7 // "Bearer " 길이
    }
}
