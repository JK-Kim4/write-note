package com.writenote.service

import com.writenote.components.KakaoConflictChecker
import com.writenote.components.KakaoLinkDecision
import com.writenote.components.PasswordPolicyValidator
import com.writenote.entity.User
import com.writenote.enums.AuthErrorCode
import com.writenote.error.AuthException
import com.writenote.repository.UserRepository
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 이메일 ↔ 카카오 추가 연결 서비스 (US5).
 *
 * - [linkEmail]: 카카오 가입 사용자가 비밀번호 추가 등록 (FR-024)
 * - [linkKakao]: 이메일 가입 사용자가 카카오 추가 연결 (FR-023, FR-025).
 *   KakaoOAuth2UserService 가 콜백 시점에 호출 (research.md R-3 link flow).
 */
@Service
class AccountLinkService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val passwordPolicyValidator: PasswordPolicyValidator,
    private val conflictChecker: KakaoConflictChecker,
) {
    /**
     * 카카오 가입 사용자 → 이메일·비밀번호 추가 등록.
     *
     * 1. 비밀번호 정책 검증 (PASSWORD_TOO_WEAK)
     * 2. 이미 비밀번호 설정됨 거부 (PASSWORD_ALREADY_SET)
     * 3. passwordHash 박음 (BCrypt cost 12)
     *
     * 이메일은 카카오 박은 값 그대로 유지 (spec.md Assumptions).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun linkEmail(
        userId: Long,
        password: String,
    ): User {
        passwordPolicyValidator.validate(password)
        val user =
            userRepository.findById(userId).orElseThrow {
                AuthException(AuthErrorCode.AUTH_TOKEN_INVALID)
            }
        if (user.passwordHash != null) {
            throw AuthException(AuthErrorCode.PASSWORD_ALREADY_SET)
        }
        user.passwordHash = passwordEncoder.encode(password)
        return user
    }

    /**
     * 이메일 가입 사용자 → 카카오 추가 연결.
     *
     * [KakaoConflictChecker.evaluateForLink] 3 분기:
     * - Acceptable → kakaoId 박음 (idempotent 포함)
     * - AlreadyLinkedToOther → KAKAO_ALREADY_LINKED throw
     * - ConflictWithSelf → KAKAO_LINK_CONFLICT throw
     */
    @Transactional(rollbackFor = [Exception::class])
    fun linkKakao(
        userId: Long,
        kakaoId: String,
    ) {
        when (val decision = conflictChecker.evaluateForLink(kakaoId, userId)) {
            is KakaoLinkDecision.Acceptable -> {
                decision.user.kakaoId = kakaoId
            }
            KakaoLinkDecision.AlreadyLinkedToOther ->
                throw AuthException(AuthErrorCode.KAKAO_ALREADY_LINKED)
            KakaoLinkDecision.ConflictWithSelf ->
                throw AuthException(AuthErrorCode.KAKAO_LINK_CONFLICT)
        }
    }
}
