package com.writenote.repository

import com.writenote.entity.ShareLink
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.Optional

interface ShareLinkRepository : JpaRepository<ShareLink, Long> {
    /** 공개 read — 토큰으로 역조회(활성 여부는 서비스에서 판정). */
    fun findByToken(token: String): ShareLink?

    /** revoke — 본인 소유 링크만(아니면 빈 Optional → 안내). */
    fun findByIdAndOwnerId(
        id: Long,
        ownerId: Long,
    ): Optional<ShareLink>

    /** 내 링크 목록 — 최근순. */
    fun findByOwnerIdOrderByCreatedAtDesc(ownerId: Long): List<ShareLink>

    /** 작품/시리즈당 공유 링크 개수(생성 제한용, 047) — 활성+비활성 총합. */
    fun countByOwnerIdAndTargetTypeAndTargetId(
        ownerId: Long,
        targetType: String,
        targetId: Long,
    ): Long

    /**
     * 대상 hard delete 시 그 대상의 활성 공유 링크를 비활성(보존, 046 R-5/FR-025).
     * 스냅샷·댓글은 삭제하지 않음(피드백 이력 유지) — 공개 read 만 비활성으로 차단.
     * 다형 targetId 라 DB FK cascade 불가 → ProjectService/CategoryService 삭제 경로에서 호출(보드 clearOwner 선례 동형).
     */
    @Modifying
    @Query(
        "UPDATE ShareLink l SET l.isActive = false " +
            "WHERE l.targetType = :targetType AND l.targetId = :targetId AND l.isActive = true",
    )
    fun deactivateByTarget(
        @Param("targetType") targetType: String,
        @Param("targetId") targetId: Long,
    ): Int
}
