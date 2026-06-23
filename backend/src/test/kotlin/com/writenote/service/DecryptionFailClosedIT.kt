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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule
import java.util.UUID

/**
 * 저장된 봉투 변조 시 fail-closed (US2).
 *
 * 봉투 ct를 1바이트 변조 후 로드 → 500 DOCUMENT_DECRYPTION_FAILED + 평문 미노출.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DecryptionFailClosedIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    @Autowired private lateinit var documentRepository: DocumentRepository

    private val jsonMapper = JsonMapper.builder().addModule(kotlinModule()).build()

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "fail-closed-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"),
        )

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"

    private fun createProject(bearer: String): Long =
        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"변조 테스트 작품"}"""),
            ).andExpect(status().isCreated)
            .andReturn()
            .response.contentAsString
            .let { body -> Regex(""""id":(\d+)""").find(body)!!.groupValues[1].toLong() }

    @Test
    fun `봉투 변조 후 로드 시 500 DOCUMENT_DECRYPTION_FAILED 이고 평문이 노출되지 않는다`() {
        val user = createUser()
        val bearer = bearerFor(user)
        val projectId = createProject(bearer)
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()

        val secret = "변조비밀텍스트${UUID.randomUUID()}"
        val plainBody = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$secret"}]}]}"""
        val version = doc.updatedAt!!.toString()
        val escapedBody = plainBody.replace("\"", "\\\"")

        mockMvc
            .perform(
                put("/api/documents/${doc.id}")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"$escapedBody","version":"$version"}"""),
            ).andExpect(status().isOk)

        // 저장된 봉투의 ct 1글자를 변조
        val stored = documentRepository.findById(doc.id!!).orElseThrow()
        val node = jsonMapper.readTree(stored.body)
        val ct = node.path("ct").asText()
        val firstChar = ct[0]
        val flipped = if (firstChar == 'A') 'B' else 'A'
        val corruptedCt = flipped + ct.substring(1)
        val corruptedBody =
            """{"v":1,"alg":"A256GCM","iv":"${node.path("iv").asText()}","ct":"$corruptedCt"}"""
        stored.body = corruptedBody
        documentRepository.saveAndFlush(stored)

        val response =
            mockMvc
                .perform(
                    get("/api/documents/${doc.id}")
                        .header("Authorization", bearer),
                ).andExpect(status().isInternalServerError)
                .andExpect(jsonPath("$.error.code").value("DOCUMENT_DECRYPTION_FAILED"))
                .andReturn()
                .response.contentAsString

        // 응답 어디에도 원문 평문이 노출되지 않는다
        assertThat(response).doesNotContain(secret)
    }
}
