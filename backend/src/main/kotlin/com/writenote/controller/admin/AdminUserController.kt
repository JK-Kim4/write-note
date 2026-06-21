package com.writenote.controller.admin

import com.writenote.model.response.AdminUserResponse
import com.writenote.model.response.PageResponse
import com.writenote.model.response.Result
import com.writenote.service.AdminUserService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@Tag(name = "AdminUser", description = "어드민 회원 조회(읽기 전용) — 단일 관리자만, 비밀값 미노출")
@RestController
@RequestMapping("/api/admin/users")
@SecurityRequirement(name = "BearerJwt")
class AdminUserController(
    private val adminUserService: AdminUserService,
) {
    @GetMapping
    @Operation(summary = "회원 목록/검색", description = "가입일 최신순, q 로 이메일 부분검색")
    fun listUsers(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @RequestParam(required = false) q: String?,
    ): Result<PageResponse<AdminUserResponse>> = Result.success(adminUserService.listUsers(page, size, q))

    @GetMapping("/{id}")
    @Operation(summary = "회원 상세", description = "미존재 404")
    fun getUser(
        @PathVariable id: Long,
    ): Result<AdminUserResponse> = Result.success(adminUserService.getUser(id))
}
