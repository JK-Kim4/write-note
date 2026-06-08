package com.writenote.service

import com.writenote.error.ResourceNotFoundException
import com.writenote.model.response.MemoCharacterResponse
import com.writenote.model.response.MemoProjectResponse
import com.writenote.model.response.MemoResponse
import com.writenote.repository.CharacterRepository
import com.writenote.repository.MemoProjectCharacterRepository
import com.writenote.repository.MemoProjectRepository
import com.writenote.repository.MemoRepository
import com.writenote.repository.ProjectRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * M1/M2 메모 조회 — MemoService(캡처) 와 분리.
 *
 * 목록 조회는 JOIN FETCH(MemoRepository JPQL) 로 N+1 회피.
 * 단건 조회는 memoProject/character 후처리로 응답 구성.
 */
@Service
class MemoQueryService(
    private val memoRepository: MemoRepository,
    private val memoProjectRepository: MemoProjectRepository,
    private val memoProjectCharacterRepository: MemoProjectCharacterRepository,
    private val projectRepository: ProjectRepository,
    private val characterRepository: CharacterRepository,
) {
    /**
     * M1 메모 목록 — 필터 + 페이지네이션.
     *
     * 우선순위: unclassified > projectId > characterId > tag > q > 전체.
     */
    @Transactional(readOnly = true)
    fun listMemos(
        userId: Long,
        unclassified: Boolean,
        projectId: Long?,
        characterId: Long?,
        tag: String?,
        q: String?,
        pageable: Pageable,
    ): Page<MemoResponse> {
        // 태그 필터는 네이티브 쿼리(TEXT[] ANY 연산) — 별도 분기
        if (tag != null) {
            val memoPage = memoRepository.findByUserIdAndTagNative(userId, tag, pageable)
            return memoPage.map { toResponseWithConnections(requireNotNull(it.id), userId) }
        }

        val memoPage =
            when {
                unclassified -> memoRepository.findUnclassifiedByUserId(userId, pageable)
                projectId != null ->
                    memoRepository.findAllWithConnectionsByUserIdAndProjectId(userId, projectId, pageable)
                characterId != null ->
                    memoRepository.findAllWithConnectionsByUserIdAndCharacterId(userId, characterId, pageable)
                q != null -> memoRepository.findAllWithConnectionsByUserIdAndQuery(userId, q, pageable)
                else -> memoRepository.findAllWithConnectionsByUserId(userId, pageable)
            }

        return memoPage.map { toResponse(it) }
    }

    /**
     * M2 단건 조회.
     */
    @Transactional(readOnly = true)
    fun getMemo(
        userId: Long,
        memoId: Long,
    ): MemoResponse {
        val memo =
            memoRepository.findByIdAndUserId(memoId, userId)
                ?: throw ResourceNotFoundException("Memo not found")
        return toResponseWithConnections(memo.id!!, userId)
    }

    private fun toResponse(memo: com.writenote.entity.Memo): MemoResponse {
        // JOIN FETCH 로 이미 로드된 memoProjects 사용
        val projectResponses = buildProjectResponses(memo.memoProjects)
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

    private fun toResponseWithConnections(
        memoId: Long,
        userId: Long,
    ): MemoResponse {
        val memo =
            memoRepository.findByIdAndUserId(memoId, userId)
                ?: throw ResourceNotFoundException("Memo not found")
        val memoProjects = memoProjectRepository.findAllByMemoId(memoId)
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

    private fun buildProjectResponses(memoProjects: List<com.writenote.entity.MemoProject>): List<MemoProjectResponse> {
        if (memoProjects.isEmpty()) return emptyList()

        val projectIds = memoProjects.map { it.projectId }.toSet()
        val projectMap =
            projectRepository
                .findAllById(projectIds)
                .filter { it.id != null }
                .associate { requireNotNull(it.id) to it.title }

        return memoProjects.map { mp ->
            val chars =
                mp.characters.map { mpc ->
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
    }
}
