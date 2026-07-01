package com.writenote.service

import com.writenote.entity.Board
import com.writenote.entity.Card
import com.writenote.entity.Link
import com.writenote.error.AuthException
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.model.request.CreateStandaloneCardRequest
import com.writenote.model.request.EditCardRequest
import com.writenote.repository.BoardRepository
import com.writenote.repository.CardRepository
import com.writenote.repository.CategoryRepository
import com.writenote.repository.LinkRepository
import com.writenote.repository.ProjectRepository
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.Optional

/**
 * 카드 관리(048) [CardService] 유닛 — MockK(시스템 경계만 mock). DB 붙는 정렬·영속 검증은 IT(로컬 공유 Postgres).
 */
class CardServiceTest {
    private lateinit var cardRepository: CardRepository
    private lateinit var linkRepository: LinkRepository
    private lateinit var boardRepository: BoardRepository
    private lateinit var projectRepository: ProjectRepository
    private lateinit var categoryRepository: CategoryRepository
    private lateinit var service: CardService

    @BeforeEach
    fun setUp() {
        cardRepository = mockk()
        linkRepository = mockk()
        boardRepository = mockk()
        projectRepository = mockk()
        categoryRepository = mockk()
        service = CardService(cardRepository, linkRepository, boardRepository, projectRepository, categoryRepository)
    }

    private fun card(
        id: Long,
        boardId: Long?,
        body: String = "",
        type: String? = null,
    ): Card = Card(id = id, userId = 1L, boardId = boardId, body = body, type = type, createdAt = Instant.now(), updatedAt = Instant.now())

    private fun board(
        id: Long,
        name: String,
    ): Board = Board(id = id, userId = 1L, name = name, createdAt = Instant.now(), updatedAt = Instant.now())

    private fun link(
        id: Long,
        source: Long,
        target: Long,
    ): Link = Link(id = id, boardId = 3L, sourceCardId = source, targetCardId = target, createdAt = Instant.now())

    private fun savedCard(c: Card): Card =
        c.apply {
            id = id ?: 500L
            createdAt = createdAt ?: Instant.now()
            updatedAt = updatedAt ?: Instant.now()
        }

    // ── listMine ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("listMine — 보드 카드는 보드명, 독립 카드는 null, linkCount=distinct 이웃(양방향 링크여도 1)")
    fun `listMine maps boardName and distinct linkCount`() {
        val c10 = card(10L, boardId = 3L, body = "복선")
        val c11 = card(11L, boardId = 3L, body = "인물")
        val c12 = card(12L, boardId = null, body = "떠도는 메모")
        every { cardRepository.findByUserIdOrderByCreatedAtDescIdDesc(1L) } returns listOf(c12, c11, c10)
        every { boardRepository.findAllById(any()) } returns listOf(board(3L, "1부 플롯"))
        // 10↔11 을 양방향 2링크로 — distinct 이웃은 각각 1
        every { linkRepository.findBySourceCardIdInOrTargetCardIdIn(any(), any()) } returns listOf(link(1L, 10L, 11L), link(2L, 11L, 10L))

        val result = service.listMine(1L).associateBy { it.id }

        assertThat(result.getValue(10L).boardName).isEqualTo("1부 플롯")
        assertThat(result.getValue(10L).ownerLabel).isEqualTo("아이디어") // 소속 없는 아이디어 보드
        assertThat(result.getValue(10L).linkCount).isEqualTo(1)
        assertThat(result.getValue(11L).linkCount).isEqualTo(1)
        assertThat(result.getValue(12L).boardId).isNull()
        assertThat(result.getValue(12L).boardName).isNull()
        assertThat(result.getValue(12L).ownerLabel).isNull() // 독립 카드
        assertThat(result.getValue(12L).linkCount).isEqualTo(0)
    }

    @Test
    @DisplayName("listMine — 카드 0개면 빈 목록(추가 조회 없음)")
    fun `listMine empty`() {
        every { cardRepository.findByUserIdOrderByCreatedAtDescIdDesc(1L) } returns emptyList()
        assertThat(service.listMine(1L)).isEmpty()
    }

    // ── createStandalone ─────────────────────────────────────────────────────

    @Test
    @DisplayName("createStandalone — board_id=null·소유=principal·빈 body(미지정)")
    fun `createStandalone saves independent card`() {
        val captured = slot<Card>()
        every { cardRepository.save(capture(captured)) } answers { savedCard(firstArg()) }

        val response = service.createStandalone(1L, CreateStandaloneCardRequest(body = null, type = null))

        assertThat(captured.captured.userId).isEqualTo(1L)
        assertThat(captured.captured.boardId).isNull()
        assertThat(captured.captured.body).isEqualTo("")
        assertThat(captured.captured.type).isNull()
        assertThat(response.boardName).isNull()
        assertThat(response.linkCount).isEqualTo(0)
    }

