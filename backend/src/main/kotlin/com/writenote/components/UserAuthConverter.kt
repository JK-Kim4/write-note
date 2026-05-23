package com.writenote.components

import com.writenote.entity.User
import com.writenote.model.response.AuthMeResponse
import org.springframework.stereotype.Component

@Component
class UserAuthConverter {
    /**
     * [User] 엔티티 → [AuthMeResponse] DTO 변환.
     *
     * `activeApiTokenCount` 는 Week 4 의 ApiToken 테이블 신설 전이라 항상 `0` 고정.
     * 임시 — Week 4 진입 시 ApiTokenRepository.countActiveByUserId(userId) 결선으로 swap.
     *
     * 출처: contracts/auth-endpoints.md §10 (GET /api/auth/me 응답 shape).
     */
    fun toAuthMeResponse(user: User): AuthMeResponse =
        AuthMeResponse(
            userId = requireNotNull(user.id) { "User.id must not be null after persistence" },
            email = user.email,
            kakaoLinked = user.kakaoId != null,
            emailVerifiedAt = user.emailVerifiedAt,
            activeApiTokenCount = 0,
        )
}
