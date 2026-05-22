package com.writenote.service

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.auth.EmailVerificationRequestedEvent
import com.writenote.auth.JwtTokenProvider
import com.writenote.components.AuthTokenGenerator
import com.writenote.components.AuthTokenLifecycleManager
import com.writenote.components.PasswordPolicyValidator
import com.writenote.components.UserAuthConverter
import com.writenote.config.JwtProperties
import com.writenote.entity.AuthToken
import com.writenote.entity.User
import com.writenote.enums.AuthErrorCode
import com.writenote.enums.AuthTokenType
import com.writenote.error.AuthException
import com.writenote.model.request.LoginRequest
import com.writenote.model.request.RefreshTokenRequest
import com.writenote.model.request.SignupEmailRequest
import com.writenote.model.request.VerifyEmailRequest
import com.writenote.model.response.AuthMeResponse
import com.writenote.model.response.SignupEmailResponse
import com.writenote.model.response.TokenPairResponse
import com.writenote.repository.AuthTokenRepository
import com.writenote.repository.UserRepository
import org.springframework.context.ApplicationEventPublisher
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val authTokenRepository: AuthTokenRepository,
    private val passwordEncoder: PasswordEncoder,
    private val passwordPolicyValidator: PasswordPolicyValidator,
    private val authTokenGenerator: AuthTokenGenerator,
    private val authTokenLifecycleManager: AuthTokenLifecycleManager,
    private val jwtTokenProvider: JwtTokenProvider,
    private val userAuthConverter: UserAuthConverter,
    private val jwtProperties: JwtProperties,
    private val applicationEventPublisher: ApplicationEventPublisher,
) {
    /**
     * 이메일·비밀번호 회원가입.
     *
     * 1. 이메일 중복 검증
     * 2. 비밀번호 정책 검증
     * 3. User INSERT
     * 4. EMAIL_VERIFY 토큰 INSERT
     * 5. 이메일 발송 이벤트 발행 (AFTER_COMMIT)
     *
     * @Transactional 의무 — publishEvent 호출이 있으므로 AFTER_COMMIT 보장
     * (spring-patterns.md §"@Transactional + @TransactionalEventListener 계약").
     */
    @Transactional(rollbackFor = [Exception::class])
    fun signupEmail(request: SignupEmailRequest): SignupEmailResponse {
        if (userRepository.existsByEmail(request.email)) {
            throw AuthException(AuthErrorCode.EMAIL_ALREADY_REGISTERED)
        }
        passwordPolicyValidator.validate(request.password)
        val user =
            userRepository.save(
                User(
                    email = request.email,
                    passwordHash = passwordEncoder.encode(request.password),
                ),
            )
        val tokenPair = authTokenGenerator.generate()
        authTokenRepository.save(
            AuthToken(
                userId = requireNotNull(user.id),
                type = AuthTokenType.EMAIL_VERIFY,
                tokenHash = tokenPair.hash,
                expiresAt = Instant.now().plus(EMAIL_VERIFY_VALIDITY),
            ),
        )
        applicationEventPublisher.publishEvent(
            EmailVerificationRequestedEvent(
                userId = requireNotNull(user.id),
                email = user.email,
                plaintextToken = tokenPair.plaintext,
            ),
        )
        return SignupEmailResponse(
            userId = requireNotNull(user.id),
            email = user.email,
            emailVerifySent = true,
        )
    }

    /**
     * 이메일 인증 토큰 검증.
     *
     * 1. token hash 로 EMAIL_VERIFY row 조회
     * 2. 만료·재사용 검증 (assertUsable)
     * 3. User.emailVerifiedAt 갱신
     * 4. AuthToken.usedAt 갱신 (일회용 처리)
     */
    @Transactional(rollbackFor = [Exception::class])
    fun verifyEmail(request: VerifyEmailRequest) {
        val tokenHash = authTokenGenerator.hash(request.token)
        val authToken =
            authTokenRepository.findByTokenHashAndType(tokenHash, AuthTokenType.EMAIL_VERIFY)
                ?: throw AuthException(AuthErrorCode.AUTH_TOKEN_INVALID)
        authTokenLifecycleManager.assertUsable(authToken)
        val user =
            userRepository.findById(authToken.userId).orElseThrow {
                AuthException(AuthErrorCode.AUTH_TOKEN_INVALID)
            }
        user.emailVerifiedAt = Instant.now()
        authTokenLifecycleManager.markUsed(authToken)
        // dirty checking — 자동 UPDATE (트랜잭션 종료 시 flush)
    }

    /**
     * 이메일·비밀번호 로그인.
     *
     * 1. 비밀번호 검증 (findByEmailForUpdate — pessimistic lock, FR-038)
     * 2. 이메일 인증 여부 검증
     * 3. last_login_at / failed_login_count 갱신
     * 4. REFRESH 토큰 INSERT
     *
     * US4 영역 (failed_login_count += 1, lockout) 은 본 라운드 placeholder.
     * US4 진입 시 LoginAttemptService 결선 예정.
     */
    @Transactional(rollbackFor = [Exception::class])
    fun login(request: LoginRequest): TokenPairResponse {
        val user =
            userRepository.findByEmailForUpdate(request.email)
                ?: throw AuthException(AuthErrorCode.LOGIN_FAILED)
        val passwordHash =
            user.passwordHash
                ?: throw AuthException(AuthErrorCode.LOGIN_FAILED) // 카카오 단독 가입자 (비밀번호 미설정)
        if (!passwordEncoder.matches(request.password, passwordHash)) {
            // TODO(US4) failed_login_count += 1, 5회 도달 시 lockout 처리 — US4 LoginAttemptService 결선
            throw AuthException(AuthErrorCode.LOGIN_FAILED)
        }
        if (user.emailVerifiedAt == null) {
            throw AuthException(AuthErrorCode.EMAIL_NOT_VERIFIED)
        }
        user.lastLoginAt = Instant.now()
        user.failedLoginCount = 0 // 성공 시 카운트 초기화
        val accessToken =
            jwtTokenProvider.createAccessToken(
                userId = requireNotNull(user.id),
                email = user.email,
            )
        val refreshTokenPair = authTokenGenerator.generate()
        authTokenRepository.save(
            AuthToken(
                userId = requireNotNull(user.id),
                type = AuthTokenType.REFRESH,
                tokenHash = refreshTokenPair.hash,
                expiresAt = Instant.now().plusSeconds(jwtProperties.refreshTokenValiditySeconds),
            ),
        )
        return TokenPairResponse(
            accessToken = accessToken,
            refreshToken = refreshTokenPair.plaintext,
            accessTokenExpiresIn = jwtProperties.accessTokenValiditySeconds,
            refreshTokenExpiresIn = jwtProperties.refreshTokenValiditySeconds,
        )
    }

    /**
     * Access token 갱신.
     *
     * V1 = rotation 미적용 (research.md R-7). 기존 refresh token 그대로 반환.
     * token row 미존재 = AUTH_TOKEN_REVOKED (로그아웃으로 삭제됨).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun refresh(request: RefreshTokenRequest): TokenPairResponse {
        val tokenHash = authTokenGenerator.hash(request.refreshToken)
        val refreshToken =
            authTokenRepository.findByTokenHashAndType(tokenHash, AuthTokenType.REFRESH)
                ?: throw AuthException(AuthErrorCode.AUTH_TOKEN_REVOKED)
        authTokenLifecycleManager.assertUsable(refreshToken)
        val user =
            userRepository.findById(refreshToken.userId).orElseThrow {
                AuthException(AuthErrorCode.AUTH_TOKEN_INVALID)
            }
        val accessToken =
            jwtTokenProvider.createAccessToken(
                userId = requireNotNull(user.id),
                email = user.email,
            )
        return TokenPairResponse(
            accessToken = accessToken,
            refreshToken = request.refreshToken, // V1 = rotation 미적용, 기존 refresh 그대로 반환
            accessTokenExpiresIn = jwtProperties.accessTokenValiditySeconds,
            refreshTokenExpiresIn = jwtProperties.refreshTokenValiditySeconds,
        )
    }

    /**
     * 로그아웃 — REFRESH 토큰 row 삭제.
     *
     * 멱등성: token 미존재 시에도 success (contracts/auth-endpoints.md §9).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun logout(refreshToken: String) {
        val tokenHash = authTokenGenerator.hash(refreshToken)
        authTokenRepository.deleteByTokenHashAndType(tokenHash, AuthTokenType.REFRESH)
    }

    /**
     * 본인 정보 조회.
     *
     * JWT principal 의 userId 로 User 조회 후 AuthMeResponse 변환.
     * 읽기 전용 트랜잭션 (spring-patterns.md §readOnly).
     */
    @Transactional(readOnly = true)
    fun me(principal: AuthenticatedPrincipal): AuthMeResponse {
        val user =
            userRepository.findById(principal.userId).orElseThrow {
                AuthException(AuthErrorCode.AUTH_TOKEN_INVALID)
            }
        return userAuthConverter.toAuthMeResponse(user)
    }

    companion object {
        private val EMAIL_VERIFY_VALIDITY: Duration = Duration.ofHours(24)
    }
}
