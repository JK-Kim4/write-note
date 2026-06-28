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
 * 공유 댓글(046 R2) — 공개 공유본(불변 스냅샷)의 텍스트 구간에 회원이 다는 위치 지정 피드백.
 *
 * 가시성 = 작가 전용(R-3): 공개 read 는 [authorId] == 요청자만, 작가 인박스([projectId] 소유)만 전체 — 조회 레이어에서 강제.
 * 앵커 = 불변 스냅샷의 ([anchorBlockIndex] top-level 블록 + [anchorStart] 문단 내 오프셋 + [anchorLength] 구간 길이).
 * [projectId] = 작가 집계용 비정규화(스냅샷의 작품). [content] = 평문(R-3).
 */
@Entity
@Table(name = "share_comment")
class ShareComment(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "share_snapshot_id", nullable = false)
    var shareSnapshotId: Long = 0,
    @Column(name = "project_id", nullable = false)
    var projectId: Long = 0,
    @Column(name = "author_id", nullable = false)
    var authorId: Long = 0,
    @Column(name = "anchor_block_index", nullable = false)
    var anchorBlockIndex: Int = 0,
    @Column(name = "anchor_start", nullable = false)
    var anchorStart: Int = 0,
    @Column(name = "anchor_length", nullable = false)
    var anchorLength: Int = 0,
    @Column(nullable = false)
    var content: String = "",
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null,
    @Column(name = "read_at")
    var readAt: Instant? = null,
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
}
