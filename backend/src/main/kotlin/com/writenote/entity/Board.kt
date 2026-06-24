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
 * 플롯 보드(038). 작품/시리즈와 독립인 사용자([userId]) 소유 캔버스.
 *
 * [categoryId]·[projectId] 는 선택 매핑(각 0~1). 대상당 보드도 최대 1개(부분 유니크 인덱스). 둘 다 null=독립 보드.
 * 노드/엣지는 보드 전용이며 쪽지 책상 캡처 메모(memos)와 무관하다. FK 는 id 컬럼 직접(Project.kt 정합).
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
    @Column(name = "category_id")
    var categoryId: Long? = null,
    @Column(name = "project_id")
    var projectId: Long? = null,
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
