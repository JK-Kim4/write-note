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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/**
 * DocumentController Web 계층 통합 테스트 — D1~D3 endpoint.
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

        val document =
            documentRepository
                .findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId)
                .first()
        return Pair(projectId, document)
    }

    /** 응답 JSON 에서 version(ISO8601 불투명 토큰 문자열) 추출. 클라이언트가 받는 그대로의 토큰. */
    private fun extractVersion(json: String): String = Regex(""""version":"([^"]+)"""").find(json)!!.groupValues[1]

    /** document id 로 GET → 현재 version 토큰 문자열 반환. */
    private fun currentVersionToken(
        bearer: String,
        documentId: Long,
    ): String =
        mockMvc
            .perform(get("/api/documents/{id}", documentId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andReturn()
            .response
            .contentAsString
            .let(::extractVersion)

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
    @DisplayName("D3 — version(토큰) 일치 저장 200 + wordCount 재계산 + version 문자열 전진 (US1 핵심)")
    fun `D3 save document succeeds on version match`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val (_, document) = createProjectAndGetDocument(bearer)
        val documentId = document.id!!
        val token0 = currentVersionToken(bearer, documentId)

        val bodyJson =
            """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"안녕 세계"}]}]}"""

        val responseJson =
            mockMvc
                .perform(
                    put("/api/documents/{id}", documentId)
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"body":"${bodyJson.replace("\"", "\\\"")}","version":"$token0"}"""),
                ).andExpect(status().isOk)
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.wordCount").value(4))
                .andExpect(jsonPath("$.data.version").isString)
                .andReturn()
                .response
                .contentAsString

        // 저장 응답의 version 토큰은 저장 전 토큰과 다른 새 값(전진)
        assertThat(extractVersion(responseJson)).isNotEqualTo(token0)
    }

    @Test
    @DisplayName("D3 — version(토큰) 불일치 409 DOCUMENT_VERSION_CONFLICT + currentVersion/currentBody")
    fun `D3 returns 409 on version conflict with current state`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val (_, document) = createProjectAndGetDocument(bearer)
        val documentId = document.id!!
        val token0 = currentVersionToken(bearer, documentId)

        // token0 으로 먼저 저장 (토큰 전진)
        val firstBodyJson =
            """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"첫 저장"}]}]}"""
        mockMvc
            .perform(
                put("/api/documents/{id}", documentId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"${firstBodyJson.replace("\"", "\\\"")}","version":"$token0"}"""),
            ).andExpect(status().isOk)

        // 구 토큰(token0) 으로 충돌 요청
        val conflictBodyJson =
            """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"충돌"}]}]}"""
        mockMvc
            .perform(
                put("/api/documents/{id}", documentId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"${conflictBodyJson.replace("\"", "\\\"")}","version":"$token0"}"""),
            ).andExpect(status().isConflict)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("DOCUMENT_VERSION_CONFLICT"))
            .andExpect(jsonPath("$.data.currentVersion").isString)
            .andExpect(jsonPath("$.data.currentBody").exists())
    }
}
