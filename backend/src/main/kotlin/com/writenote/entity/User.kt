package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "users")
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
    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    var createdAt: Instant? = null,
)
