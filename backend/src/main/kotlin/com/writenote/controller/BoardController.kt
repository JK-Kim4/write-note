package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.BatchCardPositionItem
import com.writenote.model.request.CreateBoardRequest
import com.writenote.model.request.CreateCardRequest
import com.writenote.model.request.CreateLinkRequest
import com.writenote.model.request.RenameBoardRequest
import com.writenote.model.request.SetBoardOwnerRequest
import com.writenote.model.request.UpdateCardRequest
import com.writenote.model.request.UpdateCardTypeRequest
import com.writenote.model.request.UpdateViewportRequest
import com.writenote.model.response.BoardDetailResponse
import com.writenote.model.response.BoardResponse
import com.writenote.model.response.BoardSummary
import com.writenote.model.response.CardResponse
import com.writenote.model.response.LinkResponse
import com.writenote.model.response.Result
import com.writenote.service.BoardService
import io.swagger.v3.oas.annotations.Operation
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
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 플롯 보드(038) — 작가 본인 소유 보드/카드/연결 CRUD. owner 식별은 JWT principal 에서만 도출.
 */
@RestController
@RequestMapping("/api/boards")
@Tag(name = "플롯 보드", description = "작품/시리즈와 독립인 플롯 설계 보드 — 카드·연결·매핑 (038)")
@SecurityRequirement(name = "BearerJwt")
class BoardController(
    private val boardService: BoardService,
) {
    // ── 보드 ──────────────────────────────────────────────────────────────────

    @PostMapping
    @Operation(summary = "보드 생성", description = "독립 보드 생성(매핑 선택). 대상에 이미 보드 있으면 409")
    fun createBoard(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @Valid @RequestBody request: CreateBoardRequest,
    ): ResponseEntity<Result<BoardResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(boardService.createBoard(principal.userId, request)))

    @GetMapping("/mine")
    @Operation(summary = "전역 보드 허브", description = "본인 모든 보드 + 소속 라벨(작품명/시리즈명/\"아이디어\"), 최근순. 검색은 클라 필터")
    fun listMyBoards(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
    ): Result<List<BoardSummary>> = Result.success(boardService.listMyBoards(principal.userId))

    @GetMapping
    @Operation(summary = "보드 목록(소속 필터)", description = "본인 보드. 필터: ownerType+ownerId / unmapped(아이디어)")
    fun listBoards(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @RequestParam(required = false) ownerType: String?,
        @RequestParam(required = false) ownerId: Long?,
        @RequestParam(required = false, defaultValue = "false") unmapped: Boolean,
    ): Result<List<BoardSummary>> = Result.success(boardService.listBoards(principal.userId, ownerType, ownerId, unmapped))

    @GetMapping("/{boardId}")
    @Operation(summary = "보드 열기(하이드레이션)", description = "메타 + 카드 + 연결 + 뷰포트")
    fun getBoard(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
    ): Result<BoardDetailResponse> = Result.success(boardService.getBoardDetail(principal.userId, boardId))

    @PatchMapping("/{boardId}")
    @Operation(summary = "보드 이름 변경")
    fun renameBoard(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @Valid @RequestBody request: RenameBoardRequest,
    ): Result<BoardResponse> = Result.success(boardService.renameBoard(principal.userId, boardId, request))

    @PatchMapping("/{boardId}/owner")
    @Operation(
        summary = "소속 지정/해제",
        description = "ownerType(project/category)+ownerId=작품/시리즈에 연결, null 짝=아이디어로 해제. 1:N(매핑충돌 없음). 없는·본인 아닌 대상 400",
    )
    fun setOwner(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @RequestBody request: SetBoardOwnerRequest,
    ): Result<BoardResponse> = Result.success(boardService.setBoardOwner(principal.userId, boardId, request.ownerType, request.ownerId))

    @PatchMapping("/{boardId}/viewport")
    @Operation(summary = "화면 상태 저장", description = "줌·이동(디바운스 1회)")
    fun updateViewport(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @RequestBody request: UpdateViewportRequest,
    ): Result<BoardResponse> = Result.success(boardService.updateViewport(principal.userId, boardId, request))

    @DeleteMapping("/{boardId}")
    @Operation(summary = "보드 삭제", description = "카드·연결 cascade. 캡처 메모 무영향")
    fun deleteBoard(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
    ): ResponseEntity<Void> {
        boardService.deleteBoard(principal.userId, boardId)
        return ResponseEntity.noContent().build()
    }

    // ── 카드 ──────────────────────────────────────────────────────────────────

    @PostMapping("/{boardId}/cards")
    @Operation(summary = "카드 생성", description = "생성 시점 위치 부여")
    fun createCard(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @Valid @RequestBody request: CreateCardRequest,
    ): ResponseEntity<Result<CardResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(boardService.createCard(principal.userId, boardId, request)))

    @PatchMapping("/{boardId}/cards/{cardId}")
    @Operation(summary = "카드 수정(본문/위치)", description = "null 필드는 미변경. 종류 변경은 /type 전용 경로")
    fun updateCard(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @PathVariable cardId: Long,
        @Valid @RequestBody request: UpdateCardRequest,
    ): Result<CardResponse> = Result.success(boardService.updateCard(principal.userId, boardId, cardId, request))

    @PatchMapping("/{boardId}/cards/{cardId}/type")
    @Operation(summary = "카드 종류 설정/해제", description = "type=null 이면 무지정 해제, 값은 4종(character/place/event/theme)")
    fun setCardType(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @PathVariable cardId: Long,
        @Valid @RequestBody request: UpdateCardTypeRequest,
    ): Result<CardResponse> = Result.success(boardService.setCardType(principal.userId, boardId, cardId, request.type))

    @PatchMapping("/{boardId}/cards")
    @Operation(summary = "위치 배치 저장", description = "드래그 종료·다중선택 변경분 1회")
    fun batchUpdateCards(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @RequestBody items: List<BatchCardPositionItem>,
    ): Result<List<CardResponse>> = Result.success(boardService.batchUpdateCardPositions(principal.userId, boardId, items))

    @DeleteMapping("/{boardId}/cards/{cardId}")
    @Operation(summary = "카드 삭제", description = "걸린 연결 cascade. 캡처 메모 무영향")
    fun deleteCard(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @PathVariable cardId: Long,
    ): ResponseEntity<Void> {
        boardService.deleteCard(principal.userId, boardId, cardId)
        return ResponseEntity.noContent().build()
    }

    // ── 연결 ──────────────────────────────────────────────────────────────────

    @PostMapping("/{boardId}/links")
    @Operation(summary = "연결 생성", description = "자기연결/타보드 400, 중복 409")
    fun createLink(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @Valid @RequestBody request: CreateLinkRequest,
    ): ResponseEntity<Result<LinkResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(boardService.createLink(principal.userId, boardId, request)))

    @DeleteMapping("/{boardId}/links/{linkId}")
    @Operation(summary = "연결 삭제")
    fun deleteLink(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @PathVariable linkId: Long,
    ): ResponseEntity<Void> {
        boardService.deleteLink(principal.userId, boardId, linkId)
        return ResponseEntity.noContent().build()
    }
}
