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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CategoryControllerIT {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var jwtTokenProvider: JwtTokenProvider

    @Test
    fun `create move list rename delete category preserves project as uncategorized`() {
        val bearer = bearerFor(createUser())

        // 1) 모음 생성
        val categoryId =
            mockMvc
                .perform(
                    post("/api/categories")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"name":"  장편 판타지  "}"""),
                ).andExpect(status().isCreated)
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.name").value("장편 판타지"))
                .andExpect(jsonPath("$.data.projectCount").value(0))
                .andExpect(jsonPath("$.data.parentId").doesNotExist())
                .andReturn()
                .response.contentAsString
                .let(::extractId)

        // 2) 작품 생성
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"작품A"}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response.contentAsString
                .let(::extractId)

        // 3) 작품을 모음으로 이동
        mockMvc
            .perform(
                patch("/api/projects/{id}/category", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"categoryId":$categoryId}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.categoryId").value(categoryId))

        // 4) 목록 — projectCount 1
        mockMvc
            .perform(get("/api/categories").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data[0].id").value(categoryId))
            .andExpect(jsonPath("$.data[0].projectCount").value(1))

        // 5) 이름 변경
        mockMvc
            .perform(
                patch("/api/categories/{id}", categoryId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name":"장편"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.name").value("장편"))

        // 6) 모음 삭제 — 작품은 미분류로 보존
        mockMvc
            .perform(delete("/api/categories/{id}", categoryId).header("Authorization", bearer))
            .andExpect(status().isNoContent)

        mockMvc
            .perform(get("/api/projects/{id}", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.id").value(projectId))
            .andExpect(jsonPath("$.data.categoryId").doesNotExist())
    }

    @Test
    fun `move with null categoryId moves project to uncategorized`() {
        val bearer = bearerFor(createUser())
        val categoryId =
            mockMvc
                .perform(
                    post("/api/categories")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"name":"C"}"""),
                ).andReturn()
                .response.contentAsString
                .let(::extractId)
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"P"}"""),
                ).andReturn()
                .response.contentAsString
                .let(::extractId)
        mockMvc
            .perform(
                patch("/api/projects/{id}/category", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"categoryId":$categoryId}"""),
            ).andExpect(status().isOk)

        // categoryId 생략(=null) → 미분류
        mockMvc
            .perform(
                patch("/api/projects/{id}/category", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.categoryId").doesNotExist())
    }

    @Test
    fun `category list reports series targetLength and totalWordCount from active documents`() {
        val bearer = bearerFor(createUser())

        // 시리즈 생성(총 목표 분량 포함)
        val categoryId =
            mockMvc
                .perform(
                    post("/api/categories")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"name":"대하소설","targetLength":500000}"""),
                ).andExpect(status().isCreated)
                .andExpect(jsonPath("$.data.targetLength").value(500000))
                .andExpect(jsonPath("$.data.totalWordCount").value(0))
                .andReturn()
                .response.contentAsString
                .let(::extractId)

        // 작품 2개 — 각각 본문에 글자 작성(5자, 7자), 시리즈로 이동
        val projectA = createProjectWithBody(bearer, "작품A", "가나다라마") // 5
        val projectB = createProjectWithBody(bearer, "작품B", "일이삼사오육칠") // 7
        moveToCategory(bearer, projectA, categoryId)
        moveToCategory(bearer, projectB, categoryId)

        // 보관 작품은 합산 제외 검증용
        val archived = createProjectWithBody(bearer, "보관작품", "보관본문아홉글자임") // 9
        moveToCategory(bearer, archived, categoryId)
        mockMvc
            .perform(post("/api/projects/{id}/archive", archived).header("Authorization", bearer))
            .andExpect(status().isOk)

        // 목록 — totalWordCount = 5 + 7 = 12 (보관 9 제외)
        mockMvc
            .perform(get("/api/categories").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data[0].id").value(categoryId))
            .andExpect(jsonPath("$.data[0].targetLength").value(500000))
            .andExpect(jsonPath("$.data[0].totalWordCount").value(12))
    }

    @Test
    fun `empty series reports totalWordCount zero`() {
        val bearer = bearerFor(createUser())
        mockMvc
            .perform(
                post("/api/categories")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name":"빈 시리즈"}"""),
            ).andExpect(status().isCreated)
        mockMvc
            .perform(get("/api/categories").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data[0].totalWordCount").value(0))
            .andExpect(jsonPath("$.data[0].targetLength").doesNotExist())
    }

    @Test
    fun `create rejects non-null parentId with 400`() {
        val bearer = bearerFor(createUser())
        mockMvc
            .perform(
                post("/api/categories")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name":"하위","parentId":1}"""),
            ).andExpect(status().isBadRequest)
    }

    @Test
    fun `move to other users category returns 404`() {
        val ownerBearer = bearerFor(createUser())
        val strangerBearer = bearerFor(createUser())
        // stranger 의 모음
        val strangerCategoryId =
            mockMvc
                .perform(
                    post("/api/categories")
                        .header("Authorization", strangerBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"name":"남의 모음"}"""),
                ).andReturn()
                .response.contentAsString
                .let(::extractId)
        // owner 의 작품
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", ownerBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"P"}"""),
                ).andReturn()
                .response.contentAsString
                .let(::extractId)

        mockMvc
            .perform(
                patch("/api/projects/{id}/category", projectId)
                    .header("Authorization", ownerBearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"categoryId":$strangerCategoryId}"""),
            ).andExpect(status().isNotFound)
    }

    /** 작품 생성 → 자동생성 본문에 [text] 작성(word_count = 비공백 글자 수). 작품 id 반환. */
    private fun createProjectWithBody(
        bearer: String,
        title: String,
        text: String,
    ): Long {
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"$title"}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response.contentAsString
                .let(::extractId)

        // 작품의 단일 활성 본문 조회(id + version 토큰)
        val docBody =
            mockMvc
                .perform(get("/api/projects/{id}/document", projectId).header("Authorization", bearer))
                .andExpect(status().isOk)
                .andReturn()
                .response.contentAsString
        val docId = extractId(docBody)
        val version = extractVersion(docBody)

        val body =
            """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$text"}]}]}"""
        mockMvc
            .perform(
                put("/api/documents/{id}", docId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":${quoteJson(body)},"version":"$version"}"""),
            ).andExpect(status().isOk)
        return projectId
    }

    private fun moveToCategory(
        bearer: String,
        projectId: Long,
        categoryId: Long,
    ) {
        mockMvc
            .perform(
                patch("/api/projects/{id}/category", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"categoryId":$categoryId}"""),
            ).andExpect(status().isOk)
    }

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "category-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
        )

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"

    private fun extractId(body: String): Long =
        requireNotNull(Regex(""""id":(\d+)""").find(body)) { "Response does not contain id: $body" }
            .groupValues[1]
            .toLong()

    private fun extractVersion(body: String): String =
        requireNotNull(Regex(""""version":"([^"]+)"""").find(body)) { "Response does not contain version: $body" }
            .groupValues[1]

    /** body 문자열을 JSON 문자열 리터럴로 안전 인코딩(따옴표 이스케이프). */
    private fun quoteJson(value: String): String = "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""
}
