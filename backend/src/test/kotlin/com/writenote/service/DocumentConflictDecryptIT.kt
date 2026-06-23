package com.writenote.service

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.repository.DocumentRepository
import com.writenote.repository.UserRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule
import java.util.UUID

/**
 * 저장 충돌(version 불일치) 시 409 + currentBody가 복호된 평문임을 검증 (US1).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DocumentConflictDecryptIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    @Autowired private lateinit var documentRepository: DocumentRepository

    private val jsonMapper = JsonMapper.builder().addModule(kotlinModule()).build()

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "conflict-dec-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"),
        )

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"

    private fun createProject(bearer: String): Long =
        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"충돌 테스트 작품"}"""),
            ).andExpect(status().isCreated)
            .andReturn()
            .response.contentAsString
            .let { body -> Regex(""""id":(\d+)""").find(body)!!.groupValues[1].toLong() }

    @Test
    fun `저장 충돌 시 409 응답의 currentBody는 복호된 평문이다`() {
        val user = createUser()
        val bearer = bearerFor(user)
        val projectId = createProject(bearer)
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()

        val serverBody = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"서버 최신 본문"}]}]}"""
        val version = doc.updatedAt!!.toString()
        val escapedServerBody = serverBody.replace("\"", "\\\"")

        // 1차 저장으로 서버 버전 전진
        val saveResult =
            mockMvc
                .perform(
                    put("/api/documents/${doc.id}")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"body":"$escapedServerBody","version":"$version"}"""),
                ).andExpect(status().isOk)
                .andReturn()
                .response.contentAsString
        val newVersion =
            jsonMapper
                .readTree(saveResult)
                .path("data")
                .path("version")
                .asText()

        // 2차 시도: 구 version으로 충돌 유발
        val clientBody = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"클라이언트 이전 본문"}]}]}"""
        val escapedClientBody = clientBody.replace("\"", "\\\"")
        val conflictResponse =
            mockMvc
                .perform(
                    put("/api/documents/${doc.id}")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"body":"$escapedClientBody","version":"$version"}"""),
                ).andExpect(status().isConflict)
                .andReturn()
                .response.contentAsString

        val conflictJson = jsonMapper.readTree(conflictResponse)
        val currentBody = conflictJson.path("data").path("currentBody").asText()

        // currentBody는 암호문이 아니라 평문이어야 한다
        assertThat(currentBody).isEqualTo(serverBody)
        assertThat(currentBody).contains(""""type":"doc"""")
        assertThat(currentBody).doesNotContain(""""v":1""")
    }
}
