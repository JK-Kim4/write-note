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
 * 플롯 보드(038, 041 트랙 C) 유스케이스 — 작가별 격리(모든 조회·수정·삭제는 본인 보드만, 아니면 404).
 *
 * 소속(041)은 다형 단일(ownerType="project"/"category"/null) + 1:N(한 대상에 보드 여러 개, 매핑충돌 없음).
 * 소속 무결성은 [validateOwner](본인 작품/시리즈) 검증, 대상 hard delete 시 보드 보존은 Project/Category 서비스 훅.
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
        validateOwner(userId, request.ownerType, request.ownerId)
        val board =
            boardRepository.save(
                Board(
                    userId = userId,
                    name = name,
                    ownerType = request.ownerType,
                    ownerId = request.ownerId,
                ),
            )
        return toResponse(board)
    }

    /** 전역 허브(041) — 본인 모든 보드 + 소속 라벨, 최근순. 검색은 FE 클라 필터. */
    @Transactional(readOnly = true)
    fun listMyBoards(userId: Long): List<BoardSummary> {
        requireExistingUser(userId)
        return toSummaries(boardRepository.findByUserIdOrderByUpdatedAtDesc(userId))
    }

    /** 소속 필터 목록(041) — ownerType/ownerId 지정 시 그 대상, unmapped=아이디어, 무필터=전체. 내부 탭(②)용. */
    @Transactional(readOnly = true)
    fun listBoards(
        userId: Long,
        ownerType: String?,
        ownerId: Long?,
        unmapped: Boolean,
    ): List<BoardSummary> {
        requireExistingUser(userId)
        val boards =
            when {
                ownerType != null && ownerId != null ->
                    boardRepository.findByUserIdAndOwnerTypeAndOwnerIdOrderByUpdatedAtDesc(userId, ownerType, ownerId)
                unmapped -> boardRepository.findByUserIdAndOwnerTypeIsNullOrderByUpdatedAtDesc(userId)
                else -> boardRepository.findByUserIdOrderByUpdatedAtDesc(userId)
            }
        return toSummaries(boards)
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

    /** 소속 지정/해제(041) — null 짝=아이디어로 해제(나중에 붙이기 반대). 1:N이라 매핑충돌 없음. */
    @Transactional(rollbackFor = [Exception::class])
    fun setBoardOwner(
        userId: Long,
        boardId: Long,
        ownerType: String?,
        ownerId: Long?,
    ): BoardResponse {
        val board = requireOwnedBoard(userId, boardId)
        validateOwner(userId, ownerType, ownerId)
        board.ownerType = ownerType
        board.ownerId = ownerId
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

    /**
     * 소속(041) 검증 — null 짝=아이디어(OK), "project"/"category"+id=본인 대상 존재, 그 외(짝 불완전·미지원 종류)=거부.
     * 1:N이라 "이미 매핑됨" 충돌 없음. 본인 소유가 아니거나 없는 대상이면 [AuthErrorCode.BOARD_OWNER_INVALID].
     */
    private fun validateOwner(
        userId: Long,
        ownerType: String?,
        ownerId: Long?,
    ) {
        when {
            ownerType == null && ownerId == null -> return
            ownerType == OWNER_PROJECT && ownerId != null ->
                if (projectRepository.findByIdAndUserId(ownerId, userId).isEmpty) {
                    throw AuthException(AuthErrorCode.BOARD_OWNER_INVALID)
                }
            ownerType == OWNER_CATEGORY && ownerId != null ->
                if (!categoryRepository.existsByIdAndUserId(ownerId, userId)) {
                    throw AuthException(AuthErrorCode.BOARD_OWNER_INVALID)
                }
            else -> throw AuthException(AuthErrorCode.BOARD_OWNER_INVALID)
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
            ownerType = board.ownerType,
            ownerId = board.ownerId,
            viewport = ViewportDto(zoom = board.viewportZoom, x = board.viewportX, y = board.viewportY),
            createdAt = requireNotNull(board.createdAt),
            updatedAt = requireNotNull(board.updatedAt),
        )

    /** 목록 → 요약(라벨·카드수). 소속 라벨용 작품명/시리즈명과 카드수를 일괄 조회(N+1 회피). */
    private fun toSummaries(boards: List<Board>): List<BoardSummary> {
        if (boards.isEmpty()) {
            return emptyList()
        }
        val titleById =
            boards
                .filter { it.ownerType == OWNER_PROJECT }
                .mapNotNull { it.ownerId }
                .distinct()
                .let { ids ->
                    if (ids.isEmpty()) {
                        emptyMap()
                    } else {
                        projectRepository.findAllById(ids).associate {
                            requireNotNull(it.id) to
                                it.title
                        }
                    }
                }
        val nameById =
            boards
                .filter { it.ownerType == OWNER_CATEGORY }
                .mapNotNull { it.ownerId }
                .distinct()
                .let { ids ->
                    if (ids.isEmpty()) {
                        emptyMap()
                    } else {
                        categoryRepository.findAllById(ids).associate {
                            requireNotNull(it.id) to
                                it.name
                        }
                    }
                }
        val countById =
            cardRepository.countGroupedByBoardId(boards.mapNotNull { it.id }).associate { it.boardId to it.cnt.toInt() }
        return boards.map { board ->
            BoardSummary(
                id = requireNotNull(board.id),
                name = board.name,
                ownerType = board.ownerType,
                ownerId = board.ownerId,
                ownerLabel = ownerLabel(board, titleById, nameById),
                cardCount = countById[board.id] ?: 0,
                updatedAt = requireNotNull(board.updatedAt),
            )
        }
    }

    /** 소속 라벨 — 작품명/시리즈명, 미소속(또는 삭제된 대상 잔여)이면 "아이디어". */
    private fun ownerLabel(
        board: Board,
        titleById: Map<Long, String>,
        nameById: Map<Long, String>,
    ): String =
        when (board.ownerType) {
            OWNER_PROJECT -> titleById[board.ownerId] ?: IDEA_LABEL
            OWNER_CATEGORY -> nameById[board.ownerId] ?: IDEA_LABEL
            else -> IDEA_LABEL
        }

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
        const val OWNER_PROJECT = "project"
        const val OWNER_CATEGORY = "category"
        const val IDEA_LABEL = "아이디어"
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
