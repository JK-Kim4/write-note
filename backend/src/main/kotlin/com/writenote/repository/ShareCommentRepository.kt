package com.writenote.repository

import com.writenote.entity.ShareComment
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

/** 작품별 안 읽은 피드백 수 projection(047). */
interface UnreadCountRow {
    val projectId: Long
    val unreadCount: Long
}

interface ShareCommentRepository : JpaRepository<ShareComment, Long> {
    /** 공개 read 가시성(R-3) — 한 스냅샷에서 요청자 본인 댓글만. */
    fun findByShareSnapshotIdAndAuthorId(
        shareSnapshotId: Long,
        authorId: Long,
    ): List<ShareComment>

    /** 작가 인박스 — 소유 작품들에 달린 전체 댓글(최근순). 단일 작품은 listOf(projectId). */
    fun findByProjectIdInOrderByCreatedAtDesc(projectIds: Collection<Long>): List<ShareComment>

    /** 작품별 안 읽은 피드백 수(047) — group-by 일괄(N+1 회피). 안 읽은 행 없는 작품은 결과에 미포함. */
    @Query(
        "SELECT c.projectId AS projectId, COUNT(c) AS unreadCount " +
            "FROM ShareComment c WHERE c.projectId IN :projectIds AND c.readAt IS NULL GROUP BY c.projectId",
    )
    fun countUnreadByProjectIds(
        @Param("projectIds") projectIds: Collection<Long>,
    ): List<UnreadCountRow>

    /** 작품 단위 읽음 처리(047) — 그 작품의 안 읽은 댓글 read_at 채움(bulk). 반환=갱신 행 수. */
    @Modifying
    @Query("UPDATE ShareComment c SET c.readAt = :now WHERE c.projectId = :projectId AND c.readAt IS NULL")
    fun markReadByProjectId(
        @Param("projectId") projectId: Long,
        @Param("now") now: Instant,
    ): Int
}
