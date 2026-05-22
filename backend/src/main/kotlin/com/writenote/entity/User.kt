package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EntityListeners
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.annotation.LastModifiedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.Instant

@Entity
@Table(name = "users")
@EntityListeners(AuditingEntityListener::class)
class User(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(nullable = false, unique = true, length = 320)
    var email: String = "",
    @Column(name = "kakao_id", unique = true, length = 100)
    var kakaoId: String? = null,
    @Column(name = "password_hash", length = 255)
    var passwordHash: String? = null,
    @Column(name = "email_verified_at")
    var emailVerifiedAt: Instant? = null,
    @Column(name = "last_login_at")
    var lastLoginAt: Instant? = null,
    @Column(name = "failed_login_count", nullable = false)
    var failedLoginCount: Int = 0,
    @Column(name = "lockout_until")
    var lockoutUntil: Instant? = null,
    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    var createdAt: Instant? = null,
    @LastModifiedDate
    @Column(name = "updated_at", nullable = false, insertable = false)
    var updatedAt: Instant? = null,
)
