package com.writenote.repository

import com.writenote.entity.Document
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface DocumentRepository : JpaRepository<Document, Long> {
    /** 활성 챕터 목록 — 작품 내 정렬 순서(sort_order ASC). */
    fun findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId: Long): List<Document>

    /** 카드 집계용 일괄 조회 — 활성 챕터만(N+1 금지). */
    fun findByProjectIdInAndDeletedAtIsNull(projectIds: Collection<Long>): List<Document>

    /** 활성 단건 — 저장·본문 전환 등 document id 기반 조회. */
    fun findByIdAndDeletedAtIsNull(id: Long): Optional<Document>

    /** 삭제 포함 단건 — 복구용(소유권 검증: id + projectId 매칭). */
    fun findByIdAndProjectId(
        id: Long,
        projectId: Long,
    ): Optional<Document>
}
