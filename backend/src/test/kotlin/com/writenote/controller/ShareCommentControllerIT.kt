package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.User
import com.writenote.repository.DocumentRepository
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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/**
 * 공유 댓글(046 R2) IT — 회원 작성, 비로그인 401, 교차 가시성(SC-009 — 서로 미노출/작가 전체), 본인만 삭제, 앵커 초과 400.
 *
 * 본문 = "안녕하세요반갑습니다"(10자). A 앵커 0..5, B 앵커 5..10.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ShareCommentControllerIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    @Autowired private lateinit var documentRepository: DocumentRepository

    @Test
    fun `회원은 유효 앵커로 댓글을 달 수 있다`() {
        val ctx = sharedWork()
        val member = bearerFor(createUser())

        mockMvc
            .perform(commentPost(ctx, member, blockIndex = 0, start = 0, length = 5, content = "좋아요"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.content").value("좋아요"))
            .andExpect(jsonPath("$.data.anchorStart").value(0))
    }

    @Test
    fun `비로그인 댓글 작성은 401 COMMENT_UNAUTHENTICATED`() {
        val ctx = sharedWork()

        mockMvc
            .perform(
                post("/api/shared/{token}/works/{p}/comments", ctx.token, ctx.projectId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"anchorBlockIndex":0,"anchorStart":0,"anchorLength":5,"content":"익명"}"""),
            ).andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.error.code").value("COMMENT_UNAUTHENTICATED"))
    }

    @Test
    fun `앵커가 블록 길이를 넘으면 400 COMMENT_ANCHOR_INVALID`() {
        val ctx = sharedWork()
        val member = bearerFor(createUser())

        mockMvc
            .perform(commentPost(ctx, member, blockIndex = 0, start = 8, length = 5, content = "넘침"))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("COMMENT_ANCHOR_INVALID"))
    }

    @Test
    fun `교차 가시성 — 공개 read 는 본인 댓글만, 작가 인박스는 전체다 (SC-009)`() {
        val ctx = sharedWork()
        val a = bearerFor(createUser())
        val b = bearerFor(createUser())
        mockMvc.perform(commentPost(ctx, a, 0, 0, 5, "A의댓글")).andExpect(status().isOk)
        mockMvc.perform(commentPost(ctx, b, 0, 5, 5, "B의댓글")).andExpect(status().isOk)

        // A 가 공개 페이지 열람 → A 댓글만
        mockMvc
            .perform(get("/api/shared/{token}/works/{p}", ctx.token, ctx.projectId).header("Authorization", a))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.comments.length()").value(1))
            .andExpect(jsonPath("$.data.comments[0].content").value("A의댓글"))

        // B 가 열람 → B 댓글만(A 것 안 보임)
        mockMvc
            .perform(get("/api/shared/{token}/works/{p}", ctx.token, ctx.projectId).header("Authorization", b))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.comments.length()").value(1))
            .andExpect(jsonPath("$.data.comments[0].content").value("B의댓글"))

        // 비로그인 열람 → 빈 배열
        mockMvc
            .perform(get("/api/shared/{token}/works/{p}", ctx.token, ctx.projectId))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.comments.length()").value(0))

        // 작가 인박스 → A·B 전체
        mockMvc
            .perform(get("/api/projects/{p}/comments", ctx.projectId).header("Authorization", ctx.ownerBearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.length()").value(2))
    }

    @Test
    fun `타 작품 인박스 접근은 403 COMMENT_FORBIDDEN`() {
        val ctx = sharedWork()
        val stranger = bearerFor(createUser())

        mockMvc
            .perform(get("/api/projects/{p}/comments", ctx.projectId).header("Authorization", stranger))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error.code").value("COMMENT_FORBIDDEN"))
    }

    @Test
    fun `본인 댓글만 삭제할 수 있다 (타인 403)`() {
        val ctx = sharedWork()
        val member = bearerFor(createUser())
        val stranger = bearerFor(createUser())
        val commentId =
            extract(
                mockMvc
                    .perform(commentPost(ctx, member, 0, 0, 5, "내댓글"))
                    .andExpect(status().isOk)
                    .andReturn()
                    .response.contentAsString,
                "id",
            ).toLong()

        // 타인 삭제 불가
        mockMvc
            .perform(delete("/api/share-comments/{id}", commentId).header("Authorization", stranger))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error.code").value("COMMENT_FORBIDDEN"))

        // 본인 삭제
        mockMvc
            .perform(delete("/api/share-comments/{id}", commentId).header("Authorization", member))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.deleted").value(true))
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private data class ShareCtx(
        val ownerBearer: String,
        val token: String,
        val projectId: Long,
    )

    /** owner 작품 + 본문 "안녕하세요반갑습니다"(10자) + 공유 링크. */
    private fun sharedWork(): ShareCtx {
        val ownerBearer = bearerFor(createUser())
        val projectId = createProject(ownerBearer)
        saveBody(ownerBearer, projectId, "안녕하세요반갑습니다")
        val token = extract(createShareLinkRaw(ownerBearer, projectId), "token")
        return ShareCtx(ownerBearer, token, projectId)
    }

    private fun commentPost(
        ctx: ShareCtx,
        bearer: String,
        blockIndex: Int,
        start: Int,
        length: Int,
        content: String,
    ) = post("/api/shared/{token}/works/{p}/comments", ctx.token, ctx.projectId)
        .header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON)
        .content(
            """{"anchorBlockIndex":$blockIndex,"anchorStart":$start,"anchorLength":$length,"content":"$content"}""",
        )

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "share-cmt-it-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"),
        )

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"

    private fun createProject(bearer: String): Long =
        extract(
            mockMvc
                .perform(
                    post("/api/projects")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"title":"공유 댓글 테스트 작품"}"""),
                ).andExpect(status().isCreated)
                .andReturn()
                .response.contentAsString,
            "id",
        ).toLong()

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

    private fun extract(
        body: String,
        field: String,
    ): String =
        requireNotNull(Regex(""""$field":"?([^",}]+)"?""").find(body)) {
            "Response does not contain $field: $body"
        }.groupValues[1]
}
