package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.Project
import com.writenote.entity.User
import com.writenote.repository.ProjectLogRepository
import com.writenote.repository.ProjectRepository
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
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProjectLogControllerIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var projectRepository: ProjectRepository

    @Autowired private lateinit var projectLogRepository: ProjectLogRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    @Test
    fun `create then list newest-first and fetch latest`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(owner.id!!).id!!

        // 최신 없음 → latest null
        mockMvc
            .perform(get("/api/projects/{projectId}/logs/latest", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data").doesNotExist())

        // AS1 — 생성 → 목록 등장
        createLog(bearer, projectId, "첫 기록")
        createLog(bearer, projectId, "둘째 기록")
        val thirdId = createLog(bearer, projectId, "셋째 기록")

        // AS2 — 최신순
        mockMvc
            .perform(get("/api/projects/{projectId}/logs", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.length()").value(3))
            .andExpect(jsonPath("$.data[0].body").value("셋째 기록"))
            .andExpect(jsonPath("$.data[2].body").value("첫 기록"))

        // AS3 — 최신 1건
        mockMvc
            .perform(get("/api/projects/{projectId}/logs/latest", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.id").value(thirdId))
            .andExpect(jsonPath("$.data.body").value("셋째 기록"))
    }

    @Test
    fun `empty body returns 400`() {
        val owner = createUser()
        val projectId = createProject(owner.id!!).id!!
        mockMvc
            .perform(
                post("/api/projects/{projectId}/logs", projectId)
                    .header("Authorization", bearerFor(owner))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":""}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"))
    }

    @Test
    fun `cross user log access returns 404`() {
        val ownerA = createUser()
        val ownerB = createUser()
        val projectId = createProject(ownerA.id!!).id!!
        createLog(bearerFor(ownerA), projectId, "A 기록")

        // AS4 — 타 계정 조회 거부
        mockMvc
            .perform(get("/api/projects/{projectId}/logs", projectId).header("Authorization", bearerFor(ownerB)))
            .andExpect(status().isNotFound)
        mockMvc
            .perform(
                post("/api/projects/{projectId}/logs", projectId)
                    .header("Authorization", bearerFor(ownerB))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"침입"}"""),
            ).andExpect(status().isNotFound)
    }

    @Test
    fun `deleting project cascades logs`() {
        val owner = createUser()
        val project = createProject(owner.id!!)
        createLog(bearerFor(owner), project.id!!, "삭제될 기록")
        assertThat(projectLogRepository.findByProjectIdOrderByCreatedAtDesc(project.id!!)).isNotEmpty()

        // AS5 — 작품 삭제 시 기록 연쇄 제거 (DB ON DELETE CASCADE)
        projectRepository.deleteById(project.id!!)
        projectRepository.flush()

        assertThat(projectLogRepository.findByProjectIdOrderByCreatedAtDesc(project.id!!)).isEmpty()
    }

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "log-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
        )

    private fun createProject(userId: Long): Project = projectRepository.saveAndFlush(Project(userId = userId, title = "기록 작품"))

    private fun createLog(
        bearer: String,
        projectId: Long,
        body: String,
    ): Long =
        mockMvc
            .perform(
                post("/api/projects/{projectId}/logs", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"$body"}"""),
            ).andExpect(status().isCreated)
            .andReturn()
            .response
            .contentAsString
            .let { requireNotNull(Regex(""""id":(\d+)""").find(it)).groupValues[1].toLong() }

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"
}
