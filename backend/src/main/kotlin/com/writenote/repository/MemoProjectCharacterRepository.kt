package com.writenote.repository

import com.writenote.entity.MemoProjectCharacter
import org.springframework.data.jpa.repository.JpaRepository

interface MemoProjectCharacterRepository : JpaRepository<MemoProjectCharacter, Long> {
    fun findAllByMemoProjectId(memoProjectId: Long): List<MemoProjectCharacter>

    fun deleteAllByMemoProjectId(memoProjectId: Long)
}
