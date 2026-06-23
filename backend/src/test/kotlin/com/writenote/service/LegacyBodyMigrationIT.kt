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
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule
import java.util.UUID

/**
 * 기존 평문 본문 무중단 전환 (US3).
 *
 * 평문 레거시 행 사전삽입 → 로드 정상(복호 에러 없음) → 저장 후 봉투(암호문)로 전환.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LegacyBodyMigrationIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    @Autowired private lateinit var documentRepository: DocumentRepository

    private val jsonMapper = JsonMapper.builder().addModule(kotlinModule()).build()

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "legacy-mig-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"),
        )

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"

    private fun createProject(bearer: String): Long =
        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"레거시 전환 작품"}"""),
            ).andExpect(status().isCreated)
            .andReturn()
            .response.contentAsString
            .let { body -> Regex(""""id":(\d+)""").find(body)!!.groupValues[1].toLong() }

    @Test
    fun `레거시 평문 행은 로드 시 그대로 복원되고 다음 저장 시 봉투로 전환된다`() {
        val user = createUser()
        val bearer = bearerFor(user)
        val projectId = createProject(bearer)
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()

        // 레거시 평문 본문을 DB에 직접 삽입(봉투화하지 않음 = 배포 전 데이터 모사)
        val legacyText = "레거시본문${UUID.randomUUID()}"
        val legacyPlain =
            """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$legacyText"}]}]}"""
        doc.body = legacyPlain
        documentRepository.saveAndFlush(doc)

        // 로드: 레거시 평문이 복호 에러 없이 그대로 반환(JSONB 정규화로 키순서·공백은 달라질 수 있으므로 의미 동등 비교)
        val loadResult =
            mockMvc
                .perform(
                    get("/api/documents/${doc.id}")
                        .header("Authorization", bearer),
                ).andExpect(status().isOk)
                .andReturn()
                .response.contentAsString
        val returnedBody =
            jsonMapper
                .readTree(loadResult)
                .path("data")
                .path("body")
                .asText()
        // 봉투(암호문)가 아니라 레거시 평문 그대로(type=doc 보존, v 봉투 필드 없음)
        assertThat(jsonMapper.readTree(returnedBody)).isEqualTo(jsonMapper.readTree(legacyPlain))

        // 저장: 다음 저장 시 봉투(암호문)로 전환
        val reloaded = documentRepository.findById(doc.id!!).orElseThrow()
        val version = reloaded.updatedAt!!.toString()
        val newText = "전환후본문"
        val newPlain =
            """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$newText"}]}]}"""
        val escaped = newPlain.replace("\"", "\\\"")
        mockMvc
            .perform(
                put("/api/documents/${doc.id}")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"$escaped","version":"$version"}"""),
            ).andExpect(status().isOk)

        // JSONB 정규화로 키순서·공백이 달라질 수 있으므로 봉투 여부는 파싱으로 판별
        val afterSave = documentRepository.findById(doc.id!!).orElseThrow()
        assertThat(afterSave.body).doesNotContain(newText)
        val savedNode = jsonMapper.readTree(afterSave.body)
        assertThat(savedNode.path("type").asText("")).isNotEqualTo("doc") // 평문이 아님
        assertThat(savedNode.path("v").asInt(0)).isEqualTo(1) // 봉투 v1
        assertThat(savedNode.has("iv")).isTrue()
        assertThat(savedNode.has("ct")).isTrue()
    }
}
