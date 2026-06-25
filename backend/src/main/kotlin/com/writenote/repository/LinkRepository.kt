package com.writenote.repository

import com.writenote.entity.Link
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface LinkRepository : JpaRepository<Link, Long> {
    fun findByBoardIdOrderByIdAsc(boardId: Long): List<Link>

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
