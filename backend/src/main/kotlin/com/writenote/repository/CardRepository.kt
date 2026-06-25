package com.writenote.repository

import com.writenote.entity.Card
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.Optional

/** 보드별 카드 수 집계(전역 허브 N+1 회피용 projection). */
interface BoardCardCount {
    val boardId: Long
    val cnt: Long
}

interface CardRepository : JpaRepository<Card, Long> {
    fun findByBoardIdOrderByIdAsc(boardId: Long): List<Card>

    fun findByIdAndBoardId(
        id: Long,
        boardId: Long,
    ): Optional<Card>

    /** 배치 위치 갱신 — 요청 id 들 중 해당 보드 소속만 반환(소유 검증). */
    fun findByIdInAndBoardId(
        ids: Collection<Long>,
        boardId: Long,
    ): List<Card>

    fun countByBoardId(boardId: Long): Long

    /** 보드 id 다수의 카드 수를 한 번에 집계(전역 허브 N+1 회피). 카드 0개 보드는 결과에 없음. */
    @Query("SELECT c.boardId AS boardId, COUNT(c) AS cnt FROM Card c WHERE c.boardId IN :boardIds GROUP BY c.boardId")
    fun countGroupedByBoardId(
        @Param("boardIds") boardIds: Collection<Long>,
    ): List<BoardCardCount>
}
