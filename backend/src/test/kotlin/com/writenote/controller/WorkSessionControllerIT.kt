package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.Project
import com.writenote.entity.User
import com.writenote.entity.WorkSession
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import com.writenote.repository.WorkSessionRepository
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
import java.time.Instant
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WorkSessionControllerIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var projectRepository: ProjectRepository

    @Autowired private lateinit var workSessionRepository: WorkSessionRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    @Test
    fun `start opens session and re-start keeps exactly one open`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(owner.id!!).id!!

        // AS1 — 시작 → 열린 세션
        mockMvc
            .perform(post("/api/projects/{projectId}/work-sessions/start", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.endedAt").doesNotExist())

        // AS2 — 재시작 → 이전(짧음) 폐기, 여전히 1개
        mockMvc
            .perform(post("/api/projects/{projectId}/work-sessions/start", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)

        assertThat(workSessionRepository.findFirstByProjectIdAndEndedAtIsNull(projectId)).isNotNull()
        assertThat(workSessionRepository.findByProjectIdAndEndedAtIsNotNull(projectId)).isEmpty() // 첫 세션은 30s 미만 폐기
    }

    @Test
    fun `auto-end preserves session shorter than threshold`() {
        val owner = createUser()
        val projectId = createProject(owner.id!!).id!!
        val sessionId =
            workSessionRepository
                .saveAndFlush(WorkSession(userId = owner.id!!, projectId = projectId, startedAt = Instant.now().minusSeconds(5)))
                .id!!

        // 타임워치 — 30초 미만 자동 종료도 보존
        mockMvc
            .perform(post("/api/projects/{projectId}/work-sessions/end", projectId).header("Authorization", bearerFor(owner)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.endedAt").exists())

        assertThat(workSessionRepository.findById(sessionId)).isPresent()
    }

    @Test
    fun `auto-end preserves session of threshold or longer`() {
        val owner = createUser()
        val projectId = createProject(owner.id!!).id!!
        workSessionRepository.saveAndFlush(
            WorkSession(userId = owner.id!!, projectId = projectId, startedAt = Instant.now().minusSeconds(90)),
        )

        // AS4 — 30초 이상 자동 종료 → 보존
        mockMvc
            .perform(post("/api/projects/{projectId}/work-sessions/end", projectId).header("Authorization", bearerFor(owner)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.endedAt").exists())

        mockMvc
            .perform(get("/api/projects/{projectId}/work-sessions/total", projectId).header("Authorization", bearerFor(owner)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalDurationMs").value(org.hamcrest.Matchers.greaterThan(0)))
    }

    @Test
    fun `endWithLog preserves short session and creates log atomically`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId = createProject(owner.id!!).id!!

        mockMvc
            .perform(post("/api/projects/{projectId}/work-sessions/start", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)

        // AS5 — 짧아도 종료 보존 + 기록 생성(원자)
        mockMvc
            .perform(
                post("/api/projects/{projectId}/work-sessions/end-with-log", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"오늘 작업 마침"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.session.endedAt").exists())
            .andExpect(jsonPath("$.data.log.body").value("오늘 작업 마침"))

        mockMvc
            .perform(get("/api/projects/{projectId}/logs", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.length()").value(1))
    }

    @Test
    fun `endWithLog with blank body returns 400`() {
        val owner = createUser()
        val projectId = createProject(owner.id!!).id!!
        mockMvc
            .perform(
                post("/api/projects/{projectId}/work-sessions/end-with-log", projectId)
                    .header("Authorization", bearerFor(owner))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":""}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"))
    }

    @Test
    fun `cross user start returns 404`() {
        val ownerA = createUser()
        val ownerB = createUser()
        val projectId = createProject(ownerA.id!!).id!!
        mockMvc
            .perform(post("/api/projects/{projectId}/work-sessions/start", projectId).header("Authorization", bearerFor(ownerB)))
            .andExpect(status().isNotFound)
    }

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "ws-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
        )

    private fun createProject(userId: Long): Project = projectRepository.saveAndFlush(Project(userId = userId, title = "세션 작품"))

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"
}
