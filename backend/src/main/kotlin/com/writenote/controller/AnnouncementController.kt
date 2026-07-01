package com.writenote.controller

import com.writenote.model.response.AnnouncementDetailResponse
import com.writenote.model.response.AnnouncementSummaryResponse
import com.writenote.model.response.HomeAnnouncementsResponse
import com.writenote.model.response.PageResponse
import com.writenote.model.response.Result
import com.writenote.service.AnnouncementService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@Tag(name = "Announcement", description = "공개 공지 조회 — 비인증 허용, 공개된 공지만 노출")
@RestController
@RequestMapping("/api/announcements")
class AnnouncementController(
    private val announcementService: AnnouncementService,
) {
    @GetMapping
    @Operation(summary = "공개 공지 목록", description = "isPublished=true 만, 최신 공개일 순")
    fun listAnnouncements(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): Result<PageResponse<AnnouncementSummaryResponse>> = Result.success(announcementService.listPublished(page, size))

    @GetMapping("/home")
    @Operation(summary = "홈 공지 두 슬롯", description = "고정 1건 + 최신 1건(고정과 중복 제외), 각 없으면 null")
    fun getHomeAnnouncements(): Result<HomeAnnouncementsResponse> = Result.success(announcementService.getHome())

    @GetMapping("/{id}")
    @Operation(summary = "공개 공지 상세", description = "비공개/미존재는 404")
    fun getAnnouncement(
        @PathVariable id: Long,
    ): Result<AnnouncementDetailResponse> = Result.success(announcementService.getPublished(id))
}
