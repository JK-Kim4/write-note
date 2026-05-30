package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.PrePersist
import jakarta.persistence.Table
import java.time.Instant

/** 모바일 캡처용 장기 API 토큰. */
@Entity
@Table(name = "api_tokens")
class ApiToken(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "user_id", nullable = false)
    var userId: Long = 0,
    /** SHA-256 hex (64자) — 평문 토큰 원본은 미저장 */
    @Column(name = "token_hash", nullable = false, length = 64, unique = true)
    var tokenHash: String = "",
    /** UI 식별용 접두 8자 (`wnt_XXXX`) */
    @Column(name = "token_prefix", nullable = false, length = 8)
    var tokenPrefix: String = "",
    @Column(nullable = false, length = 120)
    var label: String = "새 토큰",
    /** 마지막 캡처 시 갱신 */
    @Column(name = "last_used_at")
    var lastUsedAt: Instant? = null,
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
    /** 해지 시각 — null 이면 활성 */
    @Column(name = "revoked_at")
    var revokedAt: Instant? = null,
) {
    @PrePersist
    fun prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now()
        }
    }
}
