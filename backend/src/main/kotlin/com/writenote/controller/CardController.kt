package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.CreateStandaloneCardRequest
import com.writenote.model.request.EditCardRequest
import com.writenote.model.request.SetCardBoardRequest
import com.writenote.model.response.CardItemResponse
import com.writenote.model.response.Result
import com.writenote.service.CardService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
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

/**
 * 카드 관리(048) — 여러 보드를 가로지르는 카드 목록/상세/수정/삭제 + 보드 없는 독립 카드 생성·재배정.
 * 유저 스코프(소유 = JWT principal). 보드 캔버스 카드는 [BoardController](`/api/boards/{id}/cards`)가 담당(무변경).
 */
@RestController
@RequestMapping("/api/cards")
@Tag(name = "카드 관리", description = "여러 보드를 가로지르는 카드 관리 + 독립 카드 (048)")
@SecurityRequirement(name = "BearerJwt")
class CardController(
    private val cardService: CardService,
) {
    @GetMapping
    @Operation(summary = "카드 목록", description = "본인 카드 전량(보드 소속 + 독립), 생성일 내림차순. boardName·linkCount 동봉")
    fun listCards(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
    ): Result<List<CardItemResponse>> = Result.success(cardService.listMine(principal.userId))

    @PostMapping
    @Operation(summary = "독립 카드 생성", description = "보드 없는 카드. body 미지정 시 빈 본문(FE 가드)")
    fun createCard(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @RequestBody request: CreateStandaloneCardRequest,
    ): ResponseEntity<Result<CardItemResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(cardService.createStandalone(principal.userId, request)))

    @GetMapping("/{cardId}")
    @Operation(summary = "카드 상세", description = "종류·본문·소속 보드·연결 수. 없음/타인 404")
    fun getCard(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable cardId: Long,
    ): Result<CardItemResponse> = Result.success(cardService.getCard(principal.userId, cardId))

    @PatchMapping("/{cardId}")
    @Operation(summary = "카드 수정", description = "본문(null=미변경)/종류(null=무지정으로 해제). 보드 카드·독립 공통")
    fun editCard(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable cardId: Long,
        @RequestBody request: EditCardRequest,
    ): Result<CardItemResponse> = Result.success(cardService.editCard(principal.userId, cardId, request))

    @DeleteMapping("/{cardId}")
    @Operation(summary = "카드 삭제", description = "걸린 링크 DB cascade. 없음/타인 404")
    fun deleteCard(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable cardId: Long,
    ): ResponseEntity<Void> {
        cardService.deleteCard(principal.userId, cardId)
        return ResponseEntity.noContent().build()
    }

    @PatchMapping("/{cardId}/board")
    @Operation(
        summary = "소속 보드 변경(재배정)",
        description = "연결 없는 카드만. boardId=본인 보드 배정, null=독립으로 떼기. 연결 있으면 400, 타인 대상 보드 400",
    )
    fun setCardBoard(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable cardId: Long,
        @RequestBody request: SetCardBoardRequest,
    ): Result<CardItemResponse> = Result.success(cardService.setCardBoard(principal.userId, cardId, request.boardId))
}
