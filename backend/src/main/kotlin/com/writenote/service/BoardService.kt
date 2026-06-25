package com.writenote.service

import com.writenote.entity.Board
import com.writenote.entity.Card
import com.writenote.entity.Link
import com.writenote.enums.AuthErrorCode
import com.writenote.error.AuthException
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.model.request.BatchCardPositionItem
import com.writenote.model.request.CreateBoardRequest
import com.writenote.model.request.CreateCardRequest
import com.writenote.model.request.CreateLinkRequest
import com.writenote.model.request.RenameBoardRequest
import com.writenote.model.request.UpdateCardRequest
import com.writenote.model.request.UpdateViewportRequest
import com.writenote.model.response.BoardDetailResponse
import com.writenote.model.response.BoardResponse
import com.writenote.model.response.BoardSummary
import com.writenote.model.response.CardResponse
import com.writenote.model.response.LinkResponse
import com.writenote.model.response.ViewportDto
import com.writenote.repository.BoardRepository
import com.writenote.repository.CardRepository
import com.writenote.repository.CategoryRepository
import com.writenote.repository.LinkRepository
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 플롯 보드(038) 유스케이스 — 작가별 격리(모든 조회·수정·삭제는 본인 보드만, 아니면 404).
 *
 * 보드↔작품·보드↔시리즈 매핑은 0~1:0~1 — 대상당 보드 1개(이미 매핑된 대상에 다른 보드 매핑 시 409).
 * 카드/연결은 보드 전용이며 캡처 메모(memos)와 무관하다. 보드/카드 삭제 시 연결은 DB cascade 로 정리.
 */
