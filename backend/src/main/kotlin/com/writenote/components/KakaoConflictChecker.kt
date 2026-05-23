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

    /**
     * 로그인 사용자의 카카오 추가 연결 분기 결정 (FR-023, FR-025, US5).
     *
     * - 본인 user 미존재 → [KakaoLinkDecision.AlreadyLinkedToOther] (보수적 거부)
     * - 같은 kakaoId 가 다른 user 에 묶임 → [KakaoLinkDecision.AlreadyLinkedToOther]
     * - 본인 user 가 이미 다른 kakaoId 박힘 → [KakaoLinkDecision.ConflictWithSelf]
     * - 그 외 (본인 미연결 / 본인 이미 같은 kakaoId idempotent) → [KakaoLinkDecision.Acceptable]
     */
    fun evaluateForLink(
        kakaoId: String,
        linkUserId: Long,
    ): KakaoLinkDecision {
        val self =
            userRepository.findById(linkUserId).orElse(null)
                ?: return KakaoLinkDecision.AlreadyLinkedToOther
        val existingByKakaoId = userRepository.findByKakaoId(kakaoId)
        if (existingByKakaoId != null && existingByKakaoId.id != linkUserId) {
            return KakaoLinkDecision.AlreadyLinkedToOther
        }
        val selfKakaoId = self.kakaoId
        if (selfKakaoId != null && selfKakaoId != kakaoId) {
            return KakaoLinkDecision.ConflictWithSelf
        }
        return KakaoLinkDecision.Acceptable(self)
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

sealed class KakaoLinkDecision {
    /** 본인 user 박힘 + kakaoId 박음 가능 (미연결 또는 idempotent). */
    data class Acceptable(
        val user: User,
    ) : KakaoLinkDecision()

    /** 다른 user 에 묶인 kakaoId — KAKAO_ALREADY_LINKED 응답. */
    data object AlreadyLinkedToOther : KakaoLinkDecision()

    /** 본인 user 가 이미 다른 kakaoId 박힘 — KAKAO_LINK_CONFLICT 응답. */
    data object ConflictWithSelf : KakaoLinkDecision()
}
