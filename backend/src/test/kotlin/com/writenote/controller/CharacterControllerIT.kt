package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.repository.UserRepository
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CharacterControllerIT {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var jwtTokenProvider: JwtTokenProvider

    @Test
    @DisplayName("create + list + get + patch + delete chain — 인증된 owner happy path (US4)")
    fun `character crud chain for authenticated owner`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(bearer, "First draft")

        val characterId =
            mockMvc
                .perform(
                    post("/api/projects/{projectId}/characters", projectId)
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            """
                            {
                              "name":"민지",
                              "shortDescription":"주인공",
                              "notes":"회상 능숙",
                              "displayOrder":null
                            }
                            """.trimIndent(),
                        ),
                ).andExpect(status().isCreated)
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.name").value("민지"))
                .andExpect(jsonPath("$.data.shortDescription").value("주인공"))
                .andExpect(jsonPath("$.data.notes").value("회상 능숙"))
                .andExpect(jsonPath("$.data.displayOrder").value(0))
                .andExpect(jsonPath("$.data.projectId").value(projectId))
                .andReturn()
                .response
                .contentAsString
                .let(::extractCharacterId)

        mockMvc
            .perform(get("/api/projects/{projectId}/characters", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalElements").value(1))
            .andExpect(jsonPath("$.data.content[0].id").value(characterId))
            .andExpect(jsonPath("$.data.content[0].name").value("민지"))

        mockMvc
            .perform(
                get("/api/projects/{projectId}/characters/{id}", projectId, characterId)
                    .header("Authorization", bearer),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.id").value(characterId))
            .andExpect(jsonPath("$.data.name").value("민지"))

        mockMvc
            .perform(
                patch("/api/projects/{projectId}/characters/{id}", projectId, characterId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"shortDescription":"주인공, 24세 갱신"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.shortDescription").value("주인공, 24세 갱신"))
            .andExpect(jsonPath("$.data.name").value("민지"))
            .andExpect(jsonPath("$.data.notes").value("회상 능숙"))

        mockMvc
            .perform(
                delete("/api/projects/{projectId}/characters/{id}", projectId, characterId)
                    .header("Authorization", bearer),
            ).andExpect(status().isNoContent)

        mockMvc
            .perform(
                get("/api/projects/{projectId}/characters/{id}", projectId, characterId)
                    .header("Authorization", bearer),
            ).andExpect(status().isNotFound)
    }

    @Test
    @DisplayName("create — name 누락 400 VALIDATION_FAILED")
    fun `create character rejects missing name`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(bearer, "draft")

        mockMvc
            .perform(
                post("/api/projects/{projectId}/characters", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name":""}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"))
    }

    @Test
    @DisplayName("create — name 길이 81자 초과 400")
    fun `create character rejects name over length`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(bearer, "draft")
        val longName = "x".repeat(81)

        mockMvc
            .perform(
                post("/api/projects/{projectId}/characters", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name":"$longName"}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"))
    }

    @Test
    @DisplayName("cross user — 다른 사용자 projectId 의 character 접근 시 404 (FR-015)")
    fun `cross user access returns 404`() {
        val ownerA = createUser()
        val ownerB = createUser()
        val bearerA = bearerFor(ownerA)
        val bearerB = bearerFor(ownerB)
        val projectIdA = createProject(bearerA, "A draft")

        // ownerA 의 character 생성
        val characterId =
            mockMvc
                .perform(
                    post("/api/projects/{projectId}/characters", projectIdA)
                        .header("Authorization", bearerA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"name":"비밀 인물"}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsString
                .let(::extractCharacterId)

        // ownerB 가 ownerA 의 character 접근 시도 — 모두 404
        mockMvc
            .perform(get("/api/projects/{projectId}/characters", projectIdA).header("Authorization", bearerB))
            .andExpect(status().isNotFound)

        mockMvc
            .perform(
                get("/api/projects/{projectId}/characters/{id}", projectIdA, characterId)
                    .header("Authorization", bearerB),
            ).andExpect(status().isNotFound)

        mockMvc
            .perform(
                patch("/api/projects/{projectId}/characters/{id}", projectIdA, characterId)
                    .header("Authorization", bearerB)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name":"hacked"}"""),
            ).andExpect(status().isNotFound)

        mockMvc
            .perform(
                delete("/api/projects/{projectId}/characters/{id}", projectIdA, characterId)
                    .header("Authorization", bearerB),
            ).andExpect(status().isNotFound)
    }

    @Test
    @DisplayName("인증 없이 호출 — 401")
    fun `unauthenticated request returns 401`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(bearer, "draft")

        mockMvc
            .perform(get("/api/projects/{projectId}/characters", projectId))
            .andExpect(status().isUnauthorized)
    }

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "character-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
        )

    private fun bearerFor(user: User): String {
        val token = jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)
        return "Bearer $token"
    }

    private fun createProject(
        bearer: String,
        title: String,
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
            .let(::extractProjectId)

    private fun extractProjectId(body: String): Long = extractId(body, "project")

    private fun extractCharacterId(body: String): Long = extractId(body, "character")

    private fun extractId(
        body: String,
        label: String,
    ): Long =
        requireNotNull(Regex(""""id":(\d+)""").find(body)) {
            "Response does not contain $label id: $body"
        }.groupValues[1].toLong()
}
