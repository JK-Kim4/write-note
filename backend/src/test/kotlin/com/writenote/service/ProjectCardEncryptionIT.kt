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
import java.util.UUID

/**
 * listCards 미리보기(lastSentenceSource)가 암호문 저장 시에도 정상 복호되는지 검증 (US1).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProjectCardEncryptionIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    @Autowired private lateinit var documentRepository: DocumentRepository

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "card-enc-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"),
        )

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"

    private fun createProject(bearer: String): Long =
        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"카드 암호화 테스트 작품"}"""),
            ).andExpect(status().isCreated)
            .andReturn()
            .response.contentAsString
            .let { body -> Regex(""""id":(\d+)""").find(body)!!.groupValues[1].toLong() }

    @Test
    fun `암호문 저장 후 listCards lastSentenceSource에 평문 미리보기가 포함된다`() {
        val user = createUser()
        val bearer = bearerFor(user)
        val projectId = createProject(bearer)
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()

        val previewText = "미리보기확인텍스트"
        val plainBody = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$previewText"}]}]}"""
        val version = doc.updatedAt!!.toString()
        val escapedBody = plainBody.replace("\"", "\\\"")

        mockMvc
            .perform(
                put("/api/documents/${doc.id}")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"$escapedBody","version":"$version"}"""),
            ).andExpect(status().isOk)

        val cardsResult =
            mockMvc
                .perform(
                    get("/api/projects/cards")
                        .header("Authorization", bearer),
                ).andExpect(status().isOk)
                .andExpect(jsonPath("$.success").value(true))
                .andReturn()
                .response.contentAsString

        assertThat(cardsResult).contains(previewText)
    }

    @Test
    fun `암호문이나 DEK 없는 손상 본문이 있어도 카드 목록은 200으로 응답한다`() {
        // 견고성: 미리보기(lastSentenceSource) 복호 실패가 작품 목록 전체를 막으면 안 된다.
        // (DEK 없는 사용자의 본문이 어떤 이유로 암호문이면 복호 불가 — 그래도 목록은 떠야 함.)
        val user = createUser()
        val bearer = bearerFor(user)
        val projectId = createProject(bearer)
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()
        // 손상 상태 재현 — 암호문 봉투지만 이 사용자 DEK 없음 → decryptToPlain 이 BodyDecryptionException
        doc.body = """{"v":1,"ct":"ZmFrZWNpcGhlcnRleHQ"}"""
        documentRepository.saveAndFlush(doc)

        mockMvc
            .perform(
                get("/api/projects/cards")
                    .header("Authorization", bearer),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
    }
}
