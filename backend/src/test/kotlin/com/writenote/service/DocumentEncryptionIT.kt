package com.writenote.service

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.repository.DocumentRepository
import com.writenote.repository.UserEncryptionKeyRepository
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
import java.util.UUID

/**
 * 본문 봉투 암호화 통합 테스트 (US1 MVP).
 *
 * 핵심 검증:
 * - 저장 후 documents.body가 원문 미포함(암호문)
 * - 로드 시 평문 일치(왕복 무손실)
 * - 암호화 저장 후 word_count 정확
 * - 빈 본문 / 한글 본문 왕복
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DocumentEncryptionIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    @Autowired private lateinit var documentRepository: DocumentRepository

    @Autowired private lateinit var userEncryptionKeyRepository: UserEncryptionKeyRepository

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "enc-it-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"),
        )

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"

    private fun createProject(bearer: String): Long =
        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"암호화 테스트 작품"}"""),
            ).andExpect(status().isCreated)
            .andReturn()
            .response.contentAsString
            .let { body -> Regex(""""id":(\d+)""").find(body)!!.groupValues[1].toLong() }

    @Test
    fun `저장 후 documents_body는 원문 부분문자열을 포함하지 않는다`() {
        val user = createUser()
        // 가입 후 DEK 생성을 위해 직접 UserKeyService를 경유하거나 먼저 DEK 생성
        // createUser는 saveAndFlush라 signupEmail을 거치지 않으므로 DEK가 없음
        // getOrCreate(지연 생성 안전망)가 작동해야 함
        val bearer = bearerFor(user)
        val projectId = createProject(bearer)
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()
        val secretText = "비밀텍스트${UUID.randomUUID()}"
        val plainBody = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$secretText"}]}]}"""
        val version = doc.updatedAt!!.toString()
        val escapedBody = plainBody.replace("\"", "\\\"")

        mockMvc
            .perform(
                put("/api/documents/${doc.id}")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"$escapedBody","version":"$version"}"""),
            ).andExpect(status().isOk)

        val stored = documentRepository.findById(doc.id!!).orElseThrow()
        assertThat(stored.body).doesNotContain(secretText)
        assertThat(stored.body).doesNotContain(""""type":"doc"""")
    }

    @Test
    fun `저장 후 로드 시 평문이 그대로 복원된다(왕복 무손실)`() {
        val user = createUser()
        val bearer = bearerFor(user)
        val projectId = createProject(bearer)
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()
        val plainBody = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"왕복 테스트"}]}]}"""
        val version = doc.updatedAt!!.toString()
        val escapedBody = plainBody.replace("\"", "\\\"")

        mockMvc
            .perform(
                put("/api/documents/${doc.id}")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"$escapedBody","version":"$version"}"""),
            ).andExpect(status().isOk)

        mockMvc
            .perform(
                get("/api/documents/${doc.id}")
                    .header("Authorization", bearer),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.body").value(plainBody))
    }

    @Test
    fun `암호화 저장 후 word_count가 정확하다`() {
        val user = createUser()
        val bearer = bearerFor(user)
        val projectId = createProject(bearer)
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()
        // "안녕 세계" = 공백 제외 4자
        val plainBody = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"안녕 세계"}]}]}"""
        val version = doc.updatedAt!!.toString()
        val escapedBody = plainBody.replace("\"", "\\\"")

        mockMvc
            .perform(
                put("/api/documents/${doc.id}")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"$escapedBody","version":"$version"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.wordCount").value(4))
    }

    @Test
    fun `빈 본문 왕복 무손실`() {
        val user = createUser()
        val bearer = bearerFor(user)
        val projectId = createProject(bearer)
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()
        val emptyBody = """{"type":"doc","content":[]}"""
        val version = doc.updatedAt!!.toString()
        val escapedBody = emptyBody.replace("\"", "\\\"")

        mockMvc
            .perform(
                put("/api/documents/${doc.id}")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"$escapedBody","version":"$version"}"""),
            ).andExpect(status().isOk)

        mockMvc
            .perform(
                get("/api/documents/${doc.id}")
                    .header("Authorization", bearer),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.body").value(emptyBody))
    }
}
