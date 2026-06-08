package com.writenote.service

import com.writenote.components.ApiTokenHasher
import com.writenote.entity.ApiToken
import com.writenote.error.ResourceNotFoundException
import com.writenote.model.request.CreateApiTokenRequest
import com.writenote.model.request.UpdateApiTokenRequest
import com.writenote.repository.ApiTokenRepository
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.Optional

class ApiTokenServiceTest {
    private lateinit var apiTokenRepository: ApiTokenRepository
    private lateinit var apiTokenHasher: ApiTokenHasher
    private lateinit var service: ApiTokenService

    @BeforeEach
    fun setUp() {
        apiTokenRepository = mockk()
        apiTokenHasher = mockk()
        service = ApiTokenService(apiTokenRepository, apiTokenHasher)
    }

    // ─── 발급 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("createToken — 원본 토큰이 응답에만 포함되고 DB 에는 hash 만 저장됨")
    fun `createToken stores hash only and returns plain token once`() {
        val userId = 1L
        val plainToken = "wnt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef"
        val tokenHash = "sha256hashvalue"
        val savedToken =
            ApiToken(
                id = 10L,
                userId = userId,
                tokenHash = tokenHash,
                tokenPrefix = plainToken.take(8),
                label = "새 토큰",
                createdAt = Instant.now(),
            )

        every { apiTokenHasher.generate() } returns plainToken
        every { apiTokenHasher.hash(eq(plainToken)) } returns tokenHash
        val captured = slot<ApiToken>()
        every { apiTokenRepository.save(capture(captured)) } returns savedToken

        val response = service.createToken(userId, CreateApiTokenRequest())

        // 응답에 원본 토큰 포함
        assertThat(response.token).isEqualTo(plainToken)
        // DB 저장 엔티티에는 hash 만 — 평문 tokenHash 가 아님
        assertThat(captured.captured.tokenHash).isEqualTo(tokenHash)
        assertThat(captured.captured.tokenHash).doesNotContain("wnt_")
        // prefix 는 원본의 앞 8자
        assertThat(captured.captured.tokenPrefix).isEqualTo(plainToken.take(8))
        assertThat(captured.captured.userId).isEqualTo(userId)
    }

    @Test
    @DisplayName("createToken — label 이 지정되면 지정값으로 저장, 미지정 시 '새 토큰'")
    fun `createToken respects provided label`() {
        val userId = 2L
        val plainToken = "wnt_XYZtest"
        val tokenHash = "hash2"
        val request = CreateApiTokenRequest(label = "내 아이폰 단축어")
        val savedToken =
            ApiToken(
                id = 20L,
                userId = userId,
                tokenHash = tokenHash,
                tokenPrefix = plainToken.take(8),
                label = "내 아이폰 단축어",
                createdAt = Instant.now(),
            )

        every { apiTokenHasher.generate() } returns plainToken
        every { apiTokenHasher.hash(eq(plainToken)) } returns tokenHash
        every { apiTokenRepository.save(any()) } returns savedToken

        val response = service.createToken(userId, request)

        assertThat(response.label).isEqualTo("내 아이폰 단축어")
    }

    // ─── 목록 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("listTokens — 본인 토큰 전체(활성+해지) 반환, 원본 token 미포함")
    fun `listTokens returns all tokens without plain token`() {
        val userId = 3L
        val now = Instant.now()
        val tokens =
            listOf(
                ApiToken(id = 1L, userId = userId, tokenHash = "h1", tokenPrefix = "wnt_ABCD", label = "A", createdAt = now),
                ApiToken(
                    id = 2L,
                    userId = userId,
                    tokenHash = "h2",
                    tokenPrefix = "wnt_EFGH",
                    label = "B",
                    createdAt = now,
                    revokedAt = now,
                ),
            )
        every { apiTokenRepository.findByUserIdOrderByCreatedAtDesc(eq(userId)) } returns tokens

        val result = service.listTokens(userId)

        assertThat(result).hasSize(2)
        assertThat(result[0].tokenPrefix).isEqualTo("wnt_ABCD")
        assertThat(result[1].revokedAt).isNotNull()
    }

    // ─── label 수정 ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("updateLabel — 본인 토큰 label 갱신 후 ApiTokenResponse 반환")
    fun `updateLabel changes label and returns response`() {
        val userId = 4L
        val token =
            ApiToken(
                id = 30L,
                userId = userId,
                tokenHash = "h3",
                tokenPrefix = "wnt_QRST",
                label = "구 라벨",
                createdAt = Instant.now(),
            )
        every { apiTokenRepository.findByIdAndUserId(eq(30L), eq(userId)) } returns Optional.of(token)

        val response = service.updateLabel(userId, 30L, UpdateApiTokenRequest(label = "새 라벨"))

        assertThat(response.label).isEqualTo("새 라벨")
        assertThat(token.label).isEqualTo("새 라벨")
    }

    @Test
    @DisplayName("updateLabel — 타인 토큰 접근 시 ResourceNotFoundException")
    fun `updateLabel throws ResourceNotFoundException for non-owner`() {
        every { apiTokenRepository.findByIdAndUserId(eq(99L), eq(5L)) } returns Optional.empty()

        assertThatThrownBy { service.updateLabel(5L, 99L, UpdateApiTokenRequest(label = "x")) }
            .isInstanceOf(ResourceNotFoundException::class.java)
    }

    // ─── 해지 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("revokeToken — revoked_at 박힘, DB row 유지 (delete 미호출)")
    fun `revokeToken sets revokedAt and does not delete row`() {
        val userId = 6L
        val token =
            ApiToken(
                id = 40L,
                userId = userId,
                tokenHash = "h4",
                tokenPrefix = "wnt_UVWX",
                label = "토큰",
                createdAt = Instant.now(),
                revokedAt = null,
            )
        every { apiTokenRepository.findByIdAndUserId(eq(40L), eq(userId)) } returns Optional.of(token)

        service.revokeToken(userId, 40L)

        assertThat(token.revokedAt).isNotNull()
        verify(exactly = 0) { apiTokenRepository.delete(any()) }
        verify(exactly = 0) { apiTokenRepository.deleteById(any()) }
    }

    @Test
    @DisplayName("revokeToken — 타인 토큰 접근 시 ResourceNotFoundException")
    fun `revokeToken throws ResourceNotFoundException for non-owner`() {
        every { apiTokenRepository.findByIdAndUserId(eq(99L), eq(7L)) } returns Optional.empty()

        assertThatThrownBy { service.revokeToken(7L, 99L) }
            .isInstanceOf(ResourceNotFoundException::class.java)
    }
}
