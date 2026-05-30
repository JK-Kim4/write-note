package com.writenote.repository

import com.writenote.entity.Memo
import org.springframework.data.jpa.repository.JpaRepository

interface MemoRepository : JpaRepository<Memo, Long> {
    fun findByIdAndUserId(
        id: Long,
        userId: Long,
    ): Memo?
}
