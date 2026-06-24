package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.BatchNodePositionItem
import com.writenote.model.request.CreateBoardRequest
import com.writenote.model.request.CreateEdgeRequest
import com.writenote.model.request.CreateNodeRequest
import com.writenote.model.request.RenameBoardRequest
import com.writenote.model.request.SetBoardCategoryRequest
import com.writenote.model.request.SetBoardProjectRequest
import com.writenote.model.request.UpdateNodeRequest
import com.writenote.model.request.UpdateViewportRequest
import com.writenote.model.response.BoardDetailResponse
import com.writenote.model.response.BoardResponse
import com.writenote.model.response.BoardSummary
import com.writenote.model.response.EdgeResponse
import com.writenote.model.response.NodeResponse
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
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 플롯 보드(038) — 작가 본인 소유 보드/노드/엣지 CRUD. owner 식별은 JWT principal 에서만 도출.
 */
@RestController
@RequestMapping("/api/boards")
@Tag(name = "플롯 보드", description = "작품/시리즈와 독립인 플롯 설계 보드 — 노드·연결·매핑 (038)")
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

    @GetMapping
    @Operation(summary = "보드 목록", description = "본인 보드. 필터: projectId / categoryId / unmapped")
    fun listBoards(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @RequestParam(required = false) projectId: Long?,
        @RequestParam(required = false) categoryId: Long?,
        @RequestParam(required = false, defaultValue = "false") unmapped: Boolean,
    ): Result<List<BoardSummary>> = Result.success(boardService.listBoards(principal.userId, projectId, categoryId, unmapped))

    @GetMapping("/{boardId}")
    @Operation(summary = "보드 열기(하이드레이션)", description = "메타 + 노드 + 엣지 + 뷰포트")
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

    @PutMapping("/{boardId}/project")
    @Operation(summary = "작품 매핑 set/clear", description = "projectId null=해제. 그 작품에 다른 보드 있으면 409")
    fun setProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @RequestBody request: SetBoardProjectRequest,
    ): Result<BoardResponse> = Result.success(boardService.setProjectMapping(principal.userId, boardId, request.projectId))

    @PutMapping("/{boardId}/category")
    @Operation(summary = "시리즈 매핑 set/clear", description = "categoryId null=해제. 그 시리즈에 다른 보드 있으면 409")
    fun setCategory(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @RequestBody request: SetBoardCategoryRequest,
    ): Result<BoardResponse> = Result.success(boardService.setCategoryMapping(principal.userId, boardId, request.categoryId))

    @PatchMapping("/{boardId}/viewport")
    @Operation(summary = "화면 상태 저장", description = "줌·이동(디바운스 1회)")
    fun updateViewport(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @RequestBody request: UpdateViewportRequest,
    ): Result<BoardResponse> = Result.success(boardService.updateViewport(principal.userId, boardId, request))

    @DeleteMapping("/{boardId}")
    @Operation(summary = "보드 삭제", description = "노드·엣지 cascade. 캡처 메모 무영향")
    fun deleteBoard(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
    ): ResponseEntity<Void> {
        boardService.deleteBoard(principal.userId, boardId)
        return ResponseEntity.noContent().build()
    }

    // ── 노드 ──────────────────────────────────────────────────────────────────

    @PostMapping("/{boardId}/nodes")
    @Operation(summary = "노드 생성", description = "생성 시점 위치 부여")
    fun createNode(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @Valid @RequestBody request: CreateNodeRequest,
    ): ResponseEntity<Result<NodeResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(boardService.createNode(principal.userId, boardId, request)))

    @PatchMapping("/{boardId}/nodes/{nodeId}")
    @Operation(summary = "노드 수정(본문/위치)", description = "null 필드는 미변경")
    fun updateNode(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @PathVariable nodeId: Long,
        @Valid @RequestBody request: UpdateNodeRequest,
    ): Result<NodeResponse> = Result.success(boardService.updateNode(principal.userId, boardId, nodeId, request))

    @PatchMapping("/{boardId}/nodes")
    @Operation(summary = "위치 배치 저장", description = "드래그 종료·다중선택 변경분 1회")
    fun batchUpdateNodes(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @RequestBody items: List<BatchNodePositionItem>,
    ): Result<List<NodeResponse>> = Result.success(boardService.batchUpdateNodePositions(principal.userId, boardId, items))

    @DeleteMapping("/{boardId}/nodes/{nodeId}")
    @Operation(summary = "노드 삭제", description = "걸린 엣지 cascade. 캡처 메모 무영향")
    fun deleteNode(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @PathVariable nodeId: Long,
    ): ResponseEntity<Void> {
        boardService.deleteNode(principal.userId, boardId, nodeId)
        return ResponseEntity.noContent().build()
    }

    // ── 엣지 ──────────────────────────────────────────────────────────────────

    @PostMapping("/{boardId}/edges")
    @Operation(summary = "연결 생성", description = "자기연결/타보드 400, 중복 409")
    fun createEdge(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @Valid @RequestBody request: CreateEdgeRequest,
    ): ResponseEntity<Result<EdgeResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(boardService.createEdge(principal.userId, boardId, request)))

    @DeleteMapping("/{boardId}/edges/{edgeId}")
    @Operation(summary = "연결 삭제")
    fun deleteEdge(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable boardId: Long,
        @PathVariable edgeId: Long,
    ): ResponseEntity<Void> {
        boardService.deleteEdge(principal.userId, boardId, edgeId)
        return ResponseEntity.noContent().build()
    }
}
