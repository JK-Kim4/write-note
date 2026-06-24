package com.writenote.components

import com.writenote.entity.User
import com.writenote.model.response.AuthMeResponse
import com.writenote.repository.ApiTokenRepository
import org.springframework.stereotype.Component

@Component
class UserAuthConverter(
    private val apiTokenRepository: ApiTokenRepository,
) {
    /**
     * [User] 엔티티 → [AuthMeResponse] DTO 변환.
     *
     * `activeApiTokenCount` = revokedAt 이 null 인 본인 토큰 수
     * (ApiTokenRepository.countByUserIdAndRevokedAtIsNull).
     *
     * 출처: contracts/auth-endpoints.md §10 (GET /api/auth/me 응답 shape).
     */
    fun toAuthMeResponse(user: User): AuthMeResponse {
        val userId = requireNotNull(user.id) { "User.id must not be null after persistence" }
        return AuthMeResponse(
            userId = userId,
            email = user.email,
            nickname = user.nickname,
            kakaoLinked = user.kakaoId != null,
            emailVerifiedAt = user.emailVerifiedAt,
            activeApiTokenCount = apiTokenRepository.countByUserIdAndRevokedAtIsNull(userId).toInt(),
            createdAt = user.createdAt,
            passwordSet = user.passwordHash != null,
        )
    }
}
