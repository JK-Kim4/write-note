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
                // 장르·톤류는 시리즈로 이동(033 R3) — 요청에 보내도 무시(400 아님), 작품엔 미저장(기본값 유지)
                .andExpect(jsonPath("$.data.genre").doesNotExist())
                .andExpect(jsonPath("$.data.targetLength").value(4000))
                .andExpect(jsonPath("$.data.toneNotes").doesNotExist())
                .andExpect(jsonPath("$.data.synopsis").doesNotExist())
                .andExpect(jsonPath("$.data.worldNotes").doesNotExist())
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
            // genre 변경 경로 제거(033 R3) — PATCH 로 보내도 무시, 작품 genre 는 기본값(null) 유지
            .andExpect(jsonPath("$.data.genre").doesNotExist())

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
    fun `nextScene defaults empty and patch sending nextScene is ignored (033 R3 — 시리즈 이동)`() {
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

        // nextScene 변경 경로 제거(033 R3) — PATCH 로 보내도 무시(400 아님), 기본값 "" 유지·보존
        mockMvc
            .perform(
                patch("/api/projects/{projectId}", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"nextScene":"3장 도입부, 갈등 고조"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.nextScene").value(""))

        mockMvc
            .perform(get("/api/projects/{projectId}", projectId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.nextScene").value(""))
    }

    @Test
    fun `patch sending tone meta is ignored while title targetLength preserved (033 R3)`() {
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

        // 톤류·다음장면 변경 경로 제거(033 R3) — 보내도 무시, title·targetLength 는 유지·갱신
        mockMvc
            .perform(
                patch("/api/projects/{projectId}", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"nextScene":"다음 회차","title":"제목 갱신"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.nextScene").value(""))
            .andExpect(jsonPath("$.data.title").value("제목 갱신"))
            .andExpect(jsonPath("$.data.genre").doesNotExist())
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

        // toneNotes 는 변경 경로 제거(033 R3) — 보내도 무시. title 미지정이므로 보존, targetLength 갱신
        mockMvc
            .perform(
                patch("/api/projects/{projectId}", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"toneNotes":"새 톤","targetLength":1500}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.title").value("Original"))
            .andExpect(jsonPath("$.data.genre").doesNotExist())
            .andExpect(jsonPath("$.data.targetLength").value(1500))
            .andExpect(jsonPath("$.data.toneNotes").doesNotExist())
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

    // ── 031 layoutMode (출판 방식: paper/web) ──────────────────────────────

    @Test
    fun `layoutMode defaults to paper when omitted and persists web when provided`() {
        val owner = createUser()
        val bearer = bearerFor(owner)

        // 미지정 → 기본 'paper' (FR-013 기존 작품 동작 보존)
        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"기본 작품"}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.data.layoutMode").value("paper"))

        // 'web' 명시 → 저장·응답
        val webId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"웹 작품","layoutMode":"web"}"""),
                ).andExpect(status().isCreated)
                .andExpect(jsonPath("$.data.layoutMode").value("web"))
                .andReturn()
                .response
                .contentAsString
                .let(::extractProjectId)

        // GET 재조회에도 보존
        mockMvc
            .perform(get("/api/projects/{projectId}", webId).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.layoutMode").value("web"))
    }

    @Test
    fun `layoutMode can be toggled via patch without losing other metadata`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"전환 작품","genre":"판타지","layoutMode":"web"}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsString
                .let(::extractProjectId)

        // web → paper 전환, 다른 필드 보존
        mockMvc
            .perform(
                patch("/api/projects/{projectId}", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"layoutMode":"paper"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.layoutMode").value("paper"))
            .andExpect(jsonPath("$.data.title").value("전환 작품"))
            // genre 는 시리즈로 이동(033 R3) — 생성 시 보내도 무시되어 기본값(null) 유지
            .andExpect(jsonPath("$.data.genre").doesNotExist())
    }

    @Test
    fun `publication paper format sinkukpan is accepted on create and patch`() {
        val owner = createUser()
        val bearer = bearerFor(owner)

        // 출판 판형(신국판) 생성 — 9자 식별자(VARCHAR16) 영속
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"판형 작품","paperSize":"sinkukpan"}"""),
                ).andExpect(status().isCreated)
                .andExpect(jsonPath("$.data.paperSize").value("sinkukpan"))
                .andReturn()
                .response
                .contentAsString
                .let(::extractProjectId)

        // 다른 판형으로 PATCH
        mockMvc
            .perform(
                patch("/api/projects/{projectId}", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"paperSize":"mungopan"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.paperSize").value("mungopan"))
    }

    @Test
    fun `invalid paperSize returns 400 VALIDATION_FAILED`() {
        val owner = createUser()
        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearerFor(owner))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"잘못된 판형","paperSize":"tabloid"}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"))
    }

    @Test
    fun `fontScale defaults to m and persists chosen value via create and patch`() {
        val owner = createUser()
        val bearer = bearerFor(owner)

        // 미지정 → 기본 'm'(보통)
        val projectId =
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"글자 크기 작품"}"""),
                ).andExpect(status().isCreated)
                .andExpect(jsonPath("$.data.fontScale").value("m"))
                .andReturn()
                .response
                .contentAsString
                .let(::extractProjectId)

        // PATCH 로 'xl' 변경
        mockMvc
            .perform(
                patch("/api/projects/{projectId}", projectId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"fontScale":"xl"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.fontScale").value("xl"))

        // 생성 시 명시도 가능
        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"작게 작품","fontScale":"s"}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.data.fontScale").value("s"))
    }

    @Test
    fun `invalid fontScale returns 400 VALIDATION_FAILED`() {
        val owner = createUser()
        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearerFor(owner))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"잘못된 크기","fontScale":"xxl"}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"))
    }

    @Test
    fun `invalid layoutMode returns 400 VALIDATION_FAILED`() {
        val owner = createUser()
        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearerFor(owner))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"잘못된 모드","layoutMode":"pdf"}"""),
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
