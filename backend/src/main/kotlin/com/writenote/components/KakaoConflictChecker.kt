package com.writenote.components

import com.writenote.entity.User
import com.writenote.repository.UserRepository
import org.springframework.stereotype.Component

/**
 * 카카오 OAuth 콜백 분기 결정 컴포넌트.
 *
 * Phase 4 한정 — login flow 3 분기 (research.md R-3 + contracts/auth-endpoints.md §5).
 * Phase 7 (US5) 진입 시 link flow 분기 (KAKAO_ALREADY_LINKED / KAKAO_LINK_CONFLICT) 추가.
 */
@Component
class KakaoConflictChecker(
    private val userRepository: UserRepository,
) {
    /**
     * 비로그인 카카오 콜백 시 user 조회/생성 결정.
     *
     * - 같은 kakaoId user 존재 → [KakaoLoginDecision.ExistingKakaoUser]
     * - kakaoId 미존재 + 같은 email user 존재 + 그 user kakaoId NULL → [KakaoLoginDecision.EmailConflictNotLinked] (FR-022)
     * - 그 외 → [KakaoLoginDecision.NewKakaoUser]
     */
    fun evaluateForLogin(
        kakaoId: String,
        email: String,
    ): KakaoLoginDecision {
        val existing = userRepository.findByKakaoId(kakaoId)
        if (existing != null) {
            return KakaoLoginDecision.ExistingKakaoUser(existing)
        }
        val emailUser = userRepository.findByEmail(email)
        if (emailUser != null && emailUser.kakaoId == null) {
            return KakaoLoginDecision.EmailConflictNotLinked
        }
        return KakaoLoginDecision.NewKakaoUser(kakaoId = kakaoId, email = email)
    }
}

sealed class KakaoLoginDecision {
    data class NewKakaoUser(
        val kakaoId: String,
        val email: String,
    ) : KakaoLoginDecision()

    data class ExistingKakaoUser(
        val user: User,
    ) : KakaoLoginDecision()

    data object EmailConflictNotLinked : KakaoLoginDecision()
}
