package com.writenote.service

import com.writenote.entity.ShareReaction
import com.writenote.entity.User
import com.writenote.model.request.CreateProjectRequest
import com.writenote.model.request.CreateShareLinkRequest
import com.writenote.model.request.SaveDocumentRequest
import com.writenote.repository.DocumentRepository
import com.writenote.repository.ShareReactionRepository
import com.writenote.repository.ShareSnapshotRepository
import com.writenote.repository.UserRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import java.util.UUID

/**
 * 반응 집계(050 Phase2) — 스냅샷의 (anchor, emoji) 그룹별 count + 뷰어 본인 반응(mine) 정확성.
 *
 * Mock 경계: DB(로컬 PG) 실제. 내부 collaborator mock 금지(상태/반환값 검증). 반응은 저장소에 직접 seed(토글 자체는 US3 범위).
 */
@SpringBootTest
@ActiveProfiles("test")
class ShareReactionAggregateIT {
    @Autowired private lateinit var shareService: ShareService

    @Autowired private lateinit var shareReactionService: ShareReactionService

    @Autowired private lateinit var shareReactionRepository: ShareReactionRepository

    @Autowired private lateinit var shareSnapshotRepository: ShareSnapshotRepository

    @Autowired private lateinit var projectService: ProjectService

    @Autowired private lateinit var documentService: DocumentService

    @Autowired private lateinit var documentRepository: DocumentRepository

    @Autowired private lateinit var userRepository: UserRepository

    private fun createUser(): Long =
        userRepository
            .saveAndFlush(User(email = "reaction-agg-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"))
            .id!!

    private fun bodyJson(text: String): String =
        """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$text"}]}]}"""

    /** owner 작품(본문="안녕하세요반갑습니다", 10자) + 공유 링크 → 스냅샷 id. */
    private fun sharedSnapshotId(): Long {
        val ownerId = createUser()
        val projectId = projectService.createProject(ownerId, CreateProjectRequest(title = "반응 집계 테스트")).id
        val doc = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId).first()
        documentService.saveDocumentById(
            ownerId,
            doc.id!!,
            SaveDocumentRequest(body = bodyJson("안녕하세요반갑습니다"), version = doc.updatedAt!!),
        )
        val link = shareService.createShareLink(ownerId, CreateShareLinkRequest("work", projectId))
        return requireNotNull(shareSnapshotRepository.findByShareLinkIdAndProjectId(link.id, projectId)?.id)
    }

    private fun seedReaction(
        snapshotId: Long,
        reactorId: Long,
        emoji: String,
        blockIndex: Int = 0,
        start: Int = 0,
        length: Int = 5,
    ) {
        shareReactionRepository.save(
            ShareReaction(
                shareSnapshotId = snapshotId,
                anchorBlockIndex = blockIndex,
                anchorStart = start,
                anchorLength = length,
                emoji = emoji,
                reactorId = reactorId,
            ),
        )
    }

    @Test
    @DisplayName("같은 구간·같은 이모지에 여러 회원이 반응하면 count 가 합산된다")
    fun `same anchor same emoji counts are summed`() {
        val snapshotId = sharedSnapshotId()
        val a = createUser()
        val b = createUser()
        seedReaction(snapshotId, a, "❤️")
        seedReaction(snapshotId, b, "❤️")

        val result = shareReactionService.aggregate(snapshotId, viewerId = null)

        assertThat(result).hasSize(1)
        assertThat(result[0].count).isEqualTo(2)
    }

    @Test
    @DisplayName("같은 구간이라도 다른 이모지는 별개 집계로 나뉜다")
    fun `different emojis on same anchor are separate groups`() {
        val snapshotId = sharedSnapshotId()
        val a = createUser()
        val b = createUser()
        seedReaction(snapshotId, a, "❤️")
        seedReaction(snapshotId, b, "👍")

        val result = shareReactionService.aggregate(snapshotId, viewerId = null)

        assertThat(result).hasSize(2)
        assertThat(result.map { it.emoji }).containsExactlyInAnyOrder("❤️", "👍")
        assertThat(result).allMatch { it.count == 1 }
    }

    @Test
    @DisplayName("뷰어 본인이 남긴 반응만 mine=true, 남이 남긴 반응은 mine=false")
    fun `mine reflects viewer own reaction`() {
        val snapshotId = sharedSnapshotId()
        val a = createUser()
        val b = createUser()
        seedReaction(snapshotId, a, "❤️")
        seedReaction(snapshotId, b, "👍")

        val seenByA = shareReactionService.aggregate(snapshotId, viewerId = a)

        assertThat(seenByA.first { it.emoji == "❤️" }.mine).isTrue()
        assertThat(seenByA.first { it.emoji == "👍" }.mine).isFalse()
    }

    @Test
    @DisplayName("비로그인(viewerId=null) 은 항상 mine=false")
    fun `anonymous viewer sees mine false`() {
        val snapshotId = sharedSnapshotId()
        val a = createUser()
        seedReaction(snapshotId, a, "❤️")

        val result = shareReactionService.aggregate(snapshotId, viewerId = null)

        assertThat(result).allMatch { !it.mine }
    }
}
