package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EntityListeners
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.PrePersist
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
    @Column(name = "nickname", nullable = false, unique = true, length = 16)
    var nickname: String = "",
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
) {
    /**
     * 닉네임 불변식 안전망 — INSERT 시 닉네임이 비어 있으면 고유 임시값을 부여한다.
     *
     * 정상 가입 경로는 [com.writenote.nickname.NicknameGenerator] 로 한글 닉네임을 미리 주입하므로
     * 이 콜백은 발동하지 않는다. 테스트 픽스처 등 닉네임 미지정 저장에서 NOT NULL·UNIQUE 위반을 막는 fallback.
     */
    @PrePersist
    fun ensureNickname() {
        if (nickname.isBlank()) {
            nickname = "user_" +
                java.util.UUID
                    .randomUUID()
                    .toString()
                    .replace("-", "")
                    .take(8)
        }
    }
}
