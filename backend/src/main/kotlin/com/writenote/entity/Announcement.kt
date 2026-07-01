package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.PrePersist
import jakarta.persistence.PreUpdate
import jakarta.persistence.Table
import java.time.Instant

/**
 * 공지사항 — 운영자가 작성하고 사용자에게 노출되는 안내 글.
 *
 * 어느 작품/유저에도 종속되지 않는 독립 테이블(FK 없음).
 * 공개 조회는 [isPublished] = true 만 노출. 홈 배너(GET /api/announcements/home)는
 * 고정([isPinned]) 슬롯 1건 + 최신 슬롯 1건 두 개로 구분 노출한다.
 */
@Entity
@Table(name = "announcements")
class Announcement(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(nullable = false, length = 200)
    var title: String = "",
    @Column(nullable = false, columnDefinition = "TEXT")
    var body: String = "",
    @Column(name = "is_published", nullable = false)
    var isPublished: Boolean = false,
    @Column(name = "is_pinned", nullable = false)
    var isPinned: Boolean = false,
    @Column(name = "published_at")
    var publishedAt: Instant? = null,
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null,
) {
    @PrePersist
    fun prePersist() {
        val now = Instant.now()
        if (createdAt == null) {
            createdAt = now
        }
        if (updatedAt == null) {
            updatedAt = now
        }
    }

    @PreUpdate
    fun preUpdate() {
        updatedAt = Instant.now()
    }
}
