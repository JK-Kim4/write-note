package com.writenote.service

import com.writenote.crypto.BodyCipherService
import com.writenote.entity.Category
import com.writenote.entity.Project
import com.writenote.entity.ShareLink
import com.writenote.entity.ShareSnapshot
import com.writenote.error.ShareErrorCode
import com.writenote.error.ShareException
import com.writenote.model.request.CreateShareLinkRequest
import com.writenote.model.response.ShareLinkResponse
import com.writenote.model.response.SharedViewResponse
import com.writenote.model.response.SharedWorkMeta
import com.writenote.model.response.SharedWorkResponse
import com.writenote.repository.CategoryRepository
import com.writenote.repository.DocumentRepository
import com.writenote.repository.ProjectRepository
import com.writenote.repository.ShareLinkRepository
import com.writenote.repository.ShareSnapshotRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 공유하기(046 R1) 유스케이스 — 공유 링크 + 불변 스냅샷 동결 + 비로그인 공개 읽기.
 *
 * 스냅샷 동결 = 그 시점 documents.body 암호문(owner 키)을 그대로 복사(재암호화 불필요, R-2). 공개 read 는
 * [BodyCipherService.decryptToPlain]([ShareLink.ownerId], ...)로 owner 키 복호 — readOnly 트랜잭션 안전(DEK 미생성).
 * 비활성/미존재 링크는 동형 [ShareErrorCode.SHARE_LINK_NOT_FOUND](대상 존재 비노출, FR-006).
 */
