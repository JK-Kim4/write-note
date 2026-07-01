package com.writenote.service

import com.writenote.entity.Card
import com.writenote.enums.AuthErrorCode
import com.writenote.error.AuthException
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.model.request.CreateStandaloneCardRequest
import com.writenote.model.request.EditCardRequest
import com.writenote.model.response.CardItemResponse
import com.writenote.repository.BoardRepository
import com.writenote.repository.CardRepository
import com.writenote.repository.CategoryRepository
import com.writenote.repository.LinkRepository
import com.writenote.repository.ProjectRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 카드 관리(048) — 여러 보드를 가로지르는 카드 목록/상세/수정/삭제 + 보드 없는 독립 카드 생성·재배정.
 *
 * 소유 = `card.userId == principal`(보드 경유 아님, 아니면 404). 보드 캔버스 카드 CRUD 는 [BoardService](보드 스코프)가
 * 담당하며 무변경. 카드 삭제 시 걸린 링크는 DB FK cascade 로 정리(프론트 중복 삭제 없음).
 */
@Service
class CardService(
    private val cardRepository: CardRepository,
    private val linkRepository: LinkRepository,
    private val boardRepository: BoardRepository,
    private val projectRepository: ProjectRepository,
    private val categoryRepository: CategoryRepository,
) {
    /** 목록(US1) — 본인 카드 전량(보드 소속 + 독립), 생성일 내림차순. boardName·linkCount 일괄(N+1 회피). */
    @Transactional(readOnly = true)
    fun listMine(userId: Long): List<CardItemResponse> {
        val cards = cardRepository.findByUserIdOrderByCreatedAtDescIdDesc(userId)
        if (cards.isEmpty()) {
            return emptyList()
        }
        val boardInfo = boardInfoFor(cards)
        val linkCounts = linkCountsFor(cards)
        return cards.map { toItem(it, boardInfo, linkCounts) }
    }

    /** 상세(US3) — 유저 스코프. */
    @Transactional(readOnly = true)
    fun getCard(
        userId: Long,
        cardId: Long,
    ): CardItemResponse {
        val card = requireOwnedCard(userId, cardId)
        return toItem(card, boardInfoFor(listOf(card)), linkCountsFor(listOf(card)))
    }

    /** 독립 카드 생성(US2) — board_id=null·소유=principal. body 미지정 시 빈 본문(FE 가 내용 필수 가드). */
    @Transactional(rollbackFor = [Exception::class])
    fun createStandalone(
        userId: Long,
        request: CreateStandaloneCardRequest,
    ): CardItemResponse {
        val card =
            cardRepository.save(
                Card(
                    userId = userId,
                    boardId = null,
                    body = request.body ?: "",
                    type = CardTypes.normalize(request.type),
                    posX = 0.0,
                    posY = 0.0,
                ),
            )
        return toItem(card, emptyMap(), emptyMap())
    }

    /** 수정(US3) — 본문(null=미변경)/종류(항상 반영: null=무지정으로 해제). 보드 카드·독립 공통. */
    @Transactional(rollbackFor = [Exception::class])
    fun editCard(
        userId: Long,
        cardId: Long,
        request: EditCardRequest,
    ): CardItemResponse {
        val card = requireOwnedCard(userId, cardId)
        request.body?.let { card.body = it }
        card.type = CardTypes.normalize(request.type)
        return toItem(card, boardInfoFor(listOf(card)), linkCountsFor(listOf(card)))
    }

    /** 삭제(US4) — 걸린 링크는 DB FK cascade 로 정리. */
    @Transactional(rollbackFor = [Exception::class])
    fun deleteCard(
        userId: Long,
        cardId: Long,
    ) {
        val card = requireOwnedCard(userId, cardId)
        cardRepository.delete(card)
    }

    /**
     * 소속 보드 변경(US5) — **연결 없는 카드만**. [boardId]=본인 보드에 배정(기본 위치), null=독립으로 떼기.
     * 연결 있으면 400(FR-017a), 없는·타인 대상 보드 400(BOARD_OWNER_INVALID).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun setCardBoard(
        userId: Long,
        cardId: Long,
        boardId: Long?,
    ): CardItemResponse {
        val card = requireOwnedCard(userId, cardId)
        if (linkRepository.findBySourceCardIdInOrTargetCardIdIn(listOf(cardId), listOf(cardId)).isNotEmpty()) {
            throw ValidationException("연결이 있는 카드는 소속 보드를 바꿀 수 없습니다")
        }
        if (boardId != null && boardRepository.findByIdAndUserId(boardId, userId).isEmpty) {
            throw AuthException(AuthErrorCode.BOARD_OWNER_INVALID)
        }
        card.boardId = boardId
        if (boardId != null) {
            card.posX = 0.0
            card.posY = 0.0
        }
        return toItem(card, boardInfoFor(listOf(card)), emptyMap())
    }

    // ── 내부 헬퍼 ──────────────────────────────────────────────────────────────

    private fun requireOwnedCard(
        userId: Long,
        cardId: Long,
    ): Card =
        cardRepository
            .findByIdAndUserId(cardId, userId)
            .orElseThrow { ResourceNotFoundException("Card not found") }

    /** 대상 카드들의 소속 보드 정보(이름 + 소속 작품/시리즈 라벨) — 독립 카드 제외, 일괄 조회(N+1 회피). */
    private fun boardInfoFor(cards: List<Card>): Map<Long, BoardInfo> {
        val boardIds = cards.mapNotNull { it.boardId }.distinct()
        if (boardIds.isEmpty()) {
            return emptyMap()
        }
        val boards = boardRepository.findAllById(boardIds)
        val titleById =
            boards.filter { it.ownerType == OWNER_PROJECT }.mapNotNull { it.ownerId }.distinct().let { ids ->
                if (ids.isEmpty()) emptyMap() else projectRepository.findAllById(ids).associate { requireNotNull(it.id) to it.title }
            }
        val nameById =
            boards.filter { it.ownerType == OWNER_CATEGORY }.mapNotNull { it.ownerId }.distinct().let { ids ->
                if (ids.isEmpty()) emptyMap() else categoryRepository.findAllById(ids).associate { requireNotNull(it.id) to it.name }
            }
        return boards.associate { board ->
            requireNotNull(board.id) to
                BoardInfo(
                    name = board.name,
                    ownerType = board.ownerType,
                    ownerLabel =
                        when (board.ownerType) {
                            OWNER_PROJECT -> titleById[board.ownerId] ?: IDEA_LABEL
                            OWNER_CATEGORY -> nameById[board.ownerId] ?: IDEA_LABEL
                            else -> IDEA_LABEL
                        },
                )
        }
    }

    /** 카드별 distinct 이웃 카드 수(A→B·B→A 별개 링크여도 이웃 집합 1) — 일괄 조회(N+1 회피). */
    private fun linkCountsFor(cards: List<Card>): Map<Long, Int> {
        val ids = cards.mapNotNull { it.id }
        if (ids.isEmpty()) {
            return emptyMap()
        }
        val links = linkRepository.findBySourceCardIdInOrTargetCardIdIn(ids, ids)
        if (links.isEmpty()) {
            return emptyMap()
        }
        val neighbors = HashMap<Long, MutableSet<Long>>()
        for (link in links) {
            neighbors.getOrPut(link.sourceCardId) { mutableSetOf() }.add(link.targetCardId)
            neighbors.getOrPut(link.targetCardId) { mutableSetOf() }.add(link.sourceCardId)
        }
        return neighbors.mapValues { it.value.size }
    }

    private fun toItem(
        card: Card,
        boardInfo: Map<Long, BoardInfo>,
        linkCounts: Map<Long, Int>,
    ): CardItemResponse {
        val info = card.boardId?.let { boardInfo[it] }
        return CardItemResponse(
            id = requireNotNull(card.id),
            boardId = card.boardId,
            boardName = info?.name,
            ownerType = info?.ownerType,
            ownerLabel = info?.ownerLabel,
            body = card.body,
            type = card.type,
            linkCount = card.id?.let { linkCounts[it] } ?: 0,
            createdAt = requireNotNull(card.createdAt),
            updatedAt = requireNotNull(card.updatedAt),
        )
    }

    private data class BoardInfo(
        val name: String,
        val ownerType: String?,
        val ownerLabel: String,
    )

    private companion object {
        const val OWNER_PROJECT = "project"
        const val OWNER_CATEGORY = "category"
        const val IDEA_LABEL = "아이디어"
    }
}
