package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.Document
import com.writenote.entity.User
import com.writenote.repository.DocumentRepository
import com.writenote.repository.UserRepository
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/**
 * DocumentController Web 계층 통합 테스트 — D1~D4 endpoint.
 *
 * 실제 Spring Security + JWT 필터 + DB 포함.
 * 409 충돌 응답 계약(currentVersion, currentBody) 검증 포함.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DocumentControllerWebTest {
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
            User(email = "doc-web-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"),
        )

    private fun bearerFor(user: User): String {
        val token = jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)
        return "Bearer $token"
    }

    private fun createProjectAndGetDocument(bearer: String): Pair<Long, Document> {
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"문서 테스트 프로젝트"}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsString
                .let { body -> Regex(""""id":(\d+)""").find(body)!!.groupValues[1].toLong() }

        val document = documentRepository.findByProjectId(projectId).orElseThrow()
        return Pair(projectId, document)
    }

    // D1: GET /api/projects/{projectId}/document

    @Test
    @DisplayName("D1 — projectId 로 본문 조회 200 (US1)")
    fun `D1 get document by projectId returns 200`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val (projectId, _) = createProjectAndGetDocument(bearer)

        mockMvc
            .perform(
                get("/api/projects/{projectId}/document", projectId)
                    .header("Authorization", bearer),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.projectId").value(projectId))
            .andExpect(jsonPath("$.data.body").exists())
            .andExpect(jsonPath("$.data.version").exists())
            .andExpect(jsonPath("$.data.wordCount").exists())
    }

    @Test
    @DisplayName("D1 — 타인 projectId 시 404 (소유권 검증)")
    fun `D1 cross user returns 404`() {
        val ownerA = createUser()
        val ownerB = createUser()
        val bearerA = bearerFor(ownerA)
        val bearerB = bearerFor(ownerB)
        val (projectIdA, _) = createProjectAndGetDocument(bearerA)

        mockMvc
            .perform(
                get("/api/projects/{projectId}/document", projectIdA)
                    .header("Authorization", bearerB),
            ).andExpect(status().isNotFound)
    }

    @Test
    @DisplayName("D1 — 인증 없이 호출 401")
    fun `D1 unauthenticated returns 401`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val (projectId, _) = createProjectAndGetDocument(bearer)

        mockMvc
            .perform(get("/api/projects/{projectId}/document", projectId))
            .andExpect(status().isUnauthorized)
    }

    // D2: GET /api/documents/{id}

    @Test
    @DisplayName("D2 — document id 로 조회 200")
    fun `D2 get document by id returns 200`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val (_, document) = createProjectAndGetDocument(bearer)

        mockMvc
            .perform(
                get("/api/documents/{id}", document.id)
                    .header("Authorization", bearer),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.id").value(document.id))
    }

    @Test
    @DisplayName("D2 — 존재하지 않는 id 시 404")
    fun `D2 not found returns 404`() {
        val owner = createUser()
        val bearer = bearerFor(owner)

        mockMvc
            .perform(
                get("/api/documents/{id}", 999999L)
                    .header("Authorization", bearer),
            ).andExpect(status().isNotFound)
    }

    // D3: PUT /api/documents/{id}

    @Test
    @DisplayName("D3 — version 일치 저장 200 + wordCount 재계산 (US1 핵심)")
    fun `D3 save document succeeds on version match`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val (_, document) = createProjectAndGetDocument(bearer)

        val bodyJson =
            """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"안녕 세계"}]}]}"""

        mockMvc
            .perform(
                put("/api/documents/{id}", document.id)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"${bodyJson.replace("\"", "\\\"")}","version":0}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.wordCount").value(4))
            .andExpect(jsonPath("$.data.version").value(1))
    }

    @Test
    @DisplayName("D3 — version 불일치 409 DOCUMENT_VERSION_CONFLICT + currentVersion/currentBody")
    fun `D3 returns 409 on version conflict with current state`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val (_, document) = createProjectAndGetDocument(bearer)
        val documentId = document.id!!

        // version 0 으로 먼저 저장 (version 0 → 1)
        val firstBodyJson =
            """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"첫 저장"}]}]}"""
        mockMvc
            .perform(
                put("/api/documents/{id}", documentId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"${firstBodyJson.replace("\"", "\\\"")}","version":0}"""),
            ).andExpect(status().isOk)

        // 구버전(version = 0) 으로 충돌 요청
        val conflictBodyJson =
            """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"충돌"}]}]}"""
        mockMvc
            .perform(
                put("/api/documents/{id}", documentId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"${conflictBodyJson.replace("\"", "\\\"")}","version":0}"""),
            ).andExpect(status().isConflict)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("DOCUMENT_VERSION_CONFLICT"))
            .andExpect(jsonPath("$.data.currentVersion").value(1))
            .andExpect(jsonPath("$.data.currentBody").exists())
    }

    // D4: PATCH /api/documents/{id}/title

    @Test
    @DisplayName("D4 — title 갱신 200 응답 (D4)")
    fun `D4 update title returns 200`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val (_, document) = createProjectAndGetDocument(bearer)

        mockMvc
            .perform(
                patch("/api/documents/{id}/title", document.id)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"새 제목"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.title").value("새 제목"))
            .andExpect(jsonPath("$.data.id").value(document.id))
    }

    @Test
    @DisplayName("D4 — title 120자 초과 400 VALIDATION_FAILED")
    fun `D4 rejects title over 120 characters`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val (_, document) = createProjectAndGetDocument(bearer)
        val longTitle = "x".repeat(121)

        mockMvc
            .perform(
                patch("/api/documents/{id}/title", document.id)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"$longTitle"}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"))
    }
}
