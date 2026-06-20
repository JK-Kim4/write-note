package com.writenote.service

import com.writenote.auth.PasswordResetRequestedEvent
import com.writenote.components.AuthTokenGenerator
import com.writenote.components.AuthTokenLifecycleManager
import com.writenote.components.PasswordPolicyValidator
import com.writenote.entity.AuthToken
import com.writenote.enums.AuthErrorCode
import com.writenote.enums.AuthTokenType
import com.writenote.error.AuthException
import com.writenote.model.request.PasswordResetConfirmRequest
import com.writenote.model.request.PasswordResetRequestRequest
import com.writenote.repository.AuthTokenRepository
import com.writenote.repository.UserRepository
import org.springframework.context.ApplicationEventPublisher
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant

@Service
class PasswordResetService(
    private val userRepository: UserRepository,
    private val authTokenRepository: AuthTokenRepository,
    private val passwordEncoder: PasswordEncoder,
    private val passwordPolicyValidator: PasswordPolicyValidator,
    private val authTokenGenerator: AuthTokenGenerator,
    private val authTokenLifecycleManager: AuthTokenLifecycleManager,
    private val applicationEventPublisher: ApplicationEventPublisher,
) {
    /**
     * 비밀번호 재설정 요청.
     *
     * - 가입 미존재 이메일도 success (계정 존재 여부 노출 회피, contracts/auth-endpoints.md §6).
     * - 30분 만료 PASSWORD_RESET 토큰 INSERT + AFTER_COMMIT 이벤트 발행.
     *
     * @Transactional 의무 — publishEvent 호출이 있으므로 AFTER_COMMIT 보장
     * (spring-patterns.md §"@Transactional + @TransactionalEventListener 계약").
     */
    @Transactional(rollbackFor = [Exception::class])
    fun request(request: PasswordResetRequestRequest) {
        val user = userRepository.findByEmail(request.email) ?: return
        val tokenPair = authTokenGenerator.generate()
        authTokenRepository.save(
            AuthToken(
                userId = requireNotNull(user.id),
                type = AuthTokenType.PASSWORD_RESET,
                tokenHash = tokenPair.hash,
                expiresAt = Instant.now().plus(PASSWORD_RESET_VALIDITY),
            ),
        )
        applicationEventPublisher.publishEvent(
            PasswordResetRequestedEvent(
                userId = requireNotNull(user.id),
                email = user.email,
                plaintextToken = tokenPair.plaintext,
            ),
        )
    }

    /**
     * 비밀번호 재설정 확정.
     *
     * 1. 토큰 검증 (AUTH_TOKEN_INVALID / EXPIRED / ALREADY_USED) — 무효 토큰이면 비밀번호 노출 회피
     * 2. 비밀번호 정책 검증 (PASSWORD_TOO_WEAK)
     * 3. User.passwordHash 갱신 + 미인증 계정이면 emailVerifiedAt 설정 + AuthToken.usedAt 박음 (dirty checking)
     * 4. 사용자의 모든 REFRESH 토큰 row 삭제 — 비밀번호 변경 시 모든 세션 무효
     *    (contracts/auth-endpoints.md §7)
     */
    @Transactional(rollbackFor = [Exception::class])
    fun confirm(request: PasswordResetConfirmRequest) {
        val tokenHash = authTokenGenerator.hash(request.token)
        val authToken =
            authTokenRepository.findByTokenHashAndType(tokenHash, AuthTokenType.PASSWORD_RESET)
                ?: throw AuthException(AuthErrorCode.AUTH_TOKEN_INVALID)
        authTokenLifecycleManager.assertUsable(authToken)
        passwordPolicyValidator.validate(request.newPassword)
        val user =
            userRepository.findById(authToken.userId).orElseThrow {
                AuthException(AuthErrorCode.AUTH_TOKEN_INVALID)
            }
        user.passwordHash = passwordEncoder.encode(request.newPassword)
        // 재설정 링크 클릭 = 이메일 소유 증명 → 미인증 계정은 함께 인증 처리 (인증 메일 미수신 사용자 자가 복구)
        if (user.emailVerifiedAt == null) {
            user.emailVerifiedAt = Instant.now()
        }
        authTokenLifecycleManager.markUsed(authToken)
        authTokenRepository.deleteByUserIdAndType(requireNotNull(user.id), AuthTokenType.REFRESH)
    }

    companion object {
        private val PASSWORD_RESET_VALIDITY: Duration = Duration.ofMinutes(30)
    }
}
