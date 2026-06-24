package com.writenote.repository

import com.writenote.entity.Board
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface BoardRepository : JpaRepository<Board, Long> {
    fun findByIdAndUserId(
        id: Long,
        userId: Long,
    ): Optional<Board>

    /** 본인 보드 전량 — 최신 갱신순. */
    fun findByUserIdOrderByUpdatedAtDesc(userId: Long): List<Board>

    /** 작품 매핑 필터(본인). */
    fun findByUserIdAndProjectIdOrderByUpdatedAtDesc(
        userId: Long,
        projectId: Long,
    ): List<Board>

    /** 시리즈 매핑 필터(본인). */
    fun findByUserIdAndCategoryIdOrderByUpdatedAtDesc(
        userId: Long,
        categoryId: Long,
    ): List<Board>

    /** 미매핑(작품·시리즈 둘 다 없음) 독립 보드(본인). */
    fun findByUserIdAndProjectIdIsNullAndCategoryIdIsNullOrderByUpdatedAtDesc(userId: Long): List<Board>

    /** 작품에 매핑된 보드(대상당 1개 충돌 검사용). */
    fun findByProjectId(projectId: Long): Optional<Board>

    /** 시리즈에 매핑된 보드(대상당 1개 충돌 검사용). */
    fun findByCategoryId(categoryId: Long): Optional<Board>
}
