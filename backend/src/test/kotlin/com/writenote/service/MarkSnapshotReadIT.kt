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
 * 스냅샷 스코프 읽음 처리(050 US1, D7) — 링크(스냅샷) 단위 읽음이 같은 작품의 다른 링크에 번지지 않는지 검증.
 *
 * Mock 경계: DB(로컬 PG) 실제. 내부 collaborator mock 금지(상태/반환값 검증).
 */
@SpringBootTest
@ActiveProfiles("test")
class MarkSnapshotReadIT {
    @Autowired private lateinit var shareService: ShareService

    @Autowired private lateinit var shareCommentService: ShareCommentService

    @Autowired private lateinit var projectService: ProjectService

    @Autowired private lateinit var documentService: DocumentService

    @Autowired private lateinit var documentRepository: DocumentRepository

    @Autowired private lateinit var userRepository: UserRepository

    private fun createUser(): Long =
        userRepository
            .saveAndFlush(User(email = "mark-snapshot-read-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"))
            .id!!

    private fun bodyJson(text: String): String =
        """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$text"}]}]}"""

    @Test
    @DisplayName("그 스냅샷(링크)의 안 읽은 댓글만 읽음 처리되고, 같은 작품의 다른 링크 안 읽음은 유지된다")
    fun `mark read only affects target snapshot`() {
        val ownerId = createUser()
        val projectId = projectService.createProject(ownerId, CreateProjectRequest(title = "스냅샷 읽음 테스트")).id
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()
        documentService.saveDocumentById(
            ownerId,
            doc.id!!,
            SaveDocumentRequest(body = bodyJson("안녕하세요반갑습니다"), version = doc.updatedAt!!),
        )

        // 같은 작품에 링크 두 개(각각 스냅샷 별도 동결)
        val linkA = shareService.createShareLink(ownerId, CreateShareLinkRequest("work", projectId))
        val linkB = shareService.createShareLink(ownerId, CreateShareLinkRequest("work", projectId))

        val memberA = createUser()
        val memberB = createUser()
        shareCommentService.create(memberA, linkA.token, projectId, CreateCommentRequest(0, 0, 5, "A 링크 댓글"))
        shareCommentService.create(memberB, linkB.token, projectId, CreateCommentRequest(0, 0, 5, "B 링크 댓글"))

        val marked = shareCommentService.markReadBySnapshotId(linkA.id, projectId, ownerId)

        assertThat(marked.markedRead).isEqualTo(1)
        val feedbackA = shareCommentService.authorSnapshotFeedback(linkA.id, projectId, ownerId)
        val feedbackB = shareCommentService.authorSnapshotFeedback(linkB.id, projectId, ownerId)
        assertThat(feedbackA.comments.single().readAt).isNotNull()
        assertThat(feedbackB.comments.single().readAt).isNull()
    }

    @Test
    @DisplayName("listMine 안읽음 배지는 스냅샷 스코프 — 다중 링크에서 링크별로 정확, 한 링크 읽음이 다른 링크 배지에 안 번진다(050 리뷰 HIGH)")
    fun `unread badge is snapshot scoped`() {
        val ownerId = createUser()
        val projectId = projectService.createProject(ownerId, CreateProjectRequest(title = "배지 스코프")).id
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()
        documentService.saveDocumentById(
            ownerId,
            doc.id!!,
            SaveDocumentRequest(body = bodyJson("안녕하세요반갑습니다"), version = doc.updatedAt!!),
        )

        val linkA = shareService.createShareLink(ownerId, CreateShareLinkRequest("work", projectId))
        val linkB = shareService.createShareLink(ownerId, CreateShareLinkRequest("work", projectId))
        shareCommentService.create(createUser(), linkA.token, projectId, CreateCommentRequest(0, 0, 5, "A"))
        shareCommentService.create(createUser(), linkB.token, projectId, CreateCommentRequest(0, 0, 5, "B"))

        fun badge(linkId: Long): Int =
            shareService
                .listMine(ownerId)
                .first { it.id == linkId }
                .snapshots
                .single()
                .unreadCommentCount

        // projectId 총합(2)이 아니라 각 링크 스냅샷 단위(1)로 나와야 한다.
        assertThat(badge(linkA.id)).isEqualTo(1)
        assertThat(badge(linkB.id)).isEqualTo(1)

        shareCommentService.markReadBySnapshotId(linkA.id, projectId, ownerId)

        // 링크A만 0, 링크B는 유지(1). projectId 스코프였다면 A 읽음 후에도 A 배지가 1로 남았을 것.
        assertThat(badge(linkA.id)).isEqualTo(0)
        assertThat(badge(linkB.id)).isEqualTo(1)
    }

    @Test
    @DisplayName("타인 소유 링크의 읽음 처리는 403 SHARE_FORBIDDEN")
    fun `mark read enforces ownership`() {
        val ownerId = createUser()
        val projectId = projectService.createProject(ownerId, CreateProjectRequest(title = "읽음 권한 테스트")).id
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()
        documentService.saveDocumentById(
            ownerId,
            doc.id!!,
            SaveDocumentRequest(body = bodyJson("안녕하세요반갑습니다"), version = doc.updatedAt!!),
        )
        val link = shareService.createShareLink(ownerId, CreateShareLinkRequest("work", projectId))
        val stranger = createUser()

        assertThatThrownBy { shareCommentService.markReadBySnapshotId(link.id, projectId, stranger) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.SHARE_FORBIDDEN)
    }
}
