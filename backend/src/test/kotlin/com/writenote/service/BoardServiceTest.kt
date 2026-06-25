package com.writenote.service

import com.writenote.entity.Board
import com.writenote.entity.Card
import com.writenote.entity.Link
import com.writenote.entity.Project
import com.writenote.error.AuthException
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.model.request.BatchCardPositionItem
import com.writenote.model.request.CreateBoardRequest
import com.writenote.model.request.CreateCardRequest
import com.writenote.model.request.CreateLinkRequest
import com.writenote.model.request.UpdateCardRequest
import com.writenote.model.request.UpdateViewportRequest
import com.writenote.repository.BoardRepository
import com.writenote.repository.CardRepository
import com.writenote.repository.CategoryRepository
import com.writenote.repository.LinkRepository
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import io.mockk.every
import io.mockk.justRun
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.Optional

class BoardServiceTest {
    private lateinit var boardRepository: BoardRepository
    private lateinit var cardRepository: CardRepository
    private lateinit var linkRepository: LinkRepository
    private lateinit var projectRepository: ProjectRepository
    private lateinit var categoryRepository: CategoryRepository
    private lateinit var userRepository: UserRepository
    private lateinit var service: BoardService

    @BeforeEach
    fun setUp() {
        boardRepository = mockk()
        cardRepository = mockk()
        linkRepository = mockk()
        projectRepository = mockk()
        categoryRepository = mockk()
        userRepository = mockk()
        service =
            BoardService(
                boardRepository,
                cardRepository,
                linkRepository,
                projectRepository,
                categoryRepository,
                userRepository,
            )
    }

    private fun savedBoard(b: Board): Board =
        b.apply {
            id = id ?: 100L
            createdAt = createdAt ?: Instant.now()
            updatedAt = updatedAt ?: Instant.now()
        }

    private fun ownedBoard(
        id: Long = 100L,
        userId: Long = 1L,
    ): Board = Board(id = id, userId = userId, name = "보드", createdAt = Instant.now(), updatedAt = Instant.now())

    private fun savedCard(c: Card): Card =
        c.apply {
            id = id ?: 500L
            createdAt = createdAt ?: Instant.now()
            updatedAt = updatedAt ?: Instant.now()
        }

    // ── createBoard ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("createBoard — name trim 영속, userId 설정, 매핑 미지정 시 독립")
    fun `createBoard persists trimmed name unmapped`() {
        every { userRepository.existsById(eq(1L)) } returns true
        val captured = slot<Board>()
        every { boardRepository.save(capture(captured)) } answers { savedBoard(firstArg()) }

        val response = service.createBoard(1L, CreateBoardRequest(name = "  1부 플롯  "))

        assertThat(captured.captured.name).isEqualTo("1부 플롯")
        assertThat(captured.captured.userId).isEqualTo(1L)
        assertThat(captured.captured.projectId).isNull()
        assertThat(captured.captured.categoryId).isNull()
        assertThat(response.projectId).isNull()
        assertThat(response.viewport.zoom).isEqualTo(1.0)
    }

    @Test
    @DisplayName("createBoard — 공백만 name 은 ValidationException")
    fun `createBoard rejects blank name`() {
        every { userRepository.existsById(eq(1L)) } returns true

        assertThatThrownBy { service.createBoard(1L, CreateBoardRequest(name = "   ")) }
            .isInstanceOf(ValidationException::class.java)
    }

    @Test
    @DisplayName("createBoard — 존재하지 않는 사용자는 ResourceNotFoundException")
    fun `createBoard rejects unknown user`() {
        every { userRepository.existsById(eq(9L)) } returns false

        assertThatThrownBy { service.createBoard(9L, CreateBoardRequest(name = "x")) }
            .isInstanceOf(ResourceNotFoundException::class.java)
    }

