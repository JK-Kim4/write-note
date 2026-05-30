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
            memoRepository.findByIdAndUserId(memoId, userId)
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
     * M5 — 삭제 (cascade: MemoProjectCharacter → MemoProject → Memo).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun deleteMemo(
        userId: Long,
        memoId: Long,
    ) {
        val memo =
            memoRepository.findByIdAndUserId(memoId, userId)
                ?: throw ResourceNotFoundException("Memo not found")

        val memoProjects = memoProjectRepository.findAllByMemoId(memoId)
        for (mp in memoProjects) {
            memoProjectCharacterRepository.deleteAllByMemoProjectId(requireNotNull(mp.id))
        }
        memoProjectRepository.deleteAll(memoProjects)
        memoRepository.delete(memo)
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
