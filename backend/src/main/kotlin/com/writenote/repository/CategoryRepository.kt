package com.writenote.repository

import com.writenote.entity.Category
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.Optional

interface CategoryRepository : JpaRepository<Category, Long> {
    fun findByIdAndUserId(
        id: Long,
        userId: Long,
    ): Optional<Category>

    fun existsByIdAndUserId(
        id: Long,
        userId: Long,
    ): Boolean

    /** 작가별 모음 전량 — sort_order, id 순(빈 모음 포함). */
    fun findByUserIdOrderBySortOrderAscIdAsc(userId: Long): List<Category>

    /** 신규 모음 sortOrder 산정용 — 현재 최대값(없으면 -1 → 신규=0). */
    @Query("SELECT COALESCE(MAX(c.sortOrder), -1) FROM Category c WHERE c.userId = :userId")
    fun maxSortOrder(userId: Long): Int
}
