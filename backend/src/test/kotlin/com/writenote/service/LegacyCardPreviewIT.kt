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
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/**
 * 레거시 평문 최신 챕터로 listCards 미리보기 정상 (US3).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LegacyCardPreviewIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    @Autowired private lateinit var documentRepository: DocumentRepository

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "legacy-card-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"),
        )

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"

    private fun createProject(bearer: String): Long =
        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"레거시 카드 작품"}"""),
            ).andExpect(status().isCreated)
            .andReturn()
            .response.contentAsString
            .let { body -> Regex(""""id":(\d+)""").find(body)!!.groupValues[1].toLong() }

    @Test
    fun `레거시 평문 챕터로 listCards 미리보기가 정상 추출된다`() {
        val user = createUser()
        val bearer = bearerFor(user)
        val projectId = createProject(bearer)
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()

        val legacyText = "레거시미리보기${UUID.randomUUID()}"
        val legacyPlain =
            """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$legacyText"}]}]}"""
        doc.body = legacyPlain
        documentRepository.saveAndFlush(doc)

        val cardsResult =
            mockMvc
                .perform(
                    get("/api/projects/cards")
                        .header("Authorization", bearer),
                ).andExpect(status().isOk)
                .andReturn()
                .response.contentAsString

        assertThat(cardsResult).contains(legacyText)
    }
}
