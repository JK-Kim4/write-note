package com.writenote.service

import com.writenote.entity.Board
import com.writenote.entity.BoardEdge
import com.writenote.entity.BoardNode
import com.writenote.enums.AuthErrorCode
import com.writenote.error.AuthException
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.model.request.BatchNodePositionItem
import com.writenote.model.request.CreateBoardRequest
import com.writenote.model.request.CreateEdgeRequest
import com.writenote.model.request.CreateNodeRequest
import com.writenote.model.request.RenameBoardRequest
import com.writenote.model.request.UpdateNodeRequest
import com.writenote.model.request.UpdateViewportRequest
import com.writenote.model.response.BoardDetailResponse
import com.writenote.model.response.BoardResponse
import com.writenote.model.response.BoardSummary
import com.writenote.model.response.EdgeResponse
import com.writenote.model.response.NodeResponse
import com.writenote.model.response.ViewportDto
import com.writenote.repository.BoardEdgeRepository
import com.writenote.repository.BoardNodeRepository
import com.writenote.repository.BoardRepository
import com.writenote.repository.CategoryRepository
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 플롯 보드(038) 유스케이스 — 작가별 격리(모든 조회·수정·삭제는 본인 보드만, 아니면 404).
 *
 * 보드↔작품·보드↔시리즈 매핑은 0~1:0~1 — 대상당 보드 1개(이미 매핑된 대상에 다른 보드 매핑 시 409).
 * 노드/엣지는 보드 전용이며 캡처 메모(memos)와 무관하다. 보드/노드 삭제 시 엣지는 DB cascade 로 정리.
 */
