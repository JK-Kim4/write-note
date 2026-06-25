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
 * 연결(엣지, 038). 같은 보드([boardId]) 안 두 노드 사이의 방향 있는 관계([sourceNodeId]→[targetNodeId]).
 *
 * 같은 방향 동일 쌍은 유일(DB UNIQUE), 자기참조 금지(DB CHECK). v1 은 관계 유형 라벨 없음. 노드 삭제 시 DB cascade.
 */
@Entity
@Table(name = "board_edges")
class BoardEdge(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "board_id", nullable = false)
    var boardId: Long = 0,
    @Column(name = "source_node_id", nullable = false)
    var sourceNodeId: Long = 0,
    @Column(name = "target_node_id", nullable = false)
    var targetNodeId: Long = 0,
    @Column(name = "source_handle", length = 8)
    var sourceHandle: String? = null,
    @Column(name = "target_handle", length = 8)
    var targetHandle: String? = null,
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
