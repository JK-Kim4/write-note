package com.writenote.service

import com.writenote.entity.User
import com.writenote.error.ShareErrorCode
import com.writenote.error.ShareException
import com.writenote.model.request.CreateCommentRequest
import com.writenote.model.request.CreateProjectRequest
import com.writenote.model.request.CreateShareLinkRequest
import com.writenote.model.request.SaveDocumentRequest
import com.writenote.repository.DocumentRepository
import com.writenote.repository.UserRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import java.util.UUID

/**
 * 작가용 피드백 맥락 뷰(050 US1) — 링크(스냅샷) 단위 전문+전체 댓글+반응 집계 조회.
 *
 * Mock 경계: DB(로컬 PG)·BodyCipherService 실제. 내부 collaborator mock 금지(상태/반환값 검증).
 */
@SpringBootTest
@ActiveProfiles("test")
class AuthorSnapshotFeedbackIT {
    @Autowired private lateinit var shareService: ShareService

    @Autowired private lateinit var shareCommentService: ShareCommentService

    @Autowired private lateinit var projectService: ProjectService

    @Autowired private lateinit var documentService: DocumentService

    @Autowired private lateinit var documentRepository: DocumentRepository

    @Autowired private lateinit var userRepository: UserRepository

    private fun createUser(): Long =
        userRepository
            .saveAndFlush(User(email = "author-feedback-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"))
            .id!!

    private fun bodyJson(text: String): String =
        """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$text"}]}]}"""

    private data class Ctx(
        val ownerId: Long,
        val token: String,
        val projectId: Long,
        val linkId: Long,
    )

    private fun sharedWork(): Ctx {
        val ownerId = createUser()
        val projectId = projectService.createProject(ownerId, CreateProjectRequest(title = "맥락 뷰 테스트")).id
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()
        documentService.saveDocumentById(
            ownerId,
            doc.id!!,
            SaveDocumentRequest(body = bodyJson("안녕하세요반갑습니다"), version = doc.updatedAt!!),
        )
        val link = shareService.createShareLink(ownerId, CreateShareLinkRequest("work", projectId))
        return Ctx(ownerId, link.token, projectId, link.id)
    }

    @Test
    @DisplayName("소유자는 전체 댓글+반응 집계를 받고, 전체 의견(앵커 null) 댓글도 포함된다")
    fun `owner sees full feedback including general comments`() {
        val ctx = sharedWork()
        val memberA = createUser()
        val memberB = createUser()
        shareCommentService.create(memberA, ctx.token, ctx.projectId, CreateCommentRequest(0, 0, 5, "구간 댓글"))
        shareCommentService.create(memberB, ctx.token, ctx.projectId, CreateCommentRequest(null, null, null, "전체 의견입니다"))

        val feedback = shareCommentService.authorSnapshotFeedback(ctx.linkId, ctx.projectId, ctx.ownerId)

        assertThat(feedback.projectId).isEqualTo(ctx.projectId)
        assertThat(feedback.comments).hasSize(2)
        assertThat(feedback.comments.map { it.content }).containsExactlyInAnyOrder("구간 댓글", "전체 의견입니다")
        val general = feedback.comments.first { it.content == "전체 의견입니다" }
        assertThat(general.anchorBlockIndex).isNull()
        assertThat(general.anchorStart).isNull()
        assertThat(general.anchorLength).isNull()
    }

    @Test
    @DisplayName("비활성(off) 링크도 작가 본인은 열람할 수 있다")
    fun `owner can view feedback of inactive link`() {
        val ctx = sharedWork()
        shareService.revoke(ctx.ownerId, ctx.linkId, false)

        val feedback = shareCommentService.authorSnapshotFeedback(ctx.linkId, ctx.projectId, ctx.ownerId)

        assertThat(feedback.projectId).isEqualTo(ctx.projectId)
    }

    @Test
    @DisplayName("비소유자가 열람하면 403 SHARE_FORBIDDEN")
    fun `non owner is forbidden`() {
        val ctx = sharedWork()
        val stranger = createUser()

        assertThatThrownBy { shareCommentService.authorSnapshotFeedback(ctx.linkId, ctx.projectId, stranger) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.SHARE_FORBIDDEN)
    }

    @Test
    @DisplayName("없는 링크는 404 SHARE_LINK_NOT_FOUND")
    fun `missing link is not found`() {
        val ctx = sharedWork()

        assertThatThrownBy { shareCommentService.authorSnapshotFeedback(999_999_999L, ctx.projectId, ctx.ownerId) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.SHARE_LINK_NOT_FOUND)
    }

    @Test
    @DisplayName("링크는 있으나 그 스냅샷(작품)이 없으면 404 SHARE_LINK_NOT_FOUND")
    fun `missing snapshot is not found`() {
        val ctx = sharedWork()

        assertThatThrownBy { shareCommentService.authorSnapshotFeedback(ctx.linkId, 999_999_999L, ctx.ownerId) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.SHARE_LINK_NOT_FOUND)
    }
}
