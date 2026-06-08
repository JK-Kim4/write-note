package com.writenote.repository

import com.writenote.entity.Character
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface CharacterRepository : JpaRepository<Character, Long> {
    fun findAllByProjectIdOrderByDisplayOrderAscCreatedAtAsc(
        projectId: Long,
        pageable: Pageable,
    ): Page<Character>

    fun findAllByProjectIdOrderByDisplayOrderAscCreatedAtAsc(projectId: Long): List<Character>

    fun findByIdAndProjectId(
        id: Long,
        projectId: Long,
    ): Optional<Character>
}
