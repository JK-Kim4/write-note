package com.writenote.controller

import com.writenote.entity.User
import com.writenote.repository.UserRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
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

    @Test
    fun `create list get update and archive project for owner`() {
        val owner = createUser()
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("X-User-Id", owner.id!!)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"First draft"}"""),
                ).andExpect(status().isCreated)
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value("First draft"))
                .andExpect(jsonPath("$.data.archived").value(false))
                .andReturn()
                .response
                .contentAsString
                .let(::extractProjectId)

        mockMvc
            .perform(get("/api/projects").header("X-User-Id", owner.id!!))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.totalElements").value(1))
            .andExpect(jsonPath("$.data.content[0].id").value(projectId))

        mockMvc
            .perform(get("/api/projects/{projectId}", projectId).header("X-User-Id", owner.id!!))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.id").value(projectId))

        mockMvc
            .perform(
                patch("/api/projects/{projectId}", projectId)
                    .header("X-User-Id", owner.id!!)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"Second draft"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.title").value("Second draft"))

        mockMvc
            .perform(patch("/api/projects/{projectId}/archive", projectId).header("X-User-Id", owner.id!!))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.archived").value(true))

        mockMvc
            .perform(get("/api/projects").header("X-User-Id", owner.id!!))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalElements").value(0))
    }

    @Test
    fun `validation failure and missing user header use error envelope`() {
        mockMvc
            .perform(
                post("/api/projects")
                    .header("X-User-Id", createUser().id!!)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":""}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"))

        mockMvc
            .perform(
                post("/api/projects")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"Missing owner"}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("INVALID_PARAMETER"))
    }

    @Test
    fun `cross user project access returns not found`() {
        val owner = createUser()
        val otherUser = createUser()
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("X-User-Id", owner.id!!)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"Owner draft"}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsString
                .let(::extractProjectId)

        mockMvc
            .perform(get("/api/projects/{projectId}", projectId).header("X-User-Id", otherUser.id!!))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
    }

    private fun createUser(): User = userRepository.saveAndFlush(User(email = "controller-${UUID.randomUUID()}@example.com"))

    private fun extractProjectId(body: String): Long =
        requireNotNull(Regex(""""id":(\d+)""").find(body)) { "Response does not contain project id: $body" }
            .groupValues[1]
            .toLong()
}
