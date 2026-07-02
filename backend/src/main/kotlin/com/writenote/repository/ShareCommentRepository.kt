package com.writenote.repository

import com.writenote.entity.ShareComment
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

/** 스냅샷(=공유 링크)별 안 읽은 피드백 수 projection(050 — 배지도 스냅샷 스코프로, 읽음 처리와 정합). */
interface SnapshotUnreadRow {
    val shareSnapshotId: Long
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

    /** 작가 맥락 뷰(050 US1) — 한 스냅샷(=한 공유 링크)의 전체 댓글(authorId 무관, 최근순). */
    fun findByShareSnapshotIdOrderByCreatedAtDesc(shareSnapshotId: Long): List<ShareComment>

    /** 스냅샷별 안 읽은 피드백 수(050) — group-by 일괄(N+1 회피). 배지를 스냅샷 스코프로 계산해 다중 링크 정합(읽음 처리와 일치). */
    @Query(
        "SELECT c.shareSnapshotId AS shareSnapshotId, COUNT(c) AS unreadCount " +
            "FROM ShareComment c WHERE c.shareSnapshotId IN :snapshotIds AND c.readAt IS NULL GROUP BY c.shareSnapshotId",
    )
    fun countUnreadByShareSnapshotIds(
        @Param("snapshotIds") snapshotIds: Collection<Long>,
    ): List<SnapshotUnreadRow>

    /** 작품 단위 읽음 처리(047) — 그 작품의 안 읽은 댓글 read_at 채움(bulk). 반환=갱신 행 수. */
    @Modifying
    @Query("UPDATE ShareComment c SET c.readAt = :now WHERE c.projectId = :projectId AND c.readAt IS NULL")
    fun markReadByProjectId(
        @Param("projectId") projectId: Long,
        @Param("now") now: Instant,
    ): Int

    /**
     * 스냅샷 스코프 읽음 처리(050 US1, D7) — 그 스냅샷(=링크)만의 안 읽은 댓글 read_at 채움(bulk).
     * projectId 단위([markReadByProjectId])와 달리 같은 작품의 다른 링크 안 읽음에는 영향 없음.
     */
    @Modifying
    @Query("UPDATE ShareComment c SET c.readAt = :now WHERE c.shareSnapshotId = :shareSnapshotId AND c.readAt IS NULL")
    fun markReadByShareSnapshotId(
        @Param("shareSnapshotId") shareSnapshotId: Long,
        @Param("now") now: Instant,
    ): Int
}
