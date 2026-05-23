package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.LinkEmailRequest
import com.writenote.model.request.LinkKakaoStateRequest
import com.writenote.model.request.LoginRequest
import com.writenote.model.request.LogoutRequest
import com.writenote.model.request.PasswordResetConfirmRequest
import com.writenote.model.request.PasswordResetRequestRequest
import com.writenote.model.request.RefreshTokenRequest
import com.writenote.model.request.SignupEmailRequest
import com.writenote.model.request.VerifyEmailRequest
import com.writenote.model.response.AuthMeResponse
import com.writenote.model.response.LinkEmailResponse
import com.writenote.model.response.Result
import com.writenote.model.response.SignupEmailResponse
import com.writenote.model.response.TokenPairResponse
import com.writenote.service.AccountLinkService
import com.writenote.service.AuthService
import com.writenote.service.PasswordResetService
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService,
    private val passwordResetService: PasswordResetService,
    private val accountLinkService: AccountLinkService,
) {
    @PostMapping("/signup/email")
    fun signupEmail(
        @Valid @RequestBody request: SignupEmailRequest,
    ): ResponseEntity<Result<SignupEmailResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(authService.signupEmail(request)))

    @PostMapping("/verify-email")
    fun verifyEmail(
        @Valid @RequestBody request: VerifyEmailRequest,
    ): ResponseEntity<Result<Nothing?>> {
        authService.verifyEmail(request)
        return ResponseEntity.ok(Result.success<Nothing?>(null))
    }

    @PostMapping("/login")
    fun login(
        @Valid @RequestBody request: LoginRequest,
    ): ResponseEntity<Result<TokenPairResponse>> = ResponseEntity.ok(Result.success(authService.login(request)))

    @PostMapping("/refresh")
    fun refresh(
        @Valid @RequestBody request: RefreshTokenRequest,
    ): ResponseEntity<Result<TokenPairResponse>> = ResponseEntity.ok(Result.success(authService.refresh(request)))

    @PostMapping("/logout")
    fun logout(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @Valid @RequestBody request: LogoutRequest,
    ): ResponseEntity<Result<Nothing?>> {
        authService.logout(request.refreshToken)
        return ResponseEntity.ok(Result.success<Nothing?>(null))
    }

    @GetMapping("/me")
    fun me(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
    ): ResponseEntity<Result<AuthMeResponse>> = ResponseEntity.ok(Result.success(authService.me(principal)))

    @PostMapping("/password-reset/request")
    fun passwordResetRequest(
        @Valid @RequestBody request: PasswordResetRequestRequest,
    ): ResponseEntity<Result<Nothing?>> {
        passwordResetService.request(request)
        return ResponseEntity.ok(Result.success<Nothing?>(null))
    }

    @PostMapping("/password-reset/confirm")
    fun passwordResetConfirm(
        @Valid @RequestBody request: PasswordResetConfirmRequest,
    ): ResponseEntity<Result<Nothing?>> {
        passwordResetService.confirm(request)
        return ResponseEntity.ok(Result.success<Nothing?>(null))
    }

    /**
     * 카카오 추가 연결 시작 (FR-023, contracts/auth-endpoints.md §11).
     *
     * 본인 user id 를 session 에 박은 후 Spring Security 의 OAuth flow 진입 endpoint
     * `/api/auth/oauth/kakao` 로 302 redirect. 콜백 시 KakaoOAuth2UserService 가 session 분기.
     */
    @PostMapping("/link/kakao")
    fun linkKakaoStart(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        httpRequest: HttpServletRequest,
    ): ResponseEntity<Void> {
        httpRequest
            .getSession(true)
            .setAttribute(
                LinkKakaoStateRequest.SESSION_ATTRIBUTE_KEY,
                LinkKakaoStateRequest(linkUserId = principal.userId),
            )
        return ResponseEntity.status(HttpStatus.FOUND).header("Location", "/api/auth/oauth/kakao").build()
    }

    /**
     * 카카오 가입 사용자의 이메일·비밀번호 추가 등록 (FR-024, contracts/auth-endpoints.md §12).
     */
    @PostMapping("/link/email")
    fun linkEmail(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @Valid @RequestBody request: LinkEmailRequest,
    ): ResponseEntity<Result<LinkEmailResponse>> {
        val user = accountLinkService.linkEmail(principal.userId, request.password)
        return ResponseEntity.ok(
            Result.success(
                LinkEmailResponse(
                    userId = requireNotNull(user.id),
                    email = user.email,
                    passwordSet = true,
                ),
            ),
        )
    }
}
