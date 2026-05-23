package com.writenote.auth

/**
 * JWT access token 검증 후 SecurityContext 에 박히는 인증된 주체.
 *
 * JwtAuthenticationFilter 가 [com.writenote.auth.JwtTokenProvider.parseAccessToken] 결과로 생성.
 * `@AuthenticationPrincipal` 로 Controller 파라미터에 주입.
 *
 * 출처: contracts/security-filter-chain.md §5.
 */
data class AuthenticatedPrincipal(
    val userId: Long,
    val email: String,
)
