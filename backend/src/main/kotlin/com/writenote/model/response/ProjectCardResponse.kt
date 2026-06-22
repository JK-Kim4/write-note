package com.writenote.model.response

import java.time.Instant

/**
 * 작품 카드 집계 응답 (018/022) — `GET /api/projects/cards`.
 *
 * [ProjectResponse] 필드 + 카드 표시용 집계. 마지막 문장 파생 원료([lastSentenceSource])는
 * 최근 수정 활성 챕터 body plainText — FE 별도 조회 없이 카드 단위로 동봉.
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
    /** 소속 모음 id. null = 미분류(032). FE 가 루트/모음으로 그룹핑. */
    val categoryId: Long?,
    /** 적용 판형(033 R2) — 시리즈값 or "A4" fallback. */
    val effectivePaperSize: String,
    /** 적용 출판방식(033 R2) — 시리즈값 or "paper" fallback. */
    val effectiveLayoutMode: String,
    /** 활성 챕터 word_count 합. */
    val wordCount: Int,
    /** 활성 챕터 중 최신 updated_at — "최근에 집필함" 기준. */
    val documentUpdatedAt: Instant,
    /** 누적 작업시간(ms) — 종료된 세션 합(진행 중 제외). 세션 없으면 0. */
    val totalDurationMs: Long,
    /**
     * 마지막 문장 파생 원료 — 최근 수정(max updatedAt) 활성 챕터 body 의 plainText.
     * FE 가 `lastSentence(lastSentenceSource)` 로 마지막 문장을 파생한다.
     * 챕터 없으면 빈 문자열.
     */
    val lastSentenceSource: String,
) {
    companion object {
        fun from(
            base: ProjectResponse,
            wordCount: Int,
            documentUpdatedAt: Instant,
            totalDurationMs: Long,
            lastSentenceSource: String,
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
                categoryId = base.categoryId,
                effectivePaperSize = base.effectivePaperSize,
                effectiveLayoutMode = base.effectiveLayoutMode,
                wordCount = wordCount,
                documentUpdatedAt = documentUpdatedAt,
                totalDurationMs = totalDurationMs,
                lastSentenceSource = lastSentenceSource,
            )
    }
}
