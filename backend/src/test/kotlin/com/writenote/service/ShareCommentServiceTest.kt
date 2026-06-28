package com.writenote.service

import com.writenote.entity.User
import com.writenote.error.ShareErrorCode
import com.writenote.error.ShareException
import com.writenote.model.request.CreateCommentRequest
import com.writenote.model.request.CreateProjectRequest
import com.writenote.model.request.CreateShareLinkRequest
import com.writenote.model.request.SaveDocumentRequest
import com.writenote.repository.DocumentRepository
import com.writenote.repository.ShareCommentRepository
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
 * 공유 댓글(046 R2) 서비스 — 회원 댓글 작성(앵커 검증) + 작가 전용 가시성(공개=본인만/인박스=전체) + 본인만 삭제.
 *
 * Mock 경계: DB(로컬 PG)·BodyCipherService 실제. 내부 collaborator mock 금지(상태/반환값으로 검증).
 */
@SpringBootTest
@ActiveProfiles("test")
class ShareCommentServiceTest {
    @Autowired private lateinit var shareService: ShareService

    @Autowired private lateinit var shareCommentService: ShareCommentService

    @Autowired private lateinit var projectService: ProjectService

    @Autowired private lateinit var documentService: DocumentService

    @Autowired private lateinit var documentRepository: DocumentRepository

    @Autowired private lateinit var shareCommentRepository: ShareCommentRepository

    @Autowired private lateinit var userRepository: UserRepository

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "share-cmt-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"),
        )

    private fun bodyJson(text: String): String =
        """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$text"}]}]}"""

    private fun createWorkWithBody(
        userId: Long,
        title: String,
        text: String,
    ): Long {
        val projectId = projectService.createProject(userId, CreateProjectRequest(title = title)).id
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()
        documentService.saveDocumentById(
            userId,
            doc.id!!,
            SaveDocumentRequest(body = bodyJson(text), version = doc.updatedAt!!),
        )
        return projectId
    }

    /** owner 작품 + 공유 링크 → (token, projectId). 본문 = "안녕하세요반갑습니다"(10자). */
    private fun sharedWork(): Triple<Long, String, Long> {
        val owner = createUser()
        val projectId = createWorkWithBody(owner.id!!, "달밤", "안녕하세요반갑습니다")
        val link = shareService.createShareLink(owner.id!!, CreateShareLinkRequest("work", projectId))
        return Triple(owner.id!!, link.token, projectId)
    }

    @Test
    @DisplayName("회원이 유효 앵커로 댓글을 달면 저장되고 작성자 닉네임과 함께 반환된다")
    fun `member creates comment with valid anchor`() {
        val (_, token, projectId) = sharedWork()
        val member = createUser()

        val res =
            shareCommentService.create(
                member.id!!,
                token,
                projectId,
                CreateCommentRequest(anchorBlockIndex = 0, anchorStart = 0, anchorLength = 5, content = "좋아요"),
            )

        assertThat(res.content).isEqualTo("좋아요")
        assertThat(res.authorNickname).isEqualTo(member.nickname)
        val saved = shareCommentRepository.findById(res.id).get()
        assertThat(saved.authorId).isEqualTo(member.id)
        assertThat(saved.projectId).isEqualTo(projectId)
    }

    @Test
    @DisplayName("앵커 범위가 블록 텍스트 길이를 넘으면 COMMENT_ANCHOR_INVALID")
    fun `anchor out of range is invalid`() {
        val (_, token, projectId) = sharedWork()
        val member = createUser()

        assertThatThrownBy {
            shareCommentService.create(
                member.id!!,
                token,
                projectId,
                CreateCommentRequest(anchorBlockIndex = 0, anchorStart = 8, anchorLength = 5, content = "넘침"),
            )
        }.isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.COMMENT_ANCHOR_INVALID)
    }

    @Test
    @DisplayName("비활성/미존재 링크에 댓글 작성은 SHARE_LINK_NOT_FOUND")
    fun `comment on inactive link is not found`() {
        val (owner, token, projectId) = sharedWork()
        val member = createUser()
        val link = shareService.listMine(owner).first { it.token == token }
        shareService.revoke(owner, link.id, false)

        assertThatThrownBy {
            shareCommentService.create(
                member.id!!,
                token,
                projectId,
                CreateCommentRequest(0, 0, 0, "혼잣말"),
            )
        }.isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.SHARE_LINK_NOT_FOUND)
    }

    @Test
    @DisplayName("본인 댓글은 삭제되고 타인 댓글 삭제는 COMMENT_FORBIDDEN, 없는 댓글은 COMMENT_NOT_FOUND")
    fun `delete own only`() {
        val (_, token, projectId) = sharedWork()
        val member = createUser()
        val stranger = createUser()
        val comment =
            shareCommentService.create(member.id!!, token, projectId, CreateCommentRequest(0, 0, 5, "내댓글"))

        // 타인 삭제 불가
        assertThatThrownBy { shareCommentService.deleteOwn(stranger.id!!, comment.id) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.COMMENT_FORBIDDEN)

        // 없는 댓글
        assertThatThrownBy { shareCommentService.deleteOwn(member.id!!, 999_999_999L) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.COMMENT_NOT_FOUND)

        // 본인 삭제
        shareCommentService.deleteOwn(member.id!!, comment.id)
        assertThat(shareCommentRepository.findById(comment.id)).isEmpty()
    }

    @Test
    @DisplayName("공개 read 가시성 — 회원은 본인 댓글만, 비로그인은 빈 배열")
    fun `public read shows only own comments`() {
        val (_, token, projectId) = sharedWork()
        val memberA = createUser()
        val memberB = createUser()
        shareCommentService.create(memberA.id!!, token, projectId, CreateCommentRequest(0, 0, 5, "A의 댓글"))
        shareCommentService.create(memberB.id!!, token, projectId, CreateCommentRequest(0, 5, 5, "B의 댓글"))

        val seenByA = shareCommentService.listMineForSharedWork(token, projectId, memberA.id)
        val seenByB = shareCommentService.listMineForSharedWork(token, projectId, memberB.id)
        val seenByAnon = shareCommentService.listMineForSharedWork(token, projectId, null)

        assertThat(seenByA.map { it.content }).containsExactly("A의 댓글")
        assertThat(seenByB.map { it.content }).containsExactly("B의 댓글")
        assertThat(seenByAnon).isEmpty()
    }

    @Test
    @DisplayName("작가 인박스는 소유 작품의 전체 댓글(A·B)을 반환하고 타인 작품은 COMMENT_FORBIDDEN")
    fun `author inbox returns all comments and enforces ownership`() {
        val (owner, token, projectId) = sharedWork()
        val memberA = createUser()
        val memberB = createUser()
        shareCommentService.create(memberA.id!!, token, projectId, CreateCommentRequest(0, 0, 5, "A의 댓글"))
        shareCommentService.create(memberB.id!!, token, projectId, CreateCommentRequest(0, 5, 5, "B의 댓글"))

        val inbox = shareCommentService.listForAuthor(owner, projectId)
        assertThat(inbox.map { it.content }).containsExactlyInAnyOrder("A의 댓글", "B의 댓글")
        assertThat(inbox.map { it.authorNickname }).containsExactlyInAnyOrder(memberA.nickname, memberB.nickname)

        // 타인이 남의 작품 인박스 접근 불가
        val stranger = createUser()
        assertThatThrownBy { shareCommentService.listForAuthor(stranger.id!!, projectId) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.COMMENT_FORBIDDEN)
    }
}
