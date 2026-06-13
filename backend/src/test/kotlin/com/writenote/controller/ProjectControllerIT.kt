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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
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

    @Autowired
    private lateinit var workSessionRepository: WorkSessionRepository

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
    fun `nextScene defaults empty, is saved on patch, returned on get, and cleared by empty value`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"다음 장면 작품"}"""),
                ).andExpect(status().isCreated)
                .andExpect(jsonPath("$.data.nextScene").value(""))
                .andReturn()
                .response
                .contentAsString
                .let(::extractProjectId)

        // AS1 — 저장 후 조회 반환
        mockMvc
            .perform(
                patch("/api/projects/{projectId}", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"nextScene":"3장 도입부, 갈등 고조"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.nextScene").value("3장 도입부, 갈등 고조"))

        mockMvc
            .perform(get("/api/projects/{projectId}", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.nextScene").value("3장 도입부, 갈등 고조"))

        // AS2 — 빈 값으로 비우기
        mockMvc
            .perform(
                patch("/api/projects/{projectId}", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"nextScene":""}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.nextScene").value(""))
    }

    @Test
    fun `nextScene-only patch preserves other metadata`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"보존 확인","genre":"치유물","targetLength":2000}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsString
                .let(::extractProjectId)

        // AS4 — nextScene 만 갱신 시 타 메타 불변
        mockMvc
            .perform(
                patch("/api/projects/{projectId}", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"nextScene":"다음 회차"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.nextScene").value("다음 회차"))
            .andExpect(jsonPath("$.data.title").value("보존 확인"))
            .andExpect(jsonPath("$.data.genre").value("치유물"))
            .andExpect(jsonPath("$.data.targetLength").value(2000))
    }

    @Test
    fun `cross user patch of nextScene returns 404 and leaves value unchanged`() {
        val ownerA = createUser()
        val ownerB = createUser()
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearerFor(ownerA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"A의 작품"}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsString
                .let(::extractProjectId)

        // AS3 — 타 계정 수정 거부
        mockMvc
            .perform(
                patch("/api/projects/{projectId}", projectId)
                    .header("Authorization", bearerFor(ownerB))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"nextScene":"침입 시도"}"""),
            ).andExpect(status().isNotFound)

        mockMvc
            .perform(get("/api/projects/{projectId}", projectId).header("Authorization", bearerFor(ownerA)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.nextScene").value(""))
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

    // ── 018 카드 집계 GET /api/projects/cards ──────────────────────────────

    @Test
    fun `cards returns active projects with aggregates and excludes archived, existing contracts unchanged`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val activeId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"활성 작품","nextScene":""}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsString
                .let(::extractProjectId)
        val archivedId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"보관 작품"}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsString
                .let(::extractProjectId)
        mockMvc
            .perform(post("/api/projects/{projectId}/archive", archivedId).header("Authorization", bearer))
            .andExpect(status().isOk)

        // 종료 세션 fixture — start/end API 는 30초 미만 폐기 규칙이 있어 repository 로 직접 박는다.
        val base = Instant.parse("2026-06-09T10:00:00Z")
        workSessionRepository.saveAndFlush(
            WorkSession(userId = owner.id!!, projectId = activeId, startedAt = base, endedAt = base.plusMillis(1_200_000L)),
        )
        workSessionRepository.saveAndFlush(
            WorkSession(
                userId = owner.id!!,
                projectId = activeId,
                startedAt = base.plusSeconds(7200),
                endedAt = base.plusSeconds(7200).plusMillis(600_000L),
            ),
        )
        // 진행 중(미종료) 세션은 누적에 포함되지 않아야 한다.
        workSessionRepository.saveAndFlush(WorkSession(userId = owner.id!!, projectId = activeId, startedAt = base.plusSeconds(20000)))

        mockMvc
            .perform(get("/api/projects/cards").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.length()").value(1))
            .andExpect(jsonPath("$.data[0].id").value(activeId))
            .andExpect(jsonPath("$.data[0].title").value("활성 작품"))
            .andExpect(jsonPath("$.data[0].wordCount").value(0))
            .andExpect(jsonPath("$.data[0].documentUpdatedAt").exists())
            .andExpect(jsonPath("$.data[0].totalDurationMs").value(1_800_000L))

        // 기존 계약 회귀 무변화 — 페이지네이션 목록·작품별 누적 total 그대로.
        mockMvc
            .perform(get("/api/projects").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalElements").value(1))
        mockMvc
            .perform(get("/api/projects/{projectId}/work-sessions/total", activeId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalDurationMs").value(1_800_000L))
    }

    @Test
    fun `cards returns empty array for user without projects`() {
        val owner = createUser()
        mockMvc
            .perform(get("/api/projects/cards").header("Authorization", bearerFor(owner)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.length()").value(0))
    }

    @Test
    fun `cards without token returns 401`() {
        mockMvc
            .perform(get("/api/projects/cards"))
            .andExpect(status().isUnauthorized)
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
