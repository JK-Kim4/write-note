package com.writenote.repository

import com.writenote.entity.Board
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.Optional

interface BoardRepository : JpaRepository<Board, Long> {
    fun findByIdAndUserId(
        id: Long,
        userId: Long,
    ): Optional<Board>

    /** 본인 보드 전량 — 최신 갱신순(전역 허브 GET /boards/mine). */
    fun findByUserIdOrderByUpdatedAtDesc(userId: Long): List<Board>

    /** 소속 대상 필터(본인) — 내부 탭(②) 대비. */
    fun findByUserIdAndOwnerTypeAndOwnerIdOrderByUpdatedAtDesc(
        userId: Long,
        ownerType: String,
        ownerId: Long,
    ): List<Board>

    /** 미소속(아이디어) 보드(본인). */
    fun findByUserIdAndOwnerTypeIsNullOrderByUpdatedAtDesc(userId: Long): List<Board>

    /**
     * 대상 hard delete 시 그 대상 소속 보드를 아이디어로 강등(owner null) — 보드 보존(041, FR-009).
     * 다형이라 DB FK cascade/SET NULL 불가 → ProjectService/CategoryService 삭제 경로에서 호출.
     */
    @Modifying
    @Query("UPDATE Board b SET b.ownerType = null, b.ownerId = null WHERE b.ownerType = :ownerType AND b.ownerId = :ownerId")
    fun clearOwner(
        @Param("ownerType") ownerType: String,
        @Param("ownerId") ownerId: Long,
    ): Int
}