    @Test
    @DisplayName("createBoard — 작품 매핑 시 그 작품에 다른 보드 있으면 409")
    fun `createBoard rejects project already mapped`() {
        every { userRepository.existsById(eq(1L)) } returns true
        every { projectRepository.findByIdAndUserId(eq(7L), eq(1L)) } returns
            Optional.of(Project(id = 7L, userId = 1L, title = "작품"))
        every { boardRepository.findByProjectId(eq(7L)) } returns Optional.of(ownedBoard(id = 200L))

        assertThatThrownBy { service.createBoard(1L, CreateBoardRequest(name = "보드", projectId = 7L)) }
            .isInstanceOf(AuthException::class.java)
    }

    // ── ownership ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("getBoardDetail — 본인 보드 아니면 ResourceNotFoundException")
    fun `getBoardDetail rejects non-owner`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.empty()

        assertThatThrownBy { service.getBoardDetail(1L, 100L) }
            .isInstanceOf(ResourceNotFoundException::class.java)
    }

    // ── mapping ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("setProjectMapping — null 이면 해제(다른 검증 없이)")
    fun `setProjectMapping clears when null`() {
        val board = ownedBoard().apply { projectId = 7L }
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(board)

        val response = service.setProjectMapping(1L, 100L, null)

        assertThat(board.projectId).isNull()
        assertThat(response.projectId).isNull()
    }

    @Test
    @DisplayName("setProjectMapping — 같은 보드 재매핑은 충돌 아님")
    fun `setProjectMapping allows remapping to same board`() {
        val board = ownedBoard(id = 100L)
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(board)
        every { projectRepository.findByIdAndUserId(eq(7L), eq(1L)) } returns
            Optional.of(Project(id = 7L, userId = 1L, title = "P"))
        every { boardRepository.findByProjectId(eq(7L)) } returns Optional.of(board)

        val response = service.setProjectMapping(1L, 100L, 7L)

        assertThat(board.projectId).isEqualTo(7L)
        assertThat(response.projectId).isEqualTo(7L)
    }

    @Test
    @DisplayName("setProjectMapping — 다른 보드가 그 작품에 매핑돼 있으면 409")
    fun `setProjectMapping rejects when other board mapped`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        every { projectRepository.findByIdAndUserId(eq(7L), eq(1L)) } returns
            Optional.of(Project(id = 7L, userId = 1L, title = "P"))
        every { boardRepository.findByProjectId(eq(7L)) } returns Optional.of(ownedBoard(id = 999L))

        assertThatThrownBy { service.setProjectMapping(1L, 100L, 7L) }
            .isInstanceOf(AuthException::class.java)
    }

    @Test
    @DisplayName("setCategoryMapping — 본인 시리즈 아니면 ResourceNotFoundException")
    fun `setCategoryMapping rejects non-owned category`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        every { categoryRepository.existsByIdAndUserId(eq(5L), eq(1L)) } returns false

        assertThatThrownBy { service.setCategoryMapping(1L, 100L, 5L) }
            .isInstanceOf(ResourceNotFoundException::class.java)
    }

    // ── viewport ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("updateViewport — 줌·이동 갱신")
    fun `updateViewport updates zoom and pan`() {
        val board = ownedBoard(id = 100L)
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(board)

        val response = service.updateViewport(1L, 100L, UpdateViewportRequest(zoom = 1.5, x = -40.0, y = 12.5))

        assertThat(board.viewportZoom).isEqualTo(1.5)
        assertThat(board.viewportX).isEqualTo(-40.0)
        assertThat(response.viewport.y).isEqualTo(12.5)
    }

    // ── cards ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("createCard — 본인 보드에 위치·본문 영속")
    fun `createCard persists position and body`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        val captured = slot<Card>()
        every { cardRepository.save(capture(captured)) } answers { savedCard(firstArg()) }

        val response =
            service.createCard(1L, 100L, CreateCardRequest(body = "주인공 등장", posX = 12.5, posY = -3.0))

        assertThat(captured.captured.boardId).isEqualTo(100L)
        assertThat(captured.captured.body).isEqualTo("주인공 등장")
        assertThat(response.posX).isEqualTo(12.5)
        assertThat(response.posY).isEqualTo(-3.0)
        assertThat(response.type).isEqualTo("plot")
    }

    @Test
    @DisplayName("createCard — 타입 지정 시 영속(V25)")
    fun `createCard persists type`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        val captured = slot<Card>()
        every { cardRepository.save(capture(captured)) } answers { savedCard(firstArg()) }

        val response =
            service.createCard(1L, 100L, CreateCardRequest(body = "주인공", posX = 0.0, posY = 0.0, type = "character"))

        assertThat(captured.captured.type).isEqualTo("character")
        assertThat(response.type).isEqualTo("character")
    }

    @Test
    @DisplayName("createCard — 타입 미지정 시 기본 plot")
    fun `createCard defaults type to plot`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        val captured = slot<Card>()
        every { cardRepository.save(capture(captured)) } answers { savedCard(firstArg()) }

        service.createCard(1L, 100L, CreateCardRequest(posX = 0.0, posY = 0.0))

        assertThat(captured.captured.type).isEqualTo("plot")
    }

    @Test
    @DisplayName("createCard — 허용 외 타입은 ValidationException")
    fun `createCard rejects unknown type`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))

        assertThatThrownBy { service.createCard(1L, 100L, CreateCardRequest(posX = 0.0, posY = 0.0, type = "villain")) }
            .isInstanceOf(ValidationException::class.java)
    }

    @Test
    @DisplayName("updateCard — null 필드 미변경, 지정 필드만 갱신")
    fun `updateCard patches only provided fields`() {
        val card =
            Card(
                id = 500L,
                boardId = 100L,
                body = "old",
                posX = 1.0,
                posY = 2.0,
                zIndex = 0,
                createdAt = Instant.now(),
                updatedAt = Instant.now(),
            )
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        every { cardRepository.findByIdAndBoardId(eq(500L), eq(100L)) } returns Optional.of(card)

        val response = service.updateCard(1L, 100L, 500L, UpdateCardRequest(body = "new"))

        assertThat(card.body).isEqualTo("new")
        assertThat(card.posX).isEqualTo(1.0)
        assertThat(response.body).isEqualTo("new")
    }

    @Test
    @DisplayName("batchUpdateCardPositions — 변경분 일괄 위치 갱신")
    fun `batchUpdateCardPositions updates positions`() {
        val c1 =
            Card(id = 1L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now())
        val c2 =
            Card(id = 2L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now())
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        every { cardRepository.findByIdInAndBoardId(any(), eq(100L)) } returns listOf(c1, c2)

        val result =
            service.batchUpdateCardPositions(
                1L,
                100L,
                listOf(
                    BatchCardPositionItem(id = 1L, posX = 10.0, posY = 20.0),
                    BatchCardPositionItem(id = 2L, posX = -5.0, posY = 7.0, zIndex = 3),
                ),
            )

        assertThat(c1.posX).isEqualTo(10.0)
        assertThat(c2.posX).isEqualTo(-5.0)
        assertThat(c2.zIndex).isEqualTo(3)
        assertThat(result).hasSize(2)
    }

    @Test
    @DisplayName("batchUpdateCardPositions — 보드에 없는 카드 id 포함 시 404")
    fun `batchUpdateCardPositions rejects foreign card id`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        // 2개 요청했으나 보드 소속은 1개만 반환 → 소유 검증 실패
        every { cardRepository.findByIdInAndBoardId(any(), eq(100L)) } returns
            listOf(Card(id = 1L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now()))

        assertThatThrownBy {
            service.batchUpdateCardPositions(
                1L,
                100L,
                listOf(
                    BatchCardPositionItem(id = 1L, posX = 1.0, posY = 1.0),
                    BatchCardPositionItem(id = 2L, posX = 2.0, posY = 2.0),
                ),
            )
        }.isInstanceOf(ResourceNotFoundException::class.java)
    }

    @Test
    @DisplayName("deleteCard — 본인 카드 삭제 위임(연결은 DB cascade)")
    fun `deleteCard delegates to repository`() {
        val card =
            Card(id = 500L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now())
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        every { cardRepository.findByIdAndBoardId(eq(500L), eq(100L)) } returns Optional.of(card)
        justRun { cardRepository.delete(eq(card)) }

        service.deleteCard(1L, 100L, 500L)

        verify(exactly = 1) { cardRepository.delete(eq(card)) }
    }

    // ── links ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("createLink — 자기 연결은 BOARD_LINK_INVALID(400)")
    fun `createLink rejects self loop`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))

        assertThatThrownBy { service.createLink(1L, 100L, CreateLinkRequest(sourceCardId = 5L, targetCardId = 5L)) }
            .isInstanceOf(AuthException::class.java)
    }

    @Test
    @DisplayName("createLink — 카드가 보드에 없으면 BOARD_LINK_INVALID")
    fun `createLink rejects card not in board`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        every { cardRepository.findByIdAndBoardId(eq(5L), eq(100L)) } returns
            Optional.of(Card(id = 5L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now()))
        every { cardRepository.findByIdAndBoardId(eq(6L), eq(100L)) } returns Optional.empty()

        assertThatThrownBy { service.createLink(1L, 100L, CreateLinkRequest(sourceCardId = 5L, targetCardId = 6L)) }
            .isInstanceOf(AuthException::class.java)
    }

    @Test
    @DisplayName("createLink — 같은 방향 중복은 BOARD_LINK_DUPLICATE(409)")
    fun `createLink rejects duplicate`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        every { cardRepository.findByIdAndBoardId(eq(5L), eq(100L)) } returns
            Optional.of(Card(id = 5L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now()))
        every { cardRepository.findByIdAndBoardId(eq(6L), eq(100L)) } returns
            Optional.of(Card(id = 6L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now()))
        every { linkRepository.existsByBoardIdAndSourceCardIdAndTargetCardId(eq(100L), eq(5L), eq(6L)) } returns true

        assertThatThrownBy { service.createLink(1L, 100L, CreateLinkRequest(sourceCardId = 5L, targetCardId = 6L)) }
            .isInstanceOf(AuthException::class.java)
    }

    @Test
    @DisplayName("createLink — 유효하면 영속")
    fun `createLink persists when valid`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        every { cardRepository.findByIdAndBoardId(eq(5L), eq(100L)) } returns
            Optional.of(Card(id = 5L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now()))
        every { cardRepository.findByIdAndBoardId(eq(6L), eq(100L)) } returns
            Optional.of(Card(id = 6L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now()))
        every { linkRepository.existsByBoardIdAndSourceCardIdAndTargetCardId(eq(100L), eq(5L), eq(6L)) } returns false
        val captured = slot<Link>()
        every { linkRepository.save(capture(captured)) } answers {
            firstArg<Link>().apply {
                id = 900L
                createdAt = Instant.now()
            }
        }

        val response =
            service.createLink(
                1L,
                100L,
                CreateLinkRequest(sourceCardId = 5L, targetCardId = 6L, sourceHandle = "right", targetHandle = "left"),
            )

        assertThat(captured.captured.boardId).isEqualTo(100L)
        assertThat(captured.captured.sourceHandle).isEqualTo("right")
        assertThat(captured.captured.targetHandle).isEqualTo("left")
        assertThat(response.sourceCardId).isEqualTo(5L)
        assertThat(response.targetCardId).isEqualTo(6L)
        assertThat(response.sourceHandle).isEqualTo("right")
        assertThat(response.targetHandle).isEqualTo("left")
    }
}
