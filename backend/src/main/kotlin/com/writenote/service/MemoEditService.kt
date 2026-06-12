package com.writenote.service

import com.writenote.error.ResourceNotFoundException
import com.writenote.model.request.UpdateMemoRequest
import com.writenote.model.response.MemoCharacterResponse
import com.writenote.model.response.MemoProjectResponse
import com.writenote.model.response.MemoResponse
import com.writenote.repository.CharacterRepository
import com.writenote.repository.MemoProjectCharacterRepository
import com.writenote.repository.MemoProjectRepository
import com.writenote.repository.MemoRepository
import com.writenote.repository.ProjectRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * M4 PATCH (수정) / M5 DELETE (삭제) — MemoService(캡처) 와 분리.
 */
@Service
class MemoEditService(
    private val memoRepository: MemoRepository,
    private val memoProjectRepository: MemoProjectRepository,
    private val memoProjectCharacterRepository: MemoProjectCharacterRepository,
    private val projectRepository: ProjectRepository,
    private val characterRepository: CharacterRepository,
) {
    /**
     * M4 — 본문/reasonNote/tags 부분 수정. null = 미변경.
     */
    @Transactional(rollbackFor = [Exception::class])
    fun updateMemo(
        userId: Long,
        memoId: Long,
        request: UpdateMemoRequest,
    ): MemoResponse {
        val memo =
            memoRepository.findByIdAndUserIdAndDeletedAtIsNull(memoId, userId)
                ?: throw ResourceNotFoundException("Memo not found")

        request.body?.let {
            require(it.isNotBlank()) { "body 는 비어있을 수 없습니다." }
            memo.body = it.trim()
        }
        request.reasonNote?.let { memo.reasonNote = it }
        request.tags?.let { memo.tags = it }

        memoRepository.save(memo)

        return buildResponse(memo, userId)
    }

    /**
     * M5 — 버리기 (soft-delete). [deletedAt] 에 현재 시각 기록. 연결행(MemoProject/MemoProjectCharacter)은
     * 보존하여 복원 시 작품 연결·고정이 그대로 복귀한다. 이미 버려진 메모면 멱등(no-op).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun deleteMemo(
        userId: Long,
        memoId: Long,
    ) {
        val memo =
            memoRepository.findByIdAndUserId(memoId, userId)
                ?: throw ResourceNotFoundException("Memo not found")

        if (memo.deletedAt == null) {
            memo.deletedAt = Instant.now()
            memoRepository.save(memo)
        }
    }

    /**
     * 버린 곁쪽지 되돌리기 — [deletedAt] 을 NULL 로 되돌린다. 연결행이 보존돼 있어 작품 연결·고정이 복귀한다.
     * 버려지지 않은 메모면 멱등(no-op). 본인 메모만(소유권 검증).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun restoreMemo(
        userId: Long,
        memoId: Long,
    ): MemoResponse {
        val memo =
            memoRepository.findByIdAndUserId(memoId, userId)
                ?: throw ResourceNotFoundException("Memo not found")

        if (memo.deletedAt != null) {
            memo.deletedAt = null
            memoRepository.save(memo)
        }
        return buildResponse(memo, userId)
    }

    private fun buildResponse(
        memo: com.writenote.entity.Memo,
        userId: Long,
    ): MemoResponse {
        val memoProjects = memoProjectRepository.findAllByMemoId(requireNotNull(memo.id))
        val projectIds = memoProjects.map { it.projectId }.toSet()
        val projectMap =
            if (projectIds.isEmpty()) {
                emptyMap()
            } else {
                projectRepository
                    .findAllById(projectIds)
                    .filter { it.id != null }
                    .associate { requireNotNull(it.id) to it.title }
            }
        val projectResponses =
            memoProjects.map { mp ->
                val chars =
                    memoProjectCharacterRepository
                        .findAllByMemoProjectId(requireNotNull(mp.id))
                        .map { mpc ->
                            val charName =
                                characterRepository
                                    .findById(mpc.characterId)
                                    .map { it.name }
                                    .orElse("")
                            MemoCharacterResponse(characterId = mpc.characterId, name = charName)
                        }
                MemoProjectResponse(
                    projectId = mp.projectId,
                    title = projectMap[mp.projectId] ?: "",
                    characters = chars,
                )
            }
        return MemoResponse(
            id = requireNotNull(memo.id),
            body = memo.body,
            source = memo.source,
            capturedAt = requireNotNull(memo.capturedAt),
            activeProjectAtCapture = memo.activeProjectAtCapture,
            reasonNote = memo.reasonNote,
            tags = memo.tags,
            projects = projectResponses,
        )
    }
}
