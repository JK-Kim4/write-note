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
}
