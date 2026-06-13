package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.entity.WorkSession
import com.writenote.repository.UserRepository
import com.writenote.repository.WorkSessionRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.util.UUID

/** 018 기간 작업시간 합계 — GET /api/work-sessions/total?from=&to= (작품 횡단). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WorkSessionTotalControllerIT {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var jwtTokenProvider: JwtTokenProvider

    @Autowired
    private lateinit var workSessionRepository: WorkSessionRepository

    @Test
    fun `range total sums ended sessions across projects within range, excluding others`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val other = createUser()
        val projectA = createProject(bearer, "작품 A")
        val projectB = createProject(bearer, "작품 B")
        val foreign = createProject(bearerFor(other), "남의 작품")

        val from = Instant.parse("2026-06-08T00:00:00Z")
        // 범위 내 — 두 작품에 걸쳐 합산 대상
        saveEnded(owner.id!!, projectA, from.plusSeconds(3600), 1_200_000L)
        saveEnded(owner.id!!, projectB, from.plusSeconds(7200), 600_000L)
        // 범위 밖(이전 주) — 제외
        saveEnded(owner.id!!, projectA, from.minusSeconds(3600), 900_000L)
        // 진행 중 — 제외
        workSessionRepository.saveAndFlush(WorkSession(userId = owner.id!!, projectId = projectA, startedAt = from.plusSeconds(9000)))
        // 타 사용자 — 제외
        saveEnded(other.id!!, foreign, from.plusSeconds(3600), 500_000L)

        mockMvc
            .perform(
                get("/api/work-sessions/total")
                    .header("Authorization", bearer)
                    .param("from", "2026-06-08T00:00:00Z")
                    .param("to", "2026-06-15T00:00:00Z"),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.totalDurationMs").value(1_800_000L))
    }

    @Test
    fun `total preserves work time after project deletion`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectA = createProject(bearer, "삭제될 작품")
        val from = Instant.parse("2026-06-08T00:00:00Z")
        saveEnded(owner.id!!, projectA, from.plusSeconds(3600), 1_000_000L)

        // 작품 삭제(DELETE) → 세션 project_id=NULL 로 분리, 전체 합계는 user 단위로 보존(트랙2).
        mockMvc
            .perform(delete("/api/projects/{id}", projectA).header("Authorization", bearer))
            .andExpect(status().isNoContent)

        mockMvc
            .perform(
                get("/api/work-sessions/total")
                    .header("Authorization", bearer)
                    .param("from", "2026-06-08T00:00:00Z")
                    .param("to", "2026-06-15T00:00:00Z"),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalDurationMs").value(1_000_000L))
    }

    @Test
    fun `inverted range returns 400 VALIDATION_FAILED`() {
        val owner = createUser()
        mockMvc
            .perform(
                get("/api/work-sessions/total")
                    .header("Authorization", bearerFor(owner))
                    .param("from", "2026-06-15T00:00:00Z")
                    .param("to", "2026-06-08T00:00:00Z"),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"))
    }

    @Test
    fun `missing params return 400`() {
        val owner = createUser()
        mockMvc
            .perform(get("/api/work-sessions/total").header("Authorization", bearerFor(owner)))
            .andExpect(status().isBadRequest)
    }

    @Test
    fun `without token returns 401`() {
        mockMvc
            .perform(
                get("/api/work-sessions/total")
                    .param("from", "2026-06-08T00:00:00Z")
                    .param("to", "2026-06-15T00:00:00Z"),
            ).andExpect(status().isUnauthorized)
    }

    private fun saveEnded(
        userId: Long,
        projectId: Long,
        startedAt: Instant,
        durationMs: Long,
    ) {
        workSessionRepository.saveAndFlush(
            WorkSession(userId = userId, projectId = projectId, startedAt = startedAt, endedAt = startedAt.plusMillis(durationMs)),
        )
    }

    private fun createProject(
        bearer: String,
        title: String,
    ): Long {
        val body =
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
        return requireNotNull(Regex(""""id":(\d+)""").find(body)) { "no id in $body" }.groupValues[1].toLong()
    }

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "range-total-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
        )

    private fun bearerFor(user: User): String {
        val token = jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)
        return "Bearer $token"
    }
}
