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
 * 공유 반응(050 US3) — 공개 공유본(불변 스냅샷)의 텍스트 구간에 회원이 남기는 이모지 반응.
 *
 * 가시성 = 공개(공개 집계, R-3 위치 지정 댓글과 달리 열람자 전체가 개수를 봄).
 * 앵커 = 불변 스냅샷의 ([anchorBlockIndex] 평탄화 블록 인덱스 + [anchorStart] 블록 내 오프셋 + [anchorLength] 구간 길이),
 * [com.writenote.service.AnchorValidator] 로 검증(ShareComment 와 동일 블록 모델, 룰 §32).
 * UNIQUE(share_snapshot_id, anchor_block_index, anchor_start, anchor_length, emoji, reactor_id) — 토글의 멱등 근거(V31).
 */
@Entity
@Table(name = "share_reaction")
class ShareReaction(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "share_snapshot_id", nullable = false)
    var shareSnapshotId: Long = 0,
    @Column(name = "anchor_block_index", nullable = false)
    var anchorBlockIndex: Int = 0,
    @Column(name = "anchor_start", nullable = false)
    var anchorStart: Int = 0,
    @Column(name = "anchor_length", nullable = false)
    var anchorLength: Int = 0,
    @Column(nullable = false)
    var emoji: String = "",
    @Column(name = "reactor_id", nullable = false)
    var reactorId: Long = 0,
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
