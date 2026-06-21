package com.writenote.config

import com.writenote.auth.AuthenticatedPrincipal
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.authorization.AuthorizationDecision
import org.springframework.security.authorization.AuthorizationManager
import org.springframework.security.core.Authentication
import org.springframework.security.web.access.intercept.RequestAuthorizationContext
import org.springframework.stereotype.Component
import java.util.function.Supplier

/**
 * 어드민 경로(/api/admin 하위) 단일 관리자 인가 — 인증된 [AuthenticatedPrincipal.email] 이
 * 설정값 app.admin.email(env ADMIN_EMAIL)과 일치할 때만 허용.
 *
 * role 컬럼 미도입(솔로 운영). 비인증은 Security 가 401(authenticationEntryPoint),
 * 인증됐으나 비관리자는 403(AccessDenied)으로 분기된다.
 * 설정값이 빈 문자열이면 누구도 통과 못 함(안전 기본값).
 */
@Component
class AdminAuthorizationManager(
    @param:Value("\${app.admin.email:}") private val adminEmail: String,
) : AuthorizationManager<RequestAuthorizationContext> {
    override fun authorize(
        authentication: Supplier<out Authentication?>,
        `object`: RequestAuthorizationContext,
    ): AuthorizationDecision {
        val email = (authentication.get()?.principal as? AuthenticatedPrincipal)?.email
        val granted = adminEmail.isNotBlank() && email == adminEmail
        return AuthorizationDecision(granted)
    }
}
