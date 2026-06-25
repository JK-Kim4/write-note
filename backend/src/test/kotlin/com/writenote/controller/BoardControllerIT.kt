package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.repository.UserRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
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
                .andExpect(jsonPath("$.data.projectId").doesNotExist())
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
    fun `project mapping conflict and list filter and clear`() {
        val bearer = bearerFor(createUser())
        val board1 = createBoard(bearer, "보드1")
        val board2 = createBoard(bearer, "보드2")
        val projectId = createProject(bearer, "작품")

        mockMvc
            .perform(
                put("/api/boards/{id}/project", board1)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"projectId":$projectId}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.projectId").value(projectId))

        // 작품 필터 목록
        mockMvc
            .perform(get("/api/boards?projectId={p}", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.length()").value(1))
            .andExpect(jsonPath("$.data[0].id").value(board1))

        // 같은 작품에 다른 보드 매핑 → 409
        mockMvc
            .perform(
                put("/api/boards/{id}/project", board2)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"projectId":$projectId}"""),
            ).andExpect(status().isConflict)
            .andExpect(jsonPath("$.error.code").value("BOARD_PROJECT_ALREADY_MAPPED"))

        // 해제 후 재매핑 가능
        mockMvc
            .perform(
                put("/api/boards/{id}/project", board1)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"projectId":null}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.projectId").doesNotExist())

        mockMvc
            .perform(
                put("/api/boards/{id}/project", board2)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"projectId":$projectId}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.projectId").value(projectId))
    }

    @Test
    fun `category deletion preserves board and clears mapping`() {
        // FR-027: 매핑 대상(시리즈) 삭제 시 보드 보존·매핑만 해제(ON DELETE SET NULL)
        val bearer = bearerFor(createUser())
        val boardId = createBoard(bearer, "시리즈 보드")
        val categoryId = createCategory(bearer, "시리즈A")

        mockMvc
            .perform(
                put("/api/boards/{id}/category", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"categoryId":$categoryId}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.categoryId").value(categoryId))

        mockMvc
            .perform(delete("/api/categories/{id}", categoryId).header("Authorization", bearer))
            .andExpect(status().isNoContent)

        // 보드는 보존, 매핑만 해제
        mockMvc
            .perform(get("/api/boards/{id}", boardId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.board.id").value(boardId))
            .andExpect(jsonPath("$.data.board.categoryId").doesNotExist())
    }

    @Test
    fun `unmapped filter returns only independent boards`() {
        val bearer = bearerFor(createUser())
        val mapped = createBoard(bearer, "매핑됨")
        val independent = createBoard(bearer, "독립")
        val projectId = createProject(bearer, "작품")
        mockMvc
            .perform(
                put("/api/boards/{id}/project", mapped)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"projectId":$projectId}"""),
            ).andExpect(status().isOk)

        mockMvc
            .perform(get("/api/boards?unmapped=true").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.length()").value(1))
            .andExpect(jsonPath("$.data[0].id").value(independent))
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
    fun `card type persists and defaults to plot and rejects unknown`() {
        val bearer = bearerFor(createUser())
        val boardId = createBoard(bearer, "타입 보드")

        // 타입 지정 → 응답에 반영
        mockMvc
            .perform(
                post("/api/boards/{id}/cards", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"주인공","posX":0.0,"posY":0.0,"type":"character"}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.data.type").value("character"))

        // 미지정 → 기본 plot
        mockMvc
            .perform(
                post("/api/boards/{id}/cards", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"사건","posX":1.0,"posY":1.0}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.data.type").value("plot"))

        // 허용 외 타입 → 400
        mockMvc
            .perform(
                post("/api/boards/{id}/cards", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"posX":2.0,"posY":2.0,"type":"villain"}"""),
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