@Service
class ShareService(
    private val shareLinkRepository: ShareLinkRepository,
    private val shareSnapshotRepository: ShareSnapshotRepository,
    private val shareTokenGenerator: ShareTokenGenerator,
    private val projectRepository: ProjectRepository,
    private val categoryRepository: CategoryRepository,
    private val documentRepository: DocumentRepository,
    private val bodyCipherService: BodyCipherService,
    @Value("\${app.frontend.base-url}") private val frontendBaseUrl: String,
) {
    /** 공유 링크 생성. work=즉시 스냅샷 동결, series=링크만(공개 작품은 setPublicWorks 로). */
    @Transactional(rollbackFor = [Exception::class])
    fun createShareLink(
        userId: Long,
        request: CreateShareLinkRequest,
    ): ShareLinkResponse =
        when (request.targetType) {
            TARGET_WORK -> createWorkShareLink(userId, request.targetId)
            TARGET_SERIES -> createSeriesShareLink(userId, request.targetId)
            else -> throw ShareException(ShareErrorCode.SHARE_TARGET_INVALID)
        }

    /** 작품 공유 — 소유검증 → 그 시점 본문 암호문 복사로 스냅샷 동결. */
    private fun createWorkShareLink(
        userId: Long,
        projectId: Long,
    ): ShareLinkResponse {
        val project = requireSharableWork(userId, projectId)
        val link =
            shareLinkRepository.save(
                ShareLink(
                    token = shareTokenGenerator.generate(),
                    targetType = TARGET_WORK,
                    targetId = projectId,
                    ownerId = userId,
                    isActive = true,
                ),
            )
        val snapshot = freezeSnapshot(requireNotNull(link.id), project)
        return toResponse(link, listOf(snapshot))
    }

    /** 시리즈 공유 — 소유검증 → 링크만 생성(공개 작품은 [setPublicWorks] 로 선택, 새 작품 자동 미노출). */
    private fun createSeriesShareLink(
        userId: Long,
        categoryId: Long,
    ): ShareLinkResponse {
        requireSharableSeries(userId, categoryId)
        val link =
            shareLinkRepository.save(
                ShareLink(
                    token = shareTokenGenerator.generate(),
                    targetType = TARGET_SERIES,
                    targetId = categoryId,
                    ownerId = userId,
                    isActive = true,
                ),
            )
        return toResponse(link, emptyList())
    }

    /**
     * 시리즈 링크의 공개 작품 목록 설정 — 추가분은 그 시점 스냅샷 동결, 제거분은 스냅샷 삭제.
     * 각 작품은 본인 소유 + 그 시리즈 소속이어야 함(아니면 [ShareErrorCode.SHARE_TARGET_INVALID]).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun setPublicWorks(
        userId: Long,
        linkId: Long,
        projectIds: List<Long>,
    ): ShareLinkResponse {
        val link =
            shareLinkRepository
                .findByIdAndOwnerId(linkId, userId)
                .orElseThrow { ShareException(ShareErrorCode.SHARE_LINK_NOT_FOUND) }
        if (link.targetType != TARGET_SERIES) {
            throw ShareException(ShareErrorCode.SHARE_TARGET_INVALID)
        }
        // 선택 작품 전수 검증(본인 소유 + 그 시리즈 소속) — 부분 변경 전에 먼저 확정
        val desired = projectIds.distinct()
        val projectsById = desired.associateWith { requireWorkInSeries(userId, it, link.targetId) }

        val existing = shareSnapshotRepository.findByShareLinkId(linkId)
        val existingProjectIds = existing.map { it.projectId }.toSet()
        val desiredSet = desired.toSet()

        // 제거분 스냅샷 삭제(보존 대상 아님 — 공개 해제)
        val toRemove = existing.filter { it.projectId !in desiredSet }
        if (toRemove.isNotEmpty()) {
            shareSnapshotRepository.deleteAll(toRemove)
        }
        // 추가분만 그 시점 스냅샷 동결(기존 선택분은 동결 유지 — 재동결 안 함)
        desired
            .filter { it !in existingProjectIds }
            .forEach { freezeSnapshot(linkId, requireNotNull(projectsById[it])) }

        return toResponse(link, shareSnapshotRepository.findByShareLinkId(linkId))
    }

    /** revoke(또는 재활성) — 본인 소유 링크만. */
    @Transactional(rollbackFor = [Exception::class])
    fun revoke(
        userId: Long,
        linkId: Long,
        isActive: Boolean,
    ): ShareLinkResponse {
        val link =
            shareLinkRepository
                .findByIdAndOwnerId(linkId, userId)
                .orElseThrow { ShareException(ShareErrorCode.SHARE_LINK_NOT_FOUND) }
        link.isActive = isActive
        return toResponse(link, shareSnapshotRepository.findByShareLinkId(linkId))
    }

    /** 내 공유 링크 목록(최근순) — 스냅샷 일괄 조회(N+1 회피). */
    @Transactional(readOnly = true)
    fun listMine(userId: Long): List<ShareLinkResponse> {
        val links = shareLinkRepository.findByOwnerIdOrderByCreatedAtDesc(userId)
        if (links.isEmpty()) {
            return emptyList()
        }
        val snapshotsByLink =
            shareSnapshotRepository
                .findByShareLinkIdIn(links.mapNotNull { it.id })
                .groupBy { it.shareLinkId }
        return links.map { toResponse(it, snapshotsByLink[it.id] ?: emptyList()) }
    }

    /** 공개 열람 진입(목록) — 활성 링크만. work=단일, series=공개 작품 목록(R3). */
    @Transactional(readOnly = true)
    fun getPublicView(token: String): SharedViewResponse {
        val link = requireActiveLink(token)
        val snapshots = shareSnapshotRepository.findByShareLinkId(requireNotNull(link.id))
        val title =
            when (link.targetType) {
                // 시리즈는 작품 0개일 수도 있으므로 시리즈명을 직접 조회(스냅샷 없어도 제목 노출)
                TARGET_SERIES -> categoryRepository.findById(link.targetId).map { it.name }.orElse("")
                else -> snapshots.firstOrNull()?.titleSnapshot ?: ""
            }
        return SharedViewResponse(
            targetType = link.targetType,
            title = title,
            works = snapshots.map { SharedWorkMeta(it.projectId, it.titleSnapshot) },
        )
    }

    /** 공개 열람 단건 — 활성 링크 + 스냅샷 → owner 키 복호 평문 PM JSON. 댓글은 R2(R1 빈 배열). */
    @Transactional(readOnly = true)
    fun getSharedWork(
        token: String,
        projectId: Long,
    ): SharedWorkResponse {
        val link = requireActiveLink(token)
        val snapshot =
            shareSnapshotRepository.findByShareLinkIdAndProjectId(requireNotNull(link.id), projectId)
                ?: throw ShareException(ShareErrorCode.SHARE_TARGET_NOT_FOUND)
        val plainBody = bodyCipherService.decryptToPlain(link.ownerId, snapshot.bodySnapshot)
        return SharedWorkResponse(
            projectId = snapshot.projectId,
            title = snapshot.titleSnapshot,
            bodyJson = plainBody,
            comments = emptyList(),
        )
    }

    // ── 내부 헬퍼 ──────────────────────────────────────────────────────────────

    /** 미존재 작품 → 404, 타인 작품 → 403. */
    private fun requireSharableWork(
        userId: Long,
        projectId: Long,
    ): Project {
        val project =
            projectRepository
                .findById(projectId)
                .orElseThrow { ShareException(ShareErrorCode.SHARE_TARGET_NOT_FOUND) }
        if (project.userId != userId) {
            throw ShareException(ShareErrorCode.SHARE_FORBIDDEN)
        }
        return project
    }

    /** 미존재 시리즈 → 404, 타인 시리즈 → 403. */
    private fun requireSharableSeries(
        userId: Long,
        categoryId: Long,
    ): Category {
        val category =
            categoryRepository
                .findById(categoryId)
                .orElseThrow { ShareException(ShareErrorCode.SHARE_TARGET_NOT_FOUND) }
        if (category.userId != userId) {
            throw ShareException(ShareErrorCode.SHARE_FORBIDDEN)
        }
        return category
    }

    /** 공개 작품 선택 검증 — 본인 소유 + 그 시리즈 소속이 아니면 SHARE_TARGET_INVALID(열거·오선택 차단). */
    private fun requireWorkInSeries(
        userId: Long,
        projectId: Long,
        categoryId: Long,
    ): Project {
        val project =
            projectRepository
                .findByIdAndUserId(projectId, userId)
                .orElseThrow { ShareException(ShareErrorCode.SHARE_TARGET_INVALID) }
        if (project.categoryId != categoryId) {
            throw ShareException(ShareErrorCode.SHARE_TARGET_INVALID)
        }
        return project
    }

    /** 그 시점 본문 암호문을 그대로 복사해 스냅샷 동결(재암호화 없음). */
    private fun freezeSnapshot(
        shareLinkId: Long,
        project: Project,
    ): ShareSnapshot {
        val document =
            documentRepository
                .findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(requireNotNull(project.id))
                .firstOrNull()
                ?: throw ShareException(ShareErrorCode.SHARE_TARGET_NOT_FOUND)
        return shareSnapshotRepository.save(
            ShareSnapshot(
                shareLinkId = shareLinkId,
                projectId = requireNotNull(project.id),
                titleSnapshot = project.title,
                bodySnapshot = document.body,
            ),
        )
    }

    /** 활성 링크만 — 비활성/미존재 동형 404(대상 존재 비노출). */
    private fun requireActiveLink(token: String): ShareLink =
        shareLinkRepository
            .findByToken(token)
            ?.takeIf { it.isActive }
            ?: throw ShareException(ShareErrorCode.SHARE_LINK_NOT_FOUND)

    private fun toResponse(
        link: ShareLink,
        snapshots: List<ShareSnapshot>,
    ): ShareLinkResponse =
        ShareLinkResponse(
            id = requireNotNull(link.id),
            token = link.token,
            targetType = link.targetType,
            targetId = link.targetId,
            isActive = link.isActive,
            shareUrl = "$frontendBaseUrl/shared/${link.token}",
            createdAt = requireNotNull(link.createdAt),
            snapshots = snapshots.map { SharedWorkMeta(it.projectId, it.titleSnapshot) },
        )

    private companion object {
        const val TARGET_WORK = "work"
        const val TARGET_SERIES = "series"
    }
}
