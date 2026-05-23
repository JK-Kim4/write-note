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
    fun `create list get update and archive project for authenticated owner`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
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
                    .content("""{"title":"Second draft"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.title").value("Second draft"))

        mockMvc
            .perform(patch("/api/projects/{projectId}/archive", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.archived").value(true))

        mockMvc
            .perform(get("/api/projects").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalElements").value(0))
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
