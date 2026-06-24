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
 * 플롯 노드(038). 보드([boardId]) 위의 카드 — 기존 캡처 메모(memos)와 별개의 신규 객체.
 *
 * [posX]·[posY] 는 줌·팬과 무관한 캔버스 절대 좌표(음수·소수 허용). [zIndex] 는 겹침 순서. 정확히 한 보드에 속함(1:N).
 * [type] 은 역할 타입(plot/character/place/theme/note) — 생성 시 선택, 타입별 색상/라벨로 구분(V25).
 */
@Entity
@Table(name = "board_nodes")
class BoardNode(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "board_id", nullable = false)
    var boardId: Long = 0,
    @Column(nullable = false, columnDefinition = "TEXT")
    var body: String = "",
    @Column(nullable = false, length = 16)
    var type: String = "plot",
    @Column(name = "pos_x", nullable = false)
    var posX: Double = 0.0,
    @Column(name = "pos_y", nullable = false)
    var posY: Double = 0.0,
    @Column(name = "z_index", nullable = false)
    var zIndex: Int = 0,
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
