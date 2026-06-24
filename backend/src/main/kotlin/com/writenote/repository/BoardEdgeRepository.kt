package com.writenote.repository

import com.writenote.entity.BoardEdge
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface BoardEdgeRepository : JpaRepository<BoardEdge, Long> {
    fun findByBoardIdOrderByIdAsc(boardId: Long): List<BoardEdge>

    fun findByIdAndBoardId(
        id: Long,
        boardId: Long,
    ): Optional<BoardEdge>

    fun existsByBoardIdAndSourceNodeIdAndTargetNodeId(
        boardId: Long,
        sourceNodeId: Long,
        targetNodeId: Long,
    ): Boolean
}
