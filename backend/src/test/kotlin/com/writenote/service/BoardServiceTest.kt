package com.writenote.service

import com.writenote.entity.Board
import com.writenote.entity.BoardEdge
import com.writenote.entity.BoardNode
import com.writenote.entity.Project
import com.writenote.error.AuthException
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.model.request.BatchNodePositionItem
import com.writenote.model.request.CreateBoardRequest
import com.writenote.model.request.CreateEdgeRequest
import com.writenote.model.request.CreateNodeRequest
import com.writenote.model.request.UpdateNodeRequest
import com.writenote.model.request.UpdateViewportRequest
import com.writenote.repository.BoardEdgeRepository
import com.writenote.repository.BoardNodeRepository
import com.writenote.repository.BoardRepository
import com.writenote.repository.CategoryRepository
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
    private lateinit var boardNodeRepository: BoardNodeRepository
    private lateinit var boardEdgeRepository: BoardEdgeRepository
    private lateinit var projectRepository: ProjectRepository
    private lateinit var categoryRepository: CategoryRepository
    private lateinit var userRepository: UserRepository
    private lateinit var service: BoardService

    @BeforeEach
    fun setUp() {
        boardRepository = mockk()
        boardNodeRepository = mockk()
        boardEdgeRepository = mockk()
        projectRepository = mockk()
        categoryRepository = mockk()
        userRepository = mockk()
        service =
            BoardService(
                boardRepository,
                boardNodeRepository,
                boardEdgeRepository,
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

    private fun savedNode(n: BoardNode): BoardNode =
        n.apply {
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

    // ── nodes ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("createNode — 본인 보드에 위치·본문 영속")
    fun `createNode persists position and body`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        val captured = slot<BoardNode>()
        every { boardNodeRepository.save(capture(captured)) } answers { savedNode(firstArg()) }

        val response =
            service.createNode(1L, 100L, CreateNodeRequest(body = "주인공 등장", posX = 12.5, posY = -3.0))

        assertThat(captured.captured.boardId).isEqualTo(100L)
        assertThat(captured.captured.body).isEqualTo("주인공 등장")
        assertThat(response.posX).isEqualTo(12.5)
        assertThat(response.posY).isEqualTo(-3.0)
        assertThat(response.type).isEqualTo("plot")
    }

    @Test
    @DisplayName("createNode — 타입 지정 시 영속(V25)")
    fun `createNode persists type`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        val captured = slot<BoardNode>()
        every { boardNodeRepository.save(capture(captured)) } answers { savedNode(firstArg()) }

        val response =
            service.createNode(1L, 100L, CreateNodeRequest(body = "주인공", posX = 0.0, posY = 0.0, type = "character"))

        assertThat(captured.captured.type).isEqualTo("character")
        assertThat(response.type).isEqualTo("character")
    }

    @Test
    @DisplayName("createNode — 타입 미지정 시 기본 plot")
    fun `createNode defaults type to plot`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        val captured = slot<BoardNode>()
        every { boardNodeRepository.save(capture(captured)) } answers { savedNode(firstArg()) }

        service.createNode(1L, 100L, CreateNodeRequest(posX = 0.0, posY = 0.0))

        assertThat(captured.captured.type).isEqualTo("plot")
    }

    @Test
    @DisplayName("createNode — 허용 외 타입은 ValidationException")
    fun `createNode rejects unknown type`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))

        assertThatThrownBy { service.createNode(1L, 100L, CreateNodeRequest(posX = 0.0, posY = 0.0, type = "villain")) }
            .isInstanceOf(ValidationException::class.java)
    }

    @Test
    @DisplayName("updateNode — null 필드 미변경, 지정 필드만 갱신")
    fun `updateNode patches only provided fields`() {
        val node =
            BoardNode(
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
        every { boardNodeRepository.findByIdAndBoardId(eq(500L), eq(100L)) } returns Optional.of(node)

        val response = service.updateNode(1L, 100L, 500L, UpdateNodeRequest(body = "new"))

        assertThat(node.body).isEqualTo("new")
        assertThat(node.posX).isEqualTo(1.0)
        assertThat(response.body).isEqualTo("new")
    }

    @Test
    @DisplayName("batchUpdateNodePositions — 변경분 일괄 위치 갱신")
    fun `batchUpdateNodePositions updates positions`() {
        val n1 =
            BoardNode(id = 1L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now())
        val n2 =
            BoardNode(id = 2L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now())
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        every { boardNodeRepository.findByIdInAndBoardId(any(), eq(100L)) } returns listOf(n1, n2)

        val result =
            service.batchUpdateNodePositions(
                1L,
                100L,
                listOf(
                    BatchNodePositionItem(id = 1L, posX = 10.0, posY = 20.0),
                    BatchNodePositionItem(id = 2L, posX = -5.0, posY = 7.0, zIndex = 3),
                ),
            )

        assertThat(n1.posX).isEqualTo(10.0)
        assertThat(n2.posX).isEqualTo(-5.0)
        assertThat(n2.zIndex).isEqualTo(3)
        assertThat(result).hasSize(2)
    }

    @Test
    @DisplayName("batchUpdateNodePositions — 보드에 없는 노드 id 포함 시 404")
    fun `batchUpdateNodePositions rejects foreign node id`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        // 2개 요청했으나 보드 소속은 1개만 반환 → 소유 검증 실패
        every { boardNodeRepository.findByIdInAndBoardId(any(), eq(100L)) } returns
            listOf(BoardNode(id = 1L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now()))

        assertThatThrownBy {
            service.batchUpdateNodePositions(
                1L,
                100L,
                listOf(
                    BatchNodePositionItem(id = 1L, posX = 1.0, posY = 1.0),
                    BatchNodePositionItem(id = 2L, posX = 2.0, posY = 2.0),
                ),
            )
        }.isInstanceOf(ResourceNotFoundException::class.java)
    }

    @Test
    @DisplayName("deleteNode — 본인 노드 삭제 위임(엣지는 DB cascade)")
    fun `deleteNode delegates to repository`() {
        val node =
            BoardNode(id = 500L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now())
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        every { boardNodeRepository.findByIdAndBoardId(eq(500L), eq(100L)) } returns Optional.of(node)
        justRun { boardNodeRepository.delete(eq(node)) }

        service.deleteNode(1L, 100L, 500L)

        verify(exactly = 1) { boardNodeRepository.delete(eq(node)) }
    }

    // ── edges ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("createEdge — 자기 연결은 BOARD_EDGE_INVALID(400)")
    fun `createEdge rejects self loop`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))

        assertThatThrownBy { service.createEdge(1L, 100L, CreateEdgeRequest(sourceNodeId = 5L, targetNodeId = 5L)) }
            .isInstanceOf(AuthException::class.java)
    }

    @Test
    @DisplayName("createEdge — 노드가 보드에 없으면 BOARD_EDGE_INVALID")
    fun `createEdge rejects node not in board`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        every { boardNodeRepository.findByIdAndBoardId(eq(5L), eq(100L)) } returns
            Optional.of(BoardNode(id = 5L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now()))
        every { boardNodeRepository.findByIdAndBoardId(eq(6L), eq(100L)) } returns Optional.empty()

        assertThatThrownBy { service.createEdge(1L, 100L, CreateEdgeRequest(sourceNodeId = 5L, targetNodeId = 6L)) }
            .isInstanceOf(AuthException::class.java)
    }

    @Test
    @DisplayName("createEdge — 같은 방향 중복은 BOARD_EDGE_DUPLICATE(409)")
    fun `createEdge rejects duplicate`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        every { boardNodeRepository.findByIdAndBoardId(eq(5L), eq(100L)) } returns
            Optional.of(BoardNode(id = 5L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now()))
        every { boardNodeRepository.findByIdAndBoardId(eq(6L), eq(100L)) } returns
            Optional.of(BoardNode(id = 6L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now()))
        every { boardEdgeRepository.existsByBoardIdAndSourceNodeIdAndTargetNodeId(eq(100L), eq(5L), eq(6L)) } returns true

        assertThatThrownBy { service.createEdge(1L, 100L, CreateEdgeRequest(sourceNodeId = 5L, targetNodeId = 6L)) }
            .isInstanceOf(AuthException::class.java)
    }

    @Test
    @DisplayName("createEdge — 유효하면 영속")
    fun `createEdge persists when valid`() {
        every { boardRepository.findByIdAndUserId(eq(100L), eq(1L)) } returns Optional.of(ownedBoard(id = 100L))
        every { boardNodeRepository.findByIdAndBoardId(eq(5L), eq(100L)) } returns
            Optional.of(BoardNode(id = 5L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now()))
        every { boardNodeRepository.findByIdAndBoardId(eq(6L), eq(100L)) } returns
            Optional.of(BoardNode(id = 6L, boardId = 100L, posX = 0.0, posY = 0.0, createdAt = Instant.now(), updatedAt = Instant.now()))
        every { boardEdgeRepository.existsByBoardIdAndSourceNodeIdAndTargetNodeId(eq(100L), eq(5L), eq(6L)) } returns false
        val captured = slot<BoardEdge>()
        every { boardEdgeRepository.save(capture(captured)) } answers {
            firstArg<BoardEdge>().apply {
                id = 900L
                createdAt = Instant.now()
            }
        }

        val response = service.createEdge(1L, 100L, CreateEdgeRequest(sourceNodeId = 5L, targetNodeId = 6L))

        assertThat(captured.captured.boardId).isEqualTo(100L)
        assertThat(response.sourceNodeId).isEqualTo(5L)
        assertThat(response.targetNodeId).isEqualTo(6L)
    }
}
