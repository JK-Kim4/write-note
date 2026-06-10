package com.writenote.model.response

import java.time.Instant

/**
 * 작품 카드 집계 응답 (018) — `GET /api/projects/cards`.
 *
 * [ProjectResponse] 필드 + 카드 표시용 집계. 본문(body)은 미포함 — 마지막 문장 파생은 클라이언트가
 * 기존 document 조회로 수행한다(페이로드 비대 방지).
 */
data class ProjectCardResponse(
    val id: Long,
    val title: String,
    val genre: String?,
    val targetLength: Int?,
    val toneNotes: String?,
    val synopsis: String?,
    val worldNotes: String?,
    val nextScene: String,
    val archivedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
    /** 문서 글자수(document.word_count). */
    val wordCount: Int,
    /** 문서 저장 시각(document.updated_at) — "최근에 집필함" 기준. */
    val documentUpdatedAt: Instant,
    /** 누적 작업시간(ms) — 종료된 세션 합(진행 중 제외). 세션 없으면 0. */
    val totalDurationMs: Long,
) {
    companion object {
        fun from(
            base: ProjectResponse,
            wordCount: Int,
            documentUpdatedAt: Instant,
            totalDurationMs: Long,
        ): ProjectCardResponse =
            ProjectCardResponse(
                id = base.id,
                title = base.title,
                genre = base.genre,
                targetLength = base.targetLength,
                toneNotes = base.toneNotes,
                synopsis = base.synopsis,
                worldNotes = base.worldNotes,
                nextScene = base.nextScene,
                archivedAt = base.archivedAt,
                createdAt = base.createdAt,
                updatedAt = base.updatedAt,
                wordCount = wordCount,
                documentUpdatedAt = documentUpdatedAt,
                totalDurationMs = totalDurationMs,
            )
    }
}
