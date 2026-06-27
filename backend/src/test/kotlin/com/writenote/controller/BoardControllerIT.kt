package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.repository.UserRepository
import org.hamcrest.Matchers.nullValue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.ResultActions
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BoardControllerIT {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var jwtTokenProvider: JwtTokenProvider

    @Test
    fun `create independent board then cards viewport persist and restore`() {
        val bearer = bearerFor(createUser())

        val boardId =
            mockMvc
                .perform(
                    post("/api/boards")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"name":"  1부 플롯  "}"""),
                ).andExpect(status().isCreated)
                .andExpect(jsonPath("$.data.name").value("1부 플롯"))
                .andExpect(jsonPath("$.data.ownerType").doesNotExist())
                .andExpect(jsonPath("$.data.viewport.zoom").value(1.0))
                .andReturn()
                .response.contentAsString
                .let(::extractId)

        // 빈 보드 하이드레이션
        mockMvc
            .perform(get("/api/boards/{id}", boardId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.board.id").value(boardId))
            .andExpect(jsonPath("$.data.cards.length()").value(0))
            .andExpect(jsonPath("$.data.links.length()").value(0))

        val card1 = createCard(bearer, boardId, "A", 10.0, 20.0)
        val card2 = createCard(bearer, boardId, "B", -5.0, 7.0)

        // 배치 위치 저장(드래그 종료)
        mockMvc
            .perform(
                patch("/api/boards/{id}/cards", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""[{"id":$card1,"posX":100.0,"posY":200.0}]"""),
            ).andExpect(status().isOk)

        // 뷰포트 저장
        mockMvc
            .perform(
                patch("/api/boards/{id}/viewport", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"zoom":1.5,"x":-40.0,"y":12.0}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.viewport.zoom").value(1.5))

        // 재진입 복원
        mockMvc
            .perform(get("/api/boards/{id}", boardId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.cards.length()").value(2))
            .andExpect(jsonPath("$.data.board.viewport.zoom").value(1.5))

        // 본문 수정
        mockMvc
            .perform(
                patch("/api/boards/{b}/cards/{c}", boardId, card1)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"A수정"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.body").value("A수정"))

        // 연결 생성 후, 카드 삭제 시 연결 cascade
        createLink(bearer, boardId, card1, card2)
        mockMvc
            .perform(get("/api/boards/{id}", boardId).header("Authorization", bearer))
            .andExpect(jsonPath("$.data.links.length()").value(1))

        mockMvc
            .perform(delete("/api/boards/{b}/cards/{c}", boardId, card1).header("Authorization", bearer))
            .andExpect(status().isNoContent)

        mockMvc
            .perform(get("/api/boards/{id}", boardId).header("Authorization", bearer))
            .andExpect(jsonPath("$.data.cards.length()").value(1))
            .andExpect(jsonPath("$.data.links.length()").value(0))
    }

    @Test
    fun `link rejects self loop with 400 and duplicate with 409`() {
        val bearer = bearerFor(createUser())
        val boardId = createBoard(bearer, "연결 검증")
        val c1 = createCard(bearer, boardId, "A", 0.0, 0.0)
        val c2 = createCard(bearer, boardId, "B", 1.0, 1.0)

        // 자기 연결 → 400 BOARD_LINK_INVALID
        mockMvc
            .perform(
                post("/api/boards/{id}/links", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"sourceCardId":$c1,"targetCardId":$c1}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("BOARD_LINK_INVALID"))

        createLink(bearer, boardId, c1, c2)

        // 같은 방향 중복 → 409 BOARD_LINK_DUPLICATE
        mockMvc
            .perform(
                post("/api/boards/{id}/links", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"sourceCardId":$c1,"targetCardId":$c2}"""),
            ).andExpect(status().isConflict)
            .andExpect(jsonPath("$.error.code").value("BOARD_LINK_DUPLICATE"))
    }

    @Test
    fun `owner attach, 1 to N, owner filter, and clear to idea`() {
        val bearer = bearerFor(createUser())
        val board1 = createBoard(bearer, "보드1")
        val board2 = createBoard(bearer, "보드2")
        val projectId = createProject(bearer, "작품")

        setOwner(board1, bearer, "project", projectId)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.ownerType").value("project"))
            .andExpect(jsonPath("$.data.ownerId").value(projectId))

        // 1:N — 같은 작품에 두 번째 보드도 충돌 없이 연결
        setOwner(board2, bearer, "project", projectId)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.ownerId").value(projectId))

        // 소속 필터 목록 — 둘 다
        mockMvc
            .perform(get("/api/boards?ownerType=project&ownerId={p}", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.length()").value(2))

        // 아이디어로 해제
        setOwner(board1, bearer, null, null)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.ownerType").doesNotExist())
    }

    @Test
    fun `owner rejects foreign or unknown target with 400`() {
        val bearer = bearerFor(createUser())
        val boardId = createBoard(bearer, "보드")

        // 없는 작품 → 400 BOARD_OWNER_INVALID
        setOwner(boardId, bearer, "project", 999999L)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("BOARD_OWNER_INVALID"))

        // 미지원 owner 종류 → 400
        setOwner(boardId, bearer, "memo", 1L)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("BOARD_OWNER_INVALID"))
    }

    @Test
    fun `global hub lists all boards with owner labels`() {
        val bearer = bearerFor(createUser())
        val projectId = createProject(bearer, "달밤의 늑대")
        val categoryId = createCategory(bearer, "늑대 연대기")
        val pBoard = createBoard(bearer, "작품 보드")
        val cBoard = createBoard(bearer, "시리즈 보드")
        createBoard(bearer, "막연한 구상") // 아이디어
        setOwner(pBoard, bearer, "project", projectId).andExpect(status().isOk)
        setOwner(cBoard, bearer, "category", categoryId).andExpect(status().isOk)

        mockMvc
            .perform(get("/api/boards/mine").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.length()").value(3))
            // 라벨이 작품명/시리즈명/"아이디어"로 동봉
            .andExpect(jsonPath("$.data[?(@.id == $pBoard)].ownerLabel").value("달밤의 늑대"))
            .andExpect(jsonPath("$.data[?(@.id == $cBoard)].ownerLabel").value("늑대 연대기"))
    }

    @Test
    fun `reference boards return work board plus parent series board`() {
        // 043 집필 참조 — 그 작품 보드 + 상위 시리즈 보드. 아이디어 보드는 제외.
        val bearer = bearerFor(createUser())
        val categoryId = createCategory(bearer, "늑대 연대기")
        val projectId = createProject(bearer, "달밤의 늑대")
        moveToCategory(bearer, projectId, categoryId).andExpect(status().isOk)

        val workBoard = createBoard(bearer, "작품 보드")
        val seriesBoard = createBoard(bearer, "시리즈 보드")
        createBoard(bearer, "막연한 구상") // 아이디어 — 참조에 포함 안 됨
        setOwner(workBoard, bearer, "project", projectId).andExpect(status().isOk)
        setOwner(seriesBoard, bearer, "category", categoryId).andExpect(status().isOk)

        mockMvc
            .perform(get("/api/boards/reference?projectId={p}", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.length()").value(2))
            .andExpect(jsonPath("$.data[?(@.id == $workBoard)].ownerLabel").value("달밤의 늑대"))
            .andExpect(jsonPath("$.data[?(@.id == $seriesBoard)].ownerLabel").value("늑대 연대기"))
    }

    @Test
    fun `reference boards reject non-owned project with 404`() {
        val owner = bearerFor(createUser())
        val projectId = createProject(owner, "작품")
        val other = bearerFor(createUser())

        mockMvc
            .perform(get("/api/boards/reference?projectId={p}", projectId).header("Authorization", other))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `project hard delete preserves board as idea`() {
        // 041 FR-009: 작품 hard delete 시 그 보드는 owner null(아이디어)로 보존
        val bearer = bearerFor(createUser())
        val boardId = createBoard(bearer, "작품 보드")
        val projectId = createProject(bearer, "작품")
        setOwner(boardId, bearer, "project", projectId).andExpect(status().isOk)

        mockMvc
            .perform(delete("/api/projects/{id}", projectId).header("Authorization", bearer))
            .andExpect(status().isNoContent)

        mockMvc
            .perform(get("/api/boards/{id}", boardId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.board.id").value(boardId))
            .andExpect(jsonPath("$.data.board.ownerType").doesNotExist())
    }

    @Test
    fun `category hard delete preserves board as idea`() {
        // 041 FR-009: 시리즈 hard delete 시 그 보드는 owner null(아이디어)로 보존
        val bearer = bearerFor(createUser())
        val boardId = createBoard(bearer, "시리즈 보드")
        val categoryId = createCategory(bearer, "시리즈A")
        setOwner(boardId, bearer, "category", categoryId).andExpect(status().isOk)

        mockMvc
            .perform(delete("/api/categories/{id}", categoryId).header("Authorization", bearer))
            .andExpect(status().isNoContent)

        mockMvc
            .perform(get("/api/boards/{id}", boardId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.board.id").value(boardId))
            .andExpect(jsonPath("$.data.board.ownerType").doesNotExist())
    }

    @Test
    fun `unmapped filter returns only idea boards`() {
        val bearer = bearerFor(createUser())
        val mapped = createBoard(bearer, "매핑됨")
        val idea = createBoard(bearer, "아이디어")
        val projectId = createProject(bearer, "작품")
        setOwner(mapped, bearer, "project", projectId).andExpect(status().isOk)

        mockMvc
            .perform(get("/api/boards?unmapped=true").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.length()").value(1))
            .andExpect(jsonPath("$.data[0].id").value(idea))
    }

    @Test
    fun `board of another user returns 404`() {
        val ownerBearer = bearerFor(createUser())
        val strangerBearer = bearerFor(createUser())
        val boardId = createBoard(ownerBearer, "남의 보드")

        mockMvc
            .perform(get("/api/boards/{id}", boardId).header("Authorization", strangerBearer))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `card type persists 4 types, defaults to null, and rejects unknown`() {
        val bearer = bearerFor(createUser())
        val boardId = createBoard(bearer, "타입 보드")

        // 종류 지정(4종) → 응답에 반영
        mockMvc
            .perform(
                post("/api/boards/{id}/cards", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"주인공","posX":0.0,"posY":0.0,"type":"character"}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.data.type").value("character"))

        // 미지정 → 무지정(null)
        mockMvc
            .perform(
                post("/api/boards/{id}/cards", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"사건","posX":1.0,"posY":1.0}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.data.type").value(nullValue()))

        // 허용 외 종류 → 400
        mockMvc
            .perform(
                post("/api/boards/{id}/cards", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"posX":2.0,"posY":2.0,"type":"villain"}"""),
            ).andExpect(status().isBadRequest)
    }

    @Test
    fun `setCardType assigns then clears card type`() {
        val bearer = bearerFor(createUser())
        val boardId = createBoard(bearer, "종류 보드")
        val cardId = createCard(bearer, boardId, "카드", 0.0, 0.0)

        // 부여(event)
        mockMvc
            .perform(
                patch("/api/boards/{b}/cards/{c}/type", boardId, cardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"type":"event"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.type").value("event"))

        // 재탭 해제(null)
        mockMvc
            .perform(
                patch("/api/boards/{b}/cards/{c}/type", boardId, cardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"type":null}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.type").value(nullValue()))

        // 허용 외 종류 → 400
        mockMvc
            .perform(
                patch("/api/boards/{b}/cards/{c}/type", boardId, cardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"type":"villain"}"""),
            ).andExpect(status().isBadRequest)
    }

    @Test
    fun `rename and delete board`() {
        val bearer = bearerFor(createUser())
        val boardId = createBoard(bearer, "임시")

        mockMvc
            .perform(
                patch("/api/boards/{id}", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name":"확정 제목"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.name").value("확정 제목"))

        mockMvc
            .perform(delete("/api/boards/{id}", boardId).header("Authorization", bearer))
            .andExpect(status().isNoContent)

        mockMvc
            .perform(get("/api/boards/{id}", boardId).header("Authorization", bearer))
            .andExpect(status().isNotFound)
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private fun createBoard(
        bearer: String,
        name: String,
    ): Long =
        mockMvc
            .perform(
                post("/api/boards")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name":"$name"}"""),
            ).andExpect(status().isCreated)
            .andReturn()
            .response.contentAsString
            .let(::extractId)

    private fun createCard(
        bearer: String,
        boardId: Long,
        body: String,
        posX: Double,
        posY: Double,
    ): Long =
        mockMvc
            .perform(
                post("/api/boards/{id}/cards", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"$body","posX":$posX,"posY":$posY}"""),
            ).andExpect(status().isCreated)
            .andReturn()
            .response.contentAsString
            .let(::extractId)

    private fun createLink(
        bearer: String,
        boardId: Long,
        source: Long,
        target: Long,
    ) {
        mockMvc
            .perform(
                post("/api/boards/{id}/links", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"sourceCardId":$source,"targetCardId":$target}"""),
            ).andExpect(status().isCreated)
    }

    /** PATCH /owner — ownerType/ownerId(null 허용). 호출부가 .andExpect 로 검증. */
    private fun setOwner(
        boardId: Long,
        bearer: String,
        ownerType: String?,
        ownerId: Long?,
    ): ResultActions {
        val typeJson = ownerType?.let { "\"$it\"" } ?: "null"
        val idJson = ownerId?.toString() ?: "null"
        return mockMvc.perform(
            patch("/api/boards/{id}/owner", boardId)
                .header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"ownerType":$typeJson,"ownerId":$idJson}"""),
        )
    }

    /** PATCH /projects/{id}/category — 작품을 시리즈(모음)로 이동(043 reference 픽스처). */
    private fun moveToCategory(
        bearer: String,
        projectId: Long,
        categoryId: Long,
    ): ResultActions =
        mockMvc.perform(
            patch("/api/projects/{id}/category", projectId)
                .header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"categoryId":$categoryId}"""),
        )

    private fun createProject(
        bearer: String,
        title: String,
    ): Long =
        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"$title"}"""),
            ).andExpect(status().isCreated)
            .andReturn()
            .response.contentAsString
            .let(::extractId)

    private fun createCategory(
        bearer: String,
        name: String,
    ): Long =
        mockMvc
            .perform(
                post("/api/categories")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name":"$name"}"""),
            ).andExpect(status().isCreated)
            .andReturn()
            .response.contentAsString
            .let(::extractId)

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "board-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
        )

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"

    private fun extractId(body: String): Long =
        requireNotNull(Regex(""""id":(\d+)""").find(body)) { "Response does not contain id: $body" }
            .groupValues[1]
            .toLong()
}
