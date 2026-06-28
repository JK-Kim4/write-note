package com.writenote.service

import com.writenote.crypto.BodyCipherService
import com.writenote.entity.ShareComment
import com.writenote.entity.ShareLink
import com.writenote.error.ShareErrorCode
import com.writenote.error.ShareException
import com.writenote.model.request.CreateCommentRequest
import com.writenote.model.response.AuthorCommentResponse
import com.writenote.model.response.CommentResponse
import com.writenote.model.response.MarkCommentsReadResponse
import com.writenote.repository.ProjectRepository
import com.writenote.repository.ShareCommentRepository
import com.writenote.repository.ShareLinkRepository
import com.writenote.repository.ShareSnapshotRepository
import com.writenote.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * 공유 댓글(046 R2) 유스케이스 — 회원 텍스트 구간 댓글(작가 전용 비공개) + optional auth 회원 식별 + 작가 인박스.
 *
 * 가시성(R-3): 공개 read([listMineForSharedWork])는 요청자 본인 댓글만(비회원 빈 배열), 작가 인박스([listForAuthor])만 전체.
 * 앵커는 스냅샷 평문(owner 키 복호) 블록 범위로 [AnchorValidator] 검증. [content] 평문 저장.
 */
@Service
class ShareCommentService(
    private val shareLinkRepository: ShareLinkRepository,
    private val shareSnapshotRepository: ShareSnapshotRepository,
    private val shareCommentRepository: ShareCommentRepository,
    private val projectRepository: ProjectRepository,
    private val userRepository: UserRepository,
    private val bodyCipherService: BodyCipherService,
    private val anchorValidator: AnchorValidator,
) {
    /** 회원 댓글 작성 — 활성 링크 + 해당 스냅샷 + 앵커 범위 검증 → 저장(author_id=userId). */
    @Transactional(rollbackFor = [Exception::class])
    fun create(
        userId: Long,
        token: String,
        projectId: Long,
        request: CreateCommentRequest,
    ): CommentResponse {
        val link = requireActiveLink(token)
        val snapshot =
            shareSnapshotRepository.findByShareLinkIdAndProjectId(requireNotNull(link.id), projectId)
                ?: throw ShareException(ShareErrorCode.SHARE_TARGET_NOT_FOUND)
        val plainBody = bodyCipherService.decryptToPlain(link.ownerId, snapshot.bodySnapshot)
        if (!anchorValidator.isValid(plainBody, request.anchorBlockIndex, request.anchorStart, request.anchorLength)) {
            throw ShareException(ShareErrorCode.COMMENT_ANCHOR_INVALID)
        }
        val saved =
            shareCommentRepository.save(
                ShareComment(
                    shareSnapshotId = requireNotNull(snapshot.id),
                    projectId = snapshot.projectId,
                    authorId = userId,
                    anchorBlockIndex = request.anchorBlockIndex,
                    anchorStart = request.anchorStart,
                    anchorLength = request.anchorLength,
                    content = request.content,
                ),
            )
        return toCommentResponse(saved, nicknameOf(userId))
    }

    /** 본인 댓글만 삭제 — 미존재 404, 타인 403. */
    @Transactional(rollbackFor = [Exception::class])
    fun deleteOwn(
        userId: Long,
        commentId: Long,
    ) {
        val comment =
            shareCommentRepository
                .findById(commentId)
                .orElseThrow { ShareException(ShareErrorCode.COMMENT_NOT_FOUND) }
        if (comment.authorId != userId) {
            throw ShareException(ShareErrorCode.COMMENT_FORBIDDEN)
        }
        shareCommentRepository.delete(comment)
    }

    /** 공개 read 가시성(R-3) — 요청자 본인 댓글만. 비회원([requesterId]=null)·미존재 스냅샷이면 빈 배열. */
    @Transactional(readOnly = true)
    fun listMineForSharedWork(
        token: String,
        projectId: Long,
        requesterId: Long?,
    ): List<CommentResponse> {
        if (requesterId == null) {
            return emptyList()
        }
        val link = shareLinkRepository.findByToken(token)?.takeIf { it.isActive } ?: return emptyList()
        val snapshot =
            shareSnapshotRepository.findByShareLinkIdAndProjectId(requireNotNull(link.id), projectId)
                ?: return emptyList()
        val mine =
            shareCommentRepository.findByShareSnapshotIdAndAuthorId(requireNotNull(snapshot.id), requesterId)
        if (mine.isEmpty()) {
            return emptyList()
        }
        val nickname = nicknameOf(requesterId)
        return mine.map { toCommentResponse(it, nickname) }
    }

    /** 작가 인박스 — 소유 작품의 전체 댓글(최근순, 작성자 닉네임 동봉). 타 작품/미소유 → COMMENT_FORBIDDEN. */
    @Transactional(readOnly = true)
    fun listForAuthor(
        userId: Long,
        projectId: Long,
    ): List<AuthorCommentResponse> {
        projectRepository
            .findByIdAndUserId(projectId, userId)
            .orElseThrow { ShareException(ShareErrorCode.COMMENT_FORBIDDEN) }
        val comments = shareCommentRepository.findByProjectIdInOrderByCreatedAtDesc(listOf(projectId))
        if (comments.isEmpty()) {
            return emptyList()
        }
        val nicknamesById = nicknamesByAuthorIds(comments.map { it.authorId })
        return comments.map { comment ->
            AuthorCommentResponse(
                id = requireNotNull(comment.id),
                shareSnapshotId = comment.shareSnapshotId,
                projectId = comment.projectId,
                anchorBlockIndex = comment.anchorBlockIndex,
                anchorStart = comment.anchorStart,
                anchorLength = comment.anchorLength,
                content = comment.content,
                authorNickname = nicknamesById[comment.authorId] ?: "",
                createdAt = requireNotNull(comment.createdAt),
                readAt = comment.readAt,
            )
        }
    }

    /**
     * 작품 단위 받은 피드백 읽음 처리(047) — 작가가 그 작품 '피드백 보기'를 열 때 호출.
     * 소유 검증(타 작품/미소유 → COMMENT_FORBIDDEN) 후 그 작품의 안 읽은 댓글 전체 read_at 채움(bulk).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun markReadForProject(
        userId: Long,
        projectId: Long,
    ): MarkCommentsReadResponse {
        projectRepository
            .findByIdAndUserId(projectId, userId)
            .orElseThrow { ShareException(ShareErrorCode.COMMENT_FORBIDDEN) }
        val marked = shareCommentRepository.markReadByProjectId(projectId, Instant.now())
        return MarkCommentsReadResponse(markedRead = marked)
    }

    // ── 내부 헬퍼 ──────────────────────────────────────────────────────────────

    /** 활성 링크만 — 비활성/미존재 동형 404(대상 존재 비노출, R1 동형). */
    private fun requireActiveLink(token: String): ShareLink =
        shareLinkRepository
            .findByToken(token)
            ?.takeIf { it.isActive }
            ?: throw ShareException(ShareErrorCode.SHARE_LINK_NOT_FOUND)

    private fun nicknameOf(userId: Long): String = userRepository.findById(userId).map { it.nickname }.orElse("")

    /** 작성자 닉네임 일괄 조회(N+1 회피). */
    private fun nicknamesByAuthorIds(authorIds: List<Long>): Map<Long, String> =
        userRepository
            .findAllById(authorIds.distinct())
            .associate { requireNotNull(it.id) to it.nickname }

    private fun toCommentResponse(
        comment: ShareComment,
        authorNickname: String,
    ): CommentResponse =
        CommentResponse(
            id = requireNotNull(comment.id),
            anchorBlockIndex = comment.anchorBlockIndex,
            anchorStart = comment.anchorStart,
            anchorLength = comment.anchorLength,
            content = comment.content,
            authorNickname = authorNickname,
            createdAt = requireNotNull(comment.createdAt),
        )
}
