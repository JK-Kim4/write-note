package com.writenote.repository

import com.writenote.entity.Announcement
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface AnnouncementRepository : JpaRepository<Announcement, Long> {
    /** 공개 목록 — 최신 공개일 순. */
    fun findAllByIsPublishedTrueOrderByPublishedAtDesc(pageable: Pageable): Page<Announcement>

    /** 공개 상세 — 비공개/미존재는 빈 Optional. */
    fun findByIdAndIsPublishedTrue(id: Long): Optional<Announcement>

    /** 홈 고정 슬롯 — 공개+고정 중 공개일 최신 1건. */
    fun findFirstByIsPublishedTrueAndIsPinnedTrueOrderByPublishedAtDesc(): Optional<Announcement>

    /** 어드민 전체 목록 — 공개/비공개 모두, 최신 생성 순. */
    fun findAllByOrderByCreatedAtDesc(pageable: Pageable): Page<Announcement>
}
