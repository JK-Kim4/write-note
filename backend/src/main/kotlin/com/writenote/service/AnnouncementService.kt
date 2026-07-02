package com.writenote.service

import com.writenote.entity.Announcement
import com.writenote.error.ResourceNotFoundException
import com.writenote.model.request.CreateAnnouncementRequest
import com.writenote.model.request.UpdateAnnouncementRequest
import com.writenote.model.response.AdminAnnouncementResponse
import com.writenote.model.response.AnnouncementDetailResponse
import com.writenote.model.response.AnnouncementSummaryResponse
import com.writenote.model.response.HomeAnnouncementsResponse
import com.writenote.model.response.PageResponse
import com.writenote.repository.AnnouncementRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class AnnouncementService(
    private val announcementRepository: AnnouncementRepository,
) {
    // --- 공개 (비인증) ---

    @Transactional(readOnly = true)
    fun listPublished(
        page: Int,
        size: Int,
    ): PageResponse<AnnouncementSummaryResponse> {
        require(page >= 0) { "page must be greater than or equal to 0" }
        require(size in 1..100) { "size must be between 1 and 100" }
        val result =
            announcementRepository.findAllByIsPublishedTrueOrderByPublishedAtDesc(PageRequest.of(page, size))
        return PageResponse.from(result.map(::toSummary))
    }

    /**
     * 홈 두 슬롯 — [pinned] (공개+고정 중 공개일 최신 1건), [latest] (공개일 최신 1건, 단 pinned 와 동일하면 그다음).
     * 같은 공지가 두 슬롯에 중복 노출되지 않도록 latest 는 pinned 를 제외한다.
     */
    @Transactional(readOnly = true)
    fun getHome(): HomeAnnouncementsResponse {
        val pinned: Announcement? =
            announcementRepository.findFirstByIsPublishedTrueAndIsPinnedTrueOrderByPublishedAtDesc().orElse(null)
        val topTwo =
            announcementRepository.findAllByIsPublishedTrueOrderByPublishedAtDesc(PageRequest.of(0, 2)).content
        val latest = topTwo.firstOrNull { it.id != pinned?.id }
        return HomeAnnouncementsResponse(
            pinned = pinned?.let(::toSummary),
            latest = latest?.let(::toSummary),
        )
    }

    @Transactional(readOnly = true)
    fun getPublished(id: Long): AnnouncementDetailResponse =
        announcementRepository
            .findByIdAndIsPublishedTrue(id)
            .map(::toDetail)
            .orElseThrow { ResourceNotFoundException("Announcement not found") }

    // --- 어드민 ---

    @Transactional(readOnly = true)
    fun listAll(
        page: Int,
        size: Int,
    ): PageResponse<AdminAnnouncementResponse> {
        require(page >= 0) { "page must be greater than or equal to 0" }
        require(size in 1..100) { "size must be between 1 and 100" }
        val result = announcementRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size))
        return PageResponse.from(result.map(::toAdmin))
    }

    @Transactional(rollbackFor = [Exception::class])
    fun create(request: CreateAnnouncementRequest): AdminAnnouncementResponse {
        val saved =
            announcementRepository.save(
                Announcement(
                    title = request.title.trim(),
                    body = request.body,
                    isPublished = request.isPublished,
                    isPinned = request.isPinned,
                    publishedAt = if (request.isPublished) Instant.now() else null,
                ),
            )
        return toAdmin(saved)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun update(
        id: Long,
        request: UpdateAnnouncementRequest,
    ): AdminAnnouncementResponse {
        val announcement =
            announcementRepository
                .findById(id)
                .orElseThrow { ResourceNotFoundException("Announcement not found") }

        announcement.title = request.title.trim()
        announcement.body = request.body
        announcement.isPinned = request.isPinned
        // 비공개 → 공개 전환 시 publishedAt 최초 1회 설정
        if (request.isPublished && announcement.publishedAt == null) {
            announcement.publishedAt = Instant.now()
        }
        announcement.isPublished = request.isPublished

        return toAdmin(announcement)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun delete(id: Long) {
        val announcement =
            announcementRepository
                .findById(id)
                .orElseThrow { ResourceNotFoundException("Announcement not found") }
        announcementRepository.delete(announcement)
    }

    private fun toSummary(entity: Announcement): AnnouncementSummaryResponse =
        AnnouncementSummaryResponse(
            id = requireNotNull(entity.id),
            title = entity.title,
            publishedAt = entity.publishedAt,
        )

    private fun toDetail(entity: Announcement): AnnouncementDetailResponse =
        AnnouncementDetailResponse(
            id = requireNotNull(entity.id),
            title = entity.title,
            body = entity.body,
            publishedAt = entity.publishedAt,
        )

    private fun toAdmin(entity: Announcement): AdminAnnouncementResponse =
        AdminAnnouncementResponse(
            id = requireNotNull(entity.id),
            title = entity.title,
            body = entity.body,
            isPublished = entity.isPublished,
            isPinned = entity.isPinned,
            publishedAt = entity.publishedAt,
            createdAt = requireNotNull(entity.createdAt),
            updatedAt = requireNotNull(entity.updatedAt),
        )
}