@Service
class BoardService(
    private val boardRepository: BoardRepository,
    private val cardRepository: CardRepository,
    private val linkRepository: LinkRepository,
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
        return boards.map { toSummary(it, cardRepository.countByBoardId(requireNotNull(it.id)).toInt()) }
    }

    @Transactional(readOnly = true)
    fun getBoardDetail(
        userId: Long,
        boardId: Long,
    ): BoardDetailResponse {
        val board = requireOwnedBoard(userId, boardId)
        val cards = cardRepository.findByBoardIdOrderByIdAsc(boardId).map(::toCard)
        val links = linkRepository.findByBoardIdOrderByIdAsc(boardId).map(::toLink)
        return BoardDetailResponse(board = toResponse(board), cards = cards, links = links)
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
        // 카드·연결은 DB FK ON DELETE CASCADE 로 함께 정리. 캡처 메모(memos)는 무관(무영향).
        boardRepository.delete(board)
    }

    // ── 카드 ──────────────────────────────────────────────────────────────────

    @Transactional(rollbackFor = [Exception::class])
    fun createCard(
        userId: Long,
        boardId: Long,
        request: CreateCardRequest,
    ): CardResponse {
        requireOwnedBoard(userId, boardId)
        val card =
            cardRepository.save(
                Card(
                    boardId = boardId,
                    body = request.body ?: "",
                    type = normalizeCardType(request.type),
                    posX = request.posX,
                    posY = request.posY,
                    zIndex = request.zIndex ?: 0,
                ),
            )
        return toCard(card)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun updateCard(
        userId: Long,
        boardId: Long,
        cardId: Long,
        request: UpdateCardRequest,
    ): CardResponse {
        val card = requireOwnedCard(userId, boardId, cardId)
        request.body?.let { card.body = it }
        request.type?.let { card.type = normalizeCardType(it) }
        request.posX?.let { card.posX = it }
        request.posY?.let { card.posY = it }
        request.zIndex?.let { card.zIndex = it }
        return toCard(card)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun batchUpdateCardPositions(
        userId: Long,
        boardId: Long,
        items: List<BatchCardPositionItem>,
    ): List<CardResponse> {
        requireOwnedBoard(userId, boardId)
        if (items.isEmpty()) {
            return emptyList()
        }
        val ids = items.map { it.id }.distinct()
        val cardsById =
            cardRepository
                .findByIdInAndBoardId(ids, boardId)
                .associateBy { requireNotNull(it.id) }
        if (cardsById.size != ids.size) {
            throw ResourceNotFoundException("Card not found")
        }
        return items.map { item ->
            val card = cardsById.getValue(item.id)
            card.posX = item.posX
            card.posY = item.posY
            item.zIndex?.let { card.zIndex = it }
            toCard(card)
        }
    }

    @Transactional(rollbackFor = [Exception::class])
    fun deleteCard(
        userId: Long,
        boardId: Long,
        cardId: Long,
    ) {
        val card = requireOwnedCard(userId, boardId, cardId)
        // 걸린 연결은 DB FK ON DELETE CASCADE 로 정리(고아 연결 방지). 캡처 메모 무영향.
        cardRepository.delete(card)
    }

    // ── 연결 ──────────────────────────────────────────────────────────────────

    @Transactional(rollbackFor = [Exception::class])
    fun createLink(
        userId: Long,
        boardId: Long,
        request: CreateLinkRequest,
    ): LinkResponse {
        requireOwnedBoard(userId, boardId)
        if (request.sourceCardId == request.targetCardId) {
            throw AuthException(AuthErrorCode.BOARD_LINK_INVALID)
        }
        val bothInBoard =
            cardRepository.findByIdAndBoardId(request.sourceCardId, boardId).isPresent &&
                cardRepository.findByIdAndBoardId(request.targetCardId, boardId).isPresent
        if (!bothInBoard) {
            throw AuthException(AuthErrorCode.BOARD_LINK_INVALID)
        }
        if (linkRepository.existsByBoardIdAndSourceCardIdAndTargetCardId(
                boardId,
                request.sourceCardId,
                request.targetCardId,
            )
        ) {
            throw AuthException(AuthErrorCode.BOARD_LINK_DUPLICATE)
        }
        val link =
            linkRepository.save(
                Link(
                    boardId = boardId,
                    sourceCardId = request.sourceCardId,
                    targetCardId = request.targetCardId,
                    sourceHandle = request.sourceHandle,
                    targetHandle = request.targetHandle,
                ),
            )
        return toLink(link)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun deleteLink(
        userId: Long,
        boardId: Long,
        linkId: Long,
    ) {
        requireOwnedBoard(userId, boardId)
        val link =
            linkRepository
                .findByIdAndBoardId(linkId, boardId)
                .orElseThrow { ResourceNotFoundException("Link not found") }
        linkRepository.delete(link)
    }

    // ── 내부 헬퍼 ──────────────────────────────────────────────────────────────

    private fun requireOwnedBoard(
        userId: Long,
        boardId: Long,
    ): Board =
        boardRepository
            .findByIdAndUserId(boardId, userId)
            .orElseThrow { ResourceNotFoundException("Board not found") }

    private fun requireOwnedCard(
        userId: Long,
        boardId: Long,
        cardId: Long,
    ): Card {
        requireOwnedBoard(userId, boardId)
        return cardRepository
            .findByIdAndBoardId(cardId, boardId)
            .orElseThrow { ResourceNotFoundException("Card not found") }
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

    /** 카드 역할 타입 정규화(V25) — null=기본 'plot', 허용 외 값은 [ValidationException]. */
    private fun normalizeCardType(value: String?): String {
        val type = value ?: DEFAULT_CARD_TYPE
        if (type !in ALLOWED_CARD_TYPES) {
            throw ValidationException("지원하지 않는 카드 타입입니다: $type")
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
        cardCount: Int,
    ): BoardSummary =
        BoardSummary(
            id = requireNotNull(board.id),
            name = board.name,
            projectId = board.projectId,
            categoryId = board.categoryId,
            cardCount = cardCount,
            updatedAt = requireNotNull(board.updatedAt),
        )

    private fun toCard(card: Card): CardResponse =
        CardResponse(
            id = requireNotNull(card.id),
            body = card.body,
            type = card.type,
            posX = card.posX,
            posY = card.posY,
            zIndex = card.zIndex,
            updatedAt = requireNotNull(card.updatedAt),
        )

    private companion object {
        const val DEFAULT_CARD_TYPE = "plot"
        val ALLOWED_CARD_TYPES = setOf("plot", "character", "place", "theme", "note")
    }

    private fun toLink(link: Link): LinkResponse =
        LinkResponse(
            id = requireNotNull(link.id),
            sourceCardId = link.sourceCardId,
            targetCardId = link.targetCardId,
            sourceHandle = link.sourceHandle,
            targetHandle = link.targetHandle,
        )
}
