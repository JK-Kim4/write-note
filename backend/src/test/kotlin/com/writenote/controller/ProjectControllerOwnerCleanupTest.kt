package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.repository.UserRepository
import org.junit.jupiter.api.DisplayName
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

/**
 * 본 spec US6 의 owner-context 회귀 게이트.
 *
 * 출처: contracts/owner-context-migration.md §4 의 5 회귀 케이스.
 * - 인증된 호출 (유효 JWT) → 200 + 본인 프로젝트만
 * - 비인증 호출 → 401 AUTH_TOKEN_MISSING
 * - X-User-Id 헤더 변조 시도 → JWT 우선 (헤더 무시)
 * - 다른 사용자 리소스 접근 → 404 NOT_FOUND
 * - DTO body 에 userId 필드 포함 시도 → DTO 에 필드 없음 → 무시 (JWT user 로 생성)
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProjectControllerOwnerCleanupTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var jwtTokenProvider: JwtTokenProvider

    @Test
    @DisplayName("인증된 호출 — 유효 JWT 로 /api/projects → 200 + 본인 프로젝트 목록")
    fun `authenticated GET returns 200 with owner projects`() {
        val owner = createUser()
        val bearer = bearerFor(owner)

        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"Owner draft"}"""),
            ).andExpect(status().isCreated)

        mockMvc
            .perform(get("/api/projects").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.totalElements").value(1))
            .andExpect(jsonPath("$.data.content[0].title").value("Owner draft"))
    }

    @Test
    @DisplayName("비인증 호출 — JWT 없이 /api/projects → 401 AUTH_TOKEN_MISSING")
    fun `unauthenticated request returns 401 AUTH_TOKEN_MISSING`() {
        mockMvc
            .perform(get("/api/projects"))
            .andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("AUTH_TOKEN_MISSING"))
    }

    @Test
    @DisplayName("X-User-Id 헤더 변조 시도 — 유효 JWT 동반 시 헤더 무시 (JWT 의 userId 만 사용)")
    fun `X-User-Id header is ignored when valid JWT is present`() {
        val owner = createUser()
        val other = createUser()
        val ownerBearer = bearerFor(owner)

        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", ownerBearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"Owner-only project"}"""),
            ).andExpect(status().isCreated)

        mockMvc
            .perform(
                get("/api/projects")
                    .header("Authorization", ownerBearer)
                    .header("X-User-Id", other.id!!),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.totalElements").value(1))
            .andExpect(jsonPath("$.data.content[0].title").value("Owner-only project"))
    }

    @Test
    @DisplayName("다른 사용자 리소스 접근 — user A 의 JWT 로 user B 의 프로젝트 단건 조회 → 404 NOT_FOUND")
    fun `cross user project access returns 404 NOT_FOUND`() {
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
            .perform(
                get("/api/projects/{projectId}", projectId)
                    .header("Authorization", bearerFor(ownerB)),
            ).andExpect(status().isNotFound)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
    }

    @Test
    @DisplayName("DTO body 에 userId 필드 변조 시도 — DTO 에 필드 없음 → 무시 + JWT user 로 생성")
    fun `DTO body with extra userId field is ignored on create`() {
        val owner = createUser()
        val other = createUser()
        val bearer = bearerFor(owner)

        mockMvc
            .perform(
                post("/api/projects")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"Spoof attempt","userId":${other.id}}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.title").value("Spoof attempt"))

        mockMvc
            .perform(get("/api/projects").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalElements").value(1))

        mockMvc
            .perform(get("/api/projects").header("Authorization", bearerFor(other)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.totalElements").value(0))
    }

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(
                email = "owner-cleanup-${UUID.randomUUID()}@example.com",
                passwordHash = "test-fixture-password-hash",
            ),
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
