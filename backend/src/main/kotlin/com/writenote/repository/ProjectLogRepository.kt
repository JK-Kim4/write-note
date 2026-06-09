package com.writenote.repository

import com.writenote.entity.ProjectLog
import org.springframework.data.jpa.repository.JpaRepository

interface ProjectLogRepository : JpaRepository<ProjectLog, Long> {
    /** 작품의 기록 전체 — 생성 최신순(FR-011). */
    fun findByProjectIdOrderByCreatedAtDesc(projectId: Long): List<ProjectLog>

    /** 작품의 최신 기록 1건 — 카드 집계용(FR-012). 없으면 null. */
    fun findFirstByProjectIdOrderByCreatedAtDesc(projectId: Long): ProjectLog?
}
