package com.writenote.service

import com.writenote.entity.User
import com.writenote.error.ShareErrorCode
import com.writenote.error.ShareException
import com.writenote.model.request.CreateCategoryRequest
import com.writenote.model.request.CreateCommentRequest
import com.writenote.model.request.CreateProjectRequest
import com.writenote.model.request.CreateShareLinkRequest
import com.writenote.model.request.SaveDocumentRequest
import com.writenote.repository.DocumentRepository
import com.writenote.repository.ShareCommentRepository
import com.writenote.repository.ShareLinkRepository
import com.writenote.repository.ShareSnapshotRepository
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
 * 공유하기(046 R1) 서비스 — 스냅샷 동결(ciphertext 복사) + 공개 복호 + 소유검증 + revoke.
 *
 * Mock 경계: DB(Testcontainers/로컬 PG)·BodyCipherService 는 실제 사용(시스템 경계 아님). 내부 collaborator mock 금지.
 */
@SpringBootTest
@ActiveProfiles("test")
class ShareServiceTest {
    @Autowired private lateinit var shareService: ShareService

    @Autowired private lateinit var shareCommentService: ShareCommentService

    @Autowired private lateinit var projectService: ProjectService

    @Autowired private lateinit var categoryService: CategoryService

    @Autowired private lateinit var documentService: DocumentService

    @Autowired private lateinit var documentRepository: DocumentRepository

    @Autowired private lateinit var shareLinkRepository: ShareLinkRepository

    @Autowired private lateinit var shareSnapshotRepository: ShareSnapshotRepository

    @Autowired private lateinit var shareCommentRepository: ShareCommentRepository

    @Autowired private lateinit var userRepository: UserRepository

    private fun createUser(): Long =
        userRepository
            .saveAndFlush(User(email = "share-svc-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"))
            .id!!

    private fun bodyJson(text: String): String =
        """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$text"}]}]}"""

    /** 작품 생성 + 본문 저장(암호화) → projectId 반환. */
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

    /** 시리즈(모음) 생성 → categoryId 반환. */
    private fun createSeries(
        userId: Long,
        name: String,
    ): Long = categoryService.create(userId, CreateCategoryRequest(name = name)).id

    /** 본문 있는 작품 생성 + 시리즈 소속으로 이동 → projectId 반환. */
    private fun seriesWork(
        userId: Long,
        categoryId: Long,
        title: String,
        text: String,
    ): Long {
        val projectId = createWorkWithBody(userId, title, text)
        projectService.moveCategory(userId, projectId, categoryId)
        return projectId
    }

    @Test
    @DisplayName("작품 공유 생성 시 그 시점 본문이 암호문으로 동결되고 공개 읽기로 평문 복원된다")
    fun `work share freezes encrypted snapshot and public read decrypts`() {
        val userId = createUser()
        val projectId = createWorkWithBody(userId, "달밤", "비밀원고")

        val link = shareService.createShareLink(userId, CreateShareLinkRequest("work", projectId))
        assertThat(link.snapshots).hasSize(1)
        assertThat(link.snapshots.first().projectId).isEqualTo(projectId)

        // 스냅샷 본문은 암호문(평문 미포함)
        val snapshot = shareSnapshotRepository.findByShareLinkIdAndProjectId(link.id, projectId)!!
        assertThat(snapshot.bodySnapshot).doesNotContain("비밀원고")

        // 공개 읽기는 owner 키로 복호된 평문
        val shared = shareService.getSharedWork(link.token, projectId)
        assertThat(shared.bodyJson).contains("비밀원고")
        assertThat(shared.title).isEqualTo("달밤")
        assertThat(shared.comments).isEmpty()
    }

    @Test
    @DisplayName("타인 작품 공유 생성은 SHARE_FORBIDDEN")
    fun `creating share for another users work is forbidden`() {
        val owner = createUser()
        val projectId = createWorkWithBody(owner, "남의 작품", "본문")
        val stranger = createUser()

        assertThatThrownBy { shareService.createShareLink(stranger, CreateShareLinkRequest("work", projectId)) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.SHARE_FORBIDDEN)
    }

    @Test
    @DisplayName("없는 작품 공유 생성은 SHARE_TARGET_NOT_FOUND")
    fun `creating share for missing work is not found`() {
        val userId = createUser()

        assertThatThrownBy { shareService.createShareLink(userId, CreateShareLinkRequest("work", 999_999_999L)) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.SHARE_TARGET_NOT_FOUND)
    }

    @Test
    @DisplayName("알 수 없는 공유 대상 종류는 SHARE_TARGET_INVALID")
    fun `unknown target type is invalid`() {
        val userId = createUser()

        assertThatThrownBy { shareService.createShareLink(userId, CreateShareLinkRequest("chapter", 1L)) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.SHARE_TARGET_INVALID)
    }

