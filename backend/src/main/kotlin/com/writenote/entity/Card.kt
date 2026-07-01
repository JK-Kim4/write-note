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
 * 카드(038, 048). [userId] 소유의 한 장 — 기존 캡처 메모(memos)와 별개의 신규 객체.
 *
 * [boardId] 는 소속 보드(0 또는 1개, 1:N) — null 이면 어느 보드에도 없는 독립 카드(048). 소유는 보드 경유가 아닌 [userId] 로 직접 판별.
 * [posX]·[posY] 는 줌·팬과 무관한 캔버스 절대 좌표(음수·소수 허용, 독립 카드는 의미 없음). [zIndex] 는 겹침 순서.
 * [type] 은 역할 종류(character/place/event/theme, 트랙 D) — null=무지정. 카드 선택 후 칩으로 부여·해제, 종류별 색/라벨로 구분.
 */
@Entity
@Table(name = "cards")
class Card(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "user_id", nullable = false)
    var userId: Long = 0,
    @Column(name = "board_id")
    var boardId: Long? = null,
    @Column(nullable = false, columnDefinition = "TEXT")
    var body: String = "",
    @Column(length = 16)
    var type: String? = null,
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
