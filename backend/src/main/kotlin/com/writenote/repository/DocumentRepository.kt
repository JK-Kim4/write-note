package com.writenote.repository

import com.writenote.entity.Document
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
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

    /**
     * 제목만 갱신 — JPQL bulk update 는 @Version(updatedAt) 을 자동 증가시키지 않는다(SET 에 version 미포함).
     * 제목은 본문 낙관적 잠금과 무관한 메타이므로 토큰을 올리면 안 된다(024 거짓 409 방지).
     * clearAutomatically=true 로 1차 캐시를 비워 영속 엔티티 stale 을 막는다.
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Document d SET d.title = :title WHERE d.id = :id AND d.deletedAt IS NULL")
    fun updateTitleById(
        @Param("id") id: Long,
        @Param("title") title: String,
    ): Int
}
