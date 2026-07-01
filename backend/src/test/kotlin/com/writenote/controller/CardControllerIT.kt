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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/**
 * 카드 관리(048) `/api/cards` end-to-end — 로컬 공유 Postgres(@SpringBootTest, 격리 아님; unique email 픽스처).
 * 목록·소속 보드명·정렬·독립 생성·재배정·연결 수·삭제 cascade·소유 격리를 실 DB 로 검증(V30 적용 필요).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CardControllerIT {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var jwtTokenProvider: JwtTokenProvider

    @Test
    fun `list returns board and standalone cards with boardName sorted newest first`() {
        val bearer = bearerFor(createUser())
        val boardId = createBoard(bearer, "1부 플롯")
        createBoardCard(bearer, boardId, "복선")
        createBoardCard(bearer, boardId, "인물")
        val standaloneId = createStandalone(bearer, "떠도는 메모")

        mockMvc
            .perform(get("/api/cards").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.length()").value(3))
            .andExpect(jsonPath("$.data[0].id").value(standaloneId)) // 가장 최근 생성 = 맨 위
            .andExpect(jsonPath("$.data[0].boardId").value(nullValue()))
            .andExpect(jsonPath("$.data[0].boardName").value(nullValue()))
            .andExpect(jsonPath("$.data[2].boardName").value("1부 플롯")) // 가장 먼저 생성한 보드 카드
    }

    @Test
    fun `create standalone then attach detach and reject invalid target board`() {
        val bearer = bearerFor(createUser())
        val boardId = createBoard(bearer, "옮길 보드")
        val cardId = createStandalone(bearer, "독립 카드")

        // 붙이기
        mockMvc
            .perform(patchBoard(cardId, bearer, boardId))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.boardId").value(boardId))
            .andExpect(jsonPath("$.data.boardName").value("옮길 보드"))
        // 떼기
        mockMvc
            .perform(patchBoard(cardId, bearer, null))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.boardId").value(nullValue()))
        // 없는 대상 보드 → 400
        mockMvc
            .perform(patchBoard(cardId, bearer, 9_999_999L))
            .andExpect(status().isBadRequest)
    }

    @Test
    fun `linkCount reflects distinct neighbor and linked card cannot be reassigned`() {
        val bearer = bearerFor(createUser())
        val boardId = createBoard(bearer, "연결 보드")
        val a = createBoardCard(bearer, boardId, "A")
        val b = createBoardCard(bearer, boardId, "B")
        createLink(bearer, boardId, a, b)
        val other = createBoard(bearer, "다른 보드")

        mockMvc
            .perform(get("/api/cards/{id}", a).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.linkCount").value(1))
        // 연결 있는 카드 재배정 거부
        mockMvc
            .perform(patchBoard(a, bearer, other))
            .andExpect(status().isBadRequest)
    }

    @Test
    fun `edit updates body and type`() {
        val bearer = bearerFor(createUser())
        val cardId = createStandalone(bearer, "old")

        mockMvc
            .perform(
                patch("/api/cards/{id}", cardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"new","type":"character"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.body").value("new"))
            .andExpect(jsonPath("$.data.type").value("character"))

        mockMvc
            .perform(get("/api/cards/{id}", cardId).header("Authorization", bearer))
            .andExpect(jsonPath("$.data.body").value("new"))
            .andExpect(jsonPath("$.data.type").value("character"))
    }

    @Test
    fun `delete removes card and cascades its link`() {
        val bearer = bearerFor(createUser())
        val boardId = createBoard(bearer, "삭제 보드")
        val a = createBoardCard(bearer, boardId, "A")
        val b = createBoardCard(bearer, boardId, "B")
        createLink(bearer, boardId, a, b)

        mockMvc
            .perform(delete("/api/cards/{id}", a).header("Authorization", bearer))
            .andExpect(status().isNoContent)
        // 남은 카드 B 의 연결은 cascade 로 사라짐
        mockMvc
            .perform(get("/api/cards/{id}", b).header("Authorization", bearer))
            .andExpect(jsonPath("$.data.linkCount").value(0))
        mockMvc
            .perform(get("/api/cards").header("Authorization", bearer))
            .andExpect(jsonPath("$.data.length()").value(1))
    }

    @Test
    fun `other user cannot read edit or delete a card`() {
        val ownerBearer = bearerFor(createUser())
        val cardId = createStandalone(ownerBearer, "내 카드")
        val intruderBearer = bearerFor(createUser())

        mockMvc.perform(get("/api/cards/{id}", cardId).header("Authorization", intruderBearer)).andExpect(status().isNotFound)
        mockMvc
            .perform(
                patch("/api/cards/{id}", cardId)
                    .header("Authorization", intruderBearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"침입"}"""),
            ).andExpect(status().isNotFound)
        mockMvc.perform(delete("/api/cards/{id}", cardId).header("Authorization", intruderBearer)).andExpect(status().isNotFound)
    }

    @Test
    fun `list shows owner label of the board a card belongs to`() {
        val bearer = bearerFor(createUser())
        val projectId = createProject(bearer, "소설 A")
        val boardId = createBoard(bearer, "1부 보드")
        setOwner(boardId, bearer, "project", projectId)
        createBoardCard(bearer, boardId, "복선")

        mockMvc
            .perform(get("/api/cards").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data[0].ownerType").value("project"))
            .andExpect(jsonPath("$.data[0].ownerLabel").value("소설 A"))
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

    private fun createBoardCard(
        bearer: String,
        boardId: Long,
        body: String,
    ): Long =
        mockMvc
            .perform(
                post("/api/boards/{id}/cards", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"$body","posX":0.0,"posY":0.0}"""),
            ).andExpect(status().isCreated)
            .andReturn()
            .response.contentAsString
            .let(::extractId)

    private fun createStandalone(
        bearer: String,
        body: String,
    ): Long =
        mockMvc
            .perform(
                post("/api/cards")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"$body"}"""),
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

    private fun patchBoard(
        cardId: Long,
        bearer: String,
        boardId: Long?,
    ) = patch("/api/cards/{id}/board", cardId)
        .header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""{"boardId":${boardId ?: "null"}}""")

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

    private fun setOwner(
        boardId: Long,
        bearer: String,
        ownerType: String,
        ownerId: Long,
    ) {
        mockMvc
            .perform(
                patch("/api/boards/{id}/owner", boardId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"ownerType":"$ownerType","ownerId":$ownerId}"""),
            ).andExpect(status().isOk)
    }

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "card-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
        )

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"

    private fun extractId(body: String): Long =
        requireNotNull(Regex(""""id":(\d+)""").find(body)) { "Response does not contain id: $body" }
            .groupValues[1]
            .toLong()
}
