package com.writenote.service

import com.writenote.crypto.BodyCipherService
import com.writenote.entity.ShareComment
import com.writenote.entity.ShareLink
import com.writenote.error.ShareErrorCode
import com.writenote.error.ShareException
import com.writenote.model.request.CreateCommentRequest
import com.writenote.model.response.AuthorCommentResponse
import com.writenote.model.response.AuthorSnapshotFeedbackResponse
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
 * 앵커 3필드는 nullable(050 US3) — 셋 다 null = 전체 의견(구간 미지정), 부분 null 은 400.
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
    private val shareReactionService: ShareReactionService,
) {
    /** 회원 댓글 작성 — 활성 링크 + 해당 스냅샷 + 앵커 범위 검증(null=전체 의견은 skip) → 저장(author_id=userId). */
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
        if (hasAnchor(request.anchorBlockIndex, request.anchorStart, request.anchorLength)) {
            val plainBody = bodyCipherService.decryptToPlain(link.ownerId, snapshot.bodySnapshot)
            val isValidAnchor =
                anchorValidator.isValid(
                    plainBody,
                    requireNotNull(request.anchorBlockIndex),
                    requireNotNull(request.anchorStart),
                    requireNotNull(request.anchorLength),
                )
            if (!isValidAnchor) {
                throw ShareException(ShareErrorCode.COMMENT_ANCHOR_INVALID)
            }
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
        return toAuthorCommentResponses(comments)
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

    /**
     * 작가용 피드백 맥락 뷰(050 US1, D1) — 한 링크(스냅샷)의 본문 전문 + 전체 댓글 + 반응 집계.
     * 비활성(off) 링크도 열람 가능(작가 소유 검증만) — 존재하지 않는 링크/스냅샷은 [ShareErrorCode.SHARE_LINK_NOT_FOUND] 404,
     * 소유자가 아니면 [ShareErrorCode.SHARE_FORBIDDEN] 403(존재는 노출 — 작가 자신의 화면이라 R1 동형 미적용).
     */
    @Transactional(readOnly = true)
    fun authorSnapshotFeedback(
        linkId: Long,
        projectId: Long,
        ownerId: Long,
    ): AuthorSnapshotFeedbackResponse {
        val link = requireOwnedLink(linkId, ownerId)
        val snapshot =
            shareSnapshotRepository.findByShareLinkIdAndProjectId(requireNotNull(link.id), projectId)
                ?: throw ShareException(ShareErrorCode.SHARE_LINK_NOT_FOUND)
        val snapshotId = requireNotNull(snapshot.id)
        val plainBody = bodyCipherService.decryptToPlain(link.ownerId, snapshot.bodySnapshot)
        val comments = shareCommentRepository.findByShareSnapshotIdOrderByCreatedAtDesc(snapshotId)
        val reactions = shareReactionService.aggregate(snapshotId, ownerId)
        return AuthorSnapshotFeedbackResponse(
            projectId = snapshot.projectId,
            title = snapshot.titleSnapshot,
            bodyJson = plainBody,
            comments = toAuthorCommentResponses(comments),
            reactions = reactions,
        )
    }

    /**
     * 스냅샷 스코프 읽음 처리(050 US1, D7) — 그 링크(스냅샷)의 안 읽은 댓글만 read_at 채움.
     * [markReadForProject](projectId 단위)와 달리 같은 작품의 다른 링크 안 읽음에는 영향 없음.
     */
    @Transactional(rollbackFor = [Exception::class])
    fun markReadBySnapshotId(
        linkId: Long,
        projectId: Long,
        ownerId: Long,
    ): MarkCommentsReadResponse {
        val link = requireOwnedLink(linkId, ownerId)
        val snapshot =
            shareSnapshotRepository.findByShareLinkIdAndProjectId(requireNotNull(link.id), projectId)
                ?: throw ShareException(ShareErrorCode.SHARE_LINK_NOT_FOUND)
        val marked = shareCommentRepository.markReadByShareSnapshotId(requireNotNull(snapshot.id), Instant.now())
        return MarkCommentsReadResponse(markedRead = marked)
    }

    // ── 내부 헬퍼 ──────────────────────────────────────────────────────────────

    /** 활성 링크만 — 비활성/미존재 동형 404(대상 존재 비노출, R1 동형). */
    private fun requireActiveLink(token: String): ShareLink =
        shareLinkRepository
            .findByToken(token)
            ?.takeIf { it.isActive }
            ?: throw ShareException(ShareErrorCode.SHARE_LINK_NOT_FOUND)

    /**
     * 작가 맥락 뷰(050 US1) 소유 검증 — 미존재 링크는 404, 존재하나 타인 소유면 403(비활성 링크도 통과, N1/N4).
     * [ShareLinkRepository.findByIdAndOwnerId] 를 쓰지 않는 이유: 그 메서드는 미존재·비소유를 동형 404 로 묶어
     * 존재 비노출을 하는데(R1 동형), 작가 자신의 관리 화면은 링크가 "있는데 내 것이 아님"을 403 으로 구분해야 한다(계약 N1).
     */
    private fun requireOwnedLink(
        linkId: Long,
        ownerId: Long,
    ): ShareLink {
        val link =
            shareLinkRepository
                .findById(linkId)
                .orElseThrow { ShareException(ShareErrorCode.SHARE_LINK_NOT_FOUND) }
        if (link.ownerId != ownerId) {
            throw ShareException(ShareErrorCode.SHARE_FORBIDDEN)
        }
        return link
    }

    /** 앵커 3필드 셋 다 값(구간 댓글)=true, 셋 다 null(전체 의견)=false, 섞임=[ShareErrorCode.COMMENT_ANCHOR_INVALID] 400. */
    private fun hasAnchor(
        anchorBlockIndex: Int?,
        anchorStart: Int?,
        anchorLength: Int?,
    ): Boolean {
        val nonNullCount = listOf(anchorBlockIndex, anchorStart, anchorLength).count { it != null }
        if (nonNullCount != 0 && nonNullCount != 3) {
            throw ShareException(ShareErrorCode.COMMENT_ANCHOR_INVALID)
        }
        return nonNullCount == 3
    }

    private fun nicknameOf(userId: Long): String = userRepository.findById(userId).map { it.nickname }.orElse("")

    /** [ShareComment] 목록 → [AuthorCommentResponse] 목록(작성자 닉네임 일괄 조회, N+1 회피). */
    private fun toAuthorCommentResponses(comments: List<ShareComment>): List<AuthorCommentResponse> {
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
