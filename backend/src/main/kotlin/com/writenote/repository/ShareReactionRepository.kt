package com.writenote.repository

import com.writenote.entity.ShareReaction
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

/** 반응 집계 projection(050) — 스냅샷의 (anchor, emoji) 그룹별 개수. */
interface ReactionCountRow {
    val anchorBlockIndex: Int
    val anchorStart: Int
    val anchorLength: Int
    val emoji: String
    val count: Long
}

interface ShareReactionRepository : JpaRepository<ShareReaction, Long> {
    /** 스냅샷 반응 집계(anchor, emoji 그룹별 count) — N+1 회피 단일 그룹 쿼리. */
    @Query(
        "SELECT r.anchorBlockIndex AS anchorBlockIndex, r.anchorStart AS anchorStart, r.anchorLength AS anchorLength, " +
            "r.emoji AS emoji, COUNT(r) AS count FROM ShareReaction r WHERE r.shareSnapshotId = :snapshotId " +
            "GROUP BY r.anchorBlockIndex, r.anchorStart, r.anchorLength, r.emoji",
    )
    fun countGroupedBySnapshot(
        @Param("snapshotId") snapshotId: Long,
    ): List<ReactionCountRow>

    /** 뷰어 본인이 남긴 반응 전부(스냅샷 단위) — 집계에 [ReactionCountRow] 대비 mine 반영용. */
    fun findByShareSnapshotIdAndReactorId(
        shareSnapshotId: Long,
        reactorId: Long,
    ): List<ShareReaction>

    /** 토글 멱등 판정 — 동일 (스냅샷, 앵커, 이모지, 반응자) 존재 여부 조회. */
    fun findByShareSnapshotIdAndAnchorBlockIndexAndAnchorStartAndAnchorLengthAndEmojiAndReactorId(
        shareSnapshotId: Long,
        anchorBlockIndex: Int,
        anchorStart: Int,
        anchorLength: Int,
        emoji: String,
        reactorId: Long,
    ): ShareReaction?

    /** 토글 off — 본인 반응만 삭제(반환 = 삭제된 행 수, 없어도 0 무해). */
    @Modifying
    @Query(
        "DELETE FROM ShareReaction r WHERE r.shareSnapshotId = :snapshotId AND r.anchorBlockIndex = :anchorBlockIndex " +
            "AND r.anchorStart = :anchorStart AND r.anchorLength = :anchorLength AND r.emoji = :emoji AND r.reactorId = :reactorId",
    )
    fun deleteByAnchorAndReactor(
        @Param("snapshotId") snapshotId: Long,
        @Param("anchorBlockIndex") anchorBlockIndex: Int,
        @Param("anchorStart") anchorStart: Int,
        @Param("anchorLength") anchorLength: Int,
        @Param("emoji") emoji: String,
        @Param("reactorId") reactorId: Long,
    ): Int

    /** 특정 (anchor, emoji) 카운트 — add/remove 응답의 단건 집계 갱신용. */
    fun countByShareSnapshotIdAndAnchorBlockIndexAndAnchorStartAndAnchorLengthAndEmoji(
        shareSnapshotId: Long,
        anchorBlockIndex: Int,
        anchorStart: Int,
        anchorLength: Int,
        emoji: String,
    ): Long
}
