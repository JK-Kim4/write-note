package com.writenote.service

import com.writenote.entity.Board
import com.writenote.entity.Card
import com.writenote.entity.Category
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
import com.writenote.repository.BoardCardCount
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
    @DisplayName("createBoard — name trim 영속, userId 설정, owner 미지정 시 아이디어 보드")
    fun `createBoard persists trimmed name unmapped`() {
        every { userRepository.existsById(eq(1L)) } returns true
        val captured = slot<Board>()
        every { boardRepository.save(capture(captured)) } answers { savedBoard(firstArg()) }

        val response = service.createBoard(1L, CreateBoardRequest(name = "  1부 플롯  "))

        assertThat(captured.captured.name).isEqualTo("1부 플롯")
        assertThat(captured.captured.userId).isEqualTo(1L)
        assertThat(captured.captured.ownerType).isNull()
        assertThat(captured.captured.ownerId).isNull()
        assertThat(response.ownerType).isNull()
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
    @DisplayName("createBoard — owner=작품(본인) 영속")
    fun `createBoard persists owner project`() {
        every { userRepository.existsById(eq(1L)) } returns true
        every { projectRepository.findByIdAndUserId(eq(7L), eq(1L)) } returns
            Optional.of(Project(id = 7L, userId = 1L, title = "작품"))
        val captured = slot<Board>()
        every { boardRepository.save(capture(captured)) } answers { savedBoard(firstArg()) }

        val response = service.createBoard(1L, CreateBoardRequest(name = "보드", ownerType = "project", ownerId = 7L))

        assertThat(captured.captured.ownerType).isEqualTo("project")
        assertThat(captured.captured.ownerId).isEqualTo(7L)
        assertThat(response.ownerType).isEqualTo("project")
        assertThat(response.ownerId).isEqualTo(7L)
    }

    @Test
    @DisplayName("createBoard — 본인 아닌/없는 작품 owner 는 BOARD_OWNER_INVALID(400)")
    fun `createBoard rejects foreign project owner`() {
        every { userRepository.existsById(eq(1L)) } returns true
        every { projectRepository.findByIdAndUserId(eq(7L), eq(1L)) } returns Optional.empty()

        assertThatThrownBy {
            service.createBoard(1L, CreateBoardRequest(name = "보드", ownerType = "project", ownerId = 7L))
        }.isInstanceOf(AuthException::class.java)
    }

    @Test
    @DisplayName("createBoard — owner 종류·id 짝 불완전(종류만)은 BOARD_OWNER_INVALID")
    fun `createBoard rejects incomplete owner pair`() {
        every { userRepository.existsById(eq(1L)) } returns true

        assertThatThrownBy {
            service.createBoard(1L, CreateBoardRequest(name = "보드", ownerType = "project", ownerId = null))
        }.isInstanceOf(AuthException::class.java)
    }

    @Test
    @DisplayName("createBoard — 1:N: 같은 작품에 보드 둘 다 생성(매핑충돌 없음)")
    fun `createBoard allows multiple boards per project`() {
        every { userRepository.existsById(eq(1L)) } returns true
        every { projectRepository.findByIdAndUserId(eq(7L), eq(1L)) } returns
            Optional.of(Project(id = 7L, userId = 1L, title = "작품"))
        val captured = slot<Board>()
        every { boardRepository.save(capture(captured)) } answers { savedBoard(firstArg()) }

        service.createBoard(1L, CreateBoardRequest(name = "보드1", ownerType = "project", ownerId = 7L))
        val second = service.createBoard(1L, CreateBoardRequest(name = "보드2", ownerType = "project", ownerId = 7L))

        assertThat(second.ownerType).isEqualTo("project")
        assertThat(second.ownerId).isEqualTo(7L)
    }

    // ── ownership ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("getBoardDetail — 본인 보드 아니면 ResourceNotFoundException")
    fun `getBoardDetail rejects non-owner`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.empty()

        assertThatThrownBy { service.getBoardDetail(1L, 100L) }
            .isInstanceOf(ResourceNotFoundException::class.java)
    }

    // ── setBoardOwner ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("setBoardOwner — 본인 작품에 연결")
    fun `setBoardOwner attaches to project`() {
        val board = ownedBoard(id = 100L)
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(board)
        every { projectRepository.findByIdAndUserId(eq(7L), eq(1L)) } returns
            Optional.of(Project(id = 7L, userId = 1L, title = "P"))

        val response = service.setBoardOwner(1L, 100L, "project", 7L)

        assertThat(board.ownerType).isEqualTo("project")
        assertThat(board.ownerId).isEqualTo(7L)
        assertThat(response.ownerId).isEqualTo(7L)
    }

    @Test
    @DisplayName("setBoardOwner — null 짝이면 아이디어로 해제")
    fun `setBoardOwner clears to idea`() {
        val board =
            ownedBoard(id = 100L).apply {
                ownerType = "project"
                ownerId = 7L
            }
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(board)

        val response = service.setBoardOwner(1L, 100L, null, null)

        assertThat(board.ownerType).isNull()
        assertThat(board.ownerId).isNull()
        assertThat(response.ownerType).isNull()
    }

    @Test
    @DisplayName("setBoardOwner — 본인 아닌 시리즈는 BOARD_OWNER_INVALID")
    fun `setBoardOwner rejects foreign category`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        every { categoryRepository.existsByIdAndUserId(eq(5L), eq(1L)) } returns false

        assertThatThrownBy { service.setBoardOwner(1L, 100L, "category", 5L) }
            .isInstanceOf(AuthException::class.java)
    }

    @Test
    @DisplayName("setBoardOwner — 미지원 owner 종류는 BOARD_OWNER_INVALID")
    fun `setBoardOwner rejects unknown owner type`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))

        assertThatThrownBy { service.setBoardOwner(1L, 100L, "memo", 5L) }
            .isInstanceOf(AuthException::class.java)
    }

    // ── listMyBoards (라벨 파생) ──────────────────────────────────────────────

    @Test
    @DisplayName("listMyBoards — 소속 라벨 파생(작품명/시리즈명/아이디어) + 카드수 일괄(N+1 회피)")
    fun `listMyBoards derives owner labels and counts`() {
        every { userRepository.existsById(eq(1L)) } returns true
        val b1 =
            ownedBoard(id = 10L).apply {
                ownerType = "project"
                ownerId = 7L
            }
        val b2 =
            ownedBoard(id = 20L).apply {
                ownerType = "category"
                ownerId = 3L
            }
        val b3 = ownedBoard(id = 30L) // 아이디어(미소속)
        every { boardRepository.findByUserIdOrderByUpdatedAtDesc(eq(1L)) } returns listOf(b1, b2, b3)
        every { projectRepository.findAllById(eq(listOf(7L))) } returns
            listOf(Project(id = 7L, userId = 1L, title = "달밤"))
        every { categoryRepository.findAllById(eq(listOf(3L))) } returns
            listOf(Category(id = 3L, userId = 1L, name = "늑대 연대기", createdAt = Instant.now(), updatedAt = Instant.now()))
        every { cardRepository.countGroupedByBoardId(eq(listOf(10L, 20L, 30L))) } returns listOf(cardCount(10L, 5L))

        val result = service.listMyBoards(1L)

        assertThat(result.map { it.ownerLabel }).containsExactly("달밤", "늑대 연대기", "아이디어")
        assertThat(result.first { it.id == 10L }.cardCount).isEqualTo(5)
        assertThat(result.first { it.id == 30L }.cardCount).isEqualTo(0)
    }

    private fun cardCount(
        forBoardId: Long,
        count: Long,
    ): BoardCardCount =
        object : BoardCardCount {
            override val boardId = forBoardId
            override val cnt = count
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
