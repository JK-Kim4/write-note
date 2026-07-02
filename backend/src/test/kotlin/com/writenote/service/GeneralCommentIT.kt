package com.writenote.service

import com.writenote.entity.User
import com.writenote.error.ShareErrorCode
import com.writenote.error.ShareException
import com.writenote.model.request.CreateCommentRequest
import com.writenote.model.request.CreateProjectRequest
import com.writenote.model.request.CreateReactionRequest
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
 * 전체 의견(050 US3, 구간 미지정 앵커 nullable) — 저장·가시성·기존 구간 댓글 회귀·공개 응답 반응 embed.
 *
 * Mock 경계: DB(로컬 PG)·BodyCipherService 실제. 내부 collaborator mock 금지(상태/반환값 검증).
 */
@SpringBootTest
@ActiveProfiles("test")
class GeneralCommentIT {
    @Autowired private lateinit var shareService: ShareService

    @Autowired private lateinit var shareCommentService: ShareCommentService

    @Autowired private lateinit var shareReactionService: ShareReactionService

    @Autowired private lateinit var projectService: ProjectService

    @Autowired private lateinit var documentService: DocumentService

    @Autowired private lateinit var documentRepository: DocumentRepository

    @Autowired private lateinit var userRepository: UserRepository

    private fun createUser(): Long =
        userRepository
            .saveAndFlush(User(email = "general-comment-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"))
            .id!!

    private fun bodyJson(text: String): String =
        """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$text"}]}]}"""

    private data class Ctx(
        val ownerId: Long,
        val token: String,
        val projectId: Long,
    )

    private fun sharedWork(): Ctx {
        val ownerId = createUser()
        val projectId = projectService.createProject(ownerId, CreateProjectRequest(title = "전체 의견 테스트")).id
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()
        documentService.saveDocumentById(
            ownerId,
            doc.id!!,
            SaveDocumentRequest(body = bodyJson("안녕하세요반갑습니다"), version = doc.updatedAt!!),
        )
        val link = shareService.createShareLink(ownerId, CreateShareLinkRequest("work", projectId))
        return Ctx(ownerId, link.token, projectId)
    }

    @Test
    @DisplayName("앵커 셋 다 null 이면 전체 의견으로 저장되고 작가 인박스에 노출된다")
    fun `general comment with null anchor is stored and visible to author`() {
        val ctx = sharedWork()
        val member = createUser()

        val saved =
            shareCommentService.create(member, ctx.token, ctx.projectId, CreateCommentRequest(null, null, null, "작품 전체가 좋아요"))

        assertThat(saved.anchorBlockIndex).isNull()
        assertThat(saved.anchorStart).isNull()
        assertThat(saved.anchorLength).isNull()

        val inbox = shareCommentService.listForAuthor(ctx.ownerId, ctx.projectId)
        assertThat(inbox.map { it.content }).contains("작품 전체가 좋아요")

        // 공개 read 가시성(R-3) 은 전체 의견도 동일 — 본인(member)만 자기 댓글로 본다.
        val seenByMember = shareCommentService.listMineForSharedWork(ctx.token, ctx.projectId, member)
        assertThat(seenByMember.map { it.content }).containsExactly("작품 전체가 좋아요")
    }

    @Test
    @DisplayName("앵커가 부분적으로만 null 이면 400 COMMENT_ANCHOR_INVALID")
    fun `partial null anchor is rejected`() {
        val ctx = sharedWork()
        val member = createUser()

        assertThatThrownBy {
            shareCommentService.create(member, ctx.token, ctx.projectId, CreateCommentRequest(0, null, 5, "섞임"))
        }.isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.COMMENT_ANCHOR_INVALID)
    }

    @Test
    @DisplayName("기존 구간 댓글(앵커 3값)은 회귀 없이 그대로 동작한다")
    fun `existing anchored comment still works`() {
        val ctx = sharedWork()
        val member = createUser()

        val saved = shareCommentService.create(member, ctx.token, ctx.projectId, CreateCommentRequest(0, 0, 5, "구간 댓글"))

        assertThat(saved.anchorBlockIndex).isEqualTo(0)
        assertThat(saved.anchorStart).isEqualTo(0)
        assertThat(saved.anchorLength).isEqualTo(5)
    }

    @Test
    @DisplayName("공개 열람 응답에 반응 집계가 embed 되고, 비로그인은 mine=false 다")
    fun `public read embeds reaction aggregate with mine false for anonymous`() {
        val ctx = sharedWork()
        val member = createUser()
        shareReactionService.add(ctx.token, ctx.projectId, CreateReactionRequest(0, 0, 5, "❤️"), member)

        val anonymous = shareReactionService.aggregateForSharedWork(ctx.token, ctx.projectId, viewerId = null)
        val asMember = shareReactionService.aggregateForSharedWork(ctx.token, ctx.projectId, viewerId = member)

        assertThat(anonymous).hasSize(1)
        assertThat(anonymous[0].mine).isFalse()
        assertThat(asMember[0].mine).isTrue()
    }
}
