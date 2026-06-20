package com.writenote.components.documents

import com.writenote.entity.Document
import com.writenote.error.ValidationException
import com.writenote.model.request.ReorderDocumentsRequest
import org.springframework.stereotype.Component

/**
 * 챕터 reorder 요청 검증 (C3 — contracts/chapters-api.md).
 *
 * 4 검증:
 * - 빈 배열 + 챕터 0개 = no-op (Edge case)
 * - 중복: 같은 ID 두 번 → ValidationException
 * - 누락: 활성 챕터 전체 중 일부만 전송 → ValidationException
 * - 외부 ID: 다른 projectId 의 챕터 ID 포함 → ValidationException
 */
@Component
class ChapterReorderValidator {
    fun validate(
        request: ReorderDocumentsRequest,
        existingChapters: List<Document>,
    ) {
        val requestedIds = request.documentIds
        val existingIds = existingChapters.mapNotNull { it.id }

        if (requestedIds.isEmpty() && existingIds.isEmpty()) return

        if (requestedIds.size != requestedIds.toSet().size) {
            throw ValidationException("Duplicate document ids in reorder request")
        }

        if (requestedIds.toSet() != existingIds.toSet()) {
            throw ValidationException("Reorder request must contain exactly the project's active chapter ids")
        }
    }
}
