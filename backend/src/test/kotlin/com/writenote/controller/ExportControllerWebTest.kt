package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.model.request.ExportBlockDto
import com.writenote.model.request.ExportChapterDto
import com.writenote.model.request.ExportRequest
import com.writenote.repository.UserRepository
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ExportControllerWebTest
    @Autowired
    constructor(
        private val mockMvc: MockMvc,
        private val objectMapper: ObjectMapper,
        private val userRepository: UserRepository,
        private val jwtTokenProvider: JwtTokenProvider,
    ) {
        private fun createUser(): User =
            userRepository.saveAndFlush(
                User(email = "export-web-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"),
            )

        private fun bearerFor(user: User): String {
            val token = jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)
            return "Bearer $token"
        }

        private fun createProject(bearer: String): Long =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"export 테스트 작품"}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsString
                .let { body -> Regex(""""id":(\d+)""").find(body)!!.groupValues[1].toLong() }

        private fun sampleRequest(): ExportRequest =
            ExportRequest(
                paperSize = "A4",
                joinMode = "body-only",
                chapters =
                    listOf(
                        ExportChapterDto(
                            title = "1장",
                            blocks = listOf(ExportBlockDto(type = "paragraph", text = "본문 내용")),
                        ),
                    ),
            )

        @Test
        @DisplayName("인증 없이 docx export 는 401")
        fun `docx export requires auth`() {
            mockMvc
                .perform(
                    post("/api/export/1/docx")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleRequest())),
                ).andExpect(status().isUnauthorized)
        }

        @Test
        @DisplayName("인증 없이 hwpx export 는 401")
        fun `hwpx export requires auth`() {
            mockMvc
                .perform(
                    post("/api/export/1/hwpx")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleRequest())),
                ).andExpect(status().isUnauthorized)
        }

        @Test
        @DisplayName("소유 작품 docx export — 200 + Content-Disposition 헤더")
        fun `docx export returns 200 with content-disposition`() {
            val user = createUser()
            val bearer = bearerFor(user)
            val projectId = createProject(bearer)

            mockMvc
                .perform(
                    post("/api/export/{projectId}/docx", projectId)
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleRequest())),
                ).andExpect(status().isOk)
                .andExpect(header().exists("Content-Disposition"))
        }

        @Test
        @DisplayName("소유 작품 hwpx export — 200 + Content-Disposition 헤더")
        fun `hwpx export returns 200 with content-disposition`() {
            val user = createUser()
            val bearer = bearerFor(user)
            val projectId = createProject(bearer)

            mockMvc
                .perform(
                    post("/api/export/{projectId}/hwpx", projectId)
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleRequest())),
                ).andExpect(status().isOk)
                .andExpect(header().exists("Content-Disposition"))
        }

        @Test
        @DisplayName("타인 작품 docx export — 404")
        fun `docx export cross-user returns 404`() {
            val ownerA = createUser()
            val ownerB = createUser()
            val bearerA = bearerFor(ownerA)
            val bearerB = bearerFor(ownerB)
            val projectId = createProject(bearerA)

            mockMvc
                .perform(
                    post("/api/export/{projectId}/docx", projectId)
                        .header("Authorization", bearerB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleRequest())),
                ).andExpect(status().isNotFound)
        }
    }
