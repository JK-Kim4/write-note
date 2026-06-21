package com.writenote.controller.admin

import com.writenote.model.request.CreateAnnouncementRequest
import com.writenote.model.request.UpdateAnnouncementRequest
import com.writenote.model.response.AdminAnnouncementResponse
import com.writenote.model.response.PageResponse
import com.writenote.model.response.Result
import com.writenote.service.AnnouncementService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@Tag(name = "AdminAnnouncement", description = "어드민 공지 CRUD — 단일 관리자(app.admin.email)만")
@RestController
@RequestMapping("/api/admin/announcements")
@SecurityRequirement(name = "BearerJwt")
class AdminAnnouncementController(
    private val announcementService: AnnouncementService,
) {
    @GetMapping
    @Operation(summary = "공지 전체 목록(공개/비공개)", description = "최신 생성 순")
    fun listAnnouncements(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): Result<PageResponse<AdminAnnouncementResponse>> = Result.success(announcementService.listAll(page, size))

    @PostMapping
    @Operation(summary = "공지 작성", description = "title/body 빈 값 400")
    fun createAnnouncement(
        @Valid @RequestBody request: CreateAnnouncementRequest,
    ): ResponseEntity<Result<AdminAnnouncementResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(announcementService.create(request)))

    @PutMapping("/{id}")
    @Operation(summary = "공지 수정", description = "공개/고정 토글 포함, 미존재 404")
    fun updateAnnouncement(
        @PathVariable id: Long,
        @Valid @RequestBody request: UpdateAnnouncementRequest,
    ): Result<AdminAnnouncementResponse> = Result.success(announcementService.update(id, request))

    @DeleteMapping("/{id}")
    @Operation(summary = "공지 삭제", description = "미존재 404")
    fun deleteAnnouncement(
        @PathVariable id: Long,
    ): ResponseEntity<Void> {
        announcementService.delete(id)
        return ResponseEntity.noContent().build()
    }
}
