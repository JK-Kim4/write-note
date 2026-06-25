package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.PrePersist
import jakarta.persistence.PreUpdate
import jakarta.persistence.Table
import java.time.Instant

/**
 * 플롯 보드(038, 041 트랙 C). 작품/시리즈와 독립인 사용자([userId]) 소유 캔버스.
 *
 * [ownerType]/[ownerId] = 다형 단일 소속(041): [ownerType]="project"(작품)·"category"(시리즈)·null(아이디어).
 * 항상 짝으로 채워지거나 함께 null(DB CHECK). 한 대상에 보드 여러 개(1:N). 다형이라 진짜 FK 없음 —
 * 소속 무결성은 서비스 검증, 대상 hard delete 시 owner null 강등(보드 보존)으로 처리.
 * 카드/연결은 보드 전용이며 쪽지 책상 캡처 메모(memos)와 무관하다.
 */
@Entity
@Table(name = "boards")
class Board(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "user_id", nullable = false)
    var userId: Long = 0,
    @Column(nullable = false, length = 120)
    var name: String = "",
    @Column(name = "owner_type", length = 16)
    var ownerType: String? = null,
    @Column(name = "owner_id")
    var ownerId: Long? = null,
    @Column(name = "viewport_zoom", nullable = false)
    var viewportZoom: Double = 1.0,
    @Column(name = "viewport_x", nullable = false)
    var viewportX: Double = 0.0,
    @Column(name = "viewport_y", nullable = false)
    var viewportY: Double = 0.0,
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null,
) {
    @PrePersist
    fun prePersist() {
        val now = Instant.now()
        if (createdAt == null) {
            createdAt = now
        }
        if (updatedAt == null) {
            updatedAt = now
        }
    }

    @PreUpdate
    fun preUpdate() {
        updatedAt = Instant.now()
    }
}
