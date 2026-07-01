package com.writenote.service

import com.writenote.crypto.BodyCipherService
import com.writenote.entity.ShareLink
import com.writenote.entity.ShareReaction
import com.writenote.entity.ShareSnapshot
import com.writenote.error.ShareErrorCode
import com.writenote.error.ShareException
import com.writenote.model.request.CreateReactionRequest
import com.writenote.model.response.ReactionAggregate
import com.writenote.repository.ShareLinkRepository
import com.writenote.repository.ShareReactionRepository
import com.writenote.repository.ShareSnapshotRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 공유 반응(050 US3) 유스케이스 — 공개 스냅샷 구간 이모지 반응(회원 전용 작성, 공개 집계).
 *
 * 토글: [add]/[remove] 는 unique 키(스냅샷+앵커+이모지+반응자) 기준 멱등. 앵커는 [AnchorValidator]
 * (스냅샷 평탄화 정합, 룰 §32) 재사용 — 신규 검증 로직 없음.
 * [aggregate] 는 스냅샷의 (anchor, emoji) 그룹별 개수 + 뷰어 본인 반응([mine]) — N+1 회피(그룹 집계 1쿼리 + 본인 반응 1쿼리, 반응 건수 무관 고정 쿼리 수).
 */
@Service
class ShareReactionService(
    private val shareLinkRepository: ShareLinkRepository,
    private val shareSnapshotRepository: ShareSnapshotRepository,
    private val shareReactionRepository: ShareReactionRepository,
    private val bodyCipherService: BodyCipherService,
    private val anchorValidator: AnchorValidator,
) {
    /** 반응 추가 — 활성 링크 + 스냅샷 + 이모지 화이트리스트 + 앵커 검증 → unique 멱등 저장. */
    @Transactional(rollbackFor = [Exception::class])
    fun add(
        token: String,
        projectId: Long,
        request: CreateReactionRequest,
        reactorId: Long,
    ): ReactionAggregate {
        if (request.emoji !in ShareErrorCode.ALLOWED_EMOJIS) {
            throw ShareException(ShareErrorCode.REACTION_EMOJI_INVALID)
        }
        val link = requireActiveLink(token)
        val snapshot = requireSnapshot(link, projectId)
        val snapshotId = requireNotNull(snapshot.id)
        val plainBody = bodyCipherService.decryptToPlain(link.ownerId, snapshot.bodySnapshot)
        if (!anchorValidator.isValid(plainBody, request.anchorBlockIndex, request.anchorStart, request.anchorLength)) {
            throw ShareException(ShareErrorCode.COMMENT_ANCHOR_INVALID)
        }
        val existing =
            shareReactionRepository.findByShareSnapshotIdAndAnchorBlockIndexAndAnchorStartAndAnchorLengthAndEmojiAndReactorId(
                snapshotId,
                request.anchorBlockIndex,
                request.anchorStart,
                request.anchorLength,
                request.emoji,
                reactorId,
            )
        if (existing == null) {
            shareReactionRepository.save(
                ShareReaction(
                    shareSnapshotId = snapshotId,
                    anchorBlockIndex = request.anchorBlockIndex,
                    anchorStart = request.anchorStart,
                    anchorLength = request.anchorLength,
                    emoji = request.emoji,
                    reactorId = reactorId,
                ),
            )
        }
        return aggregateOne(snapshotId, request.anchorBlockIndex, request.anchorStart, request.anchorLength, request.emoji, reactorId)
    }

    /** 반응 제거(토글 off) — 본인 것만. 없어도 무해(멱등), 갱신된 집계 반환. */
    @Transactional(rollbackFor = [Exception::class])
    fun remove(
        token: String,
        projectId: Long,
        anchorBlockIndex: Int,
        anchorStart: Int,
        anchorLength: Int,
        emoji: String,
        reactorId: Long,
    ): ReactionAggregate {
        val link = requireActiveLink(token)
        val snapshot = requireSnapshot(link, projectId)
        val snapshotId = requireNotNull(snapshot.id)
        shareReactionRepository.deleteByAnchorAndReactor(
            snapshotId,
            anchorBlockIndex,
            anchorStart,
            anchorLength,
            emoji,
            reactorId,
        )
        return aggregateOne(snapshotId, anchorBlockIndex, anchorStart, anchorLength, emoji, reactorId)
    }

    /** 스냅샷의 반응 집계 전체 — (anchor, emoji) 그룹별 count + [viewerId] 본인 반응([ReactionAggregate.mine]). */
    @Transactional(readOnly = true)
    fun aggregate(
        snapshotId: Long,
        viewerId: Long?,
    ): List<ReactionAggregate> {
        val rows = shareReactionRepository.countGroupedBySnapshot(snapshotId)
        val mineKeys =
            if (viewerId == null) {
                emptySet()
            } else {
                shareReactionRepository
                    .findByShareSnapshotIdAndReactorId(snapshotId, viewerId)
                    .map { AnchorKey(it.anchorBlockIndex, it.anchorStart, it.anchorLength, it.emoji) }
                    .toSet()
            }
        return rows.map { row ->
            ReactionAggregate(
                anchorBlockIndex = row.anchorBlockIndex,
                anchorStart = row.anchorStart,
                anchorLength = row.anchorLength,
                emoji = row.emoji,
                count = row.count.toInt(),
                mine = AnchorKey(row.anchorBlockIndex, row.anchorStart, row.anchorLength, row.emoji) in mineKeys,
            )
        }
    }

    /**
     * 공개 read embed 용(C1) — 토큰으로 링크·스냅샷 재해석. 비활성/미존재는 빈 목록(예외 없음),
     * [ShareCommentService.listMineForSharedWork] 와 동형(공개 read 는 fail-soft).
     */
    @Transactional(readOnly = true)
    fun aggregateForSharedWork(
        token: String,
        projectId: Long,
        viewerId: Long?,
    ): List<ReactionAggregate> {
        val link = shareLinkRepository.findByToken(token)?.takeIf { it.isActive } ?: return emptyList()
        val snapshot =
            shareSnapshotRepository.findByShareLinkIdAndProjectId(requireNotNull(link.id), projectId)
                ?: return emptyList()
        return aggregate(requireNotNull(snapshot.id), viewerId)
    }

    // ── 내부 헬퍼 ──────────────────────────────────────────────────────────────

    /** 활성 링크만 — 비활성/미존재 동형 404(대상 존재 비노출, R1 동형). */
    private fun requireActiveLink(token: String): ShareLink =
        shareLinkRepository
            .findByToken(token)
            ?.takeIf { it.isActive }
            ?: throw ShareException(ShareErrorCode.SHARE_LINK_NOT_FOUND)

    private fun requireSnapshot(
        link: ShareLink,
        projectId: Long,
    ): ShareSnapshot =
        shareSnapshotRepository.findByShareLinkIdAndProjectId(requireNotNull(link.id), projectId)
            ?: throw ShareException(ShareErrorCode.SHARE_TARGET_NOT_FOUND)

    private fun aggregateOne(
        snapshotId: Long,
        anchorBlockIndex: Int,
        anchorStart: Int,
        anchorLength: Int,
        emoji: String,
        viewerId: Long?,
    ): ReactionAggregate {
        val count =
            shareReactionRepository.countByShareSnapshotIdAndAnchorBlockIndexAndAnchorStartAndAnchorLengthAndEmoji(
                snapshotId,
                anchorBlockIndex,
                anchorStart,
                anchorLength,
                emoji,
            )
        val mine =
            viewerId != null &&
                shareReactionRepository
                    .findByShareSnapshotIdAndAnchorBlockIndexAndAnchorStartAndAnchorLengthAndEmojiAndReactorId(
                        snapshotId,
                        anchorBlockIndex,
                        anchorStart,
                        anchorLength,
                        emoji,
                        viewerId,
                    ) != null
        return ReactionAggregate(anchorBlockIndex, anchorStart, anchorLength, emoji, count.toInt(), mine)
    }

    private data class AnchorKey(
        val anchorBlockIndex: Int,
        val anchorStart: Int,
        val anchorLength: Int,
        val emoji: String,
    )
}
