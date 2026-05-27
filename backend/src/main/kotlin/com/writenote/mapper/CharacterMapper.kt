package com.writenote.mapper

import com.writenote.entity.Character
import com.writenote.model.response.CharacterResponse
import org.springframework.stereotype.Component

@Component
class CharacterMapper {
    fun toResponse(character: Character): CharacterResponse =
        CharacterResponse(
            id = requireNotNull(character.id),
            projectId = character.projectId,
            name = character.name,
            shortDescription = character.shortDescription,
            notes = character.notes,
            displayOrder = character.displayOrder,
            createdAt = requireNotNull(character.createdAt),
            updatedAt = requireNotNull(character.updatedAt),
        )
}
