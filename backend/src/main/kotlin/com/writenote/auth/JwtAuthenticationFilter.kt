package com.writenote.auth

import com.writenote.error.AuthException
import com.writenote.model.response.Result
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

/**
 * JWT access token 검증 필터.
 *
 * - Authorization 헤더가 `Bearer eyJ` 접두사일 때만 검증, 그 외 pass-through.
 * - 검증 성공 시 SecurityContext 에 [AuthenticatedPrincipal] 박음.
 * - 검증 실패 시 직접 401 응답 (AuthErrorEntryPoint 미거침).
 *
 * 출처: contracts/security-filter-chain.md §1 + §3.
 */
@Component
class JwtAuthenticationFilter(
    private val jwtTokenProvider: JwtTokenProvider,
    private val objectMapper: ObjectMapper,
) : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val header = request.getHeader(AUTHORIZATION_HEADER)
        if (header == null || !header.startsWith(BEARER_JWT_PREFIX)) {
            filterChain.doFilter(request, response)
            return
        }
        val token = header.substring(BEARER_PREFIX_LENGTH)
        try {
            val principal = jwtTokenProvider.parseAccessToken(token)
            val authentication =
                UsernamePasswordAuthenticationToken(
                    principal,
                    null,
                    listOf(SimpleGrantedAuthority("ROLE_USER")),
                )
            SecurityContextHolder.getContext().authentication = authentication
            filterChain.doFilter(request, response)
        } catch (ex: AuthException) {
            SecurityContextHolder.clearContext()
            writeErrorResponse(response, ex)
        }
    }

    private fun writeErrorResponse(
        response: HttpServletResponse,
        ex: AuthException,
    ) {
        response.status = HttpStatus.UNAUTHORIZED.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.characterEncoding = Charsets.UTF_8.name()
        val body = Result.failure(ex.errorCode, ex.errorCode.defaultMessage)
        response.writer.write(objectMapper.writeValueAsString(body))
    }

    companion object {
        const val BEARER_JWT_PREFIX = "Bearer eyJ"
        private const val BEARER_PREFIX_LENGTH = 7
        private const val AUTHORIZATION_HEADER = "Authorization"
    }
}
