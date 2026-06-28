package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.repository.DocumentRepository
import com.writenote.repository.ShareSnapshotRepository
import com.writenote.repository.UserRepository
import org.assertj.core.api.Assertions.assertThat
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

/**
 * 공유하기(046 R1) IT — 비로그인 공개 읽기(복호) + revoke 후 차단 + 잘못된 토큰 + 소유검증 + 스냅샷 불변.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ShareControllerIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    @Autowired private lateinit var documentRepository: DocumentRepository

    @Autowired private lateinit var shareSnapshotRepository: ShareSnapshotRepository

    @Test
    fun `비로그인 공개 읽기는 200으로 복호된 본문을 반환한다`() {
        val bearer = bearerFor(createUser())
        val projectId = createProject(bearer)
        saveBody(bearer, projectId, "공개될원고")
        val token = createShareLink(bearer, projectId)

        // 진입(목록) — 비로그인(Authorization 없음)
        mockMvc
            .perform(get("/api/shared/{token}", token))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.targetType").value("work"))
            .andExpect(jsonPath("$.data.works.length()").value(1))

        // 본문 단건 — 비로그인, owner 키 복호 평문
        mockMvc
            .perform(get("/api/shared/{token}/works/{p}", token, projectId))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.bodyJson").value(org.hamcrest.Matchers.containsString("공개될원고")))
            .andExpect(jsonPath("$.data.comments.length()").value(0))
    }

    @Test
    fun `revoke 후 공개 읽기는 404다`() {
        val bearer = bearerFor(createUser())
        val projectId = createProject(bearer)
        saveBody(bearer, projectId, "본문")
        val created = createShareLinkRaw(bearer, projectId)
        val linkId = extract(created, "id").toLong()
        val token = extract(created, "token")

        // 끄기
        mockMvc
            .perform(
                patch("/api/share-links/{id}", linkId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"isActive":false}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.isActive").value(false))

        mockMvc
            .perform(get("/api/shared/{token}", token))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.error.code").value("SHARE_LINK_NOT_FOUND"))
    }

    @Test
    fun `잘못된 토큰은 404 SHARE_LINK_NOT_FOUND`() {
        mockMvc
            .perform(get("/api/shared/{token}", "this-token-does-not-exist-000000"))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.error.code").value("SHARE_LINK_NOT_FOUND"))
    }

    @Test
    fun `타인 작품 공유 생성은 403 SHARE_FORBIDDEN`() {
        val owner = bearerFor(createUser())
        val projectId = createProject(owner)
        val stranger = bearerFor(createUser())

        mockMvc
            .perform(
                post("/api/share-links")
                    .header("Authorization", stranger)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"targetType":"work","targetId":$projectId}"""),
            ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error.code").value("SHARE_FORBIDDEN"))
    }

    @Test
    fun `스냅샷은 원문 수정 후에도 불변이다`() {
        val bearer = bearerFor(createUser())
        val projectId = createProject(bearer)
        saveBody(bearer, projectId, "최초원고")
        val token = createShareLink(bearer, projectId)

        // 원문 수정
        saveBody(bearer, projectId, "수정된원고")

        mockMvc
            .perform(get("/api/shared/{token}/works/{p}", token, projectId))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.bodyJson").value(org.hamcrest.Matchers.containsString("최초원고")))
            .andExpect(jsonPath("$.data.bodyJson").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("수정된원고"))))
    }

    @Test
    fun `시리즈 공개 읽기는 선택된 공개 작품 목록만 반환한다`() {
        val bearer = bearerFor(createUser())
        val categoryId = createCategory(bearer, "내 시리즈")
        val p1 = createProject(bearer)
        saveBody(bearer, p1, "1화내용")
        moveToCategory(bearer, p1, categoryId)
        val p2 = createProject(bearer)
        saveBody(bearer, p2, "2화내용")
        moveToCategory(bearer, p2, categoryId)

        val created = createSeriesShareLinkRaw(bearer, categoryId)
        val linkId = extract(created, "id").toLong()
        val token = extract(created, "token")

        // 공개 작품으로 p1만 선택
        mockMvc
            .perform(
                put("/api/share-links/{id}/works", linkId)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"projectIds":[$p1]}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.snapshots.length()").value(1))

        mockMvc
            .perform(get("/api/shared/{token}", token))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.targetType").value("series"))
            .andExpect(jsonPath("$.data.title").value("내 시리즈"))
            .andExpect(jsonPath("$.data.works.length()").value(1))
            .andExpect(jsonPath("$.data.works[0].projectId").value(p1))
    }

    @Test
    fun `작품 삭제 후 공개 읽기는 404이고 스냅샷 row는 보존된다`() {
        val bearer = bearerFor(createUser())
        val projectId = createProject(bearer)
        saveBody(bearer, projectId, "삭제전원고")
        val created = createShareLinkRaw(bearer, projectId)
        val linkId = extract(created, "id").toLong()
        val token = extract(created, "token")

        // 작품 영구 삭제
        mockMvc
            .perform(delete("/api/projects/{id}", projectId).header("Authorization", bearer))
            .andExpect(status().isNoContent)

        // 링크 비활성 → 공개 읽기 동형 404
        mockMvc
            .perform(get("/api/shared/{token}", token))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.error.code").value("SHARE_LINK_NOT_FOUND"))

        // 스냅샷 row 는 보존(피드백 이력 유지)
        assertThat(shareSnapshotRepository.findByShareLinkId(linkId)).isNotEmpty()
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "share-it-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"),
        )

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"

    private fun createProject(bearer: String): Long =
        extract(
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"공유 테스트 작품"}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response.contentAsString,
            "id",
        ).toLong()

    /** 본문 저장(암호화) — 최신 version 으로 PUT. */
    private fun saveBody(
        bearer: String,
        projectId: Long,
        text: String,
    ) {
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()
        val plainBody =
            """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$text"}]}]}"""
        val escaped = plainBody.replace("\"", "\\\"")
        mockMvc
            .perform(
                put("/api/documents/{id}", doc.id)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"body":"$escaped","version":"${doc.updatedAt}"}"""),
            ).andExpect(status().isOk)
    }

    /** 공유 링크 생성 — 응답 본문(JSON)을 그대로 반환(token/id 등 추출). */
    private fun createShareLinkRaw(
        bearer: String,
        projectId: Long,
    ): String =
        mockMvc
            .perform(
                post("/api/share-links")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"targetType":"work","targetId":$projectId}"""),
            ).andExpect(status().isOk)
            .andReturn()
            .response.contentAsString

    private fun createShareLink(
        bearer: String,
        projectId: Long,
    ): String = extract(createShareLinkRaw(bearer, projectId), "token")

    /** 시리즈(모음) 생성 → categoryId 반환. */
    private fun createCategory(
        bearer: String,
        name: String,
    ): Long =
        extract(
            mockMvc
                .perform(
                    post("/api/categories")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"name":"$name"}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response.contentAsString,
            "id",
        ).toLong()

    /** 작품을 시리즈로 이동. */
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

    /** 시리즈 공유 링크 생성 — 응답 JSON 반환(token/id 추출). */
    private fun createSeriesShareLinkRaw(
        bearer: String,
        categoryId: Long,
    ): String =
        mockMvc
            .perform(
                post("/api/share-links")
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"targetType":"series","targetId":$categoryId}"""),
            ).andExpect(status().isOk)
            .andReturn()
            .response.contentAsString

    private fun extract(
        body: String,
        field: String,
    ): String =
        requireNotNull(Regex(""""$field":"?([^",}]+)"?""").find(body)) {
            "Response does not contain $field: $body"
        }.groupValues[1]
}
