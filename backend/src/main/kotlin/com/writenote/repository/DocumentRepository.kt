package com.writenote.repository

import com.writenote.entity.Document
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface DocumentRepository : JpaRepository<Document, Long> {
    fun findByProjectId(projectId: Long): Optional<Document>

    /** 카드 집계용 일괄 조회(018) — 작품 1:1 문서를 IN 으로 한 번에. */
    fun findByProjectIdIn(projectIds: Collection<Long>): List<Document>
}
