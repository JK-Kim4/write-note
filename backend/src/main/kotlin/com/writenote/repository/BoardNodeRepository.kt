package com.writenote.repository

import com.writenote.entity.BoardNode
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface BoardNodeRepository : JpaRepository<BoardNode, Long> {
    fun findByBoardIdOrderByIdAsc(boardId: Long): List<BoardNode>

    fun findByIdAndBoardId(
        id: Long,
        boardId: Long,
    ): Optional<BoardNode>

    /** 배치 위치 갱신 — 요청 id 들 중 해당 보드 소속만 반환(소유 검증). */
    fun findByIdInAndBoardId(
        ids: Collection<Long>,
        boardId: Long,
    ): List<BoardNode>

    fun countByBoardId(boardId: Long): Long
}
