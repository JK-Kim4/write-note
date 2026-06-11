package com.writenote.service

import com.writenote.components.MemoCharacterIntegrityValidator
import com.writenote.entity.MemoProject
import com.writenote.entity.MemoProjectCharacter
import com.writenote.error.ResourceNotFoundException
import com.writenote.model.request.CurateMemoRequest
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

@Service
class MemoCurationService(
    private val memoRepository: MemoRepository,
    private val memoProjectRepository: MemoProjectRepository,
    private val memoProjectCharacterRepository: MemoProjectCharacterRepository,
    private val characterRepository: CharacterRepository,
    private val projectRepository: ProjectRepository,
    private val integrityValidator: MemoCharacterIntegrityValidator,
) {
    /**
     * M7 큐레이션 — 선언적 전체 상태 저장 (차이 계산 + 단일 트랜잭션).
     *
     * 1. 메모 소유 검증 (FR-024)
     * 2. 요청 내 모든 characterId 를 DB 에서 조회 → characterProjectMap 구성
     * 3. 인물-프로젝트 무결성 검증 (FR-017)
     * 4. 현재 MemoProject 목록 vs 요청 비교 → add/remove 차이 계산
     * 5. remove: MemoProjectCharacter → MemoProject 순 삭제
     * 6. add: MemoProject 생성 → MemoProjectCharacter 생성
     * 7. Memo.tags / reasonNote 갱신
     * 8. MemoResponse 반환 (갱신된 연결 포함)
     */
    @Transactional(rollbackFor = [Exception::class])
    fun curate(
        userId: Long,
        memoId: Long,
        request: CurateMemoRequest,
    ): MemoResponse {
        val memo =
            memoRepository.findByIdAndUserIdAndDeletedAtIsNull(memoId, userId)
                ?: throw ResourceNotFoundException("Memo not found")

        // 요청 내 모든 characterId 수집
        val allCharacterIds =
            request.projectConnections.flatMap { it.characterIds }.distinct()
        val characterProjectMap: Map<Long, Long> =
            if (allCharacterIds.isEmpty()) {
                emptyMap()
            } else {
                characterRepository
                    .findAllById(allCharacterIds)
                    .filter { it.id != null }
                    .associate { requireNotNull(it.id) to it.projectId }
            }

        // 인물-프로젝트 무결성 검증 (불일치 → ValidationException → 400)
        integrityValidator.validate(request, characterProjectMap)

        // 현재 연결 상태
        val currentMemoProjects = memoProjectRepository.findAllByMemoId(memoId)
        val currentProjectIds = currentMemoProjects.map { it.projectId }.toSet()

        // 요청 상태
        val requestedProjectIds = request.projectConnections.map { it.projectId }.toSet()

        // remove: 요청에 없는 기존 연결 제거
        val toRemove = currentMemoProjects.filter { it.projectId !in requestedProjectIds }
        for (mp in toRemove) {
            memoProjectCharacterRepository.deleteAllByMemoProjectId(requireNotNull(mp.id))
            memoProjectRepository.delete(mp)
        }

        // add: 기존에 없는 신규 연결 추가
        val toAdd = request.projectConnections.filter { it.projectId !in currentProjectIds }
        for (connection in toAdd) {
            val newMp =
                memoProjectRepository.save(
                    MemoProject(memo = memo, projectId = connection.projectId),
                )
            for (characterId in connection.characterIds) {
                memoProjectCharacterRepository.save(
                    MemoProjectCharacter(memoProject = newMp, characterId = characterId),
                )
            }
        }

        // 기존 연결 중 남아있는 것의 characters diff (add/remove)
        val existingKept = currentMemoProjects.filter { it.projectId in requestedProjectIds }
        for (mp in existingKept) {
            val requestedConnection =
                request.projectConnections.find { it.projectId == mp.projectId }
                    ?: continue
            val currentChars = memoProjectCharacterRepository.findAllByMemoProjectId(requireNotNull(mp.id))
            val currentCharIds = currentChars.map { it.characterId }.toSet()
            val requestedCharIds = requestedConnection.characterIds.toSet()

            val charsToRemove = currentChars.filter { it.characterId !in requestedCharIds }
            for (mpc in charsToRemove) {
                memoProjectCharacterRepository.delete(mpc)
            }
            val charIdsToAdd = requestedCharIds - currentCharIds
            for (characterId in charIdsToAdd) {
                memoProjectCharacterRepository.save(
                    MemoProjectCharacter(memoProject = mp, characterId = characterId),
                )
            }
        }

        // Memo 필드 갱신
        memo.tags = request.tags
        memo.reasonNote = request.reasonNote
        memoRepository.save(memo)

        // 응답 구성 — 갱신된 연결을 DB 에서 재조회
        return buildResponse(memoId, userId)
    }

    private fun buildResponse(
        memoId: Long,
        userId: Long,
    ): MemoResponse {
        val memo =
            memoRepository.findByIdAndUserIdAndDeletedAtIsNull(memoId, userId)
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
                            MemoCharacterResponse(
                                characterId = mpc.characterId,
                                name = charName,
                            )
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
