package com.writenote.repository

import com.writenote.entity.Document
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface DocumentRepository : JpaRepository<Document, Long> {
    fun findByProjectId(projectId: Long): Optional<Document>
}
