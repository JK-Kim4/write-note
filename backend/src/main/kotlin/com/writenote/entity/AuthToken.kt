package com.writenote.entity

import com.writenote.enums.AuthTokenType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EntityListeners
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.Instant

@Entity
@Table(
    name = "auth_tokens",
    indexes = [
        Index(name = "idx_auth_tokens_user_type", columnList = "user_id, type"),
        Index(name = "idx_auth_tokens_expires_at", columnList = "expires_at"),
    ],
)
@EntityListeners(AuditingEntityListener::class)
class AuthToken(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "user_id", nullable = false)
    var userId: Long = 0L,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    var type: AuthTokenType = AuthTokenType.REFRESH,
    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    var tokenHash: String = "",
    @Column(name = "expires_at", nullable = false)
    var expiresAt: Instant = Instant.EPOCH,
    @Column(name = "used_at")
    var usedAt: Instant? = null,
    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    var createdAt: Instant? = null,
)
