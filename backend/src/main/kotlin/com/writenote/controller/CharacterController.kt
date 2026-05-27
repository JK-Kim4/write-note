package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.CreateCharacterRequest
import com.writenote.model.request.ReorderCharactersRequest
import com.writenote.model.request.UpdateCharacterRequest
import com.writenote.model.response.CharacterResponse
import com.writenote.model.response.PageResponse
import com.writenote.model.response.Result
import com.writenote.service.CharacterService
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
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@Tag(name = "Character", description = "프로젝트 등장인물 CRUD — owner 식별은 JWT principal 에서만 도출")
@RestController
@RequestMapping("/api/projects/{projectId}/characters")
@SecurityRequirement(name = "BearerJwt")
class CharacterController(
    private val characterService: CharacterService,
) {
    @GetMapping
    @Operation(summary = "인물 목록", description = "display_order ASC + created_at ASC 정렬")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공 (페이지네이션 envelope)"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 본인 소유 projectId 아님 / 미존재"),
        ],
    )
    fun listCharacters(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "50") size: Int,
    ): Result<PageResponse<CharacterResponse>> = Result.success(characterService.listCharacters(principal.userId, projectId, page, size))

    @GetMapping("/{characterId}")
    @Operation(summary = "인물 단건 조회")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 본인 소유 projectId 아님 / 인물 미존재 / 다른 프로젝트 인물"),
        ],
    )
    fun getCharacter(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
        @PathVariable characterId: Long,
    ): Result<CharacterResponse> = Result.success(characterService.getCharacter(principal.userId, projectId, characterId))

    @PostMapping
    @Operation(summary = "인물 추가")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "201", description = "성공"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — name 누락 / 길이 초과"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 본인 소유 projectId 아님"),
        ],
    )
    fun createCharacter(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
        @Valid @RequestBody request: CreateCharacterRequest,
    ): ResponseEntity<Result<CharacterResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(characterService.createCharacter(principal.userId, projectId, request)))

    @PatchMapping("/{characterId}")
    @Operation(summary = "인물 부분 수정", description = "null = 미변경, 명시값 = 갱신")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — 명시된 필드의 검증 실패"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
        ],
    )
    fun updateCharacter(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
        @PathVariable characterId: Long,
        @Valid @RequestBody request: UpdateCharacterRequest,
    ): Result<CharacterResponse> = Result.success(characterService.updateCharacter(principal.userId, projectId, characterId, request))

    @PutMapping("/reorder")
    @Operation(summary = "인물 표시 순서 일괄 갱신", description = "전체 인물 ID permutation 전송 — null/누락/중복/외부ID 시 400")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공 (새 순서 응답)"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — 누락 / 중복 / 외부 ID"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 본인 소유 projectId 아님"),
        ],
    )
    fun reorderCharacters(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
        @Valid @RequestBody request: ReorderCharactersRequest,
    ): Result<PageResponse<CharacterResponse>> = Result.success(characterService.reorderCharacters(principal.userId, projectId, request))

    @DeleteMapping("/{characterId}")
    @Operation(summary = "인물 삭제")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "204", description = "성공 — body 없음"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
        ],
    )
    fun deleteCharacter(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
        @PathVariable characterId: Long,
    ): ResponseEntity<Void> {
        characterService.deleteCharacter(principal.userId, projectId, characterId)
        return ResponseEntity.noContent().build()
    }
}
