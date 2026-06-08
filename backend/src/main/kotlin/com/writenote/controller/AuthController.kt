package com.writenote.controller

import com.writenote.auth.AuthCookieFactory
import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.enums.AuthErrorCode
import com.writenote.error.AuthException
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
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.http.HttpHeaders
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
@Tag(name = "인증", description = "회원가입 / 로그인 / JWT 갱신 / 카카오 OAuth / 비밀번호 재설정 / 계정 연결")
class AuthController(
    private val authService: AuthService,
    private val passwordResetService: PasswordResetService,
    private val accountLinkService: AccountLinkService,
    private val authCookieFactory: AuthCookieFactory,
) {
    @PostMapping("/signup/email")
    @Operation(summary = "이메일 회원가입", description = "이메일·비밀번호로 신규 계정 생성 + 이메일 인증 토큰 발송")
    fun signupEmail(
        @Valid @RequestBody request: SignupEmailRequest,
    ): ResponseEntity<Result<SignupEmailResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(authService.signupEmail(request)))

    @PostMapping("/verify-email")
    @Operation(summary = "이메일 인증", description = "발송된 토큰으로 emailVerifiedAt 박음 + 토큰 즉시 폐기")
    fun verifyEmail(
        @Valid @RequestBody request: VerifyEmailRequest,
    ): ResponseEntity<Result<Nothing?>> {
        authService.verifyEmail(request)
        return ResponseEntity.ok(Result.success<Nothing?>(null))
    }

    @PostMapping("/login")
    @Operation(summary = "이메일 로그인", description = "이메일·비밀번호 검증 + JWT access/refresh 발급. 5회 실패 시 30분 잠금.")
    fun login(
        @Valid @RequestBody request: LoginRequest,
    ): ResponseEntity<Result<TokenPairResponse>> = tokenPairResponse(authService.login(request))

    @PostMapping("/refresh")
    @Operation(
        summary = "토큰 갱신",
        description = "refresh token 으로 새 access/refresh 발급. 입력은 body(003 호환) 우선, 부재 시 refresh_token 쿠키(005 R-4)",
    )
    fun refresh(
        @RequestBody(required = false) request: RefreshTokenRequest?,
        httpRequest: HttpServletRequest,
    ): ResponseEntity<Result<TokenPairResponse>> =
        tokenPairResponse(
            authService.refresh(RefreshTokenRequest(resolveRefreshToken(request?.refreshToken, httpRequest))),
        )

    @PostMapping("/logout")
    @Operation(summary = "로그아웃", description = "전달된 refresh token 폐기 — 이후 사용 시 AUTH_TOKEN_REVOKED")
    @SecurityRequirement(name = "BearerJwt")
    fun logout(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @RequestBody(required = false) request: LogoutRequest?,
        httpRequest: HttpServletRequest,
    ): ResponseEntity<Result<Nothing?>> {
        authService.logout(resolveRefreshToken(request?.refreshToken, httpRequest))
        return ResponseEntity
            .ok()
            .header(HttpHeaders.SET_COOKIE, authCookieFactory.expiredAccessTokenCookie().toString())
            .header(HttpHeaders.SET_COOKIE, authCookieFactory.expiredRefreshTokenCookie().toString())
            .body(Result.success<Nothing?>(null))
    }

    @GetMapping("/me")
    @Operation(summary = "본인 정보 조회", description = "userId / email / kakaoLinked / emailVerifiedAt / activeApiTokenCount")
    @SecurityRequirement(name = "BearerJwt")
    fun me(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
    ): ResponseEntity<Result<AuthMeResponse>> = ResponseEntity.ok(Result.success(authService.me(principal)))

    @PostMapping("/password-reset/request")
    @Operation(
        summary = "비밀번호 재설정 요청",
        description = "이메일로 30분 만료 재설정 토큰 발송 — 미가입 이메일도 200 (정보 노출 회피)",
    )
    fun passwordResetRequest(
        @Valid @RequestBody request: PasswordResetRequestRequest,
    ): ResponseEntity<Result<Nothing?>> {
        passwordResetService.request(request)
        return ResponseEntity.ok(Result.success<Nothing?>(null))
    }

    @PostMapping("/password-reset/confirm")
    @Operation(summary = "비밀번호 재설정 확정", description = "토큰 + 새 비밀번호 → password_hash 갱신 + 모든 REFRESH 토큰 폐기")
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
    @Operation(
        summary = "카카오 추가 연결 시작",
        description = "본인 userId 를 session 박은 후 /api/auth/oauth/kakao 로 302 redirect",
    )
    @SecurityRequirement(name = "BearerJwt")
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
    @Operation(summary = "이메일·비밀번호 추가 등록", description = "카카오 가입 사용자가 비밀번호 추가 — 이미 박혀있으면 PASSWORD_ALREADY_SET")
    @SecurityRequirement(name = "BearerJwt")
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

    /**
     * refresh token 입력 source 결정 (refresh/logout 공용).
     *
     * body(`RefreshTokenRequest`/`LogoutRequest`, 003 호환) 우선, 부재 시 `refresh_token` 쿠키 read (005 R-4 reactive refresh).
     * frontend 는 httpOnly 쿠키라 JS 로 refresh token 을 읽을 수 없으므로 빈 body + 쿠키로 호출. 둘 다 부재 시 AUTH_TOKEN_MISSING.
     */
    private fun resolveRefreshToken(
        bodyToken: String?,
        httpRequest: HttpServletRequest,
    ): String =
        bodyToken?.takeIf { it.isNotBlank() }
            ?: httpRequest.cookies
                ?.firstOrNull { it.name == AuthCookieFactory.REFRESH_TOKEN_COOKIE }
                ?.value
                ?.takeIf { it.isNotBlank() }
            ?: throw AuthException(AuthErrorCode.AUTH_TOKEN_MISSING)

    /**
     * access/refresh 토큰을 httpOnly 쿠키로 내려주는 응답 빌더 (login/refresh 공용).
     *
     * body 의 [TokenPairResponse] 는 003 호환 위해 유지하되, frontend 는 쿠키에 의존 (005 R-4).
     */
    private fun tokenPairResponse(pair: TokenPairResponse): ResponseEntity<Result<TokenPairResponse>> =
        ResponseEntity
            .ok()
            .header(HttpHeaders.SET_COOKIE, authCookieFactory.accessTokenCookie(pair.accessToken).toString())
            .header(HttpHeaders.SET_COOKIE, authCookieFactory.refreshTokenCookie(pair.refreshToken).toString())
            .body(Result.success(pair))
}