@Service
class BoardService(
    private val boardRepository: BoardRepository,
    private val boardNodeRepository: BoardNodeRepository,
    private val boardEdgeRepository: BoardEdgeRepository,
    private val projectRepository: ProjectRepository,
    private val categoryRepository: CategoryRepository,
    private val userRepository: UserRepository,
) {
    // ── 보드 ──────────────────────────────────────────────────────────────────

    @Transactional(rollbackFor = [Exception::class])
    fun createBoard(
        userId: Long,
        request: CreateBoardRequest,
    ): BoardResponse {
        requireExistingUser(userId)
        val name = request.name.trim()
        if (name.isEmpty()) {
            throw ValidationException("보드 이름은 비어 있을 수 없습니다")
        }
        request.projectId?.let { requireMappableProject(userId, it, currentBoardId = null) }
        request.categoryId?.let { requireMappableCategory(userId, it, currentBoardId = null) }
        val board =
            boardRepository.save(
                Board(
                    userId = userId,
                    name = name,
                    projectId = request.projectId,
                    categoryId = request.categoryId,
                ),
            )
        return toResponse(board)
    }

    @Transactional(readOnly = true)
    fun listBoards(
        userId: Long,
        projectId: Long?,
        categoryId: Long?,
        unmapped: Boolean,
    ): List<BoardSummary> {
        requireExistingUser(userId)
        val boards =
            when {
                projectId != null -> boardRepository.findByUserIdAndProjectIdOrderByUpdatedAtDesc(userId, projectId)
                categoryId != null -> boardRepository.findByUserIdAndCategoryIdOrderByUpdatedAtDesc(userId, categoryId)
                unmapped ->
                    boardRepository.findByUserIdAndProjectIdIsNullAndCategoryIdIsNullOrderByUpdatedAtDesc(userId)
                else -> boardRepository.findByUserIdOrderByUpdatedAtDesc(userId)
            }
        return boards.map { toSummary(it, boardNodeRepository.countByBoardId(requireNotNull(it.id)).toInt()) }
    }

    @Transactional(readOnly = true)
    fun getBoardDetail(
        userId: Long,
        boardId: Long,
    ): BoardDetailResponse {
        val board = requireOwnedBoard(userId, boardId)
        val nodes = boardNodeRepository.findByBoardIdOrderByIdAsc(boardId).map(::toNode)
        val edges = boardEdgeRepository.findByBoardIdOrderByIdAsc(boardId).map(::toEdge)
        return BoardDetailResponse(board = toResponse(board), nodes = nodes, edges = edges)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun renameBoard(
        userId: Long,
        boardId: Long,
        request: RenameBoardRequest,
    ): BoardResponse {
        val board = requireOwnedBoard(userId, boardId)
        val name = request.name.trim()
        if (name.isEmpty()) {
            throw ValidationException("보드 이름은 비어 있을 수 없습니다")
        }
        board.name = name
        return toResponse(board)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun setProjectMapping(
        userId: Long,
        boardId: Long,
        projectId: Long?,
    ): BoardResponse {
        val board = requireOwnedBoard(userId, boardId)
        if (projectId != null) {
            requireMappableProject(userId, projectId, currentBoardId = boardId)
        }
        board.projectId = projectId
        return toResponse(board)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun setCategoryMapping(
        userId: Long,
        boardId: Long,
        categoryId: Long?,
    ): BoardResponse {
        val board = requireOwnedBoard(userId, boardId)
        if (categoryId != null) {
            requireMappableCategory(userId, categoryId, currentBoardId = boardId)
        }
        board.categoryId = categoryId
        return toResponse(board)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun updateViewport(
        userId: Long,
        boardId: Long,
        request: UpdateViewportRequest,
    ): BoardResponse {
        val board = requireOwnedBoard(userId, boardId)
        board.viewportZoom = request.zoom
        board.viewportX = request.x
        board.viewportY = request.y
        return toResponse(board)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun deleteBoard(
        userId: Long,
        boardId: Long,
    ) {
        val board = requireOwnedBoard(userId, boardId)
        // 노드·엣지는 DB FK ON DELETE CASCADE 로 함께 정리. 캡처 메모(memos)는 무관(무영향).
        boardRepository.delete(board)
    }

    // ── 노드 ──────────────────────────────────────────────────────────────────

    @Transactional(rollbackFor = [Exception::class])
    fun createNode(
        userId: Long,
        boardId: Long,
        request: CreateNodeRequest,
    ): NodeResponse {
        requireOwnedBoard(userId, boardId)
        val node =
            boardNodeRepository.save(
                BoardNode(
                    boardId = boardId,
                    body = request.body ?: "",
                    type = normalizeNodeType(request.type),
                    posX = request.posX,
                    posY = request.posY,
                    zIndex = request.zIndex ?: 0,
                ),
            )
        return toNode(node)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun updateNode(
        userId: Long,
        boardId: Long,
        nodeId: Long,
        request: UpdateNodeRequest,
    ): NodeResponse {
        val node = requireOwnedNode(userId, boardId, nodeId)
        request.body?.let { node.body = it }
        request.type?.let { node.type = normalizeNodeType(it) }
        request.posX?.let { node.posX = it }
        request.posY?.let { node.posY = it }
        request.zIndex?.let { node.zIndex = it }
        return toNode(node)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun batchUpdateNodePositions(
        userId: Long,
        boardId: Long,
        items: List<BatchNodePositionItem>,
    ): List<NodeResponse> {
        requireOwnedBoard(userId, boardId)
        if (items.isEmpty()) {
            return emptyList()
        }
        val ids = items.map { it.id }.distinct()
        val nodesById =
            boardNodeRepository
                .findByIdInAndBoardId(ids, boardId)
                .associateBy { requireNotNull(it.id) }
        if (nodesById.size != ids.size) {
            throw ResourceNotFoundException("Board node not found")
        }
        return items.map { item ->
            val node = nodesById.getValue(item.id)
            node.posX = item.posX
            node.posY = item.posY
            item.zIndex?.let { node.zIndex = it }
            toNode(node)
        }
    }

    @Transactional(rollbackFor = [Exception::class])
    fun deleteNode(
        userId: Long,
        boardId: Long,
        nodeId: Long,
    ) {
        val node = requireOwnedNode(userId, boardId, nodeId)
        // 걸린 엣지는 DB FK ON DELETE CASCADE 로 정리(고아 엣지 방지). 캡처 메모 무영향.
        boardNodeRepository.delete(node)
    }

    // ── 엣지 ──────────────────────────────────────────────────────────────────

    @Transactional(rollbackFor = [Exception::class])
    fun createEdge(
        userId: Long,
        boardId: Long,
        request: CreateEdgeRequest,
    ): EdgeResponse {
        requireOwnedBoard(userId, boardId)
        if (request.sourceNodeId == request.targetNodeId) {
            throw AuthException(AuthErrorCode.BOARD_EDGE_INVALID)
        }
        val bothInBoard =
            boardNodeRepository.findByIdAndBoardId(request.sourceNodeId, boardId).isPresent &&
                boardNodeRepository.findByIdAndBoardId(request.targetNodeId, boardId).isPresent
        if (!bothInBoard) {
            throw AuthException(AuthErrorCode.BOARD_EDGE_INVALID)
        }
        if (boardEdgeRepository.existsByBoardIdAndSourceNodeIdAndTargetNodeId(
                boardId,
                request.sourceNodeId,
                request.targetNodeId,
            )
        ) {
            throw AuthException(AuthErrorCode.BOARD_EDGE_DUPLICATE)
        }
        val edge =
            boardEdgeRepository.save(
                BoardEdge(
                    boardId = boardId,
                    sourceNodeId = request.sourceNodeId,
                    targetNodeId = request.targetNodeId,
                    sourceHandle = request.sourceHandle,
                    targetHandle = request.targetHandle,
                ),
            )
        return toEdge(edge)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun deleteEdge(
        userId: Long,
        boardId: Long,
        edgeId: Long,
    ) {
        requireOwnedBoard(userId, boardId)
        val edge =
            boardEdgeRepository
                .findByIdAndBoardId(edgeId, boardId)
                .orElseThrow { ResourceNotFoundException("Board edge not found") }
        boardEdgeRepository.delete(edge)
    }

    // ── 내부 헬퍼 ──────────────────────────────────────────────────────────────

    private fun requireOwnedBoard(
        userId: Long,
        boardId: Long,
    ): Board =
        boardRepository
            .findByIdAndUserId(boardId, userId)
            .orElseThrow { ResourceNotFoundException("Board not found") }

    private fun requireOwnedNode(
        userId: Long,
        boardId: Long,
        nodeId: Long,
    ): BoardNode {
        requireOwnedBoard(userId, boardId)
        return boardNodeRepository
            .findByIdAndBoardId(nodeId, boardId)
            .orElseThrow { ResourceNotFoundException("Board node not found") }
    }

    /** 작품 매핑 가능 검증 — 본인 작품이어야 하고, 다른 보드가 이미 매핑돼 있으면 409. */
    private fun requireMappableProject(
        userId: Long,
        projectId: Long,
        currentBoardId: Long?,
    ) {
        if (projectRepository.findByIdAndUserId(projectId, userId).isEmpty) {
            throw ResourceNotFoundException("Project not found")
        }
        val existing = boardRepository.findByProjectId(projectId)
        if (existing.isPresent && existing.get().id != currentBoardId) {
            throw AuthException(AuthErrorCode.BOARD_PROJECT_ALREADY_MAPPED)
        }
    }

    /** 시리즈 매핑 가능 검증 — 본인 시리즈여야 하고, 다른 보드가 이미 매핑돼 있으면 409. */
    private fun requireMappableCategory(
        userId: Long,
        categoryId: Long,
        currentBoardId: Long?,
    ) {
        if (!categoryRepository.existsByIdAndUserId(categoryId, userId)) {
            throw ResourceNotFoundException("Category not found")
        }
        val existing = boardRepository.findByCategoryId(categoryId)
        if (existing.isPresent && existing.get().id != currentBoardId) {
            throw AuthException(AuthErrorCode.BOARD_CATEGORY_ALREADY_MAPPED)
        }
    }

    private fun requireExistingUser(userId: Long) {
        if (!userRepository.existsById(userId)) {
            throw ResourceNotFoundException("User not found")
        }
    }

    /** 노드 역할 타입 정규화(V25) — null=기본 'plot', 허용 외 값은 [ValidationException]. */
    private fun normalizeNodeType(value: String?): String {
        val type = value ?: DEFAULT_NODE_TYPE
        if (type !in ALLOWED_NODE_TYPES) {
            throw ValidationException("지원하지 않는 노드 타입입니다: $type")
        }
        return type
    }

    private fun toResponse(board: Board): BoardResponse =
        BoardResponse(
            id = requireNotNull(board.id),
            name = board.name,
            projectId = board.projectId,
            categoryId = board.categoryId,
            viewport = ViewportDto(zoom = board.viewportZoom, x = board.viewportX, y = board.viewportY),
            createdAt = requireNotNull(board.createdAt),
            updatedAt = requireNotNull(board.updatedAt),
        )

    private fun toSummary(
        board: Board,
        nodeCount: Int,
    ): BoardSummary =
        BoardSummary(
            id = requireNotNull(board.id),
            name = board.name,
            projectId = board.projectId,
            categoryId = board.categoryId,
            nodeCount = nodeCount,
            updatedAt = requireNotNull(board.updatedAt),
        )

    private fun toNode(node: BoardNode): NodeResponse =
        NodeResponse(
            id = requireNotNull(node.id),
            body = node.body,
            type = node.type,
            posX = node.posX,
            posY = node.posY,
            zIndex = node.zIndex,
            updatedAt = requireNotNull(node.updatedAt),
        )

    private companion object {
        const val DEFAULT_NODE_TYPE = "plot"
        val ALLOWED_NODE_TYPES = setOf("plot", "character", "place", "theme", "note")
    }

    private fun toEdge(edge: BoardEdge): EdgeResponse =
        EdgeResponse(
            id = requireNotNull(edge.id),
            sourceNodeId = edge.sourceNodeId,
            targetNodeId = edge.targetNodeId,
            sourceHandle = edge.sourceHandle,
            targetHandle = edge.targetHandle,
        )
}
