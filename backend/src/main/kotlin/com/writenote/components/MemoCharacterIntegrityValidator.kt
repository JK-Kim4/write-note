package com.writenote.components

import com.writenote.error.ValidationException
import com.writenote.model.request.CurateMemoRequest
import org.springframework.stereotype.Component

/**
 * 큐레이션 요청 내 인물-프로젝트 소속 무결성 검증 (FR-017).
 *
 * characterProjectMap: characterId → projectId 매핑 (CharacterRepository 에서 조회).
 * projectConnections 의 각 connection 에서 characterIds 가 해당 projectId 소속인지 검증.
 * 불일치 또는 존재하지 않는 characterId → ValidationException (400 VALIDATION_FAILED).
 */
@Component
class MemoCharacterIntegrityValidator {
    fun validate(
        request: CurateMemoRequest,
        characterProjectMap: Map<Long, Long>,
    ) {
        for (connection in request.projectConnections) {
            for (characterId in connection.characterIds) {
                val belongsToProject = characterProjectMap[characterId]
                if (belongsToProject == null || belongsToProject != connection.projectId) {
                    throw ValidationException(
                        "VALIDATION_FAILED: characterId=$characterId does not belong to projectId=${connection.projectId}",
                    )
                }
            }
        }
    }
}