    @Test
    @DisplayName("createStandalone — 지원 안 하는 종류 거부(400)")
    fun `createStandalone rejects invalid type`() {
        assertThatThrownBy { service.createStandalone(1L, CreateStandaloneCardRequest(type = "bogus")) }
            .isInstanceOf(ValidationException::class.java)
    }

    // ── editCard ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("editCard — 종류를 null 로 무지정 해제 + 본문 반영")
    fun `editCard clears type and patches body`() {
        val c = card(5L, boardId = 3L, body = "old", type = "event")
        every { cardRepository.findByIdAndUserId(5L, 1L) } returns Optional.of(c)
        every { boardRepository.findAllById(any()) } returns listOf(board(3L, "1부 플롯"))
        every { linkRepository.findBySourceCardIdInOrTargetCardIdIn(any(), any()) } returns emptyList()

        val response = service.editCard(1L, 5L, EditCardRequest(body = "new", type = null))

        assertThat(c.body).isEqualTo("new")
        assertThat(c.type).isNull()
        assertThat(response.type).isNull()
    }

    @Test
    @DisplayName("editCard — 없는·타인 카드 404")
    fun `editCard not found`() {
        every { cardRepository.findByIdAndUserId(5L, 1L) } returns Optional.empty()
        assertThatThrownBy { service.editCard(1L, 5L, EditCardRequest(body = "x")) }
            .isInstanceOf(ResourceNotFoundException::class.java)
    }

    // ── setCardBoard ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("setCardBoard — 연결 있는 카드 재배정 거부(400)")
    fun `setCardBoard rejects linked card`() {
        every { cardRepository.findByIdAndUserId(5L, 1L) } returns Optional.of(card(5L, boardId = 3L))
        every { linkRepository.findBySourceCardIdInOrTargetCardIdIn(listOf(5L), listOf(5L)) } returns listOf(link(1L, 5L, 9L))

        assertThatThrownBy { service.setCardBoard(1L, 5L, 7L) }
            .isInstanceOf(ValidationException::class.java)
    }

    @Test
    @DisplayName("setCardBoard — 타인·없는 대상 보드 거부(BOARD_OWNER_INVALID)")
    fun `setCardBoard rejects non-owned board`() {
        every { cardRepository.findByIdAndUserId(5L, 1L) } returns Optional.of(card(5L, boardId = null))
        every { linkRepository.findBySourceCardIdInOrTargetCardIdIn(listOf(5L), listOf(5L)) } returns emptyList()
        every { boardRepository.findByIdAndUserId(7L, 1L) } returns Optional.empty()

        assertThatThrownBy { service.setCardBoard(1L, 5L, 7L) }
            .isInstanceOf(AuthException::class.java)
    }

    @Test
    @DisplayName("setCardBoard — 본인 보드에 배정 시 기본 위치(0,0)로 이동")
    fun `setCardBoard attaches with default position`() {
        val c =
            card(5L, boardId = null).apply {
                posX = 9.0
                posY = 9.0
            }
        every { cardRepository.findByIdAndUserId(5L, 1L) } returns Optional.of(c)
        every { linkRepository.findBySourceCardIdInOrTargetCardIdIn(listOf(5L), listOf(5L)) } returns emptyList()
        every { boardRepository.findByIdAndUserId(7L, 1L) } returns Optional.of(board(7L, "타깃 보드"))
        every { boardRepository.findAllById(any()) } returns listOf(board(7L, "타깃 보드"))

        val response = service.setCardBoard(1L, 5L, 7L)

        assertThat(c.boardId).isEqualTo(7L)
        assertThat(c.posX).isEqualTo(0.0)
        assertThat(c.posY).isEqualTo(0.0)
        assertThat(response.boardName).isEqualTo("타깃 보드")
    }

    @Test
    @DisplayName("setCardBoard — null 이면 독립으로 떼기(소속 보드 없음)")
    fun `setCardBoard detaches to independent`() {
        val c = card(5L, boardId = 3L)
        every { cardRepository.findByIdAndUserId(5L, 1L) } returns Optional.of(c)
        every { linkRepository.findBySourceCardIdInOrTargetCardIdIn(listOf(5L), listOf(5L)) } returns emptyList()

        val response = service.setCardBoard(1L, 5L, null)

        assertThat(c.boardId).isNull()
        assertThat(response.boardId).isNull()
        assertThat(response.boardName).isNull()
    }

    // ── getCard / deleteCard 소유 격리 ─────────────────────────────────────────

    @Test
    @DisplayName("getCard / deleteCard — 없는·타인 카드 404")
    fun `getCard and deleteCard not found`() {
        every { cardRepository.findByIdAndUserId(5L, 1L) } returns Optional.empty()
        assertThatThrownBy { service.getCard(1L, 5L) }.isInstanceOf(ResourceNotFoundException::class.java)
        assertThatThrownBy { service.deleteCard(1L, 5L) }.isInstanceOf(ResourceNotFoundException::class.java)
    }
}
