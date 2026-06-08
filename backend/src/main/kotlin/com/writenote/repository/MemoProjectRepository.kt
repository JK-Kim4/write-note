package com.writenote.repository

import com.writenote.entity.MemoProject
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface MemoProjectRepository : JpaRepository<MemoProject, Long> {
    fun findAllByMemoId(memoId: Long): List<MemoProject>

    fun findByMemoIdAndProjectId(
        memoId: Long,
        projectId: Long,
    ): MemoProject?

    fun findAllByProjectIdAndPinnedIsTrue(projectId: Long): List<MemoProject>

    /** 작품 맥락 곁쪽지 목록 — memo JOIN FETCH, 고정 우선·최신순. */
    @Query(
        """
        SELECT mp FROM MemoProject mp
        JOIN FETCH mp.memo m
        WHERE mp.projectId = :projectId
        ORDER BY mp.pinned DESC, m.capturedAt DESC
        """,
    )
    fun findAllByProjectIdWithMemo(projectId: Long): List<MemoProject>
}
