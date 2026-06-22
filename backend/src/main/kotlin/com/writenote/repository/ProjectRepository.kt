package com.writenote.repository

import com.writenote.entity.Project
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.Optional

/** 운영 툴 회원 조회(030 US2) — userId 별 작품 수 집계 projection(N+1 회피). */
interface ProjectCountByUser {
    val userId: Long
    val cnt: Long
}

/** 모음(032) — categoryId 별 활성 작품 수 집계 projection(N+1 회피). */
interface CategoryProjectCount {
    val categoryId: Long
    val cnt: Long
}

interface ProjectRepository : JpaRepository<Project, Long> {
    @Query(
        "SELECT p.userId AS userId, COUNT(p) AS cnt FROM Project p WHERE p.userId IN :userIds GROUP BY p.userId",
    )
    fun countByUserIds(userIds: List<Long>): List<ProjectCountByUser>

    fun findByIdAndUserId(
        id: Long,
        userId: Long,
    ): Optional<Project>

    fun findByUserIdAndArchivedAtIsNullOrderByUpdatedAtDesc(
        userId: Long,
        pageable: Pageable,
    ): Page<Project>

    fun findByUserIdAndArchivedAtIsNotNullOrderByArchivedAtDesc(
        userId: Long,
        pageable: Pageable,
    ): Page<Project>

    /** 카드 집계용(018) — 활성 작품 전량(베타 작품 소수 전제, 페이지네이션 없음). */
    fun findByUserIdAndArchivedAtIsNull(userId: Long): List<Project>

    /** 모음(032) — 작가의 모음별 활성 작품 수(보관 제외). 미분류(category_id NULL) 제외. */
    @Query(
        "SELECT p.categoryId AS categoryId, COUNT(p) AS cnt FROM Project p " +
            "WHERE p.userId = :userId AND p.categoryId IS NOT NULL AND p.archivedAt IS NULL GROUP BY p.categoryId",
    )
    fun countActiveByCategory(userId: Long): List<CategoryProjectCount>
}