    @Test
    @DisplayName("revoke 후 공개 열람은 SHARE_LINK_NOT_FOUND(비활성 동형)")
    fun `revoked link public view is not found`() {
        val userId = createUser()
        val projectId = createWorkWithBody(userId, "철회작", "본문")
        val link = shareService.createShareLink(userId, CreateShareLinkRequest("work", projectId))

        shareService.revoke(userId, link.id, false)

        assertThatThrownBy { shareService.getPublicView(link.token) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.SHARE_LINK_NOT_FOUND)
    }

    @Test
    @DisplayName("미존재 토큰 공개 열람은 SHARE_LINK_NOT_FOUND")
    fun `unknown token public view is not found`() {
        assertThatThrownBy { shareService.getPublicView("nonexistent-token-value-000000000") }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.SHARE_LINK_NOT_FOUND)
    }

    @Test
    @DisplayName("원문 수정 후에도 스냅샷 공개 본문은 불변이다(동결)")
    fun `snapshot stays frozen after original body is edited`() {
        val userId = createUser()
        val projectId = createWorkWithBody(userId, "동결작", "원본문장")
        val link = shareService.createShareLink(userId, CreateShareLinkRequest("work", projectId))

        // 원문 수정
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()
        documentService.saveDocumentById(
            userId,
            doc.id!!,
            SaveDocumentRequest(body = bodyJson("수정된문장"), version = doc.updatedAt!!),
        )

        val shared = shareService.getSharedWork(link.token, projectId)
        assertThat(shared.bodyJson).contains("원본문장")
        assertThat(shared.bodyJson).doesNotContain("수정된문장")
    }

    @Test
    @DisplayName("내 공유 링크 목록은 최근순으로 스냅샷 메타와 함께 반환된다")
    fun `list mine returns links with snapshot meta`() {
        val userId = createUser()
        val p1 = createWorkWithBody(userId, "작품1", "본문1")
        val p2 = createWorkWithBody(userId, "작품2", "본문2")
        shareService.createShareLink(userId, CreateShareLinkRequest("work", p1))
        shareService.createShareLink(userId, CreateShareLinkRequest("work", p2))

        val mine = shareService.listMine(userId)
        assertThat(mine).hasSize(2)
        assertThat(mine.first().snapshots).hasSize(1)
        assertThat(mine.first().shareUrl).contains("/shared/")
    }

    // ── R3: 시리즈 공유 + 공개 작품 선택 ───────────────────────────────────────────

    @Test
    @DisplayName("본인 시리즈 공유 링크는 빈 공개 작품 목록으로 생성된다(작품은 PUT 으로 선택)")
    fun `series share link is created with empty snapshots`() {
        val userId = createUser()
        val seriesId = createSeries(userId, "내 시리즈")

        val link = shareService.createShareLink(userId, CreateShareLinkRequest("series", seriesId))

        assertThat(link.targetType).isEqualTo("series")
        assertThat(link.targetId).isEqualTo(seriesId)
        assertThat(link.snapshots).isEmpty()
    }

    @Test
    @DisplayName("타인 시리즈 공유 생성은 SHARE_FORBIDDEN")
    fun `creating series share for another users series is forbidden`() {
        val owner = createUser()
        val seriesId = createSeries(owner, "남의 시리즈")
        val stranger = createUser()

        assertThatThrownBy { shareService.createShareLink(stranger, CreateShareLinkRequest("series", seriesId)) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.SHARE_FORBIDDEN)
    }

    @Test
    @DisplayName("없는 시리즈 공유 생성은 SHARE_TARGET_NOT_FOUND")
    fun `creating series share for missing series is not found`() {
        val userId = createUser()

        assertThatThrownBy { shareService.createShareLink(userId, CreateShareLinkRequest("series", 999_999_999L)) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.SHARE_TARGET_NOT_FOUND)
    }

    @Test
    @DisplayName("setPublicWorks 는 추가된 작품을 스냅샷으로 동결하고 해제된 작품의 스냅샷은 삭제한다")
    fun `setPublicWorks freezes added works and removes deselected`() {
        val userId = createUser()
        val seriesId = createSeries(userId, "달빛 시리즈")
        val p1 = seriesWork(userId, seriesId, "1화", "첫째이야기")
        val p2 = seriesWork(userId, seriesId, "2화", "둘째이야기")
        val p3 = seriesWork(userId, seriesId, "3화", "셋째이야기")
        val link = shareService.createShareLink(userId, CreateShareLinkRequest("series", seriesId))

        val after1 = shareService.setPublicWorks(userId, link.id, listOf(p1, p2))
        assertThat(after1.snapshots.map { it.projectId }).containsExactlyInAnyOrder(p1, p2)

        val after2 = shareService.setPublicWorks(userId, link.id, listOf(p2, p3))
        assertThat(after2.snapshots.map { it.projectId }).containsExactlyInAnyOrder(p2, p3)
        // 해제된 p1 스냅샷은 삭제됨
        assertThat(shareSnapshotRepository.findByShareLinkIdAndProjectId(link.id, p1)).isNull()
    }

    @Test
    @DisplayName("시리즈에 속하지 않는 작품은 setPublicWorks 에서 SHARE_TARGET_INVALID")
    fun `setPublicWorks rejects a work not in the series`() {
        val userId = createUser()
        val seriesId = createSeries(userId, "시리즈")
        val outsider = createWorkWithBody(userId, "외부작", "본문")
        val link = shareService.createShareLink(userId, CreateShareLinkRequest("series", seriesId))

        assertThatThrownBy { shareService.setPublicWorks(userId, link.id, listOf(outsider)) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.SHARE_TARGET_INVALID)
    }

    @Test
    @DisplayName("작품 링크에 setPublicWorks 는 SHARE_TARGET_INVALID(시리즈 전용)")
    fun `setPublicWorks on a work link is invalid`() {
        val userId = createUser()
        val projectId = createWorkWithBody(userId, "작품", "본문")
        val link = shareService.createShareLink(userId, CreateShareLinkRequest("work", projectId))

        assertThatThrownBy { shareService.setPublicWorks(userId, link.id, listOf(projectId)) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.SHARE_TARGET_INVALID)
    }

    @Test
    @DisplayName("시리즈 공개 열람은 선택된 공개 작품 목록만 시리즈명과 함께 반환한다")
    fun `series public view returns only selected works with series title`() {
        val userId = createUser()
        val seriesId = createSeries(userId, "은하 시리즈")
        val p1 = seriesWork(userId, seriesId, "1화", "본문1")
        seriesWork(userId, seriesId, "2화", "본문2")
        val link = shareService.createShareLink(userId, CreateShareLinkRequest("series", seriesId))
        shareService.setPublicWorks(userId, link.id, listOf(p1))

        val view = shareService.getPublicView(link.token)

        assertThat(view.targetType).isEqualTo("series")
        assertThat(view.title).isEqualTo("은하 시리즈")
        assertThat(view.works.map { it.projectId }).containsExactly(p1)
    }

    @Test
    @DisplayName("시리즈에 새로 추가된 작품은 자동으로 공개되지 않는다")
    fun `newly added project to series is not auto-exposed`() {
        val userId = createUser()
        val seriesId = createSeries(userId, "연재")
        val p1 = seriesWork(userId, seriesId, "1화", "본문1")
        val link = shareService.createShareLink(userId, CreateShareLinkRequest("series", seriesId))
        shareService.setPublicWorks(userId, link.id, listOf(p1))

        // 공개 설정 이후 시리즈에 새 작품 추가
        seriesWork(userId, seriesId, "2화", "본문2")

        val view = shareService.getPublicView(link.token)
        assertThat(view.works.map { it.projectId }).containsExactly(p1)
    }

    // ── R3: 대상 삭제 수명주기(링크 비활성 + 스냅샷·댓글 보존) ───────────────────────

    @Test
    @DisplayName("작품 삭제 시 그 작품의 공유 링크는 비활성화되고 스냅샷·댓글은 보존된다")
    fun `deleting a project deactivates its share link and preserves snapshot and comment`() {
        val owner = createUser()
        val projectId = createWorkWithBody(owner, "삭제될작품", "원고내용")
        val link = shareService.createShareLink(owner, CreateShareLinkRequest("work", projectId))
        val snapshotId = shareSnapshotRepository.findByShareLinkIdAndProjectId(link.id, projectId)!!.id!!

        val member = createUser()
        val comment =
            shareCommentService.create(
                member,
                link.token,
                projectId,
                CreateCommentRequest(anchorBlockIndex = 0, anchorStart = 0, anchorLength = 2, content = "피드백"),
            )

        projectService.deleteProject(owner, projectId)

        // 링크 비활성 → 공개 열람 동형 404
        assertThatThrownBy { shareService.getPublicView(link.token) }
            .isInstanceOf(ShareException::class.java)
            .extracting("errorCode")
            .isEqualTo(ShareErrorCode.SHARE_LINK_NOT_FOUND)
        // 링크 row 는 잔존(비활성)
        assertThat(shareLinkRepository.findByToken(link.token)!!.isActive).isFalse()
        // 스냅샷·댓글은 보존(피드백 이력 유지)
        assertThat(shareSnapshotRepository.findById(snapshotId)).isPresent()
        assertThat(shareCommentRepository.findById(comment.id)).isPresent()
    }

    @Test
    @DisplayName("시리즈 삭제 시 그 시리즈의 공유 링크는 비활성화되고 스냅샷은 보존된다")
    fun `deleting a series deactivates its share link and preserves snapshots`() {
        val owner = createUser()
        val seriesId = createSeries(owner, "삭제될시리즈")
        val p1 = seriesWork(owner, seriesId, "1화", "본문1")
        val link = shareService.createShareLink(owner, CreateShareLinkRequest("series", seriesId))
        shareService.setPublicWorks(owner, link.id, listOf(p1))
        val snapshotId = shareSnapshotRepository.findByShareLinkIdAndProjectId(link.id, p1)!!.id!!

        categoryService.delete(owner, seriesId)

        assertThat(shareLinkRepository.findByToken(link.token)!!.isActive).isFalse()
        assertThat(shareSnapshotRepository.findById(snapshotId)).isPresent()
    }
}
