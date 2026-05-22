package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.LoginRequest
import com.writenote.model.request.LogoutRequest
import com.writenote.model.request.RefreshTokenRequest
import com.writenote.model.request.SignupEmailRequest
import com.writenote.model.request.VerifyEmailRequest
import com.writenote.model.response.AuthMeResponse
import com.writenote.model.response.Result
import com.writenote.model.response.SignupEmailResponse
import com.writenote.model.response.TokenPairResponse
import com.writenote.service.AuthService
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
}
