package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.Document
import com.writenote.entity.User
import com.writenote.repository.DocumentRepository
import com.writenote.repository.UserRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/**
 * 챕터(Document 1:N) C1 목록·C2 생성·C7 단건 endpoint 통합 테스트 (T007).
 *
 * @SpringBootTest + @AutoConfigureMockMvc + JWT bearer — CharacterControllerIT 패턴.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DocumentControllerIT {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var jwtTokenProvider: JwtTokenProvider

    @Autowired
    private lateinit var documentRepository: DocumentRepository

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "chapter-it-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"),
        )

    private fun bearerFor(user: User): String {
        val token = jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)
        return "Bearer $token"
    }

    private fun createProject(
        bearer: String,
        title: String = "챕터 테스트 작품",
    ): Long =
        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"$title"}"""),
            ).andExpect(status().isCreated)
            .andReturn()
            .response
            .contentAsString
            .let { body -> Regex(""""id":(\d+)""").find(body)!!.groupValues[1].toLong() }

    private fun firstActiveDocument(projectId: Long): Document =
        documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()

    // ── C1: GET /api/projects/{projectId}/documents ──────────────────────────

    @Test
    @DisplayName("C1 — 챕터 목록 조회 200: 메타만(id·title·sortOrder·wordCount·updatedAt), body 미포함")
    fun `C1 list chapters returns meta only without body`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(bearer)

        mockMvc
            .perform(
                get("/api/projects/{projectId}/documents", projectId)
                    .header("Authorization", bearer),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data").isArray)
            .andExpect(jsonPath("$.data.length()").value(1)) // 작품 생성 시 1번 챕터 자동 생성
            .andExpect(jsonPath("$.data[0].id").isNumber)
            .andExpect(jsonPath("$.data[0].title").exists())
            .andExpect(jsonPath("$.data[0].sortOrder").value(0))
            .andExpect(jsonPath("$.data[0].wordCount").value(0))
            .andExpect(jsonPath("$.data[0].updatedAt").exists())
            // body 는 목록 응답에 포함되면 안 됨
            .andExpect(jsonPath("$.data[0].body").doesNotExist())
    }

    @Test
    @DisplayName("C1 — sortOrder ASC 정렬 검증: 챕터 2개 생성 후 목록이 sortOrder 순")
    fun `C1 list chapters is ordered by sortOrder asc`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(bearer)

        // 챕터 추가 생성
        mockMvc
            .perform(
                post("/api/projects/{projectId}/documents", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"2장"}"""),
            ).andExpect(status().isCreated)

        val responseJson =
            mockMvc
                .perform(
                    get("/api/projects/{projectId}/documents", projectId)
                        .header("Authorization", bearer),
                ).andExpect(status().isOk)
                .andExpect(jsonPath("$.data.length()").value(2))
                .andReturn()
                .response
                .contentAsString

        // sortOrder 가 오름차순인지 확인
        val sortOrders =
            Regex(""""sortOrder":(\d+)""")
                .findAll(responseJson)
                .map { it.groupValues[1].toInt() }
                .toList()
        assertThat(sortOrders).isSortedAccordingTo(Comparator.naturalOrder())
    }

    @Test
    @DisplayName("C1 — 타인 projectId 시 404")
    fun `C1 cross user returns 404`() {
        val ownerA = createUser()
        val ownerB = createUser()
        val bearerA = bearerFor(ownerA)
        val bearerB = bearerFor(ownerB)
        val projectId = createProject(bearerA)

        mockMvc
            .perform(
                get("/api/projects/{projectId}/documents", projectId)
                    .header("Authorization", bearerB),
            ).andExpect(status().isNotFound)
    }

    @Test
    @DisplayName("C1 — 인증 없이 401")
    fun `C1 unauthenticated returns 401`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(bearer)

        mockMvc
            .perform(get("/api/projects/{projectId}/documents", projectId))
            .andExpect(status().isUnauthorized)
    }

    // ── C2: POST /api/projects/{projectId}/documents ──────────────────────────

    @Test
    @DisplayName("C2 — 챕터 생성 201: 지정 title, sortOrder = 기존 최대+1, 본문 포함 응답")
    fun `C2 create chapter returns 201 with body included`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(bearer)

        mockMvc
            .perform(
                post("/api/projects/{projectId}/documents", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"2장"}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.id").isNumber)
            .andExpect(jsonPath("$.data.title").value("2장"))
            .andExpect(jsonPath("$.data.sortOrder").value(1)) // 기존 1번 챕터 sortOrder=0 → 새로운 챕터 1
            .andExpect(jsonPath("$.data.wordCount").value(0))
            .andExpect(jsonPath("$.data.body").exists()) // 생성 응답은 본문 포함
            .andExpect(jsonPath("$.data.updatedAt").exists())
    }

    @Test
    @DisplayName("C2 — title 미지정 시 '새 챕터' 기본값")
    fun `C2 create chapter uses default title when title absent`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(bearer)

        mockMvc
            .perform(
                post("/api/projects/{projectId}/documents", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}"),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.data.title").value("새 챕터"))
    }

    @Test
    @DisplayName("C2 — title 빈 문자열 시 '새 챕터' 기본값")
    fun `C2 create chapter uses default title when title is empty string`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(bearer)

        mockMvc
            .perform(
                post("/api/projects/{projectId}/documents", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":""}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.data.title").value("새 챕터"))
    }

    @Test
    @DisplayName("C2 — 타인 projectId 시 404")
    fun `C2 create chapter cross user returns 404`() {
        val ownerA = createUser()
        val ownerB = createUser()
        val bearerA = bearerFor(ownerA)
        val bearerB = bearerFor(ownerB)
        val projectId = createProject(bearerA)

        mockMvc
            .perform(
                post("/api/projects/{projectId}/documents", projectId)
                    .header("Authorization", bearerB)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"해킹"}"""),
            ).andExpect(status().isNotFound)
    }

    @Test
    @DisplayName("C2 — 인증 없이 401")
    fun `C2 unauthenticated returns 401`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(bearer)

        mockMvc
            .perform(
                post("/api/projects/{projectId}/documents", projectId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"챕터"}"""),
            ).andExpect(status().isUnauthorized)
    }

    // ── C7: GET /api/documents/{id} — soft-delete 가드 ────────────────────────

    @Test
    @DisplayName("C7 — 삭제(soft-delete)된 챕터 단건 조회 시 404")
    fun `C7 soft deleted chapter returns 404`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(bearer)
        val document = firstActiveDocument(projectId)

        // soft-delete 직접 적용
        document.deletedAt = java.time.Instant.now()
        documentRepository.saveAndFlush(document)

        mockMvc
            .perform(
                get("/api/documents/{id}", document.id)
                    .header("Authorization", bearer),
            ).andExpect(status().isNotFound)
    }

    @Test
    @DisplayName("C7 — 활성 챕터 단건 조회 200 (기존 D2 행위 보존)")
    fun `C7 active chapter returns 200`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(bearer)
        val document = firstActiveDocument(projectId)

        mockMvc
            .perform(
                get("/api/documents/{id}", document.id)
                    .header("Authorization", bearer),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.id").value(document.id))
            .andExpect(jsonPath("$.data.body").exists())
    }
}
