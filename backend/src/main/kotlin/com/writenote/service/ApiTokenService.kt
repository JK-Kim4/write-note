package com.writenote.service

import com.writenote.components.ApiTokenHasher
import com.writenote.entity.ApiToken
import com.writenote.error.ResourceNotFoundException
import com.writenote.model.request.CreateApiTokenRequest
import com.writenote.model.request.UpdateApiTokenRequest
import com.writenote.model.response.ApiTokenCreatedResponse
import com.writenote.model.response.ApiTokenResponse
import com.writenote.repository.ApiTokenRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class ApiTokenService(
    private val apiTokenRepository: ApiTokenRepository,
    private val apiTokenHasher: ApiTokenHasher,
) {
    /**
     * 신규 API 토큰 발급.
     *
     * 1. `wnt_` + base62 32자 평문 생성 (ApiTokenHasher.generate)
     * 2. SHA-256 hash → DB 저장 (평문은 미저장 — 보안)
     * 3. 평문 토큰은 응답에만 1회 포함 — 이후 서버에서 조회 불가
     */
    @Transactional(rollbackFor = [Exception::class])
    fun createToken(
        userId: Long,
        request: CreateApiTokenRequest,
    ): ApiTokenCreatedResponse {
        val plainToken = apiTokenHasher.generate()
        val tokenHash = apiTokenHasher.hash(plainToken)
        val tokenPrefix = plainToken.take(8)
        val saved =
            apiTokenRepository.save(
                ApiToken(
                    userId = userId,
                    tokenHash = tokenHash,
                    tokenPrefix = tokenPrefix,
                    label = request.label,
                ),
            )
        return ApiTokenCreatedResponse(
            id = requireNotNull(saved.id),
            token = plainToken,
            tokenPrefix = saved.tokenPrefix,
            label = saved.label,
            createdAt = requireNotNull(saved.createdAt),
        )
    }

    /**
     * 본인 토큰 목록 조회 (활성+해지 모두, 원본 token 미포함).
     */
    @Transactional(readOnly = true)
    fun listTokens(userId: Long): List<ApiTokenResponse> =
        apiTokenRepository
            .findByUserIdOrderByCreatedAtDesc(userId)
            .map { it.toResponse() }

    /**
     * 토큰 label 변경.
     *
     * 소유 격리: 타인 토큰은 findByIdAndUserId 에서 empty → ResourceNotFoundException.
     */
    @Transactional(rollbackFor = [Exception::class])
    fun updateLabel(
        userId: Long,
        tokenId: Long,
        request: UpdateApiTokenRequest,
    ): ApiTokenResponse {
        val token = requireOwnedToken(userId, tokenId)
        token.label = request.label
        return token.toResponse()
    }

    /**
     * 토큰 해지 — revoked_at = now(). DB row 유지 (감사 목적).
     *
     * 이후 해당 토큰으로 /api/capture 호출 시 ApiTokenAuthenticationFilter 가 revoked 검증 후 거부.
     */
    @Transactional(rollbackFor = [Exception::class])
    fun revokeToken(
        userId: Long,
        tokenId: Long,
    ) {
        val token = requireOwnedToken(userId, tokenId)
        token.revokedAt = Instant.now()
        // dirty checking — 자동 UPDATE (트랜잭션 종료 시 flush)
    }

    private fun requireOwnedToken(
        userId: Long,
        tokenId: Long,
    ): ApiToken =
        apiTokenRepository
            .findByIdAndUserId(tokenId, userId)
            .orElseThrow { ResourceNotFoundException("ApiToken not found") }

    private fun ApiToken.toResponse() =
        ApiTokenResponse(
            id = requireNotNull(id),
            tokenPrefix = tokenPrefix,
            label = label,
            lastUsedAt = lastUsedAt,
            createdAt = requireNotNull(createdAt),
            revokedAt = revokedAt,
        )
}
