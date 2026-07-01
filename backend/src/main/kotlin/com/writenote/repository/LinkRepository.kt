package com.writenote.repository

import com.writenote.entity.Link
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface LinkRepository : JpaRepository<Link, Long> {
    fun findByBoardIdOrderByIdAsc(boardId: Long): List<Link>

    /**
     * 카드 관리(048) — 주어진 카드들에 걸린 링크 전량(연결 수 계산용). source 또는 target 이 대상 카드면 포함.
     * distinct 이웃 카드 수는 서비스에서 계산(A→B·B→A 별개 링크여도 이웃 집합 {A,B} 는 1) — native UNION 별칭 함정 회피.
     */
    fun findBySourceCardIdInOrTargetCardIdIn(
        sourceCardIds: Collection<Long>,
        targetCardIds: Collection<Long>,
    ): List<Link>

    fun findByIdAndBoardId(
        id: Long,
        boardId: Long,
    ): Optional<Link>

    fun existsByBoardIdAndSourceCardIdAndTargetCardId(
        boardId: Long,
        sourceCardId: Long,
        targetCardId: Long,
    ): Boolean
}
