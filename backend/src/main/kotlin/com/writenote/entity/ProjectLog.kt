package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.PrePersist
import jakarta.persistence.Table
import java.time.Instant

/** 집필 기록(작품 로그) — desktop project_logs 이식. 작품 소유권 경유 격리. */
@Entity
@Table(name = "project_logs")
class ProjectLog(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "user_id", nullable = false)
    var userId: Long = 0,
    // 작품 삭제 시 ON DELETE SET NULL → 집필 기록은 user 단위로 보존(트랙2).
    @Column(name = "project_id")
    var projectId: Long? = null,
    @Column(nullable = false, columnDefinition = "TEXT")
    var body: String = "",
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
) {
    @PrePersist
    fun prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now()
        }
    }
}
