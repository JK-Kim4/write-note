package com.writenote.repository

import com.writenote.entity.ShareSnapshot
import org.springframework.data.jpa.repository.JpaRepository

interface ShareSnapshotRepository : JpaRepository<ShareSnapshot, Long> {
    /** 링크의 공개 작품 목록(work=1, series=N). */
    fun findByShareLinkId(shareLinkId: Long): List<ShareSnapshot>

    /** 공개 read 단건 — 링크 + 작품 매칭 스냅샷. */
    fun findByShareLinkIdAndProjectId(
        shareLinkId: Long,
        projectId: Long,
    ): ShareSnapshot?

    /** 목록 일괄 조회(N+1 회피) — 여러 링크의 스냅샷을 한 번에. */
    fun findByShareLinkIdIn(shareLinkIds: Collection<Long>): List<ShareSnapshot>
}
