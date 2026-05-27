package com.writenote.components.characters

import com.writenote.entity.Character
import com.writenote.error.ValidationException
import com.writenote.model.request.ReorderCharactersRequest
import org.springframework.stereotype.Component

/**
 * Character reorder 요청 검증 (FR-016 / research R-4).
 *
 * 4 검증:
 * - 빈 배열 + 인물 0명 = no-op (Edge case — contracts/character-endpoints.md #24)
 * - 중복: 같은 ID 두 번 → ValidationException
 * - 누락: 전체 N명 중 일부만 전송 → ValidationException
 * - 외부 ID: 다른 projectId 의 인물 ID 포함 → ValidationException
 */
@Component
class CharacterReorderValidator {
    fun validate(
        request: ReorderCharactersRequest,
        existingCharacters: List<Character>,
    ) {
        val requestedIds = request.characterIds
        val existingIds = existingCharacters.mapNotNull { it.id }

        if (requestedIds.isEmpty() && existingIds.isEmpty()) return

        if (requestedIds.size != requestedIds.toSet().size) {
            throw ValidationException("Duplicate character ids in reorder request")
        }

        if (requestedIds.toSet() != existingIds.toSet()) {
            throw ValidationException("Reorder request must contain exactly the project's character ids")
        }
    }
}
