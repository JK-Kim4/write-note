package com.writenote.service

import com.writenote.entity.Character
import com.writenote.error.ResourceNotFoundException
import com.writenote.mapper.CharacterMapper
import com.writenote.model.request.CreateCharacterRequest
import com.writenote.model.request.UpdateCharacterRequest
import com.writenote.model.response.CharacterResponse
import com.writenote.model.response.PageResponse
import com.writenote.repository.CharacterRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class CharacterService(
    private val characterRepository: CharacterRepository,
    private val projectService: ProjectService,
    private val characterMapper: CharacterMapper,
) {
    @Transactional(readOnly = true)
    fun listCharacters(
        userId: Long,
        projectId: Long,
        page: Int,
        size: Int,
    ): PageResponse<CharacterResponse> {
        projectService.requireOwnedProject(userId, projectId)
        require(page >= 0) { "page must be greater than or equal to 0" }
        require(size in 1..100) { "size must be between 1 and 100" }

        val pageable = PageRequest.of(page, size)
        val characters =
            characterRepository.findAllByProjectIdOrderByDisplayOrderAscCreatedAtAsc(projectId, pageable)
        return PageResponse.from(characters.map(characterMapper::toResponse))
    }

    @Transactional(readOnly = true)
    fun getCharacter(
        userId: Long,
        projectId: Long,
        characterId: Long,
    ): CharacterResponse {
        projectService.requireOwnedProject(userId, projectId)
        val character = requireOwnedCharacter(projectId, characterId)
        return characterMapper.toResponse(character)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun createCharacter(
        userId: Long,
        projectId: Long,
        request: CreateCharacterRequest,
    ): CharacterResponse {
        projectService.requireOwnedProject(userId, projectId)
        val character =
            characterRepository.save(
                Character(
                    projectId = projectId,
                    name = request.name.trim(),
                    shortDescription = request.shortDescription,
                    notes = request.notes,
                    displayOrder = request.displayOrder ?: 0,
                ),
            )
        return characterMapper.toResponse(character)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun updateCharacter(
        userId: Long,
        projectId: Long,
        characterId: Long,
        request: UpdateCharacterRequest,
    ): CharacterResponse {
        projectService.requireOwnedProject(userId, projectId)
        val character = requireOwnedCharacter(projectId, characterId)

        request.name?.let { character.name = it.trim() }
        request.shortDescription?.let { character.shortDescription = it }
        request.notes?.let { character.notes = it }
        request.displayOrder?.let { character.displayOrder = it }

        return characterMapper.toResponse(character)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun deleteCharacter(
        userId: Long,
        projectId: Long,
        characterId: Long,
    ) {
        projectService.requireOwnedProject(userId, projectId)
        val character = requireOwnedCharacter(projectId, characterId)
        characterRepository.delete(character)
    }

    private fun requireOwnedCharacter(
        projectId: Long,
        characterId: Long,
    ): Character =
        characterRepository
            .findByIdAndProjectId(characterId, projectId)
            .orElseThrow { ResourceNotFoundException("Character not found") }
}
