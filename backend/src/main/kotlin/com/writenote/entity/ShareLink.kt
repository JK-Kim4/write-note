package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.PrePersist
import jakarta.persistence.Table
import java.time.Instant

/**
 * 공유 링크(046). 작가([ownerId])가 작품/시리즈를 공유로 내보낸 capability 토큰.
 *
 * [token] = 추측불가 base62 32자, URL 노출 값(원문 저장 — 공개 read 가 토큰으로 역조회). [targetType]="work"|"series",
 * [targetId]=project.id 또는 category.id(다형, 진짜 FK 아님). [isActive]=revoke 시 false(미존재와 동형 404 안내).
 * [ownerId]=스냅샷 복호 키 주체. 대상 hard delete 시 보존(R3 훅이 비활성).
 */
@Entity
@Table(name = "share_link")
class ShareLink(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(nullable = false, unique = true)
    var token: String = "",
    @Column(name = "target_type", nullable = false)
    var targetType: String = "work",
    @Column(name = "target_id", nullable = false)
    var targetId: Long = 0,
    @Column(name = "owner_id", nullable = false)
    var ownerId: Long = 0,
    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true,
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
) {
    @PrePersist
    fun prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now()
        }
    }
}
