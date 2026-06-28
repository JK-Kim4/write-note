package com.writenote.repository

import com.writenote.entity.ShareComment
import org.springframework.data.jpa.repository.JpaRepository

interface ShareCommentRepository : JpaRepository<ShareComment, Long> {
    /** 공개 read 가시성(R-3) — 한 스냅샷에서 요청자 본인 댓글만. */
    fun findByShareSnapshotIdAndAuthorId(
        shareSnapshotId: Long,
        authorId: Long,
    ): List<ShareComment>

    /** 작가 인박스 — 소유 작품들에 달린 전체 댓글(최근순). 단일 작품은 listOf(projectId). */
    fun findByProjectIdInOrderByCreatedAtDesc(projectIds: Collection<Long>): List<ShareComment>
}
