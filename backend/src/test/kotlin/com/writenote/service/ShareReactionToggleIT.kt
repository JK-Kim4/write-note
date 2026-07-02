package com.writenote.service

import com.writenote.controller.ShareReactionController
import com.writenote.entity.User
import com.writenote.error.ShareErrorCode
import com.writenote.error.ShareException
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
 * 이모지 반응 토글(050 US3) — 추가/제거 멱등 + 화이트리스트 + 앵커 검증 + 비회원 차단.
 *
 * Mock 경계: DB(로컬 PG)·BodyCipherService 실제. 내부 collaborator mock 금지(상태/반환값 검증).
 * 비회원 차단은 [ShareReactionController] 를 직접 호출해 실제 프로덕션 인가 경로(nullable principal)를 검증한다.
 */
@SpringBootTest
@ActiveProfiles("test")
class ShareReactionToggleIT {
    @Autowired private lateinit var shareService: ShareService

    @Autowired private lateinit var shareReactionService: ShareReactionService

    @Autowired private lateinit var shareReactionController: ShareReactionController

    @Autowired private lateinit var projectService: ProjectService

    @Autowired private lateinit var documentService: DocumentService

    @Autowired private lateinit var documentRepository: DocumentRepository

    @Autowired private lateinit var userRepository: UserRepository

    private fun createUser(): Long =
        userRepository
            .saveAndFlush(User(email = "reaction-toggle-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"))
            .id!!

    private fun bodyJson(text: String): String =
        """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$text"}]}]}"""

    private data class Ctx(
        val ownerId: Long,
        val token: String,
        val projectId: Long,
    )

    /** owner 작품(본문="안녕하세요반갑습니다", 10자) + 공유 링크. */
    private fun sharedWork(): Ctx {
        val ownerId = createUser()
        val projectId = projectService.createProject(ownerId, CreateProjectRequest(title = "반응 토글 테스트")).id
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
    @DisplayName("반응을 추가하면 집계 count 가 1이 된다")
    fun `add reaction increments count to one`() {
        val ctx = sharedWork()
        val member = createUser()

        val result = shareReactionService.add(ctx.token, ctx.projectId, CreateReactionRequest(0, 0, 5, "❤️"), member)

        assertThat(result.count).isEqualTo(1)
        assertThat(result.mine).isTrue()
    }

    @Test
    @DisplayName("같은 회원이 같은 구간·이모지에 중복 추가해도 count 는 그대로(멱등)")
    fun `duplicate add is idempotent`() {
        val ctx = sharedWork()
        val member = createUser()
        shareReactionService.add(ctx.token, ctx.projectId, CreateReactionRequest(0, 0, 5, "❤️"), member)

        val result = shareReactionService.add(ctx.token, ctx.projectId, CreateReactionRequest(0, 0, 5, "❤️"), member)

        assertThat(result.count).isEqualTo(1)
    }

    @Test
    @DisplayName("반응을 제거하면 count 가 0이 된다")
    fun `remove reaction decrements count to zero`() {
        val ctx = sharedWork()
        val member = createUser()
        shareReactionService.add(ctx.token, ctx.projectId, CreateReactionRequest(0, 0, 5, "❤️"), member)

        val result = shareReactionService.remove(ctx.token, ctx.projectId, 0, 0, 5, "❤️", member)

        assertThat(result.count).isEqualTo(0)
        assertThat(result.mine).isFalse()
    }

    @Test
    @DisplayName("다른 회원의 반응은 별개로 집계되고, 한쪽 제거는 다른 쪽에 영향 없다")
    fun `different members reactions are counted separately`() {
        val ctx = sharedWork()
        val memberA = createUser()
        val memberB = createUser()
        shareReactionService.add(ctx.token, ctx.projectId, CreateReactionRequest(0, 0, 5, "❤️"), memberA)

        val result = shareReactionService.add(ctx.token, ctx.projectId, CreateReactionRequest(0, 0, 5, "❤️"), memberB)

        assertThat(result.count).isEqualTo(2)
        val afterRemove = shareReactionService.remove(ctx.token, ctx.projectId, 0, 0, 5, "❤️", memberA)
        assertThat(afterRemove.count).isEqualTo(1)
    }

    @Test
    @DisplayName("화이트리스트 밖 이모지는 400 REACTION_EMOJI_INVALID")
    fun `emoji outside whitelist is rejected`() {
        val ctx = sharedWork()
        val member = createUser()

        assertThatThrownBy {
            shareReactionService.add(ctx.token, ctx.projectId, CreateReactionRequest(0, 0, 5, "😀"), member)
        }.isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.REACTION_EMOJI_INVALID)
    }

    @Test
    @DisplayName("앵커가 블록 길이를 넘으면 400 COMMENT_ANCHOR_INVALID")
    fun `invalid anchor is rejected`() {
        val ctx = sharedWork()
        val member = createUser()

        assertThatThrownBy {
            shareReactionService.add(ctx.token, ctx.projectId, CreateReactionRequest(0, 8, 5, "❤️"), member)
        }.isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.COMMENT_ANCHOR_INVALID)
    }

    @Test
    @DisplayName("비회원 반응 추가는 401 COMMENT_UNAUTHENTICATED")
    fun `unauthenticated reaction is rejected`() {
        val ctx = sharedWork()

        assertThatThrownBy {
            shareReactionController.addReaction(null, ctx.token, ctx.projectId, CreateReactionRequest(0, 0, 5, "❤️"))
        }.isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.COMMENT_UNAUTHENTICATED)
    }
}
