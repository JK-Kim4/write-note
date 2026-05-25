package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.repository.UserRepository
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
class ProjectControllerIT {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var jwtTokenProvider: JwtTokenProvider

    @Test
    fun `create list get patch archive unarchive delete project for authenticated owner`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            """
                            {
                              "title":"First draft",
                              "genre":"치유물",
                              "targetLength":4000,
                              "toneNotes":"잔잔",
                              "synopsis":"손녀와 할머니",
                              "worldNotes":"1990s"
                            }
                            """.trimIndent(),
                        ),
                ).andExpect(status().isCreated)
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value("First draft"))
                .andExpect(jsonPath("$.data.genre").value("치유물"))
                .andExpect(jsonPath("$.data.targetLength").value(4000))
                .andExpect(jsonPath("$.data.toneNotes").value("잔잔"))
                .andExpect(jsonPath("$.data.synopsis").value("손녀와 할머니"))
                .andExpect(jsonPath("$.data.worldNotes").value("1990s"))
                .andExpect(jsonPath("$.data.archivedAt").doesNotExist())
                .andReturn()
                .response
                .contentAsString
                .let(::extractProjectId)

        mockMvc
            .perform(get("/api/projects").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.totalElements").value(1))
            .andExpect(jsonPath("$.data.content[0].id").value(projectId))

        mockMvc
            .perform(get("/api/projects/{projectId}", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.id").value(projectId))

        mockMvc
            .perform(
                patch("/api/projects/{projectId}", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"Second draft","genre":"스릴러"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.title").value("Second draft"))
            .andExpect(jsonPath("$.data.genre").value("스릴러"))
            .andExpect(jsonPath("$.data.toneNotes").value("잔잔"))
            .andExpect(jsonPath("$.data.synopsis").value("손녀와 할머니"))

        mockMvc
            .perform(post("/api/projects/{projectId}/archive", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.archivedAt").exists())

        mockMvc
            .perform(get("/api/projects").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalElements").value(0))

        mockMvc
            .perform(get("/api/projects?archived=true").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalElements").value(1))
            .andExpect(jsonPath("$.data.content[0].id").value(projectId))

        mockMvc
            .perform(post("/api/projects/{projectId}/unarchive", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.archivedAt").doesNotExist())

        mockMvc
            .perform(get("/api/projects").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalElements").value(1))

        mockMvc
            .perform(delete("/api/projects/{projectId}", projectId).header("Authorization", bearer))
            .andExpect(status().isNoContent)

        mockMvc
            .perform(get("/api/projects/{projectId}", projectId).header("Authorization", bearer))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `partial update preserves unspecified fields`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"Original","genre":"치유물","targetLength":1000}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsString
                .let(::extractProjectId)

        mockMvc
            .perform(
                patch("/api/projects/{projectId}", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"toneNotes":"새 톤"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.title").value("Original"))
            .andExpect(jsonPath("$.data.genre").value("치유물"))
            .andExpect(jsonPath("$.data.targetLength").value(1000))
            .andExpect(jsonPath("$.data.toneNotes").value("새 톤"))
    }

    @Test
    fun `archive is idempotent — second call keeps original archivedAt`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"To archive twice"}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsString
                .let(::extractProjectId)

        val firstResponse =
            mockMvc
                .perform(post("/api/projects/{projectId}/archive", projectId).header("Authorization", bearer))
                .andExpect(status().isOk)
                .andReturn()
                .response
                .contentAsString
        val firstArchivedAt =
            requireNotNull(Regex(""""archivedAt":"([^"]+)"""").find(firstResponse)) {
                "firstResponse does not contain archivedAt: $firstResponse"
            }.groupValues[1]

        mockMvc
            .perform(post("/api/projects/{projectId}/archive", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.archivedAt").value(firstArchivedAt))
    }

    @Test
    fun `validation failure on authenticated call returns 400 VALIDATION_FAILED`() {
        val owner = createUser()
        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearerFor(owner))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":""}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"))
    }

    @Test
    fun `cross user archive attempt returns 404`() {
        val ownerA = createUser()
        val ownerB = createUser()
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearerFor(ownerA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"A's draft"}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsString
                .let(::extractProjectId)

        mockMvc
            .perform(post("/api/projects/{projectId}/archive", projectId).header("Authorization", bearerFor(ownerB)))
            .andExpect(status().isNotFound)

        mockMvc
            .perform(delete("/api/projects/{projectId}", projectId).header("Authorization", bearerFor(ownerB)))
            .andExpect(status().isNotFound)
    }

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "controller-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
        )

    private fun bearerFor(user: User): String {
        val token = jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)
        return "Bearer $token"
    }

    private fun extractProjectId(body: String): Long =
        requireNotNull(Regex(""""id":(\d+)""").find(body)) { "Response does not contain project id: $body" }
            .groupValues[1]
            .toLong()
}
