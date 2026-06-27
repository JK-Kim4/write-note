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
 * 연결(링크, 038). 같은 보드([boardId]) 안 두 카드 사이의 관계([sourceCardId]↔[targetCardId]).
 *
 * 같은 순서쌍은 유일(DB UNIQUE), 자기연결 금지(DB CHECK). 무방향(화살표 없음) — source/target 은 저장 순서일 뿐.
 * [sourceHandle]/[targetHandle] 은 연결 테두리 앵커(top/right/bottom/left). 카드 삭제 시 DB cascade.
 */
@Entity
@Table(name = "links")
class Link(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "board_id", nullable = false)
    var boardId: Long = 0,
    @Column(name = "source_card_id", nullable = false)
    var sourceCardId: Long = 0,
    @Column(name = "target_card_id", nullable = false)
    var targetCardId: Long = 0,
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
