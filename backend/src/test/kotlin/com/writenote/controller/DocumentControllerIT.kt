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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/**
 * Document 단건 조회(D2) / 자동저장(D3) endpoint 통합 테스트.
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
            User(email = "document-it-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"),
        )

    private fun bearerFor(user: User): String {
        val token = jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)
        return "Bearer $token"
    }

    private fun createProject(
        bearer: String,
        title: String = "문서 테스트 작품",
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

    // ── D2: GET /api/documents/{id} ───────────────────────────────────────────

    @Test
    @DisplayName("D2 — 삭제(soft-delete)된 문서 단건 조회 시 404")
    fun `D2 soft deleted document returns 404`() {
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
    @DisplayName("D2 — 활성 문서 단건 조회 200")
    fun `D2 active document returns 200`() {
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

    // ── D3: PUT /api/documents/{id} — soft-delete 저장 가드 ────────────────────

    @Test
    @DisplayName("D3 — 삭제된 문서에 자동저장 PUT 404")
    fun `D3 autosave to deleted document returns 404`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(bearer)
        val document = firstActiveDocument(projectId)

        document.deletedAt = java.time.Instant.now()
        documentRepository.saveAndFlush(document)

        // 삭제된 문서에 자동저장 시도 → 404
        // body 필드는 JSON 문자열(이스케이프 필요)
        val escapedDocJson = Document.EMPTY_DOC_JSON.replace("\"", "\\\"")
        val saveBody = """{"body":"$escapedDocJson","version":"2026-01-01T00:00:00Z"}"""
        mockMvc
            .perform(
                put("/api/documents/{id}", document.id!!)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(saveBody),
            ).andExpect(status().isNotFound)
    }
}
