package com.writenote.service

import com.writenote.entity.Memo
import com.writenote.entity.MemoProject
import com.writenote.error.ResourceNotFoundException
import com.writenote.model.response.ProjectMemoResponse
import com.writenote.repository.MemoProjectRepository
import com.writenote.repository.MemoRepository
import com.writenote.repository.ProjectRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 곁쪽지 고정 토글 — `memos:setPin` 대응.
 *
 * 작품당 고정 1개 불변식: pin=true 시 그 작품의 기존 고정을 먼저 해제(flush)한 뒤 대상을 고정한다.
 * partial unique index(uq_memo_project_pinned)와 정합 — 해제 flush 가 먼저여야 인덱스 충돌이 없다.
 */
@Service
class MemoPinService(
    private val memoRepository: MemoRepository,
    private val memoProjectRepository: MemoProjectRepository,
    private val projectRepository: ProjectRepository,
) {
    @Transactional(rollbackFor = [Exception::class])
    fun setPin(
        userId: Long,
        projectId: Long,
        memoId: Long,
        pinned: Boolean,
    ): ProjectMemoResponse {
        projectRepository
            .findByIdAndUserId(projectId, userId)
            .orElseThrow { ResourceNotFoundException("Project not found") }
        val memo =
            memoRepository.findByIdAndUserId(memoId, userId)
                ?: throw ResourceNotFoundException("Memo not found")
        val link =
            memoProjectRepository.findByMemoIdAndProjectId(memoId, projectId)
                ?: throw ResourceNotFoundException("Memo is not linked to project")

        if (pinned) {
            val others = memoProjectRepository.findAllByProjectIdAndPinnedIsTrue(projectId).filter { it.id != link.id }
            if (others.isNotEmpty()) {
                others.forEach { it.pinned = false }
                memoProjectRepository.saveAllAndFlush(others)
            }
            link.pinned = true
        } else {
            link.pinned = false
        }
        memoProjectRepository.saveAndFlush(link)

        return toResponse(link, memo)
    }

    private fun toResponse(
        link: MemoProject,
        memo: Memo,
    ): ProjectMemoResponse =
        ProjectMemoResponse(
            memoId = requireNotNull(memo.id),
            projectId = link.projectId,
            body = memo.body,
            source = memo.source,
            capturedAt = requireNotNull(memo.capturedAt),
            reasonNote = memo.reasonNote,
            tags = memo.tags,
            pinned = link.pinned,
        )
}
