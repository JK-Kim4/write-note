package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.CreateCategoryRequest
import com.writenote.model.request.UpdateCategoryRequest
import com.writenote.model.response.CategoryResponse
import com.writenote.model.response.Result
import com.writenote.service.CategoryService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/categories")
@Tag(name = "모음(카테고리)", description = "작가 본인의 작품 분류 모음 CRUD — owner 식별은 JWT principal 에서만 도출 (032)")
@SecurityRequirement(name = "BearerJwt")
class CategoryController(
    private val categoryService: CategoryService,
) {
    @PostMapping
    @Operation(summary = "모음 생성", description = "JWT principal 의 userId 를 owner 로 새 모음 생성. parentId 비-null 은 400(v1 1뎁스 강제)")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "201", description = "생성 성공"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — name 누락/길이초과 / parentId 비-null"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
        ],
    )
    fun createCategory(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @Valid @RequestBody request: CreateCategoryRequest,
    ): ResponseEntity<Result<CategoryResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(categoryService.create(principal.userId, request)))

    @GetMapping
    @Operation(summary = "모음 목록", description = "본인 모음 전량 sort_order,id 순 + 각 활성 작품 수(projectCount). 빈 모음 포함")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공 (배열 — 페이지네이션 없음)"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
        ],
    )
    fun listCategories(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
    ): Result<List<CategoryResponse>> = Result.success(categoryService.list(principal.userId))

    @PatchMapping("/{categoryId}")
    @Operation(summary = "모음 이름 변경 / 순서", description = "본인 모음만. null 필드는 미변경")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — name 빈값/길이초과"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
        ],
    )
    fun updateCategory(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable categoryId: Long,
        @Valid @RequestBody request: UpdateCategoryRequest,
    ): Result<CategoryResponse> = Result.success(categoryService.rename(principal.userId, categoryId, request))

    @DeleteMapping("/{categoryId}")
    @Operation(
        summary = "모음 삭제 (작품 보존)",
        description = "본인 모음 삭제 — 소속 작품은 DB ON DELETE SET NULL 로 미분류 전환(작품 무손실, FR-007)",
    )
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "204", description = "성공 — body 없음"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
        ],
    )
    fun deleteCategory(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable categoryId: Long,
    ): ResponseEntity<Void> {
        categoryService.delete(principal.userId, categoryId)
        return ResponseEntity.noContent().build()
    }
}
