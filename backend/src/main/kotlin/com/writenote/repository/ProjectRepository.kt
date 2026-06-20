package com.writenote.repository

import com.writenote.entity.Project
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface ProjectRepository : JpaRepository<Project, Long> {
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
}
