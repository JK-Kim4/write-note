package com.writenote.repository

import com.writenote.entity.MemoProject
import org.springframework.data.jpa.repository.JpaRepository

interface MemoProjectRepository : JpaRepository<MemoProject, Long> {
    fun findAllByMemoId(memoId: Long): List<MemoProject>
}
